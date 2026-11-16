import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { query, transaction, installDb } = vi.hoisted(() => ({ query: vi.fn(), transaction: vi.fn(), installDb: vi.fn() }));
vi.mock('../../src/db/pool.js', () => ({ pool: { query: (...args: any[]) => query(...args) }, transaction: (...args: any[]) => transaction(...args), todayWIB: () => "(now() AT TIME ZONE 'Asia/Jakarta')::date" }));
import { buildApp } from '../../src/app.js';

describe('isolated HTTP workflow: intake to waiter delivery', () => {
  const db = new PGlite();
  const app = buildApp();
  const base = { nama: 'Fixture Pasien', rm: 'FIX-001', ruangan: '101', diagnosis: 'Umum', usia: 40, bb: 60, tb: 165, kalori: 1800, tekstur: 'Biasa' };
  let day: string;
  let ingredientId: string;
  beforeAll(async () => {
    installDb(db);
    query.mockImplementation((sql: string, params?: any[]) => db.query(sql, params));
    transaction.mockImplementation(async (fn: (client: any) => any) => {
      await db.exec('BEGIN');
      try { const value = await fn({ query: (sql: string, params?: any[]) => db.query(sql, params) }); await db.exec('COMMIT'); return value; }
      catch (error) { await db.exec('ROLLBACK'); throw error; }
    });
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);');
    await db.exec(readFileSync(resolve(process.cwd(), '../supabase/migrations/20261030000001_init.sql'), 'utf8'));
    await db.exec(readFileSync(resolve(process.cwd(), '../supabase/migrations/20261031000002_menu_recipes.sql'), 'utf8'));
    await db.exec(readFileSync(resolve(process.cwd(), '../supabase/migrations/20261031000003_kitchen_stock_reservations.sql'), 'utf8'));
    await db.exec(readFileSync(resolve(process.cwd(), '../supabase/migrations/20261114000008_menu_paket.sql'), 'utf8'));
    await db.exec(readFileSync(resolve(process.cwd(), '../supabase/migrations/20261116000011_menu_package_diet_texture.sql'), 'utf8'));
    await db.exec(readFileSync(resolve(process.cwd(), '../supabase/migrations/20261116000012_kitchen_stock_precision.sql'), 'utf8'));
    const d: any = await db.query("SELECT to_char((now() AT TIME ZONE 'Asia/Jakarta')::date,'YYYY-MM-DD') AS day"); day = d.rows[0].day;
    const b: any = await db.query("INSERT INTO bahan(nama,kategori,stok,satuan,minimum,kedaluwarsa) VALUES ('Beras fixture','Pokok',3,'kg',0,'2099-12-31') RETURNING id"); ingredientId = b.rows[0].id;
    await db.query("INSERT INTO menu_resep_bahan(menu,bahan_id,jumlah_per_porsi,satuan,kalori_per_porsi) VALUES ('Menu fixture', $1, 2.5, 'gram', 500)", [ingredientId]);
    const packageRow: any = await db.query("INSERT INTO menu_paket(nama,deskripsi,diet,tekstur) VALUES ('Menu fixture','Fixture','Diet Normal','Biasa') RETURNING id");
    await db.query("INSERT INTO menu_paket_resep(paket_id,resep_nama) VALUES ($1,'Menu fixture')", [packageRow.rows[0].id]);
  });
  afterAll(async () => { await app.close(); await db.close(); });
  it('creates intake, sends dietitian recommendation, validates kitchen stock and confirms waiter handoff', async () => {
    const intake = await app.inject({ method:'POST', url:'/api/pasien/intake', headers:{'x-nc-role':'perawat'}, payload:{...base,alergi:'-',pantangan:'Tidak ada'} });
    expect(intake.statusCode).toBe(201);
    const patientId = intake.json().patient.id;
    const rec = await app.inject({ method:'POST', url:'/api/rekomendasi', headers:{'x-nc-role':'ahli-gizi'}, payload:{ tanggal:day,pasien:base.nama,waktu:'Sarapan',tekstur:'Biasa',kalori:500,diet:'Diet Normal',menu:'Menu fixture',komposisi:'Beras fixture',catatan:'',status:'Dikirim' } });
    expect(rec.statusCode).toBe(201);
    const kitchen = await app.inject({ method:'GET', url:`/api/logistik/persiapan?tanggal=${day}`, headers:{'x-nc-role':'logistik'} });
    expect(kitchen.statusCode).toBe(200);
    await db.exec(`CREATE FUNCTION fail_stock_ledger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture ledger failure'; END $$; CREATE TRIGGER fail_stock_ledger_before_insert BEFORE INSERT ON stok_transaksi FOR EACH ROW EXECUTE FUNCTION fail_stock_ledger();`);
    const failedComplete = await app.inject({ method:'PATCH', url:'/api/logistik/persiapan/Sarapan', headers:{'x-nc-role':'logistik'}, payload:{status:'Selesai',tanggal:day} });
    expect(failedComplete.statusCode).toBe(500);
    const rolledBack: any = await db.query('SELECT stok,(SELECT count(*) FROM persiapan_bahan_reservasi WHERE bahan_id=$1) AS reservations,(SELECT count(*) FROM stok_transaksi WHERE bahan_id=$1) AS ledger_count FROM bahan WHERE id=$1',[ingredientId]);
    expect(rolledBack.rows[0]).toMatchObject({stok:'3.0000',reservations:0,ledger_count:0});
    await db.exec('DROP TRIGGER fail_stock_ledger_before_insert ON stok_transaksi; DROP FUNCTION fail_stock_ledger();');
    const complete = await app.inject({ method:'PATCH', url:'/api/logistik/persiapan/Sarapan', headers:{'x-nc-role':'logistik'}, payload:{status:'Selesai',tanggal:day} });
    expect(complete.statusCode).toBe(200);
    const queue = await app.inject({ method:'GET', url:'/api/jadwal/distribusi-siap', headers:{'x-nc-role':'waiter'} });
    expect(queue.statusCode).toBe(200);
    expect(queue.json()).toHaveLength(1);
    expect(queue.json()[0]).toMatchObject({pasien:base.nama,menu:'Menu fixture'});
    const delivered = await app.inject({ method:'PATCH', url:`/api/jadwal/${queue.json()[0].id}/terkirim`, headers:{'x-nc-role':'waiter'} });
    expect(delivered.statusCode).toBe(200);
    expect(delivered.json().status).toBe('Terkirim');
    const sentList = await app.inject({ method:'GET', url:'/api/jadwal/terkirim', headers:{'x-nc-role':'waiter'} });
    expect(sentList.statusCode).toBe(200);
    expect(sentList.json()).toHaveLength(1);
    expect(sentList.json()[0]).toMatchObject({pasien:base.nama,menu:'Menu fixture',status:'Terkirim'});
    const readyAfterDelivery = await app.inject({ method:'GET', url:'/api/jadwal/distribusi-siap', headers:{'x-nc-role':'waiter'} });
    expect(readyAfterDelivery.json()).toHaveLength(0);
    const verify = await db.query('SELECT p.nama,pa.alergi,j.status,d.status AS kitchen FROM pasien p JOIN pantangan_alergi pa ON pa.pasien_id=p.id JOIN jadwal_makan j ON j.pasien_id=p.id JOIN persiapan_dapur d ON d.waktu=j.waktu WHERE p.id=$1',[patientId]);
    expect(verify.rows[0]).toMatchObject({nama:base.nama,alergi:'-',status:'Terkirim',kitchen:'Selesai'});
    const ledger: any = await db.query("SELECT b.stok, s.jenis, s.jumlah FROM bahan b JOIN stok_transaksi s ON s.bahan_id=b.id WHERE b.id=$1", [ingredientId]);
    expect(ledger.rows).toHaveLength(1);
    expect(ledger.rows[0]).toMatchObject({stok:'2.9975',jenis:'Keluar',jumlah:'0.0025'});
    const repeated = await app.inject({ method:'PATCH', url:'/api/logistik/persiapan/Sarapan', headers:{'x-nc-role':'logistik'}, payload:{status:'Selesai',tanggal:day} });
    expect(repeated.statusCode).toBe(200);
    const afterRepeat: any = await db.query('SELECT stok,(SELECT count(*) FROM stok_transaksi WHERE bahan_id=$1) AS ledger_count FROM bahan WHERE id=$1',[ingredientId]);
    expect(afterRepeat.rows[0]).toMatchObject({stok:'2.9975',ledger_count:1});

  });
});
