import { FastifyInstance } from 'fastify';
import { login, revokeSession } from '../auth/index.js';
import * as m from '../modules/account.js';
import { ValidationError } from '../http/errors.js';
export async function accountRoutes(app:FastifyInstance){
 app.post('/auth/login',async(req:any,reply)=>{const d=req.body||{};if(!d.username||!d.password)throw new ValidationError('Username dan password wajib diisi.');return reply.send(await login(d));});
 app.post('/auth/logout',async(req,reply)=>{const authorization=req.headers.authorization||'';if(authorization.startsWith('Bearer '))await revokeSession(authorization.slice(7));return reply.code(204).send();});
 app.get('/me',async(req:any,reply)=>reply.send(await m.me(req.user.id,req.user.role)));
 app.patch('/me',async(req:any,reply)=>reply.send(await m.updateMe(req.user.id,req.body||{})));
 app.patch('/me/password',async(req:any,reply)=>{await m.changePassword(req.user.id,req.body||{});return reply.code(204).send();});
 app.get('/me/preferensi',async(req:any,reply)=>reply.send(await m.getPrefs(req.user.id)));
 app.put('/me/preferensi',async(req:any,reply)=>reply.send(await m.putPrefs(req.user.id,req.body||{})));
}
