import { FastifyInstance } from 'fastify';
import { requirePermission } from '../rbac.js';
import * as jadwalModule from '../modules/jadwal.js';

export async function jadwalRoutes(app: FastifyInstance) {
  app.get('/distribusi-siap', async (request, reply) => {
    requirePermission(request.user.role, 'jadwal', 'read');
    return reply.send(await jadwalModule.getReadyDistribution());
  });

  app.get('/terkirim', async (request, reply) => {
    requirePermission(request.user.role, 'jadwal', 'read');
    return reply.send(await jadwalModule.getDeliveredDistribution());
  });

  app.patch('/:id/terkirim', async (request, reply) => {
    requirePermission(request.user.role, 'jadwal', 'action');
    const { id } = request.params as any;
    return reply.send(await jadwalModule.markDelivered(id));
  });

  app.get('/pasien-distribusi', async (request, reply) => {
    requirePermission(request.user.role, 'jadwal', 'read');
    return reply.send(await jadwalModule.getDistributionPatients());
  });
  
  app.get('/', async (request, reply) => {
    requirePermission(request.user.role, 'jadwal', 'read');
    const result = await jadwalModule.getAllJadwal();
    return reply.send(result);
  });
  
  app.post('/', async (request, reply) => {
    requirePermission(request.user.role, 'jadwal', 'create');
    const result = await jadwalModule.createJadwal(request.body, request.user.role, request.user.id);
    return reply.status(201).send(result);
  });
  
  app.patch('/:id', async (request, reply) => {
    requirePermission(request.user.role, 'jadwal', 'update');
    const { id } = request.params as any;
    const result = await jadwalModule.updateJadwal(id, request.body, request.user.role, request.user.id);
    return reply.send(result);
  });
  
  app.delete('/:id', async (request, reply) => {
    requirePermission(request.user.role, 'jadwal', 'delete');
    const { id } = request.params as any;
    await jadwalModule.deleteJadwal(id, request.user.id);
    return reply.status(204).send();
  });
}
