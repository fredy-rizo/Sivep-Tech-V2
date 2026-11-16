import bcrypt from 'bcryptjs';
import { User } from '../../models/User.js';
import { conflict, forbidden, notFound } from '../../lib/errors.js';
import { parse, userCreateSchema, userUpdateSchema } from '../../lib/validation.js';
import { serializeUser } from '../../lib/serializers.js';

export default async function userRoutes(fastify) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', async (request) => {
    const users = await User.find({ tenantId: request.tenant._id }).sort({ createdAt: 1 });
    return { data: users.map(serializeUser) };
  });

  fastify.post(
    '/',
    { preHandler: [fastify.requireRole('owner', 'admin')] },
    async (request, reply) => {
      const input = parse(userCreateSchema, request.body);

      if (input.role === 'owner' && request.user.role !== 'owner') {
        throw forbidden('Solo el propietario puede crear otro propietario');
      }

      const exists = await User.findOne({
        tenantId: request.tenant._id,
        email: input.email,
      }).lean();
      if (exists) throw conflict('Ya existe un usuario con ese correo en esta empresa');

      const user = await User.create({
        tenantId: request.tenant._id,
        name: input.name,
        email: input.email,
        passwordHash: await bcrypt.hash(input.password, 10),
        role: input.role,
        active: input.active ?? true,
      });

      return reply.code(201).send({ data: serializeUser(user) });
    },
  );

  fastify.patch(
    '/:id',
    { preHandler: [fastify.requireRole('owner', 'admin')] },
    async (request) => {
      const input = parse(userUpdateSchema, request.body);
      const user = await User.findOne({
        _id: request.params.id,
        tenantId: request.tenant._id,
      }).select('+passwordHash');
      if (!user) throw notFound('Usuario no encontrado');

      const isSelf = String(user._id) === request.user.sub;
      if (input.role === 'owner' && request.user.role !== 'owner') {
        throw forbidden('Solo el propietario puede asignar ese rol');
      }
      if (isSelf && input.active === false) {
        throw forbidden('No puedes desactivar tu propia cuenta');
      }
      if (isSelf && input.role && input.role !== 'owner' && user.role === 'owner') {
        throw forbidden('No puedes quitarte el rol de propietario');
      }

      if (input.name !== undefined) user.name = input.name;
      if (input.role !== undefined) user.role = input.role;
      if (input.active !== undefined) user.active = input.active;
      if (input.password) user.passwordHash = await bcrypt.hash(input.password, 10);

      await user.save();
      return { data: serializeUser(user) };
    },
  );

  fastify.delete(
    '/:id',
    { preHandler: [fastify.requireRole('owner', 'admin')] },
    async (request) => {
      const user = await User.findOne({
        _id: request.params.id,
        tenantId: request.tenant._id,
      });
      if (!user) throw notFound('Usuario no encontrado');
      if (String(user._id) === request.user.sub) {
        throw forbidden('No puedes eliminar tu propia cuenta');
      }
      if (user.role === 'owner') {
        const owners = await User.countDocuments({
          tenantId: request.tenant._id,
          role: 'owner',
          active: true,
        });
        if (owners <= 1) throw forbidden('La empresa debe conservar al menos un propietario');
      }
      await user.deleteOne();
      return { data: { ok: true } };
    },
  );
}
