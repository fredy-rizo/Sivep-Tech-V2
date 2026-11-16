import { db, tenantTable } from '../../db/mysql.js';
import { notFound, unprocessable } from '../../lib/errors.js';
import {
  appointmentSchema,
  bookingSettingsSchema,
  groomingSchema,
  parse,
  petSchema,
} from '../../lib/validation.js';
import { Tenant } from '../../models/Tenant.js';
import {
  ensureBooking,
  minutesFromTime,
  normalizeServices,
  serializeBooking,
} from '../../lib/booking.js';

function serializePet(row) {
  return {
    id: Number(row.id),
    customerId: row.customer_id ? Number(row.customer_id) : null,
    customerName: row.customer_name ?? null,
    customerPhone: row.customer_phone ?? null,
    name: row.name,
    species: row.species,
    breed: row.breed,
    birthdate: row.birthdate,
    weight: row.weight === null ? null : Number(row.weight),
    notes: row.notes,
    active: Boolean(row.active),
    createdAt: row.created_at,
  };
}

function serializeAppointment(row) {
  return {
    id: Number(row.id),
    petId: Number(row.pet_id),
    petName: row.pet_name ?? null,
    species: row.species ?? null,
    customerId: row.customer_id ? Number(row.customer_id) : null,
    customerName: row.customer_name ?? null,
    customerPhone: row.customer_phone ?? null,
    scheduledAt: row.scheduled_at,
    reason: row.reason,
    vetName: row.vet_name,
    status: row.status,
    source: row.source ?? 'internal',
    durationMinutes: Number(row.duration_minutes ?? 30),
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export default async function vetRoutes(fastify) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', fastify.requireVertical('veterinaria'));

  // ------------------------------------------------------------- mascotas
  fastify.get('/pets', async (request) => {
    const q = String(request.query.q ?? '').trim();
    const query = db('pets as p')
      .leftJoin('customers as c', 'c.id', 'p.customer_id')
      .where('p.tenant_id', request.tenantId)
      .select('p.*', 'c.name as customer_name', 'c.phone as customer_phone')
      .orderBy('p.name', 'asc')
      .limit(400);

    if (q) {
      query.where((builder) => {
        builder
          .whereRaw('LOWER(p.name) LIKE ?', [`%${q.toLowerCase()}%`])
          .orWhereRaw('LOWER(c.name) LIKE ?', [`%${q.toLowerCase()}%`]);
      });
    }
    if (request.query.active === 'true') query.where('p.active', true);

    const rows = await query;
    return { data: rows.map(serializePet) };
  });

  fastify.get('/pets/:id', async (request) => {
    const row = await db('pets as p')
      .leftJoin('customers as c', 'c.id', 'p.customer_id')
      .where('p.tenant_id', request.tenantId)
      .where('p.id', request.params.id)
      .select('p.*', 'c.name as customer_name', 'c.phone as customer_phone')
      .first();
    if (!row) throw notFound('Paciente no encontrado');

    const appointments = await db('appointments')
      .where({ tenant_id: request.tenantId, pet_id: row.id })
      .orderBy('scheduled_at', 'desc');

    return {
      data: {
        ...serializePet(row),
        appointments: appointments.map(serializeAppointment),
      },
    };
  });

  fastify.post('/pets', async (request, reply) => {
    const input = parse(petSchema, request.body);
    if (input.customerId) {
      const customer = await tenantTable('customers', request.tenantId)
        .where('id', input.customerId)
        .first();
      if (!customer) throw unprocessable('El tutor seleccionado no existe');
    }

    const [id] = await db('pets').insert({
      tenant_id: request.tenantId,
      customer_id: input.customerId ?? null,
      name: input.name,
      species: input.species,
      breed: input.breed,
      birthdate: input.birthdate,
      weight: input.weight,
      notes: input.notes,
      active: input.active ?? true,
    });

    const row = await db('pets as p')
      .leftJoin('customers as c', 'c.id', 'p.customer_id')
      .where('p.tenant_id', request.tenantId)
      .where('p.id', id)
      .select('p.*', 'c.name as customer_name', 'c.phone as customer_phone')
      .first();
    return reply.code(201).send({ data: serializePet(row) });
  });

  fastify.patch('/pets/:id', async (request) => {
    const input = parse(petSchema.partial(), request.body);
    const exists = await tenantTable('pets', request.tenantId)
      .where('id', request.params.id)
      .first();
    if (!exists) throw notFound('Paciente no encontrado');

    const row = {};
    if (input.customerId !== undefined) row.customer_id = input.customerId;
    if (input.name !== undefined) row.name = input.name;
    if (input.species !== undefined) row.species = input.species;
    if (input.breed !== undefined) row.breed = input.breed;
    if (input.birthdate !== undefined) row.birthdate = input.birthdate;
    if (input.weight !== undefined) row.weight = input.weight;
    if (input.notes !== undefined) row.notes = input.notes;
    if (input.active !== undefined) row.active = input.active;

    await tenantTable('pets', request.tenantId)
      .where('id', request.params.id)
      .update({ ...row, updated_at: db.fn.now() });

    const updated = await db('pets as p')
      .leftJoin('customers as c', 'c.id', 'p.customer_id')
      .where('p.tenant_id', request.tenantId)
      .where('p.id', request.params.id)
      .select('p.*', 'c.name as customer_name', 'c.phone as customer_phone')
      .first();
    return { data: serializePet(updated) };
  });

  fastify.delete('/pets/:id', async (request) => {
    const appointments = await tenantTable('appointments', request.tenantId)
      .where('pet_id', request.params.id)
      .count({ c: '*' })
      .first();
    if (Number(appointments?.c) > 0) {
      await tenantTable('pets', request.tenantId)
        .where('id', request.params.id)
        .update({ active: false });
      return {
        data: { ok: true, deactivated: true, message: 'El paciente tiene historial: se desactivó.' },
      };
    }
    await tenantTable('pets', request.tenantId).where('id', request.params.id).delete();
    return { data: { ok: true } };
  });

  // -------------------------------------------------------------- agenda
  fastify.get('/appointments', async (request) => {
    const query = db('appointments as a')
      .leftJoin('pets as p', 'p.id', 'a.pet_id')
      .leftJoin('customers as c', 'c.id', 'a.customer_id')
      .where('a.tenant_id', request.tenantId)
      .select(
        'a.*',
        'p.name as pet_name',
        'p.species as species',
        'c.name as customer_name',
        'c.phone as customer_phone',
      )
      .orderBy('a.scheduled_at', 'asc')
      .limit(400);

    if (request.query.date) query.whereRaw('DATE(a.scheduled_at) = ?', [request.query.date]);
    if (request.query.status) query.where('a.status', request.query.status);
    if (request.query.source) query.where('a.source', request.query.source);
    if (request.query.today === 'true') query.whereRaw('DATE(a.scheduled_at) = CURDATE()');

    const rows = await query;
    return { data: rows.map(serializeAppointment) };
  });

  fastify.post('/appointments', async (request, reply) => {
    const input = parse(appointmentSchema, request.body);
    const pet = await tenantTable('pets', request.tenantId)
      .where('id', input.petId)
      .first();
    if (!pet) throw unprocessable('El paciente seleccionado no existe');

    const [id] = await db('appointments').insert({
      tenant_id: request.tenantId,
      pet_id: input.petId,
      customer_id: input.customerId ?? pet.customer_id ?? null,
      scheduled_at: new Date(input.scheduledAt),
      reason: input.reason,
      vet_name: input.vetName,
      status: input.status ?? 'scheduled',
      notes: input.notes,
    });

    const row = await db('appointments as a')
      .leftJoin('pets as p', 'p.id', 'a.pet_id')
      .leftJoin('customers as c', 'c.id', 'a.customer_id')
      .where('a.tenant_id', request.tenantId)
      .where('a.id', id)
      .select('a.*', 'p.name as pet_name', 'p.species as species', 'c.name as customer_name', 'c.phone as customer_phone')
      .first();
    return reply.code(201).send({ data: serializeAppointment(row) });
  });

  fastify.patch('/appointments/:id', async (request) => {
    const input = parse(appointmentSchema.partial(), request.body);
    const exists = await tenantTable('appointments', request.tenantId)
      .where('id', request.params.id)
      .first();
    if (!exists) throw notFound('Cita no encontrada');

    const row = {};
    if (input.petId !== undefined) row.pet_id = input.petId;
    if (input.customerId !== undefined) row.customer_id = input.customerId;
    if (input.scheduledAt !== undefined) row.scheduled_at = new Date(input.scheduledAt);
    if (input.reason !== undefined) row.reason = input.reason;
    if (input.vetName !== undefined) row.vet_name = input.vetName;
    if (input.status !== undefined) row.status = input.status;
    if (input.notes !== undefined) row.notes = input.notes;

    await tenantTable('appointments', request.tenantId)
      .where('id', request.params.id)
      .update({ ...row, updated_at: db.fn.now() });

    const updated = await db('appointments as a')
      .leftJoin('pets as p', 'p.id', 'a.pet_id')
      .leftJoin('customers as c', 'c.id', 'a.customer_id')
      .where('a.tenant_id', request.tenantId)
      .where('a.id', request.params.id)
      .select('a.*', 'p.name as pet_name', 'p.species as species', 'c.name as customer_name', 'c.phone as customer_phone')
      .first();
    return { data: serializeAppointment(updated) };
  });

  fastify.delete('/appointments/:id', async (request) => {
    await tenantTable('appointments', request.tenantId)
      .where('id', request.params.id)
      .delete();
    return { data: { ok: true } };
  });

  // -------------------------------------------------- reservas en línea
  fastify.get(
    '/booking-settings',
    { preHandler: [fastify.requireRole('owner', 'admin')] },
    async (request) => {
      const tenant = await ensureBooking(request.tenant);
      const [pending] = await db('appointments')
        .where({ tenant_id: request.tenantId, source: 'public', status: 'scheduled' })
        .count({ c: '*' });
      return {
        data: {
          booking: serializeBooking(tenant),
          pending: Number(pending?.c ?? 0),
        },
      };
    },
  );

  fastify.patch(
    '/booking-settings',
    { preHandler: [fastify.requireRole('owner', 'admin')] },
    async (request) => {
      const input = parse(bookingSettingsSchema, request.body);
      const tenant = await Tenant.findById(request.tenantId);
      await ensureBooking(tenant);

      const current = tenant.booking.toObject?.() ?? tenant.booking;
      const next = { ...current };
      if (input.enabled !== undefined) next.enabled = input.enabled;
      if (input.openTime !== undefined) next.openTime = input.openTime;
      if (input.closeTime !== undefined) next.closeTime = input.closeTime;
      if (input.slotMinutes !== undefined) next.slotMinutes = input.slotMinutes;
      if (input.daysAhead !== undefined) next.daysAhead = input.daysAhead;
      if (input.intro !== undefined) next.intro = input.intro;
      if (input.services !== undefined) next.services = normalizeServices(input.services);

      const open = minutesFromTime(next.openTime);
      const close = minutesFromTime(next.closeTime);
      if (open === null || close === null || close <= open) {
        throw unprocessable('La hora de cierre debe ser posterior a la de apertura');
      }

      tenant.booking = next;
      await tenant.save();
      return { data: { booking: serializeBooking(tenant) } };
    },
  );

  fastify.get('/customers', async (request) => {
    const rows = await tenantTable('customers', request.tenantId)
      .where('active', true)
      .orderBy('name', 'asc')
      .limit(300);
    return {
      data: rows.map((row) => ({
        id: Number(row.id),
        name: row.name,
        phone: row.phone,
      })),
    };
  });

  fastify.get('/grooming', async (request) => {
    const rows = await tenantTable('grooming_sessions', request.tenantId)
      .orderBy('scheduled_at', 'desc');
    return { data: rows };
  });

  fastify.post('/grooming', { preHandler: [fastify.requireRole('owner', 'admin')] }, async (request, reply) => {
    try {
      const input = parse(groomingSchema, request.body);
      const result = await tenantTable('grooming_sessions', request.tenantId).insert({
        tenant_id: request.tenantId,
        pet_id: input.petId,
        customer_id: input.customerId ?? null,
        service: input.service,
        reason: input.reason ?? null,
        scheduled_at: new Date(input.scheduledAt),
        vet_name: input.vetName ?? null,
        status: input.status ?? 'scheduled',
        notes: input.notes ?? null,
      });
      return { data: result };
    } catch (err) {
      console.error('ERROR grooming:', err);
      throw err;
    }
  });

  fastify.patch('/grooming/:id', { preHandler: [fastify.requireRole('owner', 'admin')] }, async (request, reply) => {
    const input = parse(groomingSchema.partial(), request.body);
    const updated = await tenantTable('grooming_sessions', request.tenantId)
      .where('id', request.params.id)
      .update({
        service: input.service,
        reason: input.reason ?? null,
        scheduled_at: input.scheduledAt ? new Date(input.scheduledAt) : null,
        vet_name: input.vetName ?? null,
        status: input.status,
        notes: input.notes ?? null,
      });
    return { data: updated };
  });

  fastify.delete('/grooming/:id', async (request) => {
    await tenantTable('grooming_sessions', request.tenantId)
      .where('id', request.params.id)
      .delete();
    return { data: { ok: true } };
  });
}
