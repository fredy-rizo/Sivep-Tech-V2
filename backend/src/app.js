import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import mongoose from 'mongoose';
import { config } from './config.js';
import authPlugin from './plugins/auth.js';
import { AppError } from './lib/errors.js';
import { db } from './db/mysql.js';

import publicRoutes from './modules/public/routes.js';
import authRoutes from './modules/auth/routes.js';
import tenantRoutes from './modules/tenant/routes.js';
import userRoutes from './modules/users/routes.js';
import customerRoutes from './modules/customers/routes.js';
import productRoutes from './modules/products/routes.js';
import saleRoutes from './modules/sales/routes.js';
import hotelRoutes from './modules/hotels/routes.js';
import veterinaryRoutes from './modules/veterinary/routes.js';
import pharmacyRoutes from './modules/pharmacy/routes.js';
import dashboardRoutes from './modules/dashboard/routes.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      transport: config.prettyLogs ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
    },
    bodyLimit: 1024 * 1024,
    trustProxy: true,
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || config.corsOrigin.includes(origin)) return callback(null, true);
      return callback(null, config.env !== 'production' && /^http:\/\/localhost:\d+$/.test(origin));
    },
    credentials: true,
  });
  await app.register(rateLimit, {
    max: 600,
    timeWindow: '1 minute',
    allowList: config.env === 'development' ? ['127.0.0.1', '::1'] : [],
  });
  await app.register(jwt, {
    secret: config.jwtSecret,
    sign: { expiresIn: config.jwtExpiresIn },
  });
  await app.register(authPlugin);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply
        .code(error.status)
        .send({ error: { code: error.code, message: error.message, details: error.details } });
    }

    if (error.validation) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: error.validation },
      });
    }

    if (error.code === 'ER_DUP_ENTRY') {
      return reply
        .code(409)
        .send({ error: { code: 'DUPLICATE', message: 'El registro ya existe' } });
    }

    if (error.statusCode === 401) {
      return reply
        .code(401)
        .send({ error: { code: 'UNAUTHORIZED', message: 'Sesión inválida o expirada' } });
    }

    request.log.error({ err: error }, 'Error no controlado');
    return reply.code(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Ocurrió un error inesperado. Intenta de nuevo.',
      },
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: { code: 'NOT_FOUND', message: `Ruta no encontrada: ${request.method} ${request.url}` },
    });
  });

  app.get('/api/health', async () => {
    const mongo = mongoose.connection.readyState === 1;
    let mysql = false;
    try {
      await db.raw('select 1');
      mysql = true;
    } catch {
      mysql = false;
    }
    return {
      data: {
        status: mongo && mysql ? 'ok' : 'degraded',
        service: 'sivep-tech-api',
        version: '1.0.0',
        mongo,
        mysql,
        uptime: Math.round(process.uptime()),
      },
    };
  });

  await app.register(publicRoutes, { prefix: '/api/public' });
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(tenantRoutes, { prefix: '/api/tenant' });
  await app.register(userRoutes, { prefix: '/api/users' });
  await app.register(customerRoutes, { prefix: '/api/customers' });
  await app.register(productRoutes, { prefix: '/api/products' });
  await app.register(saleRoutes, { prefix: '/api/sales' });
  await app.register(hotelRoutes, { prefix: '/api/hotels' });
  await app.register(veterinaryRoutes, { prefix: '/api/vet' });
  await app.register(pharmacyRoutes, { prefix: '/api/pharmacy' });
  await app.register(dashboardRoutes, { prefix: '/api/dashboard' });

  return app;
}
