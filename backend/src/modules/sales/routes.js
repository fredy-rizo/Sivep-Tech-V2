import { db, num, roundMoney, tenantTable } from '../../db/mysql.js';
import { notFound, unprocessable } from '../../lib/errors.js';
import { parse, saleSchema } from '../../lib/validation.js';
import { receiptPrefixFor } from '../../lib/starter.js';

const PAYMENT_LABELS = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  other: 'Otro',
};

function serializeSale(row) {
  if (!row) return null;
  const returnedQuantity = Number(row.returned_quantity ?? 0);
  const soldQuantity =
    row.sold_quantity === undefined || row.sold_quantity === null
      ? null
      : Number(row.sold_quantity);
  let returnStatus = 'none';
  if (returnedQuantity > 0) {
    returnStatus = soldQuantity !== null && returnedQuantity >= soldQuantity ? 'full' : 'partial';
  }
  return {
    id: Number(row.id),
    number: row.number,
    customerId: row.customer_id ? Number(row.customer_id) : null,
    customerName: row.customer_name ?? null,
    userName: row.user_name,
    subtotal: Number(row.subtotal),
    tax: Number(row.tax),
    total: Number(row.total),
    paymentMethod: row.payment_method,
    paymentLabel: PAYMENT_LABELS[row.payment_method] ?? row.payment_method,
    status: row.status,
    notes: row.notes,
    returnedQuantity,
    soldQuantity,
    returnStatus,
    createdAt: row.created_at,
  };
}

const SOLD_SUBQUERY =
  '(select coalesce(sum(si.quantity), 0) from sale_items si where si.sale_id = s.id and si.tenant_id = s.tenant_id)';
const RETURNED_SUBQUERY =
  '(select coalesce(sum(sr.quantity), 0) from sales_returns sr where sr.sale_id = s.id and sr.tenant_id = s.tenant_id)';

export default async function saleRoutes(fastify) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', async (request) => {
    const limit = Math.min(Number(request.query.limit) || 50, 200);
    const query = db('sales as s')
      .leftJoin('customers as c', 'c.id', 's.customer_id')
      .where('s.tenant_id', request.tenantId)
      .select(
        's.*',
        'c.name as customer_name',
        db.raw(`${SOLD_SUBQUERY} as sold_quantity`),
        db.raw(`${RETURNED_SUBQUERY} as returned_quantity`),
      )
      .orderBy('s.created_at', 'desc')
      .limit(limit);

    if (request.query.from) query.where('s.created_at', '>=', `${request.query.from} 00:00:00`);
    if (request.query.to) query.where('s.created_at', '<=', `${request.query.to} 23:59:59`);
    if (request.query.status) query.where('s.status', request.query.status);

    const rows = await query;
    return { data: rows.map(serializeSale) };
  });

  fastify.get('/:id', async (request) => {
    const row = await db('sales as s')
      .leftJoin('customers as c', 'c.id', 's.customer_id')
      .where('s.tenant_id', request.tenantId)
      .where('s.id', request.params.id)
      .select(
        's.*',
        'c.name as customer_name',
        db.raw(`${SOLD_SUBQUERY} as sold_quantity`),
        db.raw(`${RETURNED_SUBQUERY} as returned_quantity`),
      )
      .first();
    if (!row) throw notFound('Venta no encontrada');

    const [items, returns] = await Promise.all([
      tenantTable('sale_items', request.tenantId)
        .where('sale_id', row.id)
        .orderBy('id', 'asc'),
      tenantTable('sales_returns', request.tenantId)
        .where('sale_id', row.id)
        .orderBy('id', 'asc'),
    ]);

    const returnedByProduct = new Map();
    for (const entry of returns) {
      const key = Number(entry.product_id);
      returnedByProduct.set(key, (returnedByProduct.get(key) ?? 0) + Number(entry.quantity));
    }

    return {
      data: {
        ...serializeSale(row),
        items: items.map((item) => {
          const productId = item.product_id ? Number(item.product_id) : null;
          const returned = productId ? (returnedByProduct.get(productId) ?? 0) : 0;
          return {
            id: Number(item.id),
            productId,
            description: item.description,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unit_price),
            total: Number(item.total),
            returnedQuantity: returned,
            remainingQuantity: Math.max(0, Number(item.quantity) - returned),
          };
        }),
        returns: returns.map((entry) => ({
          id: Number(entry.id),
          productId: entry.product_id ? Number(entry.product_id) : null,
          quantity: Number(entry.quantity),
          reason: entry.reason,
          returnedAt: entry.returned_at,
        })),
      },
    };
  });

  fastify.post('/', async (request, reply) => {
    const input = parse(saleSchema, request.body);

    const consolidated = new Map();
    for (const item of input.items) {
      consolidated.set(item.productId, (consolidated.get(item.productId) ?? 0) + item.quantity);
    }
    const productIds = [...consolidated.keys()];

    const sale = await db.transaction(async (trx) => {
      const products = await trx('products')
        .where({ tenant_id: request.tenantId })
        .whereIn('id', productIds)
        .forUpdate();

      if (products.length !== productIds.length) {
        throw unprocessable('Uno de los productos ya no está disponible');
      }

      for (const product of products) {
        if (!product.active) {
          throw unprocessable(`El producto "${product.name}" está inactivo`);
        }
        const requested = consolidated.get(Number(product.id));
        if (product.track_stock && Number(product.stock) < requested) {
          throw unprocessable(
            `Stock insuficiente de "${product.name}". Disponible: ${Number(product.stock)}`,
          );
        }
      }

      if (input.customerId) {
        const customer = await trx('customers')
          .where({ tenant_id: request.tenantId, id: input.customerId })
          .first();
        if (!customer) throw unprocessable('El cliente seleccionado no existe');
      }

      const rows = products.map((product) => {
        const quantity = consolidated.get(Number(product.id));
        return {
          product,
          quantity,
          total: roundMoney(quantity * Number(product.price)),
        };
      });

      const subtotal = roundMoney(rows.reduce((sum, row) => sum + row.total, 0));
      const taxRate = Number(request.tenant.settings?.taxRate ?? 0);
      const tax = roundMoney(subtotal * taxRate);
      const total = roundMoney(subtotal + tax);

      const year = new Date().getFullYear();
      const [{ c: count }] = await trx('sales')
        .where('tenant_id', request.tenantId)
        .count({ c: '*' });
      const prefix = receiptPrefixFor(request.tenant);
      const number = `${prefix}-${year}-${String(Number(count) + 1).padStart(4, '0')}`;

      const [saleId] = await trx('sales').insert({
        tenant_id: request.tenantId,
        number,
        customer_id: input.customerId ?? null,
        user_id: request.user.sub,
        user_name: request.user.name,
        subtotal,
        tax,
        total,
        payment_method: input.paymentMethod,
        status: 'paid',
        notes: input.notes,
      });

      await trx('sale_items').insert(
        rows.map((row) => ({
          tenant_id: request.tenantId,
          sale_id: saleId,
          product_id: row.product.id,
          description: row.product.name,
          quantity: row.quantity,
          unit_price: row.product.price,
          total: row.total,
        })),
      );

      for (const row of rows) {
        if (row.product.track_stock) {
          await trx('products')
            .where({ tenant_id: request.tenantId, id: row.product.id })
            .decrement('stock', row.quantity);
        }
      }

      return saleId;
    });

    const row = await db('sales as s')
      .leftJoin('customers as c', 'c.id', 's.customer_id')
      .where('s.tenant_id', request.tenantId)
      .where('s.id', sale)
      .select('s.*', 'c.name as customer_name')
      .first();

    return reply.code(201).send({ data: serializeSale(row) });
  });

  fastify.post(
    '/returns',
    { preHandler: [fastify.authenticate, fastify.requireRole('owner', 'admin')] },
    async (request, reply) => {
      const saleId = Number(request.body?.saleId);
      const productId = Number(request.body?.productId);
      const quantity = Number(request.body?.quantity);
      const reason = request.body?.reason ?? null;

      if (!Number.isInteger(saleId) || saleId <= 0) {
        throw unprocessable('La venta indicada no es válida');
      }
      if (!Number.isInteger(productId) || productId <= 0) {
        throw unprocessable('El producto indicado no es válido');
      }
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw unprocessable('La cantidad a devolver debe ser mayor que cero');
      }

      const result = await db.transaction(async (trx) => {
        const sale = await trx('sales')
          .where({ tenant_id: request.tenantId, id: saleId })
          .first();
        if (!sale) throw notFound('Venta no encontrada');

        const item = await trx('sale_items')
          .where({ tenant_id: request.tenantId, sale_id: saleId, product_id: productId })
          .first();
        if (!item) throw unprocessable('El producto no pertenece a esta venta');

        const previous = await trx('sales_returns')
          .where({ tenant_id: request.tenantId, sale_id: saleId, product_id: productId })
          .sum('quantity as total')
          .first();
        const alreadyReturned = Number(previous?.total ?? 0);
        const available = Number(item.quantity) - alreadyReturned;

        if (quantity > available) {
          throw unprocessable(
            available <= 0
              ? 'Ese producto ya fue devuelto por completo'
              : `Solo quedan ${available} unidades por devolver de este producto`,
          );
        }

        await trx('sales_returns').insert({
          tenant_id: request.tenantId,
          sale_id: saleId,
          product_id: productId,
          quantity,
          reason,
          returned_at: trx.fn.now(),
          employee_id: request.user?.sub ?? null,
        });

        const product = await trx('products')
          .where({ tenant_id: request.tenantId, id: productId })
          .first();

        if (product?.track_stock) {
          await trx('products')
            .where({ tenant_id: request.tenantId, id: productId })
            .increment('stock', quantity);
        }

        const updated = await trx('products')
          .where({ tenant_id: request.tenantId, id: productId })
          .first();

        return {
          saleId,
          productId,
          quantity,
          returnedTotal: alreadyReturned + quantity,
          remaining: available - quantity,
          newStock: Number(updated?.stock ?? 0),
        };
      });

      return { data: { ok: true, ...result } };
    },
  );
}
