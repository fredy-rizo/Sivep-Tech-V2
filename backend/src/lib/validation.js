import { z } from 'zod';
import { unprocessable } from './errors.js';

/** Valida con Zod y lanza un 422 con detalle por campo. */
export function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || '_',
      message: issue.message,
    }));
    throw unprocessable('Revisa los datos enviados', details);
  }
  return result.data;
}

const optionalText = (max) =>
  z
    .union([z.string().trim().max(max), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' || v === null ? null : v));

const money = z.coerce.number().min(0).max(999999999);
const quantity = z.coerce.number().min(0).max(99999999);

export const loginSchema = z.object({
  tenantSlug: z.string().trim().min(2).max(60).toLowerCase(),
  email: z.string().trim().email().max(160).toLowerCase(),
  password: z.string().min(6).max(120),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(6).max(120),
  newPassword: z.string().min(8).max(120),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
});

export const customerSchema = z.object({
  name: z.string().trim().min(2).max(160),
  doc: optionalText(40),
  phone: optionalText(40),
  email: z
    .union([z.string().trim().email().max(120), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' || v === null ? null : v)),
  address: optionalText(240),
  notes: optionalText(1000),
  active: z.boolean().optional(),
});

export const productSchema = z.object({
  name: z.string().trim().min(2).max(180),
  sku: optionalText(60),
  category: optionalText(80),
  unit: z.string().trim().max(24).optional(),
  price: money,
  cost: money.optional(),
  stock: quantity.optional(),
  minStock: quantity.optional(),
  trackStock: z.boolean().optional(),
  active: z.boolean().optional(),
  attributes: z.record(z.any()).optional().nullable(),
});

export const batchSchema = z.object({
  lot: optionalText(80),
  expiresAt: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' || v === null ? null : v)),
  quantity: z.coerce.number().min(0),
  cost: money.optional(),
});

export const groomingSchema = z.object({
  petId: z.coerce.number().int().positive(),
  customerId: z.coerce.number().int().positive().nullable().optional(),
  service: z.string().trim().min(2).max(120),
  reason: z.string().trim().min(2).max(180).optional(),
  scheduledAt: z.string().min(10).max(30),
  vetName: optionalText(120),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).default('scheduled'),
  notes: optionalText(1000),
});

export const saleSchema = z.object({
  customerId: z.coerce.number().int().positive().nullable().optional(),
  paymentMethod: z.enum(['cash', 'card', 'transfer', 'other']).default('cash'),
  notes: optionalText(500),
  items: z
    .array(
      z.object({
        productId: z.coerce.number().int().positive(),
        quantity: z.coerce.number().positive().max(99999),
      }),
    )
    .min(1, 'Agrega al menos un producto'),
});

export const roomSchema = z.object({
  number: z.string().trim().min(1).max(20),
  type: z.string().trim().min(2).max(80),
  capacity: z.coerce.number().int().min(1).max(50),
  rate: money,
  floor: optionalText(20),
  status: z.enum(['available', 'occupied', 'cleaning', 'maintenance']).optional(),
  notes: optionalText(1000),
});

export const reservationSchema = z.object({
  roomId: z.coerce.number().int().positive(),
  customerId: z.coerce.number().int().positive().nullable().optional(),
  guestName: z.string().trim().min(2).max(160),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD'),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD'),
  guests: z.coerce.number().int().min(1).max(50).optional(),
  total: money.optional(),
  status: z
    .enum(['confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'])
    .optional(),
  notes: optionalText(1000),
});

export const petSchema = z.object({
  customerId: z.coerce.number().int().positive().nullable().optional(),
  name: z.string().trim().min(2).max(120),
  species: z.string().trim().min(2).max(60),
  breed: optionalText(80),
  birthdate: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' || v === null ? null : v)),
  weight: z
    .union([z.coerce.number().min(0).max(2000), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' || v === null ? null : v)),
  notes: optionalText(1000),
  active: z.boolean().optional(),
});

export const appointmentSchema = z.object({
  petId: z.coerce.number().int().positive(),
  customerId: z.coerce.number().int().positive().nullable().optional(),
  scheduledAt: z.string().min(10).max(30),
  reason: z.string().trim().min(2).max(180),
  vetName: optionalText(120),
  status: z
    .enum(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'])
    .optional(),
  notes: optionalText(1000),
});

const timeHHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Usa el formato HH:mm');

const bookingServiceSchema = z.object({
  id: z.string().trim().max(40).optional(),
  name: z.string().trim().min(2).max(80),
  duration: z.coerce.number().int().min(15).max(240),
  price: z.coerce.number().min(0).max(999999999).optional(),
});

export const bookingSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  services: z.array(bookingServiceSchema).min(1, 'Agrega al menos un servicio').max(20).optional(),
  openTime: timeHHMM.optional(),
  closeTime: timeHHMM.optional(),
  slotMinutes: z.coerce.number().int().min(15).max(120).optional(),
  daysAhead: z.coerce.number().int().min(1).max(120).optional(),
  intro: optionalText(240),
});

export const publicBookingSchema = z.object({
  serviceId: z.string().trim().min(1).max(40),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD'),
  time: timeHHMM,
  tutorName: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(6).max(40),
  petName: z.string().trim().min(1).max(120),
  species: optionalText(60),
  email: z
    .union([z.string().trim().email().max(120), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' || v === null ? null : v)),
  notes: optionalText(500),
});

export const userCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160).toLowerCase(),
  password: z.string().min(8).max(120),
  role: z.enum(['owner', 'admin', 'staff']).default('staff'),
  active: z.boolean().optional(),
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  role: z.enum(['owner', 'admin', 'staff']).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).max(120).optional(),
});

export const registerSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Usa solo minúsculas, números y guiones'),
  vertical: z.enum(['hotel', 'farmacia', 'veterinaria', 'tienda']),
  ownerName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160).toLowerCase(),
  password: z.string().min(8).max(120),
  phone: optionalText(40),
});

export const tenantUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  branding: z
    .object({
      tagline: optionalText(140),
      primary: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    })
    .optional(),
  contact: z
    .object({
      email: optionalText(120),
      phone: optionalText(40),
      address: optionalText(240),
      city: optionalText(80),
    })
    .optional(),
  settings: z
    .object({
      currency: z.string().trim().length(3).optional(),
      locale: z.string().trim().max(10).optional(),
      timezone: z.string().trim().max(60).optional(),
      taxRate: z.coerce.number().min(0).max(0.5).optional(),
      receiptPrefix: optionalText(6),
      thankYouNote: optionalText(200),
    })
    .optional(),
});

export const contactIdeaSchema = z.object({
  name: z.string().trim().min(2, 'Cuéntanos tu nombre').max(120),
  business: optionalText(160),
  email: z.string().trim().email('Escribe un correo válido').max(160),
  phone: optionalText(40),
  businessType: optionalText(60),
  message: z
    .string()
    .trim()
    .min(20, 'Cuéntanos un poco más sobre tu idea (mínimo 20 caracteres)')
    .max(2000),
});
