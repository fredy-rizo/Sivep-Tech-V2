import { db, tenantTable } from '../../db/mysql.js';
import { conflict, notFound } from '../../lib/errors.js';
import { batchSchema, parse, productSchema } from '../../lib/validation.js';
import { serializeProduct } from '../../lib/serializers.js';

function toRow(input) {
  const row = {};
  if (input.name !== undefined) row.name = input.name;
  if (input.sku !== undefined) row.sku = input.sku;
  if (input.category !== undefined) row.category = input.category;
  if (input.unit !== undefined) row.unit = input.unit;
  if (input.price !== undefined) row.price = input.price;
  if (input.cost !== undefined) row.cost = input.cost;
  if (input.stock !== undefined) row.stock = input.stock;
  if (input.minStock !== undefined) row.min_stock = input.minStock;
  if (input.trackStock !== undefined) row.track_stock = input.trackStock;
  if (input.active !== undefined) row.active = input.active;
  if (input.attributes !== undefined) row.attributes = input.attributes;
  return row;
}

export default async function productRoutes(fastify) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', async (request) => {
    const q = String(request.query.q ?? '').trim();
    const query = tenantTable('products', request.tenantId)
      .orderBy('name', 'asc')
      .limit(500);

    if (q) {
      query.where((builder) => {
        builder
          .whereRaw('LOWER(products.name) LIKE ?', [`%${q.toLowerCase()}%`])
          .orWhereRaw('LOWER(products.sku) LIKE ?', [`%${q.toLowerCase()}%`])
          .orWhereRaw('LOWER(products.category) LIKE ?', [`%${q.toLowerCase()}%`]);
      });
    }
    if (request.query.active === 'true') query.where('active', true);
    if (request.query.lowStock === 'true') {
      query.where('track_stock', true).whereRaw('stock <= min_stock');
    }

    const rows = await query;
    return { data: rows.map(serializeProduct) };
  });

  fastify.post('/', async (request, reply) => {
    const input = parse(productSchema, request.body);
    const [id] = await db('products').insert({
      tenant_id: request.tenantId,
      ...toRow({ unit: 'unidad', cost: 0, stock: 0, minStock: 0, trackStock: true, ...input }),
    });
    const row = await tenantTable('products', request.tenantId).where('id', id).first();
    return reply.code(201).send({ data: serializeProduct(row) });
  });

  fastify.patch('/:id', async (request) => {
    const input = parse(productSchema.partial(), request.body);
    const exists = await tenantTable('products', request.tenantId)
      .where('id', request.params.id)
      .first();
    if (!exists) throw notFound('Producto no encontrado');

    await tenantTable('products', request.tenantId)
      .where('id', request.params.id)
      .update({ ...toRow(input), updated_at: db.fn.now() });

    const row = await tenantTable('products', request.tenantId)
      .where('id', request.params.id)
      .first();
    return { data: serializeProduct(row) };
  });

  fastify.delete('/:id', async (request) => {
    const id = request.params.id;
    const used = await tenantTable('sale_items', request.tenantId)
      .where('product_id', id)
      .count({ c: '*' })
      .first();

    if (Number(used?.c) > 0) {
      await tenantTable('products', request.tenantId).where('id', id).update({ active: false });
      return {
        data: { ok: true, deactivated: true, message: 'El producto tiene ventas: se desactivó.' },
      };
    }

    await tenantTable('product_batches', request.tenantId).where('product_id', id).delete();
    await tenantTable('products', request.tenantId).where('id', id).delete();
    return { data: { ok: true } };
  });

  // ------------------------------------------------------------- lotes
  fastify.get('/:id/batches', async (request) => {
    const rows = await tenantTable('product_batches', request.tenantId)
      .where('product_id', request.params.id)
      .orderBy('expires_at', 'asc');

    return {
      data: rows.map((row) => ({
        id: Number(row.id),
        productId: Number(row.product_id),
        lot: row.lot,
        expiresAt: row.expires_at,
        quantity: Number(row.quantity),
        cost: Number(row.cost),
        createdAt: row.created_at,
      })),
    };
  });

  fastify.post('/:id/batches', async (request, reply) => {
    const product = await tenantTable('products', request.tenantId)
      .where('id', request.params.id)
      .first();
    if (!product) throw notFound('Producto no encontrado');

    const input = parse(batchSchema, request.body);
    const [id] = await db('product_batches').insert({
      tenant_id: request.tenantId,
      product_id: product.id,
      lot: input.lot,
      expires_at: input.expiresAt,
      quantity: input.quantity,
      cost: input.cost ?? product.cost,
    });

    const row = await tenantTable('product_batches', request.tenantId).where('id', id).first();
    return reply.code(201).send({
      data: {
        id: Number(row.id),
        productId: Number(row.product_id),
        lot: row.lot,
        expiresAt: row.expires_at,
        quantity: Number(row.quantity),
        cost: Number(row.cost),
      },
    });
  });

  fastify.delete('/:id/batches/:batchId', async (request) => {
    await tenantTable('product_batches', request.tenantId)
      .where({ id: request.params.batchId, product_id: request.params.id })
      .delete();
    return { data: { ok: true } };
  });
}
