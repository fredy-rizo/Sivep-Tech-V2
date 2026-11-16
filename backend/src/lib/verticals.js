export const VERTICAL_CATALOG = {
  hotel: {
    slug: 'hotel',
    name: 'Hoteles',
    short: 'Hotel',
    tagline: 'Habitaciones, tarifas y reservas en una sola recepción.',
    modules: ['habitaciones', 'reservas', 'ventas', 'productos', 'clientes'],
    receiptPrefix: 'H',
  },
  farmacia: {
    slug: 'farmacia',
    name: 'Farmacia',
    short: 'Farmacia',
    tagline: 'Inventario, lotes y vencimientos sin perder de vista el mostrador.',
    modules: ['lotes', 'ventas', 'productos', 'clientes'],
    receiptPrefix: 'F',
  },
  veterinaria: {
    slug: 'veterinaria',
    name: 'Veterinaria',
    short: 'Veterinaria',
    tagline: 'Tutores, pacientes y agenda clínica con seguimiento.',
    modules: ['mascotas', 'agenda', 'ventas', 'productos', 'clientes'],
    receiptPrefix: 'V',
  },
  tienda: {
    slug: 'tienda',
    name: 'Tienda de barrio',
    short: 'Tienda',
    tagline: 'Ventas rápidas, inventario claro y clientes de siempre.',
    modules: ['ventas', 'productos', 'clientes'],
    receiptPrefix: 'T',
  },
};

export function verticalCatalog(req) {
  const vertical = req.tenant?.vertical;
  return vertical ? VERTICAL_CATALOG[vertical] : null;
}
