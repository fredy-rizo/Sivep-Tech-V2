import { config } from './src/config.js';

const base = {
  client: 'mysql2',
  connection: config.mysql,
  pool: { min: 0, max: 10 },
  migrations: {
    directory: './src/db/migrations',
    tableName: 'sivep_migrations',
  },
};

export default {
  development: base,
  production: base,
};
