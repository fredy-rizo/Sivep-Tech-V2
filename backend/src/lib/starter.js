import { db } from '../db/mysql.js';
import { VERTICAL_CATALOG } from './verticals.js';

const PRODUCTS = {
  hotel: [
    { name: 'Desayuno americano', category: 'Restaurante', price: 28000, stock: 0, trackStock: false, unit: 'porción' },
    { name: 'Minibar surtido', category: 'Minibar', price: 18000, stock: 20, minStock: 5, unit: 'unidad' },
    { name: 'Lavandería por kilo', category: 'Servicios', price: 16000, stock: 0, trackStock: false, unit: 'kg' },
    { name: 'Late check-out', category: 'Servicios', price: 45000, stock: 0, trackStock: false, unit: 'servicio' },
  ],
  farmacia: [
    { name: 'Acetaminofén 500 mg', category: 'Analgésicos', price: 1200, cost: 650, stock: 80, minStock: 20, unit: 'tableta' },
    { name: 'Ibuprofeno 400 mg', category: 'Analgésicos', price: 1500, cost: 800, stock: 60, minStock: 20, unit: 'tableta' },
    { name: 'Alcohol antiséptico 250 ml', category: 'Cuidado', price: 6500, cost: 3800, stock: 24, minStock: 8, unit: 'frasco' },
    { name: 'Suero oral', category: 'Hidratación', price: 3200, cost: 1800, stock: 30, minStock: 10, unit: 'sobre' },
  ],
  veterinaria: [
    { name: 'Consulta general', category: 'Consultas', price: 65000, stock: 0, trackStock: false, unit: 'servicio' },
    { name: 'Vacuna antirrábica', category: 'Vacunas', price: 48000, cost: 25000, stock: 12, minStock: 4, unit: 'dosis' },
    { name: 'Desparasitante', category: 'Medicamentos', price: 22000, cost: 12000, stock: 18, minStock: 6, unit: 'unidad' },
    { name: 'Baño y corte', category: 'Estética', price: 55000, stock: 0, trackStock: false, unit: 'servicio' },
  ],
  tienda: [
    { name: 'Arroz 500 g', category: 'Despensa', price: 2800, cost: 2100, stock: 40, minStock: 10, unit: 'unidad' },
    { name: 'Pan tajado', category: 'Panadería', price: 4500, cost: 3200, stock: 15, minStock: 5, unit: 'unidad' },
    { name: 'Leche entera 1 L', category: 'Lácteos', price: 4200, cost: 3100, stock: 24, minStock: 8, unit: 'caja' },
    { name: 'Gaseosa 400 ml', category: 'Bebidas', price: 2500, cost: 1700, stock: 48, minStock: 12, unit: 'botella' },
    { name: 'Detergente 500 g', category: 'Aseo', price: 8500, cost: 6200, stock: 10, minStock: 4, unit: 'unidad' },
  ],
};

const ROOMS = [
  { number: '101', type: 'Doble', capacity: 2, rate: 180000, floor: '1' },
  { number: '102', type: 'Doble', capacity: 2, rate: 180000, floor: '1' },
  { number: '103', type: 'Sencilla', capacity: 1, rate: 130000, floor: '1' },
  { number: '201', type: 'Suite', capacity: 3, rate: 320000, floor: '2' },
  { number: '202', type: 'Familiar', capacity: 5, rate: 390000, floor: '2' },
  { number: '203', type: 'Doble', capacity: 2, rate: 195000, floor: '2' },
];

/** Datos mínimos para que una empresa recién creada pueda operar. */
export async function seedStarterData(tenant) {
  const tenantId = String(tenant._id ?? tenant.id);
  const products = PRODUCTS[tenant.vertical] ?? PRODUCTS.tienda;
  await db('products').insert(
    products.map((product, index) => ({
      tenant_id: tenantId,
      sku: `IN-${String(index + 1).padStart(3, '0')}`,
      name: product.name,
      category: product.category,
      unit: product.unit,
      price: product.price,
      cost: product.cost ?? 0,
      stock: product.stock ?? 0,
      min_stock: product.minStock ?? 0,
      track_stock: product.trackStock !== false,
      active: true,
    })),
  );

  await db('customers').insert({
    tenant_id: tenantId,
    name: 'Consumidor final',
    doc: '222222222222',
    active: true,
  });

  if (tenant.vertical === 'hotel') {
    await db('rooms').insert(
      ROOMS.map((room) => ({
        tenant_id: tenantId,
        ...room,
        status: 'available',
      })),
    );
  }
}

export function receiptPrefixFor(tenant) {
  const configured = tenant.settings?.receiptPrefix;
  if (configured) return configured;
  return VERTICAL_CATALOG[tenant.vertical]?.receiptPrefix ?? 'S';
}
