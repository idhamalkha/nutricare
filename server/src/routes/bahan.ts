import { FastifyInstance } from 'fastify';
import { requirePermission } from '../rbac.js';
import * as bahanModule from '../modules/bahan.js';

export async function bahanRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    requirePermission(request.user.role, 'bahan', 'read');
    const result = await bahanModule.getAllBahan();
    return reply.send(result);
  });
  
  app.post('/', async (request, reply) => {
    requirePermission(request.user.role, 'bahan', 'create');
    const result = await bahanModule.createBahan(request.body, request.user.id);
    return reply.status(201).send(result);
  });
  
  app.patch('/:id', async (request, reply) => {
    requirePermission(request.user.role, 'bahan', 'update');
    const { id } = request.params as any;
    const result = await bahanModule.updateBahan(id, request.body, request.user.id);
    return reply.send(result);
  });
  
  app.delete('/:id', async (request, reply) => {
    requirePermission(request.user.role, 'bahan', 'delete');
    const { id } = request.params as any;
    await bahanModule.deleteBahan(id, request.user.id);
    return reply.status(204).send();
  });
}
