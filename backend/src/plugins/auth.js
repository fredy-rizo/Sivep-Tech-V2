import fp from 'fastify-plugin';
import { Tenant } from '../models/Tenant.js';
import { forbidden, unauthorized } from '../lib/errors.js';

export default fp(async function authPlugin(fastify) {
  fastify.decorate('authenticate', async function authenticate(request, reply) {
    try {
      await request.jwtVerify();
    } catch {
      return reply
        .code(401)
        .send({ error: { code: 'UNAUTHORIZED', message: 'Sesión inválida o expirada' } });
    }

    let tenant;
    try {
      tenant = await Tenant.findById(request.user.tenantId);
    } catch {
      tenant = null;
    }

    if (!tenant || tenant.status !== 'active') {
      return reply
        .code(401)
        .send({ error: { code: 'TENANT_INACTIVE', message: 'La empresa no está disponible' } });
    }

    // El token manda. Si llega x-tenant, debe coincidir: nunca se cambia de
    // tenant por una cabecera enviada desde el navegador.
    const requestedTenant = request.headers['x-tenant'];
    if (requestedTenant && requestedTenant !== tenant.slug) {
      return reply
        .code(403)
        .send({ error: { code: 'TENANT_MISMATCH', message: 'La empresa no coincide con la sesión' } });
    }

    request.tenant = tenant;
    request.tenantId = String(tenant._id);
  });

  fastify.decorate('requireRole', function requireRole(...roles) {
    return async function roleGuard(request) {
      if (!request.user || !roles.includes(request.user.role)) {
        throw forbidden('Tu rol no permite esta acción');
      }
    };
  });

  fastify.decorate('requireVertical', function requireVertical(...verticals) {
    return async function verticalGuard(request) {
      if (!verticals.includes(request.tenant.vertical)) {
        throw forbidden('Este módulo no está disponible para este tipo de negocio');
      }
    };
  });
});
