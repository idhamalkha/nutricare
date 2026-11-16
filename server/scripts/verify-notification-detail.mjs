// Uji tulis-baca kolom notifications.detail di dalam transaksi yang dibatalkan.
// Tidak ada data yang tersimpan: selalu ROLLBACK.
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import dotenv from 'dotenv';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(__dirname, '..');
dotenv.config({ path: join(serverRoot, '.env') });

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15000,
});

const detail = {
  kind: 'pasien',
  ringkas: 'Uji rincian (dibatalkan).',
  fields: [{ label: 'Ruangan', value: 'Melati 3' }],
};

try {
  await client.connect();
  await client.query('BEGIN');
  const inserted = await client.query(
    `INSERT INTO notifications(user_id, role, type, title, body, link, detail)
     SELECT id, role, 'info', 'Uji rincian', 'Uji rincian notifikasi', NULL, $1::jsonb
     FROM profiles LIMIT 1
     RETURNING id, detail`,
    [JSON.stringify(detail)]
  );
  const row = inserted.rows[0];
  // jsonb menyusun ulang urutan kunci, jadi bandingkan isinya per bagian.
  const kembali = row.detail || {};
  const cocok = kembali.kind === detail.kind
    && kembali.ringkas === detail.ringkas
    && Array.isArray(kembali.fields)
    && kembali.fields.length === 1
    && kembali.fields[0].label === 'Ruangan'
    && kembali.fields[0].value === 'Melati 3';
  console.log('Baris uji:', row.id);
  console.log('Detail kembali:', JSON.stringify(row.detail));
  console.log('Isi rincian utuh:', cocok);
  await client.query('ROLLBACK');
  const sisa = await client.query(`SELECT COUNT(*)::int AS total FROM notifications WHERE title = 'Uji rincian'`);
  console.log('Setelah rollback, baris uji tersisa:', sisa.rows[0].total);
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Uji gagal:', error.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
