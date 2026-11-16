import mongoose from 'mongoose';
import { buildApp } from './app.js';
import { config } from './config.js';
import { db, pingDatabase } from './db/mysql.js';

async function main() {
  const app = await buildApp();

  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 8000 });
  app.log.info({ uri: config.mongoUri.replace(/\/\/.*@/, '//***@') }, 'MongoDB conectado');

  await pingDatabase();
  app.log.info(
    { host: config.mysql.host, database: config.mysql.database },
    'MySQL conectado',
  );

  await app.listen({ port: config.port, host: config.host });

  const shutdown = async (signal) => {
    app.log.info({ signal }, 'Cerrando servidor');
    await app.close();
    await db.destroy();
    await mongoose.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('\nNo se pudo iniciar SIVEP Tech API.');
  console.error(error.message);
  if (/ECONNREFUSED|Server selection/i.test(String(error.message))) {
    console.error('\nVerifica que MongoDB y MySQL estén activos y que backend/.env sea correcto.');
    console.error('Sugerencia: inicia los servicios locales de MongoDB y MySQL.');
    console.error('Luego: pnpm migrate && pnpm seed');
  }
  process.exit(1);
});
