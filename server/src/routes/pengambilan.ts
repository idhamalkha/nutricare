import { FastifyInstance } from 'fastify';
import { requirePermission } from '../rbac.js';
import * as pengambilanModule from '../modules/pengambilan.js';

// Pengambilan ompreng: dipakai waiter. Evaluasi makanan: dipakai ahli gizi.
export async function pengambilanRoutes(app: FastifyInstance) {
  app.get('/antrean', async (request, reply) => {
    requirePermission(request.user.role, 'pengambilan', 'read');
    return reply.send(await pengambilanModule.getAntreanPengambilan());
  });

  app.get('/riwayat', async (request, reply) => {
    requirePermission(request.user.role, 'pengambilan', 'read');
    return reply.send(await pengambilanModule.getRiwayatPengambilan());
  });

  app.post('/', async (request, reply) => {
    requirePermission(request.user.role, 'pengambilan', 'action');
    const result = await pengambilanModule.createPengambilan(request.body, request.user.id);
    return reply.status(201).send(result);
  });
}

export async function evaluasiRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    requirePermission(request.user.role, 'evaluasi', 'read');
    return reply.send(await pengambilanModule.getAllEvaluasi());
  });

  app.patch('/:id', async (request, reply) => {
    requirePermission(request.user.role, 'evaluasi', 'update');
    const { id } = request.params as any;
    return reply.send(await pengambilanModule.simpanEvaluasi(id, request.body, request.user.id));
  });
}
