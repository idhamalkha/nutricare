import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('recipe migration on isolated PostgreSQL-compatible fixture', () => {
  it('creates the recipe table, constraints, uniqueness, FK and RLS without touching a remote database', async () => {
    const db = new PGlite();
    try {
      await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);`);
      const baseline = readFileSync(resolve(process.cwd(), '../supabase/migrations/20261030000001_init.sql'), 'utf8');
      await db.exec(baseline);
      const migration = readFileSync(resolve(process.cwd(), '../supabase/migrations/20261031000002_menu_recipes.sql'), 'utf8');
      await db.exec(migration);
      const ledgerMigration = readFileSync(resolve(process.cwd(), '../supabase/migrations/20261031000003_kitchen_stock_reservations.sql'), 'utf8');
      await db.exec(ledgerMigration);
      const pushMigration = readFileSync(resolve(process.cwd(), '../supabase/migrations/20261031000004_web_push.sql'), 'utf8');
      await db.exec(pushMigration);
      await db.exec(`INSERT INTO bahan(id,nama,kategori,stok,satuan,minimum,kedaluwarsa) VALUES ('00000000-0000-4000-8000-000000000001','Beras','Pokok',10,'kg',1,'2027-12-31');`);
      await db.exec(`INSERT INTO menu_resep_bahan(menu,bahan_id,jumlah_per_porsi,satuan) VALUES ('Nasi ayam','00000000-0000-4000-8000-000000000001',0.08,'kg');`);
      const table = await db.query(`SELECT column_name,data_type,numeric_precision,numeric_scale FROM information_schema.columns WHERE table_name='menu_resep_bahan' AND column_name='jumlah_per_porsi'`);
      expect(table.rows).toHaveLength(1);
      expect(table.rows[0]).toMatchObject({ data_type: 'numeric', numeric_precision: 12, numeric_scale: 3 });
      const rls: any = await db.query(`SELECT relrowsecurity FROM pg_class WHERE relname='menu_resep_bahan'`);
      expect(rls.rows[0]?.relrowsecurity).toBe(true);
      const pushTable: any = await db.query(`SELECT relrowsecurity FROM pg_class WHERE relname='push_subscriptions'`);
      expect(pushTable.rows[0]?.relrowsecurity).toBe(true);
      const pushColumns: any = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name='push_subscriptions'`);
      expect(pushColumns.rows.map((row:any)=>row.column_name)).toContain('role');
      const ledger: any = await db.query(`SELECT relrowsecurity FROM pg_class WHERE relname='persiapan_bahan_reservasi'`);
      expect(ledger.rows[0]?.relrowsecurity).toBe(true);
      const reservationColumns: any = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name='persiapan_bahan_reservasi'`);
      expect(reservationColumns.rows.map((row:any)=>row.column_name)).toContain('stok_transaksi_id');
      expect(reservationColumns.rows.map((row:any)=>row.column_name)).toContain('status');
      await expect(db.exec(`INSERT INTO persiapan_bahan_reservasi(tanggal,waktu,menu,bahan_id,jumlah,stok_transaksi_id) VALUES ('2026-10-31','Sarapan','Nasi ayam','00000000-0000-4000-8000-000000000001',0.08,gen_random_uuid())`)).rejects.toThrow();
      await expect(db.exec(`INSERT INTO menu_resep_bahan(menu,bahan_id,jumlah_per_porsi,satuan) VALUES ('nasi AYAM','00000000-0000-4000-8000-000000000001',0.09,'kg')`)).rejects.toThrow();
      await expect(db.exec(`INSERT INTO menu_resep_bahan(menu,bahan_id,jumlah_per_porsi,satuan) VALUES ('Menu tak valid','00000000-0000-4000-8000-000000000099',0.09,'kg')`)).rejects.toThrow();
      await expect(db.exec(`INSERT INTO menu_resep_bahan(menu,bahan_id,jumlah_per_porsi,satuan) VALUES ('Jumlah nol','00000000-0000-4000-8000-000000000001',0,'kg')`)).rejects.toThrow();
    } finally {
      await db.close();
    }
  }, 60000);
});
