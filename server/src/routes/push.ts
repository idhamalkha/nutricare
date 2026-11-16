import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';
import webpush from 'web-push';
import { createNotificationsForRoles } from '../modules/notifications.js';

const publicKey = process.env.VAPID_PUBLIC_KEY || '';
const privateKey = process.env.VAPID_PRIVATE_KEY || '';
const subject = process.env.VAPID_SUBJECT || 'mailto:admin@nutricare.local';
const enabled = Boolean(publicKey && privateKey);
if (enabled) webpush.setVapidDetails(subject, publicKey, privateKey);

export async function pushRoutes(app: FastifyInstance) {
 app.get('/push/vapid-public-key', async () => ({ enabled, publicKey: enabled ? publicKey : null }));
 app.post('/push/subscriptions', async (req: any, reply) => {
  if (!enabled) return reply.code(503).send({ error: 'Push belum dikonfigurasi; polling tetap aktif.' });
  const sub=req.body as any;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth || !/^https:\/\//.test(sub.endpoint)) return reply.code(400).send({error:'Subscription tidak valid.'});
  await pool.query(`INSERT INTO push_subscriptions(user_id,role,endpoint,p256dh,auth_key) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,role,endpoint) DO UPDATE SET p256dh=EXCLUDED.p256dh,auth_key=EXCLUDED.auth_key`,[req.user.id,req.user.role,sub.endpoint,sub.keys.p256dh,sub.keys.auth]);
  return reply.code(204).send();
 });
 app.delete('/push/subscriptions', async (req: any, reply) => {
  const endpoint=(req.body as any)?.endpoint;
  if (endpoint) await pool.query('DELETE FROM push_subscriptions WHERE user_id=$1 AND endpoint=$2',[req.user.id,endpoint]);
  return reply.code(204).send();
 });
}

const validRoles = new Set(['ahli-gizi','perawat','waiter','logistik','dapur']);
async function deliver(rows:any[], title:string, body:string) {
 const payload=JSON.stringify({title,body});
 await Promise.all(rows.map(async (row:any) => {
  try { await webpush.sendNotification({endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth_key}},payload); }
  catch(error:any) { if(error.statusCode===404 || error.statusCode===410) await pool.query('DELETE FROM push_subscriptions WHERE id=$1',[row.id]); }
 }));
}
export async function sendPushToRole(roles: string[], title: string, body: string, options: { type?: string; link?: string | null; roleLinks?: Record<string, string>; detail?: any } = {}) {
 const selected = [...new Set(roles.filter(role => validRoles.has(role)))];
 if (!selected.length) return;
 // Persist inbox notification first, even when Web Push/VAPID is disabled.
 await createNotificationsForRoles(selected, { title, body, type: options.type || 'info', link: options.link || null, roleLinks: options.roleLinks, detail: options.detail || null });
 if (!enabled) return;
 const rows=await pool.query('SELECT id,endpoint,p256dh,auth_key FROM push_subscriptions WHERE role=ANY($1::text[])',[selected]);
 await deliver(rows.rows,title,body);
}

export async function sendPushToUser(userId: string, title: string, body: string) {
 if (!enabled) return;
 const rows=await pool.query('SELECT id,endpoint,p256dh,auth_key FROM push_subscriptions WHERE user_id=$1',[userId]);
 await deliver(rows.rows,title,body);
}
