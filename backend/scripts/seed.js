/**
 * Crea (o actualiza) las cuatro empresas de demostración y sus datos operativos.
 * Ejecutar: pnpm seed
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from '../src/config.js';
import { db } from '../src/db/mysql.js';
import { Tenant } from '../src/models/Tenant.js';
import { User } from '../src/models/User.js';

const PASSWORD = 'demo1234';

const DEMOS = [
  {
    slug: 'demo-hotel',
    name: 'Hotel Casa Bruma',
    vertical: 'hotel',
    owner: 'Camila Ríos',
    email: 'hotel@sivep.tech',
    phone: '+57 601 742 1180',
    address: 'Calle 12 # 4-55, La Candelaria',
    city: 'Bogotá',
    tagline: 'Hospedaje con memoria: recepción clara, habitaciones listas.',
    plan: 'profesional',
    taxRate: 0,
    receiptPrefix: 'H',
  },
  {
    slug: 'demo-farmacia',
    name: 'Farmacia El Roble',
    vertical: 'farmacia',
    owner: 'Andrés Salazar',
    email: 'farmacia@sivep.tech',
    phone: '+57 604 312 9080',
    address: 'Carrera 43 # 18-22',
    city: 'Medellín',
    tagline: 'La droguería del barrio, con inventario al día.',
    plan: 'esencial',
    taxRate: 0.19,
    receiptPrefix: 'F',
  },
  {
    slug: 'demo-veterinaria',
    name: 'Veterinaria Patas & Pulso',
    vertical: 'veterinaria',
    owner: 'Laura Méndez',
    email: 'veterinaria@sivep.tech',
    phone: '+57 602 665 4410',
    address: 'Avenida 6N # 23-40',
    city: 'Cali',
    tagline: 'Cuidado clínico para quienes también son familia.',
    plan: 'profesional',
    taxRate: 0,
    receiptPrefix: 'V',
  },
  {
    slug: 'demo-tienda',
    name: 'Tienda Doña Rosa',
    vertical: 'tienda',
    owner: 'Rosa Delgado',
    email: 'tienda@sivep.tech',
    phone: '+57 605 380 7742',
    address: 'Calle 30 # 8-14, barrio El Prado',
    city: 'Barranquilla',
    tagline: 'La tienda de siempre, ahora con las cuentas claras.',
    plan: 'esencial',
    taxRate: 0,
    receiptPrefix: 'T',
  },
];

const day = (offset = 0) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date;
};

const dateOnly = (offset = 0) => {
  const date = day(offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
};

const at = (offset, hour, minute = 0) => {
  const date = day(offset);
  date.setHours(hour, minute, 0, 0);
  return date;
};

const PRODUCTS = {
  hotel: [
    ['Desayuno americano', 'Restaurante', 28000, 12000, 0, 0, false, 'porción'],
    ['Minibar surtido', 'Minibar', 18000, 9500, 20, 6, true, 'unidad'],
    ['Lavandería por kilo', 'Servicios', 16000, 5000, 0, 0, false, 'kg'],
    ['Late check-out', 'Servicios', 45000, 0, 0, 0, false, 'servicio'],
    ['Tour histórico', 'Experiencias', 85000, 40000, 0, 0, false, 'persona'],
  ],
  farmacia: [
    ['Acetaminofén 500 mg', 'Analgésicos', 1200, 650, 80, 20, true, 'tableta'],
    ['Ibuprofeno 400 mg', 'Analgésicos', 1500, 800, 60, 20, true, 'tableta'],
    ['Alcohol antiséptico 250 ml', 'Cuidado', 6500, 3800, 24, 8, true, 'frasco'],
    ['Suero oral', 'Hidratación', 3200, 1800, 30, 10, true, 'sobre'],
    ['Loratadina 10 mg', 'Alergias', 900, 450, 90, 25, true, 'tableta'],
    ['Vitamina C 500 mg', 'Vitaminas', 1800, 950, 45, 15, true, 'tableta'],
    ['Termómetro digital', 'Dispositivos', 28000, 19000, 8, 3, true, 'unidad'],
    ['Tapabocas quirúrgico', 'Protección', 700, 350, 120, 30, true, 'unidad'],
  ],
  veterinaria: [
    ['Consulta general', 'Consultas', 65000, 0, 0, 0, false, 'servicio'],
    ['Vacuna antirrábica', 'Vacunas', 48000, 25000, 12, 4, true, 'dosis'],
    ['Desparasitante canino', 'Medicamentos', 22000, 12000, 18, 6, true, 'unidad'],
    ['Baño y corte', 'Estética', 55000, 15000, 0, 0, false, 'servicio'],
    ['Perfil sanguíneo', 'Laboratorio', 95000, 38000, 0, 0, false, 'servicio'],
  ],
  tienda: [
    ['Arroz 500 g', 'Despensa', 2800, 2100, 40, 10, true, 'unidad'],
    ['Pan tajado', 'Panadería', 4500, 3200, 15, 5, true, 'unidad'],
    ['Leche entera 1 L', 'Lácteos', 4200, 3100, 24, 8, true, 'caja'],
    ['Gaseosa 400 ml', 'Bebidas', 2500, 1700, 48, 12, true, 'botella'],
    ['Detergente 500 g', 'Aseo', 8500, 6200, 10, 4, true, 'unidad'],
    ['Huevos AA x 12', 'Despensa', 9800, 7800, 18, 6, true, 'bandeja'],
    ['Mantequilla 250 g', 'Lácteos', 6200, 4600, 12, 4, true, 'unidad'],
    ['Papel higiénico x 4', 'Aseo', 7200, 5200, 20, 6, true, 'paquete'],
  ],
};

const CUSTOMERS = {
  hotel: [
    ['Mariana Torres', 'CC 10203040', '+57 310 555 1201', 'mariana.torres@example.com', 'Cra 11 # 85-20'],
    ['Julián Pardo', 'CC 79123456', '+57 320 555 8830', 'julian.pardo@example.com', 'Calle 70 # 5-32'],
    ['Sofía Beltrán', 'CE 2045678', '+57 301 555 4477', 'sofia.beltran@example.com', 'Av. Suba # 115-40'],
    ['Hostelería Andina SAS', 'NIT 901.442.318-2', '+57 601 555 2200', 'reservas@hosteleriaandina.co', 'Calle 93 # 15-10'],
  ],
  farmacia: [
    ['Carlos Gómez', 'CC 80345612', '+57 312 555 9081', 'carlos.gomez@example.com', 'Carrera 45 # 20-14'],
    ['Lucía Fernández', 'CC 43210987', '+57 315 555 3322', 'lucia.fernandez@example.com', 'Calle 10 # 32-55'],
    ['Consumidor final', '222222222222', '', '', ''],
  ],
  veterinaria: [
    ['Andrea Molina', 'CC 52890441', '+57 317 555 1122', 'andrea.molina@example.com', 'Av. 6N # 23-40'],
    ['Felipe Cárdenas', 'CC 16789012', '+57 310 555 7788', 'felipe.cardenas@example.com', 'Calle 44 # 12-08'],
    ['Valentina Ruiz', 'CC 10324567', '+57 300 555 6633', 'valentina.ruiz@example.com', 'Cra 66 # 13-20'],
    ['Consumidor final', '222222222222', '', '', ''],
  ],
  tienda: [
    ['Marta Ospina', 'CC 35478901', '+57 305 555 1188', '', 'Calle 30 # 8-20'],
    ['Jorge Pineda', 'CC 72114556', '+57 318 555 2244', '', 'Calle 32 # 9-12'],
    ['Consumidor final', '222222222222', '', '', ''],
  ],
};

const PETS = [
  [0, 'Luna', 'Perro', 'Labrador', '2021-04-12', 24.5, 'Alergia leve al pollo.'],
  [0, 'Milo', 'Gato', 'Criollo', '2022-09-03', 4.2, 'Esterilizado.'],
  [1, 'Rocky', 'Perro', 'Bulldog francés', '2020-01-27', 12.8, 'Dificultad respiratoria leve.'],
  [2, 'Nube', 'Gato', 'Angora', '2023-06-18', 3.6, ''],
  [2, 'Kiwi', 'Ave', 'Periquito', '2024-02-09', 0.04, 'Control de plumaje.'],
];

async function upsertTenant(demo) {
  const tenant = await Tenant.findOneAndUpdate(
    { slug: demo.slug },
    {
      $set: {
        name: demo.name,
        vertical: demo.vertical,
        plan: demo.plan,
        status: 'active',
        branding: { tagline: demo.tagline, primary: '#8B1E3F', accent: '#5B8C4E' },
        contact: {
          email: demo.email,
          phone: demo.phone,
          address: demo.address,
          city: demo.city,
        },
        settings: {
          currency: 'COP',
          locale: 'es-CO',
          timezone: 'America/Bogota',
          taxRate: demo.taxRate,
          receiptPrefix: demo.receiptPrefix,
          thankYouNote: 'Gracias por preferirnos.',
        },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  await User.findOneAndUpdate(
    { tenantId: tenant._id, email: demo.email },
    {
      $set: {
        name: demo.owner,
        passwordHash,
        role: 'owner',
        active: true,
        lastLoginAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return tenant;
}

async function clearOperationalData(tenantId) {
  const tables = [
    'appointments',
    'pets',
    'reservations',
    'rooms',
    'sale_items',
    'sales',
    'product_batches',
    'products',
    'customers',
  ];
  for (const table of tables) {
    await db(table).where({ tenant_id: tenantId }).del();
  }
}

async function seedCustomers(tenantId, vertical) {
  const ids = [];
  for (const [name, doc, phone, email, address] of CUSTOMERS[vertical]) {
    const [id] = await db('customers').insert({
      tenant_id: tenantId,
      name,
      doc,
      phone,
      email,
      address,
      active: true,
    });
    ids.push(Number(id));
  }
  return ids;
}

async function seedProducts(tenantId, vertical) {
  const ids = [];
  let index = 1;
  for (const [name, category, price, cost, stock, minStock, trackStock, unit] of PRODUCTS[
    vertical
  ]) {
    const [id] = await db('products').insert({
      tenant_id: tenantId,
      sku: `SKU-${String(index).padStart(3, '0')}`,
      name,
      category,
      unit,
      price,
      cost,
      stock,
      min_stock: minStock,
      track_stock: trackStock,
      active: true,
    });
    ids.push(Number(id));
    index += 1;
  }
  return ids;
}

async function seedRooms(tenantId) {
  const rooms = [
    ['101', 'Doble', 2, 180000, '1', 'occupied', 'Vista al patio interior.'],
    ['102', 'Doble', 2, 180000, '1', 'available', ''],
    ['103', 'Sencilla', 1, 130000, '1', 'cleaning', ''],
    ['201', 'Suite', 3, 320000, '2', 'available', 'Terraza privada.'],
    ['202', 'Familiar', 5, 390000, '2', 'available', ''],
    ['203', 'Doble', 2, 195000, '2', 'maintenance', 'Revisión de aire acondicionado.'],
  ];
  const ids = {};
  for (const [number, type, capacity, rate, floor, status, notes] of rooms) {
    const [id] = await db('rooms').insert({
      tenant_id: tenantId,
      number,
      type,
      capacity,
      rate,
      floor,
      status,
      notes,
    });
    ids[number] = Number(id);
  }
  return ids;
}

async function seedReservations(tenantId, rooms, customers) {
  const rows = [
    {
      room_id: rooms['101'],
      customer_id: customers[0],
      guest_name: 'Mariana Torres',
      check_in: dateOnly(-1),
      check_out: dateOnly(2),
      guests: 2,
      total: 540000,
      status: 'checked_in',
      notes: 'Llegó con mascota pequeña.',
    },
    {
      room_id: rooms['201'],
      customer_id: customers[3],
      guest_name: 'Hostelería Andina SAS',
      check_in: dateOnly(0),
      check_out: dateOnly(3),
      guests: 2,
      total: 960000,
      status: 'confirmed',
      notes: 'Facturar a nombre de la empresa.',
    },
    {
      room_id: rooms['102'],
      customer_id: customers[1],
      guest_name: 'Julián Pardo',
      check_in: dateOnly(1),
      check_out: dateOnly(4),
      guests: 2,
      total: 540000,
      status: 'confirmed',
      notes: '',
    },
    {
      room_id: rooms['103'],
      customer_id: customers[2],
      guest_name: 'Sofía Beltrán',
      check_in: dateOnly(-5),
      check_out: dateOnly(-2),
      guests: 1,
      total: 390000,
      status: 'checked_out',
      notes: '',
    },
    {
      room_id: rooms['202'],
      customer_id: null,
      guest_name: 'Familia Restrepo',
      check_in: dateOnly(5),
      check_out: dateOnly(7),
      guests: 4,
      total: 780000,
      status: 'confirmed',
      notes: 'Solicitan cuna.',
    },
  ];
  await db('reservations').insert(rows.map((row) => ({ tenant_id: tenantId, ...row })));
}

async function seedPets(tenantId, customers) {
  const ids = [];
  for (const [customerIndex, name, species, breed, birthdate, weight, notes] of PETS) {
    const [id] = await db('pets').insert({
      tenant_id: tenantId,
      customer_id: customers[customerIndex] ?? null,
      name,
      species,
      breed,
      birthdate,
      weight,
      notes,
      active: true,
    });
    ids.push(Number(id));
  }
  return ids;
}

async function seedAppointments(tenantId, pets, customers) {
  const rows = [
    [pets[0], customers[0], at(0, 9, 0), 'Control post-operatorio', 'Dra. Laura Méndez', 'completed', 'Evolución favorable.'],
    [pets[1], customers[0], at(0, 11, 30), 'Vacunación anual', 'Dra. Laura Méndez', 'confirmed', ''],
    [pets[2], customers[1], at(0, 15, 0), 'Revisión respiratoria', 'Dr. Samuel Ortiz', 'scheduled', ''],
    [pets[3], customers[2], at(1, 10, 0), 'Esterilización de control', 'Dra. Laura Méndez', 'scheduled', ''],
    [pets[4], customers[2], at(2, 14, 0), 'Control de plumaje', 'Dr. Samuel Ortiz', 'scheduled', ''],
  ];
  await db('appointments').insert(
    rows.map(([pet_id, customer_id, scheduled_at, reason, vet_name, status, notes]) => ({
      tenant_id: tenantId,
      pet_id,
      customer_id,
      scheduled_at,
      reason,
      vet_name,
      status,
      notes,
    })),
  );
}

async function seedBatches(tenantId, products) {
  const rows = [
    [0, 'L-2401', dateOnly(15), 30, 650],
    [0, 'L-2402', dateOnly(120), 50, 640],
    [1, 'L-2410', dateOnly(45), 35, 800],
    [3, 'L-2502', dateOnly(-8), 5, 1800],
    [4, 'L-2505', dateOnly(80), 60, 450],
    [5, 'L-2511', dateOnly(200), 45, 950],
    [6, 'L-2520', dateOnly(400), 8, 19000],
    [7, 'L-2530', dateOnly(60), 120, 350],
  ];
  await db('product_batches').insert(
    rows
      .filter(([index]) => products[index])
      .map(([index, lot, expires_at, quantity, cost]) => ({
        tenant_id: tenantId,
        product_id: products[index],
        lot,
        expires_at,
        quantity,
        cost,
      })),
  );
}

async function seedSales({ tenantId, vertical, products, customers, prefix, taxRate }) {
  const templates = {
    hotel: [
      [-5, 0, [[0, 2], [1, 1]], 'card'],
      [-4, 1, [[2, 3]], 'cash'],
      [-3, 0, [[3, 1], [0, 2]], 'card'],
      [-2, 3, [[4, 2], [1, 2]], 'transfer'],
      [-1, 2, [[0, 4]], 'card'],
      [0, 1, [[1, 3], [3, 1]], 'cash'],
    ],
    farmacia: [
      [-6, 0, [[0, 10], [4, 8]], 'cash'],
      [-5, 1, [[2, 2], [7, 5]], 'card'],
      [-4, 2, [[1, 12]], 'cash'],
      [-3, 0, [[3, 4], [5, 6]], 'cash'],
      [-1, 1, [[6, 1], [0, 6]], 'card'],
      [0, 2, [[1, 8], [4, 10], [3, 2]], 'cash'],
    ],
    veterinaria: [
      [-5, 0, [[0, 1], [2, 1]], 'card'],
      [-4, 1, [[1, 1], [3, 1]], 'cash'],
      [-3, 2, [[0, 1], [4, 1]], 'transfer'],
      [-2, 2, [[3, 2]], 'cash'],
      [-1, 1, [[0, 1], [1, 2]], 'card'],
      [0, 0, [[0, 1], [2, 1]], 'cash'],
    ],
    tienda: [
      [-6, 0, [[0, 2], [1, 1], [2, 2]], 'cash'],
      [-5, 1, [[3, 4], [6, 2]], 'cash'],
      [-4, 2, [[4, 1], [7, 2], [2, 1]], 'cash'],
      [-3, 0, [[5, 1], [0, 3]], 'card'],
      [-1, 1, [[1, 2], [3, 6]], 'cash'],
      [0, 2, [[2, 2], [4, 1], [6, 3]], 'cash'],
    ],
  };

  let sequence = 1;
  for (const [daysAgo, customerIndex, items, payment] of templates[vertical]) {
    const lineRows = items
      .filter(([productIndex]) => products[productIndex])
      .map(([productIndex, qty]) => {
        const [name, , price] = PRODUCTS[vertical][productIndex];
        return { productId: products[productIndex], description: name, qty, price };
      });
    const subtotal = lineRows.reduce((sum, row) => sum + row.qty * row.price, 0);
    const tax = Math.round(subtotal * taxRate * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;
    const createdAt = at(daysAgo, 10 + (sequence % 8), (sequence * 7) % 60);

    const [saleId] = await db('sales').insert({
      tenant_id: tenantId,
      number: `${prefix}-${new Date().getFullYear()}-${String(sequence).padStart(4, '0')}`,
      customer_id: customers[customerIndex] ?? null,
      user_id: 'seed',
      user_name: 'Caja principal',
      subtotal,
      tax,
      total,
      payment_method: payment,
      status: 'paid',
      notes: null,
      created_at: createdAt,
      updated_at: createdAt,
    });

    await db('sale_items').insert(
      lineRows.map((row) => ({
        tenant_id: tenantId,
        sale_id: saleId,
        product_id: row.productId,
        description: row.description,
        quantity: row.qty,
        unit_price: row.price,
        total: Math.round(row.qty * row.price * 100) / 100,
      })),
    );
    sequence += 1;
  }
}

async function main() {
  console.log('\nSIVEP Tech · datos de demostración\n');
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 8000 });
  await db.raw('select 1');

  for (const demo of DEMOS) {
    const tenant = await upsertTenant(demo);
    const tenantId = String(tenant._id);
    await clearOperationalData(tenantId);

    const customers = await seedCustomers(tenantId, demo.vertical);
    const products = await seedProducts(tenantId, demo.vertical);

    if (demo.vertical === 'hotel') {
      const rooms = await seedRooms(tenantId);
      await seedReservations(tenantId, rooms, customers);
    }
    if (demo.vertical === 'veterinaria') {
      const pets = await seedPets(tenantId, customers);
      await seedAppointments(tenantId, pets, customers);
    }
    if (demo.vertical === 'farmacia') {
      await seedBatches(tenantId, products);
    }

    await seedSales({
      tenantId,
      vertical: demo.vertical,
      products,
      customers,
      prefix: demo.receiptPrefix,
      taxRate: demo.taxRate,
    });

    console.log(`  ✓ ${demo.name.padEnd(28)} ${demo.slug.padEnd(18)} ${demo.email}`);
  }

  console.log(`\n  Contraseña para todas las cuentas: ${PASSWORD}\n`);
  console.log('  Listo. Inicia sesión en http://localhost:5173/login\n');

  await db.destroy();
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('\nError preparando los datos:', error.message);
  try {
    await db.destroy();
    await mongoose.disconnect();
  } catch {
    // noop
  }
  process.exit(1);
});
