import { db } from '../../db/mysql.js';

function serializeBatch(row) {
  return {
    id: Number(row.id),
    productId: Number(row.product_id),
    productName: row.product_name,
    category: row.category,
    lot: row.lot,
    expiresAt: row.expires_at,
    quantity: Number(row.quantity),
    cost: Number(row.cost),
    unit: row.unit,
    daysToExpire: row.days_to_expire === null ? null : Number(row.days_to_expire),
  };
}

export default async function pharmacyRoutes(fastify) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', fastify.requireVertical('farmacia'));

  fastify.get('/batch-list', async (request) => {
    const days = Math.max(0, Math.min(Number(request.query.days) || 90, 365));
    const query = db('product_batches as b')
      .join('products as p', 'p.id', 'b.product_id')
      .where('b.tenant_id', request.tenantId)
      .where('b.quantity', '>', 0)
      .select(
        'b.*',
        'p.name as product_name',
        'p.category',
        'p.unit',
        db.raw('DATEDIFF(b.expires_at, CURDATE()) as days_to_expire'),
      )
      .orderBy('b.expires_at', 'asc');

    if (request.query.expiring === 'true') {
      query.whereRaw('b.expires_at <= DATE_ADD(CURDATE(), INTERVAL ? DAY)', [days]);
    }
    if (request.query.q) {
      query.whereRaw('LOWER(p.name) LIKE ?', [`%${String(request.query.q).toLowerCase()}%`]);
    }

    const rows = await query.limit(400);
    return { data: rows.map(serializeBatch) };
  });

  fastify.get('/alerts', async (request) => {
    const [expiring, lowStock, expired] = await Promise.all([
      db('product_batches as b')
        .join('products as p', 'p.id', 'b.product_id')
        .where('b.tenant_id', request.tenantId)
        .where('b.quantity', '>', 0)
        .whereRaw('b.expires_at BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)')
        .count({ c: '*' })
        .first(),
      db('products')
        .where({ tenant_id: request.tenantId, active: true, track_stock: true })
        .whereRaw('stock <= min_stock')
        .count({ c: '*' })
        .first(),
      db('product_batches')
        .where({ tenant_id: request.tenantId })
        .where('quantity', '>', 0)
        .whereRaw('expires_at < CURDATE()')
        .count({ c: '*' })
        .first(),
    ]);

    return {
      data: {
        expiringSoon: Number(expiring?.c ?? 0),
        lowStock: Number(lowStock?.c ?? 0),
        expired: Number(expired?.c ?? 0),
      },
    };
  });
}
