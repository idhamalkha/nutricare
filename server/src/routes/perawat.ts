import { FastifyInstance } from 'fastify';
import { requirePermission } from '../rbac.js';
import * as perawatModule from '../modules/perawat.js';

export async function perawatRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    requirePermission(request.user.role, 'perawat', 'read');
    const result = await perawatModule.getAllLaporan();
    return reply.send(result);
  });
  
  app.post('/', async (request, reply) => {
    requirePermission(request.user.role, 'perawat', 'create');
    const result = await perawatModule.createLaporan(request.body, request.user.id);
    return reply.status(201).send(result);
  });
  
  app.patch('/:id', async (request, reply) => {
    requirePermission(request.user.role, 'perawat', 'update');
    const { id } = request.params as any;
    const result = await perawatModule.updateLaporan(id, request.body, request.user.id);
    return reply.send(result);
  });
  
  app.delete('/:id', async (request, reply) => {
    requirePermission(request.user.role, 'perawat', 'delete');
    const { id } = request.params as any;
    await perawatModule.deleteLaporan(id, request.user.id);
    return reply.status(204).send();
  });
}
