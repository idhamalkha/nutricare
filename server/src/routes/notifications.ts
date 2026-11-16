import { FastifyInstance } from 'fastify';
import {
  clearNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../modules/notifications.js';

export async function notificationRoutes(app: FastifyInstance) {
  app.get('/notifications', async (request: any, reply) => {
    const raw = Number((request.query as any)?.limit || 50);
    const result = await listNotifications(request.user.id, Number.isFinite(raw) ? raw : 50);
    return reply.send(result);
  });

  app.patch('/notifications/read-all', async (request: any, reply) => {
    const updated = await markAllNotificationsRead(request.user.id);
    return reply.send({ updated });
  });

  app.patch('/notifications/:id/read', async (request: any, reply) => {
    const { id } = request.params as any;
    await markNotificationRead(request.user.id, id);
    return reply.send({ success: true });
  });

  app.delete('/notifications', async (request: any, reply) => {
    const deleted = await clearNotifications(request.user.id);
    return reply.send({ deleted });
  });
}
