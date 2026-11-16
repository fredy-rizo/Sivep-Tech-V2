import { Tenant } from '../../models/Tenant.js';
import { parse, tenantUpdateSchema } from '../../lib/validation.js';
import { serializeTenant } from '../../lib/serializers.js';
import { VERTICAL_CATALOG } from '../../lib/verticals.js';

export default async function tenantRoutes(fastify) {
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request) => {
    return {
      data: {
        tenant: serializeTenant(request.tenant),
        vertical: VERTICAL_CATALOG[request.tenant.vertical],
      },
    };
  });

  fastify.patch(
    '/',
    { preHandler: [fastify.authenticate, fastify.requireRole('owner', 'admin')] },
    async (request) => {
      const input = parse(tenantUpdateSchema, request.body);
      const tenant = await Tenant.findById(request.tenant._id);

      if (input.name) tenant.name = input.name;
      if (input.branding) {
        tenant.branding = { ...tenant.branding.toObject?.(), ...input.branding };
      }
      if (input.contact) {
        tenant.contact = { ...tenant.contact.toObject?.(), ...input.contact };
      }
      if (input.settings) {
        tenant.settings = { ...tenant.settings.toObject?.(), ...input.settings };
      }

      await tenant.save();
      return { data: { tenant: serializeTenant(tenant) } };
    },
  );
}
