import bcrypt from 'bcryptjs';
import { Tenant } from '../../models/Tenant.js';
import { User } from '../../models/User.js';
import { badRequest, notFound, unauthorized } from '../../lib/errors.js';
import {
  changePasswordSchema,
  loginSchema,
  parse,
  profileSchema,
} from '../../lib/validation.js';
import { serializeTenant, serializeUser } from '../../lib/serializers.js';

function signToken(fastify, user, tenant) {
  return fastify.jwt.sign({
    sub: String(user._id),
    tenantId: String(tenant._id),
    tenantSlug: tenant.slug,
    role: user.role,
    name: user.name,
  });
}

export default async function authRoutes(fastify) {
  fastify.post(
    '/login',
    { config: { rateLimit: { max: 12, timeWindow: '1 minute' } } },
    async (request) => {
      const input = parse(loginSchema, request.body);
      const tenant = await Tenant.findOne({ slug: input.tenantSlug });
      if (!tenant || tenant.status !== 'active') {
        throw unauthorized('Empresa o credenciales incorrectas');
      }

      const user = await User.findOne({
        tenantId: tenant._id,
        email: input.email,
        active: true,
      }).select('+passwordHash');

      if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
        throw unauthorized('Empresa o credenciales incorrectas');
      }

      user.lastLoginAt = new Date();
      await user.save();

      return {
        data: {
          token: signToken(fastify, user, tenant),
          user: serializeUser(user),
          tenant: serializeTenant(tenant),
        },
      };
    },
  );

  fastify.get(
    '/me',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const user = await User.findOne({
        _id: request.user.sub,
        tenantId: request.tenant._id,
      });
      if (!user || !user.active) throw unauthorized('La cuenta no está activa');
      return {
        data: {
          user: serializeUser(user),
          tenant: serializeTenant(request.tenant),
        },
      };
    },
  );

  fastify.patch(
    '/profile',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const input = parse(profileSchema, request.body);
      const user = await User.findOneAndUpdate(
        { _id: request.user.sub, tenantId: request.tenant._id },
        { name: input.name },
        { new: true },
      );
      if (!user) throw notFound('Usuario no encontrado');
      return { data: { user: serializeUser(user) } };
    },
  );

  fastify.post(
    '/change-password',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const input = parse(changePasswordSchema, request.body);
      const user = await User.findOne({
        _id: request.user.sub,
        tenantId: request.tenant._id,
      }).select('+passwordHash');
      if (!user) throw notFound('Usuario no encontrado');

      const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
      if (!valid) throw badRequest('La contraseña actual no es correcta');

      user.passwordHash = await bcrypt.hash(input.newPassword, 10);
      await user.save();
      return { data: { ok: true } };
    },
  );
}
