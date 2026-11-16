import { FastifyInstance } from 'fastify';
import { requirePermission } from '../rbac.js';
import * as pantanganModule from '../modules/pantangan.js';

export async function pantanganRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    requirePermission(request.user.role, 'pantangan', 'read');
    const result = await pantanganModule.getAllPantangan();
    return reply.send(result);
  });
  
  app.post('/', async (request, reply) => {
    requirePermission(request.user.role, 'pantangan', 'create');
    const result = await pantanganModule.createPantangan(request.body, request.user.id);
    return reply.status(201).send(result);
  });
  
  app.patch('/:id', async (request, reply) => {
    requirePermission(request.user.role, 'pantangan', 'update');
    const { id } = request.params as any;
    const result = await pantanganModule.updatePantangan(id, request.body, request.user.id);
    return reply.send(result);
  });
  
  app.delete('/:id', async (request, reply) => {
    requirePermission(request.user.role, 'pantangan', 'delete');
    const { id } = request.params as any;
    await pantanganModule.deletePantangan(id, request.user.id);
    return reply.status(204).send();
  });
}
