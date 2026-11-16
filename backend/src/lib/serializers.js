export function serializeTenant(tenant) {
  if (!tenant) return null;
  const plain = typeof tenant.toObject === 'function' ? tenant.toObject() : tenant;
  return {
    id: String(plain._id ?? plain.id),
    slug: plain.slug,
    name: plain.name,
    vertical: plain.vertical,
    plan: plain.plan,
    status: plain.status,
    branding: plain.branding ?? {},
    contact: plain.contact ?? {},
    settings: plain.settings ?? {},
    booking:
      plain.vertical === 'veterinaria'
        ? {
            token: plain.booking?.token ?? null,
            enabled: plain.booking?.enabled !== false,
          }
        : undefined,
    createdAt: plain.createdAt,
  };
}

export function serializeTenantPublic(tenant) {
  const serialized = serializeTenant(tenant);
  if (!serialized) return null;
  return {
    slug: serialized.slug,
    name: serialized.name,
    vertical: serialized.vertical,
    branding: serialized.branding,
    contact: serialized.contact,
  };
}

export function serializeUser(user) {
  if (!user) return null;
  const plain = typeof user.toObject === 'function' ? user.toObject() : user;
  return {
    id: String(plain._id ?? plain.id),
    name: plain.name,
    email: plain.email,
    role: plain.role,
    active: plain.active,
    lastLoginAt: plain.lastLoginAt ?? null,
    createdAt: plain.createdAt,
  };
}

export function serializeCustomer(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    name: row.name,
    doc: row.doc,
    phone: row.phone,
    email: row.email,
    address: row.address,
    notes: row.notes,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeProduct(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    sku: row.sku,
    name: row.name,
    category: row.category,
    unit: row.unit,
    price: Number(row.price),
    cost: Number(row.cost),
    stock: Number(row.stock),
    minStock: Number(row.min_stock),
    trackStock: Boolean(row.track_stock),
    active: Boolean(row.active),
    attributes: row.attributes ?? null,
    lowStock: Boolean(row.track_stock) && Number(row.stock) <= Number(row.min_stock),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
