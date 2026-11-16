import { FastifyInstance } from 'fastify';
import { requirePermission } from '../rbac.js';
import { ForbiddenError } from '../http/errors.js';
import * as m from '../modules/logistik.js';

export async function logistikRoutes(app: FastifyInstance) {
  const auth=(req:any)=>req.user;
  app.get('/stok',async(req,reply)=>{const u=auth(req);requirePermission(u.role,'logistik','read');return reply.send(await m.listStok());});
  app.post('/stok',async(req:any,reply)=>{const u=auth(req);requirePermission(u.role,'logistik','create');return reply.code(201).send(await m.createStok(req.body,u.id));});
  app.get('/pengajuan',async(req,reply)=>{const u=auth(req);requirePermission(u.role,'logistik','read');return reply.send(await m.listPengajuan());});
  app.post('/pengajuan',async(req:any,reply)=>{const u=auth(req);requirePermission(u.role,'logistik','create');return reply.code(201).send(await m.createPengajuan(req.body,u.id));});
  app.patch('/pengajuan/:id',async(req:any,reply)=>{const u=auth(req);requirePermission(u.role,'logistik','update');return reply.send(await m.updatePengajuan(req.params.id,req.body,u.id));});
  app.get('/pengembalian',async(req,reply)=>{const u=auth(req);requirePermission(u.role,'logistik','read');return reply.send(await m.listPengembalian());});
  app.post('/pengembalian',async(req:any,reply)=>{const u=auth(req);requirePermission(u.role,'logistik','create');return reply.code(201).send(await m.createPengembalian(req.body,u.id));});
  app.get('/persiapan',async(req:any,reply)=>{const u=auth(req);if(!['logistik','dapur'].includes(u.role))throw new ForbiddenError('Anda tidak memiliki izin untuk aksi ini.');const q=req.query as any;return reply.send(await m.getPersiapan(q.tanggal));});
  app.patch('/persiapan/:waktu',async(req:any,reply)=>{const u=auth(req);if(!['logistik','dapur'].includes(u.role))throw new ForbiddenError('Anda tidak memiliki izin untuk aksi ini.');return reply.send(await m.patchPersiapan(req.params.waktu,req.body));});
  // Resep (hidangan tunggal + bahan + kalori)
  app.get('/resep',async(req,reply)=>{const u=auth(req);requirePermission(u.role,'logistik','read');return reply.send(await m.listMenuRecipes());});
  app.put('/resep',async(req:any,reply)=>{const u=auth(req);requirePermission(u.role,'logistik','update');const d=req.body||{};return reply.send(await m.replaceMenuRecipe(d.menu,d.items));});
  app.delete('/resep/:menu',async(req:any,reply)=>{const u=auth(req);requirePermission(u.role,'logistik','delete');return reply.send(await m.deleteMenuRecipe(decodeURIComponent(req.params.menu)));});
  // Menu Paket (kumpulan resep, kalori otomatis)
  app.get('/menu',async(req,reply)=>{const u=auth(req);requirePermission(u.role,'logistik','read');return reply.send(await m.listMenuPaket());});
  app.post('/menu',async(req:any,reply)=>{const u=auth(req);requirePermission(u.role,'logistik','create');return reply.code(201).send(await m.createMenuPaket(req.body));});
  app.patch('/menu/:id',async(req:any,reply)=>{const u=auth(req);requirePermission(u.role,'logistik','update');return reply.send(await m.updateMenuPaket(req.params.id,req.body));});
  app.delete('/menu/:id',async(req:any,reply)=>{const u=auth(req);requirePermission(u.role,'logistik','delete');return reply.send(await m.deleteMenuPaket(req.params.id));});
  // Laporan & ringkasan
  app.get('/ringkasan',async(req,reply)=>{const u=auth(req);if(!['logistik','dapur'].includes(u.role))throw new ForbiddenError('Anda tidak memiliki izin untuk aksi ini.');return reply.send(await m.ringkasan());});
  app.get('/laporan/pemakaian',async(req,reply)=>{const u=auth(req);if(!['logistik','dapur'].includes(u.role))throw new ForbiddenError('Anda tidak memiliki izin untuk aksi ini.');return reply.send(await m.pemakaian());});
  app.get('/laporan/kondisi-stok',async(req,reply)=>{const u=auth(req);requirePermission(u.role,'logistik','read');return reply.send(await m.kondisiStok());});
}
