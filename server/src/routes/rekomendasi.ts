import { FastifyInstance } from 'fastify';
import { requirePermission } from '../rbac.js';
import * as rekomendasiModule from '../modules/rekomendasi.js';

export async function rekomendasiRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    requirePermission(request.user.role, 'rekomendasi', 'read');
    const result = await rekomendasiModule.getAllRekomendasi();
    return reply.send(result);
  });
  
  app.post('/', async (request, reply) => {
    requirePermission(request.user.role, 'rekomendasi', 'create');
    const result = await rekomendasiModule.createRekomendasi(request.body, request.user.id);
    return reply.status(201).send(result);
  });
  
  app.patch('/:id', async (request, reply) => {
    requirePermission(request.user.role, 'rekomendasi', 'update');
    const { id } = request.params as any;
    const result = await rekomendasiModule.updateRekomendasi(id, request.body, request.user.id);
    return reply.send(result);
  });
  
  app.delete('/:id', async (request, reply) => {
    requirePermission(request.user.role, 'rekomendasi', 'delete');
    const { id } = request.params as any;
    await rekomendasiModule.deleteRekomendasi(id, request.user.id);
    return reply.status(204).send();
  });
}
