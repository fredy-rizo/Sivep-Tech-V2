import { randomBytes } from 'node:crypto';
import { Tenant } from '../models/Tenant.js';
import { db } from '../db/mysql.js';
import { notFound, unprocessable } from './errors.js';

/** Servicios con los que arranca una veterinaria. El negocio puede editarlos. */
export const DEFAULT_BOOKING_SERVICES = [
  { id: 'consulta-general', name: 'Consulta general', duration: 30, price: 65000 },
  { id: 'vacunacion', name: 'Vacunación', duration: 30, price: 48000 },
  { id: 'bano-peluqueria', name: 'Baño y peluquería', duration: 60, price: 55000 },
  { id: 'desparasitacion', name: 'Desparasitación', duration: 30, price: 22000 },
  { id: 'control-seguimiento', name: 'Control y seguimiento', duration: 30, price: 0 },
];

const HOURS = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function minutesFromTime(value) {
  const match = HOURS.exec(String(value ?? ''));
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function timeFromMinutes(total) {
  const normalized = ((Math.round(total) % 1440) + 1440) % 1440;
  const hours = String(Math.floor(normalized / 60)).padStart(2, '0');
  const minutes = String(normalized % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function localDateISO(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(dateISO, days) {
  const [year, month, day] = String(dateISO).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return localDateISO(date);
}

function randomToken() {
  return randomBytes(6).toString('hex');
}

function slugifyService(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * Garantiza que la empresa tenga token y configuración de reservas.
 * Es idempotente: solo escribe la primera vez.
 */
export async function ensureBooking(tenant) {
  if (!tenant || tenant.vertical !== 'veterinaria') return tenant;

  let dirty = false;
  if (!tenant.booking) {
    tenant.booking = {};
    dirty = true;
  }

  if (!tenant.booking.token) {
    let token = randomToken();
    // La probabilidad de choque es mínima, pero se comprueba igual.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const exists = await Tenant.exists({ 'booking.token': token });
      if (!exists) break;
      token = randomToken();
    }
    tenant.booking.token = token;
    dirty = true;
  }

  if (!tenant.booking.services?.length) {
    tenant.booking.services = DEFAULT_BOOKING_SERVICES;
    dirty = true;
  }

  if (dirty) await tenant.save();
  return tenant;
}

export function serializeBooking(tenant) {
  const booking = tenant?.booking ?? {};
  return {
    token: booking.token ?? null,
    enabled: booking.enabled !== false,
    services: (booking.services ?? []).map((service) => ({
      id: service.id,
      name: service.name,
      duration: Number(service.duration ?? 30),
      price: Number(service.price ?? 0),
    })),
    openTime: booking.openTime ?? '08:00',
    closeTime: booking.closeTime ?? '18:00',
    slotMinutes: Number(booking.slotMinutes ?? 30),
    daysAhead: Number(booking.daysAhead ?? 30),
    intro: booking.intro ?? '',
  };
}

/** Normaliza los servicios editados por el negocio y evita ids repetidos. */
export function normalizeServices(services = []) {
  const used = new Set();
  return services.map((service, index) => {
    let id = service.id || slugifyService(service.name) || `servicio-${index + 1}`;
    let suffix = 2;
    while (used.has(id)) {
      id = `${slugifyService(service.name) || 'servicio'}-${suffix}`;
      suffix += 1;
    }
    used.add(id);
    return {
      id,
      name: String(service.name).trim(),
      duration: Number(service.duration ?? 30),
      price: Number(service.price ?? 0),
    };
  });
}

export async function findBookingTenant(token) {
  const value = String(token ?? '').trim();
  if (!value) throw notFound('Enlace de reservas no válido');

  const tenant = await Tenant.findOne({
    'booking.token': value,
    status: 'active',
    vertical: 'veterinaria',
  });
  if (!tenant) throw notFound('Enlace de reservas no válido o inactivo');

  await ensureBooking(tenant);
  return tenant;
}

function overlaps(start, end, blocks) {
  return blocks.some((block) => start < block.end && end > block.start);
}

/**
 * Devuelve la disponibilidad de una fecha cruzando citas y sesiones de
 * peluquería ya registradas para la empresa.
 */
export async function buildAvailability(tenant, dateISO, serviceId) {
  const booking = serializeBooking(tenant);
  if (!booking.enabled) {
    throw unprocessable('Las reservas en línea están desactivadas');
  }

  const service = booking.services.find((item) => item.id === serviceId);
  if (!service) throw unprocessable('El servicio seleccionado no existe');

  const today = localDateISO();
  const maxDate = addDays(today, booking.daysAhead);
  if (dateISO < today) throw unprocessable('La fecha ya pasó');
  if (dateISO > maxDate) {
    throw unprocessable(`Solo puedes reservar hasta ${booking.daysAhead} días adelante`);
  }

  const open = minutesFromTime(booking.openTime);
  const close = minutesFromTime(booking.closeTime);
  if (open === null || close === null || close <= open) {
    throw unprocessable('El horario de atención no está configurado correctamente');
  }

  const [appointments, grooming] = await Promise.all([
    db('appointments')
      .where({ tenant_id: String(tenant._id) })
      .whereNot('status', 'cancelled')
      .whereRaw('DATE(scheduled_at) = ?', [dateISO])
      .select('scheduled_at', 'duration_minutes'),
    db('grooming_sessions')
      .where({ tenant_id: String(tenant._id) })
      .whereNot('status', 'cancelled')
      .whereRaw('DATE(scheduled_at) = ?', [dateISO])
      .select('scheduled_at'),
  ]);

  const blocks = [];
  for (const row of appointments) {
    const start = new Date(row.scheduled_at);
    const startMin = start.getHours() * 60 + start.getMinutes();
    const duration = Number(row.duration_minutes ?? booking.slotMinutes) || booking.slotMinutes;
    blocks.push({ start: startMin, end: startMin + duration });
  }
  for (const row of grooming) {
    const start = new Date(row.scheduled_at);
    const startMin = start.getHours() * 60 + start.getMinutes();
    blocks.push({ start: startMin, end: startMin + 60 });
  }

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const slots = [];

  for (let start = open; start + service.duration <= close; start += booking.slotMinutes) {
    const end = start + service.duration;
    const past = dateISO === today && start <= nowMinutes + 15;
    slots.push({
      time: timeFromMinutes(start),
      available: !past && !overlaps(start, end, blocks),
    });
  }

  return { date: dateISO, minDate: today, maxDate, service, slots };
}

export function bookingDateToTimestamp(dateISO, time) {
  return new Date(`${dateISO}T${time}:00`);
}
