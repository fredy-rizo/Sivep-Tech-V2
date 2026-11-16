import { db, num, tenantTable } from '../../db/mysql.js';

function serializeSale(row) {
  return {
    id: Number(row.id),
    number: row.number,
    customerName: row.customer_name ?? null,
    total: Number(row.total),
    paymentMethod: row.payment_method,
    status: row.status,
    createdAt: row.created_at,
  };
}

function lastSevenDays(rows) {
  const map = new Map(rows.map((row) => [row.day, Number(row.total)]));
  const series = [];
  const today = new Date();
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;
    series.push({ date: key, total: map.get(key) ?? 0 });
  }
  return series;
}

export default async function dashboardRoutes(fastify) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', async (request) => {
    const tenantId = request.tenantId;
    const vertical = request.tenant.vertical;

    const [
      revenueTodayRow,
      revenueMonthRow,
      salesTodayRow,
      salesMonthRow,
      customersRow,
      productsRow,
      lowStockRow,
      lastSalesRows,
      seriesRows,
    ] = await Promise.all([
      tenantTable('sales', tenantId)
        .where('status', 'paid')
        .whereRaw('DATE(created_at) = CURDATE()')
        .sum({ total: 'total' })
        .first(),
      tenantTable('sales', tenantId)
        .where('status', 'paid')
        .whereRaw('YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())')
        .sum({ total: 'total' })
        .first(),
      tenantTable('sales', tenantId)
        .whereRaw('DATE(created_at) = CURDATE()')
        .count({ c: '*' })
        .first(),
      tenantTable('sales', tenantId)
        .whereRaw('YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())')
        .count({ c: '*' })
        .first(),
      tenantTable('customers', tenantId).where('active', true).count({ c: '*' }).first(),
      tenantTable('products', tenantId).where('active', true).count({ c: '*' }).first(),
      tenantTable('products', tenantId)
        .where({ active: true, track_stock: true })
        .whereRaw('stock <= min_stock')
        .count({ c: '*' })
        .first(),
      db('sales as s')
        .leftJoin('customers as c', 'c.id', 's.customer_id')
        .where('s.tenant_id', tenantId)
        .select('s.*', 'c.name as customer_name')
        .orderBy('s.created_at', 'desc')
        .limit(6),
      tenantTable('sales', tenantId)
        .where('status', 'paid')
        .whereRaw('created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)')
        .select(db.raw("DATE_FORMAT(created_at, '%Y-%m-%d') as day"))
        .sum({ total: 'total' })
        .groupByRaw("DATE_FORMAT(created_at, '%Y-%m-%d')"),
    ]);

    const summary = {
      revenueToday: num(revenueTodayRow?.total),
      revenueMonth: num(revenueMonthRow?.total),
      salesToday: num(salesTodayRow?.c),
      salesMonth: num(salesMonthRow?.c),
      customers: num(customersRow?.c),
      products: num(productsRow?.c),
      lowStock: num(lowStockRow?.c),
      currency: request.tenant.settings?.currency ?? 'COP',
      series: lastSevenDays(seriesRows),
      recentSales: lastSalesRows.map(serializeSale),
      vertical: {},
    };

    if (vertical === 'hotel') {
      const [rooms, available, occupied, arrivals, departures, upcoming] = await Promise.all([
        tenantTable('rooms', tenantId).count({ c: '*' }).first(),
        tenantTable('rooms', tenantId).where('status', 'available').count({ c: '*' }).first(),
        tenantTable('rooms', tenantId).where('status', 'occupied').count({ c: '*' }).first(),
        tenantTable('reservations', tenantId)
          .whereRaw('check_in = CURDATE()')
          .whereIn('status', ['confirmed', 'checked_in'])
          .count({ c: '*' })
          .first(),
        tenantTable('reservations', tenantId)
          .whereRaw('check_out = CURDATE()')
          .whereIn('status', ['checked_in', 'confirmed'])
          .count({ c: '*' })
          .first(),
        tenantTable('reservations', tenantId)
          .whereNotIn('status', ['checked_out', 'cancelled', 'no_show'])
          .whereRaw('check_out >= CURDATE()')
          .count({ c: '*' })
          .first(),
      ]);
      summary.vertical = {
        rooms: num(rooms?.c),
        available: num(available?.c),
        occupied: num(occupied?.c),
        arrivalsToday: num(arrivals?.c),
        departuresToday: num(departures?.c),
        upcoming: num(upcoming?.c),
        occupancy: num(rooms?.c) ? Math.round((num(occupied?.c) / num(rooms?.c)) * 100) : 0,
      };
    }

    if (vertical === 'farmacia') {
      const [expiring, expired, batches] = await Promise.all([
        db('product_batches')
          .where({ tenant_id: tenantId })
          .where('quantity', '>', 0)
          .whereRaw('expires_at BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)')
          .count({ c: '*' })
          .first(),
        db('product_batches')
          .where({ tenant_id: tenantId })
          .where('quantity', '>', 0)
          .whereRaw('expires_at < CURDATE()')
          .count({ c: '*' })
          .first(),
        db('product_batches')
          .where({ tenant_id: tenantId })
          .where('quantity', '>', 0)
          .count({ c: '*' })
          .first(),
      ]);
      summary.vertical = {
        expiringSoon: num(expiring?.c),
        expired: num(expired?.c),
        batches: num(batches?.c),
      };
    }

    if (vertical === 'veterinaria') {
      const [pets, appointmentsToday, pending, completedMonth] = await Promise.all([
        tenantTable('pets', tenantId).where('active', true).count({ c: '*' }).first(),
        tenantTable('appointments', tenantId)
          .whereRaw('DATE(scheduled_at) = CURDATE()')
          .count({ c: '*' })
          .first(),
        tenantTable('appointments', tenantId)
          .whereIn('status', ['scheduled', 'confirmed'])
          .whereRaw('scheduled_at >= NOW()')
          .count({ c: '*' })
          .first(),
        tenantTable('appointments', tenantId)
          .where('status', 'completed')
          .whereRaw('YEAR(scheduled_at) = YEAR(CURDATE()) AND MONTH(scheduled_at) = MONTH(CURDATE())')
          .count({ c: '*' })
          .first(),
      ]);
      summary.vertical = {
        pets: num(pets?.c),
        appointmentsToday: num(appointmentsToday?.c),
        pending: num(pending?.c),
        completedMonth: num(completedMonth?.c),
      };
    }

    if (vertical === 'tienda') {
      const [stockUnits, categories] = await Promise.all([
        tenantTable('products', tenantId)
          .where('active', true)
          .sum({ total: 'stock' })
          .first(),
        tenantTable('products', tenantId)
          .where('active', true)
          .countDistinct({ c: 'category' })
          .first(),
      ]);
      summary.vertical = {
        stockUnits: num(stockUnits?.total),
        categories: num(categories?.c),
      };
    }

    return { data: summary };
  });
}
