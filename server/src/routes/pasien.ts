import { FastifyInstance } from 'fastify';
import { requirePermission } from '../rbac.js';
import * as pasienModule from '../modules/pasien.js';

export async function pasienRoutes(app: FastifyInstance) {
  // GET /api/pasien
  app.get('/', async (request, reply) => {
    requirePermission(request.user.role, 'pasien', 'read');
    const result = await pasienModule.getAllPasien();
    return reply.send(result);
  });
  
  // Atomic patient + allergy/restriction intake for nursing workflow.
  app.post('/intake', async (request, reply) => {
    requirePermission(request.user.role, 'pasien', 'create');
    requirePermission(request.user.role, 'pantangan', 'create');
    const result = await pasienModule.createPatientIntake(request.body, request.user.id);
    return reply.status(201).send(result);
  });

  // POST /api/pasien
  app.post('/', async (request, reply) => {
    requirePermission(request.user.role, 'pasien', 'create');
    const result = await pasienModule.createPasien(request.body, request.user.id);
    return reply.status(201).send(result);
  });

  // GET /api/pasien/pulang — riwayat pasien yang sudah pulang (soft delete).
  app.get('/pulang', async (request, reply) => {
    requirePermission(request.user.role, 'pasien', 'read');
    const result = await pasienModule.getDischargedPasien();
    return reply.send(result);
  });

  // POST /api/pasien/:id/masuk-kembali — pasien lama masuk kembali.
  app.post('/:id/masuk-kembali', async (request, reply) => {
    requirePermission(request.user.role, 'pasien', 'create');
    const { id } = request.params as any;
    const result = await pasienModule.readmitPasien(id, request.body, request.user.id);
    return reply.send(result);
  });
  
  // PATCH /api/pasien/:id
  app.patch('/:id', async (request, reply) => {
    requirePermission(request.user.role, 'pasien', 'update');
    const { id } = request.params as any;
    const result = await pasienModule.updatePasien(id, request.body, request.user.id);
    return reply.send(result);
  });
  
  // DELETE /api/pasien/:id
  app.delete('/:id', async (request, reply) => {
    requirePermission(request.user.role, 'pasien', 'delete');
    const { id } = request.params as any;
    await pasienModule.deletePasien(id, request.user.id);
    return reply.status(204).send();
  });
}
