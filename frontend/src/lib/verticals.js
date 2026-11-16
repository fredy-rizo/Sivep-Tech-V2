export const VERTICALS = {
  hotel: {
    slug: 'hotel',
    name: 'Hoteles',
    short: 'Hotel',
    eyebrow: 'Hospitalidad',
    description:
      'Recepción, habitaciones, tarifas y reservas. El estado de cada cuarto a la vista y la cuenta clara al final de la estadía.',
    asset: '/brand/sivep-tech-01-monograma-brote.svg',
    nav: [
      { to: '/app/habitaciones', label: 'Habitaciones', icon: 'bed' },
      { to: '/app/reservas', label: 'Reservas', icon: 'calendar' },
    ],
    dashboardTitle: 'La casa, en orden.',
  },
  farmacia: {
    slug: 'farmacia',
    name: 'Farmacia',
    short: 'Farmacia',
    eyebrow: 'Salud',
    description:
      'Medicamentos, lotes y fechas de vencimiento bajo control. Ventas de mostrador sin filas ni cuadernos.',
    asset: '/brand/sivep-tech-02-surco-datos.svg',
    nav: [
      { to: '/app/lotes', label: 'Lotes y vencimientos', icon: 'flask' },
    ],
    dashboardTitle: 'Mostrador surtido, cuentas claras.',
  },
  veterinaria: {
    slug: 'veterinaria',
    name: 'Veterinaria',
    short: 'Veterinaria',
    eyebrow: 'Cuidado animal',
    description:
      'Tutores, pacientes e historia de cada visita. Agenda diaria para que ninguna consulta se cruce.',
    asset: '/brand/sivep-tech-03-escudo-nodo.svg',
    nav: [
      { to: '/app/mascotas', label: 'Pacientes', icon: 'paw' },
      { to: '/app/agenda', label: 'Agenda', icon: 'calendar' },
      { to: '/app/reservas-vet', label: 'Reservas', icon: 'link', adminOnly: true },
    ],
    dashboardTitle: 'Cada paciente, con su historia.',
  },
  tienda: {
    slug: 'tienda',
    name: 'Tienda de barrio',
    short: 'Tienda',
    eyebrow: 'Comercio',
    description:
      'Ventas rápidas, inventario que cuadra y clientes de siempre. Lo esencial para el día a día del negocio.',
    asset: '/brand/sivep-tech-04-nodo-red.svg',
    nav: [],
    dashboardTitle: 'El barrio compra, la tienda cuadra.',
  },
};

export const VERTICAL_LIST = Object.values(VERTICALS);

export const DEMO_ACCOUNTS = [
  { slug: 'demo-hotel', label: 'Hotel Casa Bruma', vertical: 'hotel', email: 'hotel@sivep.tech' },
  {
    slug: 'demo-farmacia',
    label: 'Farmacia El Roble',
    vertical: 'farmacia',
    email: 'farmacia@sivep.tech',
  },
  {
    slug: 'demo-veterinaria',
    label: 'Veterinaria Patas & Pulso',
    vertical: 'veterinaria',
    email: 'veterinaria@sivep.tech',
  },
  { slug: 'demo-tienda', label: 'Tienda Doña Rosa', vertical: 'tienda', email: 'tienda@sivep.tech' },
];

export const DEMO_PASSWORD = 'demo1234';
