import knex from 'knex';
import { config } from '../config.js';

export const db = knex({
  client: 'mysql2',
  connection: config.mysql,
  pool: { min: 0, max: 10 },
});

/** Devuelve una consulta ya delimitada al tenant. La base es compartida. */
export function tenantQuery(table, tenantId) {
  return db(table).where(`${table}.tenant_id`, tenantId);
}

export function tenantTable(table, tenantId) {
  return db(table).where({ tenant_id: tenantId });
}

export async function pingDatabase() {
  await db.raw('select 1');
}

export function num(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
