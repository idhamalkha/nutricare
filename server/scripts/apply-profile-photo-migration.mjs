// Menjalankan migrasi kolom profiles.foto_profil (idempoten).
// Pakai: cd server && node scripts/apply-profile-photo-migration.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import dotenv from 'dotenv';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(__dirname, '..');
dotenv.config({ path: join(serverRoot, '.env') });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL belum diisi di server/.env');
  process.exit(1);
}

const sqlPath = join(serverRoot, '..', 'supabase', 'migrations', '20261101000005_profile_photo.sql');
const sql = readFileSync(sqlPath, 'utf8');

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15000,
});

try {
  await client.connect();
  await client.query(sql);

  const col = await client.query(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'foto_profil'`
  );

  const count = await client.query(
    'SELECT COUNT(*)::int AS total, COUNT(foto_profil)::int AS dengan_foto FROM profiles'
  );

  console.log('Kolom foto_profil:', col.rows[0] || 'TIDAK ADA');
  console.log('Total profil:', count.rows[0].total, '| sudah punya foto:', count.rows[0].dengan_foto);
  console.log('Migrasi selesai.');
} catch (error) {
  console.error('Migrasi gagal:', error.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
