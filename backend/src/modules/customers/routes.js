import { db, tenantTable } from '../../db/mysql.js';
import { conflict, notFound } from '../../lib/errors.js';
import { customerSchema, parse } from '../../lib/validation.js';
import { serializeCustomer } from '../../lib/serializers.js';

function toRow(input) {
  const row = {};
  if (input.name !== undefined) row.name = input.name;
  if (input.doc !== undefined) row.doc = input.doc;
  if (input.phone !== undefined) row.phone = input.phone;
  if (input.email !== undefined) row.email = input.email;
  if (input.address !== undefined) row.address = input.address;
  if (input.notes !== undefined) row.notes = input.notes;
  if (input.active !== undefined) row.active = input.active;
  return row;
}

export default async function customerRoutes(fastify) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', async (request) => {
    const q = String(request.query.q ?? '').trim();
    const query = tenantTable('customers', request.tenantId).orderBy('name', 'asc').limit(500);
    if (q) {
      query.where((builder) => {
        builder
          .whereRaw('LOWER(customers.name) LIKE ?', [`%${q.toLowerCase()}%`])
          .orWhereRaw('customers.doc LIKE ?', [`%${q}%`])
          .orWhereRaw('customers.phone LIKE ?', [`%${q}%`]);
      });
    }
    if (request.query.active === 'true') query.where('active', true);
    const rows = await query;
    return { data: rows.map(serializeCustomer) };
  });

  fastify.get('/:id', async (request) => {
    const row = await tenantTable('customers', request.tenantId)
      .where('id', request.params.id)
      .first();
    if (!row) throw notFound('Cliente no encontrado');
    return { data: serializeCustomer(row) };
  });

  fastify.post('/', async (request, reply) => {
    const input = parse(customerSchema, request.body);
    const [id] = await db('customers').insert({
      tenant_id: request.tenantId,
      ...toRow(input),
    });
    const row = await tenantTable('customers', request.tenantId).where('id', id).first();
    return reply.code(201).send({ data: serializeCustomer(row) });
  });

  fastify.patch('/:id', async (request) => {
    const input = parse(customerSchema.partial(), request.body);
    const exists = await tenantTable('customers', request.tenantId)
      .where('id', request.params.id)
      .first();
    if (!exists) throw notFound('Cliente no encontrado');

    await tenantTable('customers', request.tenantId)
      .where('id', request.params.id)
      .update({ ...toRow(input), updated_at: db.fn.now() });

    const row = await tenantTable('customers', request.tenantId)
      .where('id', request.params.id)
      .first();
    return { data: serializeCustomer(row) };
  });

  fastify.delete('/:id', async (request) => {
    const id = request.params.id;
    const [sales, reservations, pets] = await Promise.all([
      tenantTable('sales', request.tenantId).where('customer_id', id).count({ c: '*' }).first(),
      tenantTable('reservations', request.tenantId).where('customer_id', id).count({ c: '*' }).first(),
      tenantTable('pets', request.tenantId).where('customer_id', id).count({ c: '*' }).first(),
    ]);

    if (Number(sales?.c) + Number(reservations?.c) + Number(pets?.c) > 0) {
      throw conflict('El cliente tiene historial asociado. Puedes desactivarlo en su lugar.');
    }

    await tenantTable('customers', request.tenantId).where('id', id).delete();
    return { data: { ok: true } };
  });
}
