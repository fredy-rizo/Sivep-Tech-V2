/**
 * Esquema operativo de SIVEP Tech.
 * Todas las tablas llevan tenant_id: una sola base MySQL, aislamiento por fila.
 */
export async function up(knex) {
  const tenantId = (table) => table.string('tenant_id', 24).notNullable().index();

  // ---------------------------------------------------------------- clientes
  await knex.schema.createTable('customers', (t) => {
    t.bigIncrements('id');
    tenantId(t);
    t.string('name', 160).notNullable();
    t.string('doc', 40);
    t.string('phone', 40);
    t.string('email', 120);
    t.string('address', 240);
    t.text('notes');
    t.boolean('active').notNullable().defaultTo(true);
    t.timestamps(true, true);
    t.index(['tenant_id', 'name']);
  });

  // -------------------------------------------------------------- inventario
  await knex.schema.createTable('products', (t) => {
    t.bigIncrements('id');
    tenantId(t);
    t.string('sku', 60);
    t.string('name', 180).notNullable();
    t.string('category', 80);
    t.string('unit', 24).notNullable().defaultTo('unidad');
    t.decimal('price', 12, 2).notNullable().defaultTo(0);
    t.decimal('cost', 12, 2).notNullable().defaultTo(0);
    t.decimal('stock', 12, 2).notNullable().defaultTo(0);
    t.decimal('min_stock', 12, 2).notNullable().defaultTo(0);
    t.boolean('track_stock').notNullable().defaultTo(true);
    t.boolean('active').notNullable().defaultTo(true);
    t.json('attributes');
    t.timestamps(true, true);
    t.index(['tenant_id', 'name']);
    t.index(['tenant_id', 'sku']);
  });

  await knex.schema.createTable('product_batches', (t) => {
    t.bigIncrements('id');
    tenantId(t);
    t.bigInteger('product_id').unsigned().notNullable();
    t.string('lot', 80);
    t.date('expires_at');
    t.decimal('quantity', 12, 2).notNullable().defaultTo(0);
    t.decimal('cost', 12, 2).notNullable().defaultTo(0);
    t.timestamps(true, true);
    t.index(['tenant_id', 'product_id']);
    t.index(['tenant_id', 'expires_at']);
  });

  // ------------------------------------------------------------------ ventas
  await knex.schema.createTable('sales', (t) => {
    t.bigIncrements('id');
    tenantId(t);
    t.string('number', 40).notNullable();
    t.bigInteger('customer_id').unsigned();
    t.string('user_id', 40);
    t.string('user_name', 120);
    t.decimal('subtotal', 12, 2).notNullable().defaultTo(0);
    t.decimal('tax', 12, 2).notNullable().defaultTo(0);
    t.decimal('total', 12, 2).notNullable().defaultTo(0);
    t.string('payment_method', 24).notNullable().defaultTo('cash');
    t.string('status', 24).notNullable().defaultTo('paid');
    t.text('notes');
    t.timestamps(true, true);
    t.index(['tenant_id', 'created_at']);
    t.index(['tenant_id', 'number']);
  });

  await knex.schema.createTable('sale_items', (t) => {
    t.bigIncrements('id');
    tenantId(t);
    t.bigInteger('sale_id').unsigned().notNullable();
    t.bigInteger('product_id').unsigned();
    t.string('description', 200).notNullable();
    t.decimal('quantity', 12, 2).notNullable().defaultTo(1);
    t.decimal('unit_price', 12, 2).notNullable().defaultTo(0);
    t.decimal('total', 12, 2).notNullable().defaultTo(0);
    t.index(['tenant_id', 'sale_id']);
  });

  // ----------------------------------------------------------------- hoteles
  await knex.schema.createTable('rooms', (t) => {
    t.bigIncrements('id');
    tenantId(t);
    t.string('number', 20).notNullable();
    t.string('type', 80).notNullable().defaultTo('Doble');
    t.integer('capacity').notNullable().defaultTo(2);
    t.decimal('rate', 12, 2).notNullable().defaultTo(0);
    t.string('floor', 20);
    t.string('status', 24).notNullable().defaultTo('available');
    t.text('notes');
    t.timestamps(true, true);
    t.index(['tenant_id', 'number']);
    t.index(['tenant_id', 'status']);
  });

  await knex.schema.createTable('reservations', (t) => {
    t.bigIncrements('id');
    tenantId(t);
    t.bigInteger('room_id').unsigned().notNullable();
    t.bigInteger('customer_id').unsigned();
    t.string('guest_name', 160).notNullable();
    t.date('check_in').notNullable();
    t.date('check_out').notNullable();
    t.integer('guests').notNullable().defaultTo(1);
    t.decimal('total', 12, 2).notNullable().defaultTo(0);
    t.string('status', 24).notNullable().defaultTo('confirmed');
    t.text('notes');
    t.timestamps(true, true);
    t.index(['tenant_id', 'check_in']);
    t.index(['tenant_id', 'status']);
  });

  // ------------------------------------------------------------- devoluciones
  await knex.schema.createTable('sales_returns', (t) => {
    t.bigIncrements('id');
    tenantId(t);
    t.bigInteger('sale_id').unsigned().notNullable();
    t.bigInteger('product_id').unsigned().notNullable();
    t.integer('quantity').notNullable().defaultTo(1);
    t.string('reason', 180);
    t.datetime('returned_at').notNullable().defaultTo(knex.fn.now());
    t.string('employee_id', 40);
    t.timestamps(true, true);
    t.index(['tenant_id', 'sale_id']);
    t.index(['tenant_id', 'product_id']);
  });

  // ------------------------------------------------------------- veterinaria
  await knex.schema.createTable('pets', (t) => {
    t.bigIncrements('id');
    tenantId(t);
    t.bigInteger('customer_id').unsigned();
    t.string('name', 120).notNullable();
    t.string('species', 60).notNullable().defaultTo('Perro');
    t.string('breed', 80);
    t.date('birthdate');
    t.decimal('weight', 8, 2);
    t.text('notes');
    t.boolean('active').notNullable().defaultTo(true);
    t.timestamps(true, true);
    t.index(['tenant_id', 'name']);
  });

  await knex.schema.createTable('appointments', (t) => {
    t.bigIncrements('id');
    tenantId(t);
    t.bigInteger('pet_id').unsigned().notNullable();
    t.bigInteger('customer_id').unsigned();
    t.datetime('scheduled_at').notNullable();
    t.string('reason', 180).notNullable();
    t.string('vet_name', 120);
    t.string('status', 24).notNullable().defaultTo('scheduled');
    t.string('source', 20).notNullable().defaultTo('internal');
    t.integer('duration_minutes').notNullable().defaultTo(30);
    t.text('notes');
    t.timestamps(true, true);
    t.index(['tenant_id', 'scheduled_at']);
    t.index(['tenant_id', 'status']);
  });

  // ------------------------------------------------------------- grooming
  await knex.schema.createTable('grooming_sessions', (t) => {
    t.bigIncrements('id');
    tenantId(t);
    t.bigInteger('pet_id').unsigned().notNullable();
    t.bigInteger('customer_id').unsigned();
    t.string('service', 120).notNullable();
    t.string('reason', 180);
    t.datetime('scheduled_at').notNullable();
    t.string('vet_name', 120);
    t.string('status', 24).notNullable().defaultTo('scheduled');
    t.text('notes');
    t.timestamps(true, true);
    t.index(['tenant_id', 'scheduled_at']);
    t.index(['tenant_id', 'status']);
  });
}

export async function down(knex) {
  const tables = [
    'appointments',
    'grooming_sessions',
    'pets',
    'reservations',
    'rooms',
    'sale_items',
    'sales',
    'sales_returns',
    'product_batches',
    'products',
    'customers',
  ];
  for (const table of tables) {
    await knex.schema.dropTableIfExists(table);
  }
}
