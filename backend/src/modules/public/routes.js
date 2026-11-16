import bcrypt from 'bcryptjs';
import { Tenant } from '../../models/Tenant.js';
import { User } from '../../models/User.js';
import { db } from '../../db/mysql.js';
import { conflict, notFound, unprocessable, AppError } from '../../lib/errors.js';
import {
  parse,
  publicBookingSchema,
  registerSchema,
  contactIdeaSchema,
} from '../../lib/validation.js';
import { isMailEnabled, sendContactIdea } from '../../lib/mailer.js';
import { serializeTenant, serializeTenantPublic, serializeUser } from '../../lib/serializers.js';
import { seedStarterData } from '../../lib/starter.js';
import { VERTICAL_CATALOG } from '../../lib/verticals.js';
import {
  bookingDateToTimestamp,
  buildAvailability,
  ensureBooking,
  findBookingTenant,
  serializeBooking,
} from '../../lib/booking.js';

const RESERVED_SLUGS = new Set([
  'app',
  'api',
  'admin',
  'www',
  'login',
  'registro',
  'sivep',
  'soporte',
  'ayuda',
]);

export default async function publicRoutes(fastify) {
  fastify.get('/verticals', async () => ({
    data: Object.values(VERTICAL_CATALOG).map(({ slug, name, short, tagline }) => ({
      slug,
      name,
      short,
      tagline,
    })),
  }));

  // ------------------------------------------------- ideas de sistema (landing)
  fastify.post(
    '/ideas',
    { config: { rateLimit: { max: 5, timeWindow: '10 minutes' } } },
    async (request) => {
      const input = parse(contactIdeaSchema, request.body);

      if (!isMailEnabled()) {
        request.log.warn(
          { idea: input },
          'SMTP sin configurar: la idea no se envió por correo',
        );
        throw new AppError(
          503,
          'MAIL_NOT_CONFIGURED',
          'El envío por correo aún no está habilitado. Escríbenos directo a siveptech@gmail.com.',
        );
      }

      await sendContactIdea(input);
      return { data: { received: true } };
    },
  );

  fastify.get('/tenants/:slug', async (request) => {
    const slug = String(request.params.slug).toLowerCase();
    const tenant = await Tenant.findOne({ slug, status: 'active' }).lean();
    if (!tenant) throw notFound('No encontramos una empresa con ese identificador');
    return { data: serializeTenantPublic(tenant) };
  });

  // ------------------------------------------------- reservas públicas (vet)
  fastify.get('/booking/:token', async (request) => {
    const tenant = await findBookingTenant(request.params.token);
    return {
      data: {
        business: serializeTenantPublic(tenant),
        booking: serializeBooking(tenant),
      },
    };
  });

  fastify.get('/booking/:token/availability', async (request) => {
    const tenant = await findBookingTenant(request.params.token);
    const date = String(request.query.date ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw unprocessable('Selecciona una fecha válida');
    }
    const serviceId = String(request.query.service ?? '');
    if (!serviceId) throw unprocessable('Selecciona un servicio');

    const availability = await buildAvailability(tenant, date, serviceId);
    return { data: availability };
  });

  fastify.post(
    '/booking/:token',
    { config: { rateLimit: { max: 12, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const input = parse(publicBookingSchema, request.body);
      const tenant = await findBookingTenant(request.params.token);
      const tenantId = String(tenant._id);

      const availability = await buildAvailability(tenant, input.date, input.serviceId);
      const slot = availability.slots.find((item) => item.time === input.time);
      if (!slot?.available) {
        throw conflict('Ese horario acaba de ocuparse. Elige otro, por favor.');
      }

      const service = availability.service;
      const scheduledAt = bookingDateToTimestamp(input.date, input.time);
      if (Number.isNaN(scheduledAt.getTime())) throw unprocessable('La fecha no es válida');

      const created = await db.transaction(async (trx) => {
        const booked = await trx('appointments')
          .where({ tenant_id: tenantId })
          .whereNot('status', 'cancelled')
          .whereRaw('DATE(scheduled_at) = ?', [input.date])
          .forUpdate()
          .select('scheduled_at', 'duration_minutes');

        const startMinute = Number(input.time.slice(0, 2)) * 60 + Number(input.time.slice(3, 5));
        const endMinute = startMinute + service.duration;
        const clash = booked.some((row) => {
          const start = new Date(row.scheduled_at);
          const rowStart = start.getHours() * 60 + start.getMinutes();
          const rowEnd = rowStart + Number(row.duration_minutes ?? service.duration);
          return startMinute < rowEnd && endMinute > rowStart;
        });
        if (clash) {
          throw conflict('Ese horario acaba de ocuparse. Elige otro, por favor.');
        }

        const groomingBooked = await trx('grooming_sessions')
          .where({ tenant_id: tenantId })
          .whereNot('status', 'cancelled')
          .whereRaw('DATE(scheduled_at) = ?', [input.date])
          .forUpdate()
          .select('scheduled_at');
        const groomingClash = groomingBooked.some((row) => {
          const start = new Date(row.scheduled_at);
          const rowStart = start.getHours() * 60 + start.getMinutes();
          return startMinute < rowStart + 60 && endMinute > rowStart;
        });
        if (groomingClash) {
          throw conflict('Ese horario acaba de ocuparse. Elige otro, por favor.');
        }

        const phone = input.phone.trim();
        let customer = await trx('customers')
          .where({ tenant_id: tenantId, phone })
          .first();
        if (!customer) {
          const [customerId] = await trx('customers').insert({
            tenant_id: tenantId,
            name: input.tutorName,
            phone,
            email: input.email ?? null,
            active: true,
          });
          customer = { id: customerId, name: input.tutorName };
        } else if (input.email && !customer.email) {
          await trx('customers')
            .where({ tenant_id: tenantId, id: customer.id })
            .update({ email: input.email, updated_at: trx.fn.now() });
        }

        const petName = input.petName.trim();
        let pet = await trx('pets')
          .where({ tenant_id: tenantId, customer_id: customer.id })
          .whereRaw('LOWER(name) = ?', [petName.toLowerCase()])
          .first();
        if (!pet) {
          const [petId] = await trx('pets').insert({
            tenant_id: tenantId,
            customer_id: customer.id,
            name: petName,
            species: input.species || 'No especificada',
            active: true,
          });
          pet = { id: petId };
        }

        const noteParts = ['Reserva en línea'];
        if (input.email) noteParts.push(`Correo: ${input.email}`);
        if (input.notes) noteParts.push(input.notes);

        const [appointmentId] = await trx('appointments').insert({
          tenant_id: tenantId,
          pet_id: pet.id,
          customer_id: customer.id,
          scheduled_at: scheduledAt,
          reason: service.name,
          status: 'scheduled',
          source: 'public',
          duration_minutes: service.duration,
          notes: noteParts.join(' · '),
        });

        if (/ba[ñn]o|peluquer|est[eé]tica/i.test(service.name)) {
          await trx('grooming_sessions').insert({
            tenant_id: tenantId,
            pet_id: pet.id,
            customer_id: customer.id,
            service: service.name,
            reason: 'Reserva en línea',
            scheduled_at: scheduledAt,
            status: 'scheduled',
            notes: input.notes ?? null,
          });
        }

        return {
          appointmentId,
          reference: `R-${String(appointmentId).padStart(5, '0')}`,
        };
      });

      return reply.code(201).send({
        data: {
          ok: true,
          reference: created.reference,
          date: input.date,
          time: input.time,
          scheduledAt,
          service: { name: service.name, duration: service.duration, price: service.price },
          petName: input.petName,
          tutorName: input.tutorName,
          phone: input.phone,
          business: {
            name: tenant.name,
            phone: tenant.contact?.phone ?? '',
            address: tenant.contact?.address ?? '',
            city: tenant.contact?.city ?? '',
          },
        },
      });
    },
  );

  fastify.post(
    '/register',
    {
      config: { rateLimit: { max: 8, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const input = parse(registerSchema, request.body);
      if (RESERVED_SLUGS.has(input.slug)) {
        throw conflict('Ese identificador está reservado, elige otro');
      }

      const existing = await Tenant.findOne({ slug: input.slug }).lean();
      if (existing) throw conflict('Ese identificador ya está en uso');

      const tenant = await Tenant.create({
        slug: input.slug,
        name: input.businessName,
        vertical: input.vertical,
        plan: 'esencial',
        status: 'active',
        branding: {
          tagline: VERTICAL_CATALOG[input.vertical]?.tagline ?? '',
        },
        contact: {
          email: input.email,
          phone: input.phone ?? '',
        },
        settings: {
          currency: input.vertical === 'hotel' ? 'COP' : 'COP',
          locale: 'es-CO',
          timezone: 'America/Bogota',
          taxRate: input.vertical === 'hotel' ? 0 : 0.19,
          receiptPrefix: VERTICAL_CATALOG[input.vertical]?.receiptPrefix ?? '',
        },
      });

      const passwordHash = await bcrypt.hash(input.password, 10);
      const user = await User.create({
        tenantId: tenant._id,
        name: input.ownerName,
        email: input.email,
        passwordHash,
        role: 'owner',
        active: true,
        lastLoginAt: new Date(),
      });

      try {
        await seedStarterData(tenant);
      } catch (error) {
        fastify.log.error({ err: error, tenant: tenant.slug }, 'No se pudieron crear datos iniciales');
      }

      if (tenant.vertical === 'veterinaria') {
        try {
          await ensureBooking(tenant);
        } catch (error) {
          fastify.log.error({ err: error, tenant: tenant.slug }, 'No se pudo crear el enlace de reservas');
        }
      }

      const token = fastify.jwt.sign({
        sub: String(user._id),
        tenantId: String(tenant._id),
        tenantSlug: tenant.slug,
        role: user.role,
        name: user.name,
      });

      return reply.code(201).send({
        data: {
          token,
          user: serializeUser(user),
          tenant: serializeTenant(tenant),
        },
      });
    },
  );
}
