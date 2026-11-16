import mongoose from 'mongoose';

const brandingSchema = new mongoose.Schema(
  {
    tagline: { type: String, default: '' },
    primary: { type: String, default: '#8B1E3F' },
    accent: { type: String, default: '#5B8C4E' },
  },
  { _id: false },
);

const contactSchema = new mongoose.Schema(
  {
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    city: { type: String, default: '' },
  },
  { _id: false },
);

const settingsSchema = new mongoose.Schema(
  {
    currency: { type: String, default: 'COP' },
    locale: { type: String, default: 'es-CO' },
    timezone: { type: String, default: 'America/Bogota' },
    taxRate: { type: Number, default: 0.19, min: 0, max: 0.5 },
    receiptPrefix: { type: String, default: '' },
    thankYouNote: { type: String, default: '' },
  },
  { _id: false },
);

const bookingServiceSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    duration: { type: Number, default: 30, min: 15, max: 240 },
    price: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const bookingSchema = new mongoose.Schema(
  {
    token: { type: String, unique: true, sparse: true, index: true },
    enabled: { type: Boolean, default: true },
    services: { type: [bookingServiceSchema], default: [] },
    openTime: { type: String, default: '08:00' },
    closeTime: { type: String, default: '18:00' },
    slotMinutes: { type: Number, default: 30 },
    daysAhead: { type: Number, default: 30 },
    intro: { type: String, default: '' },
  },
  { _id: false },
);

const tenantSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },
    name: { type: String, required: true, trim: true },
    vertical: {
      type: String,
      required: true,
      enum: ['hotel', 'farmacia', 'veterinaria', 'tienda'],
      index: true,
    },
    plan: { type: String, enum: ['esencial', 'profesional'], default: 'esencial' },
    status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
    branding: { type: brandingSchema, default: () => ({}) },
    contact: { type: contactSchema, default: () => ({}) },
    settings: { type: settingsSchema, default: () => ({}) },
    booking: { type: bookingSchema, default: () => ({}) },
  },
  { timestamps: true },
);

tenantSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
});

export const Tenant = mongoose.model('Tenant', tenantSchema);
