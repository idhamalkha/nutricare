import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.database.url,
  // Supabase pooler mode: transaction (tidak support prepared statements)
  // Jadi kita pakai query biasa tanpa prepare
  // Supabase pooler (session mode) membatasi total 15 klien per project.
  // Jangan melebihi itu, kalau tidak koneksi baru ditolak (EMAXCONNSESSION).
  // Satu proses hanya butuh beberapa koneksi; sisanya antre di pool.
  // Dengan transaction pooler (port 6543) koneksi dipakai bergantian,
  // jadi beberapa pengguna bisa memakai pool yang sama.
  // Serverless runtimes reuse warm instances; keep per-instance connections low.
  max: Number(process.env.DB_POOL_MAX || (process.env.VERCEL || process.env.NETLIFY ? 1 : 5)),
  // Koneksi menganggur dilepas lebih cepat supaya tidak menahan slot pooler.
  idleTimeoutMillis: 60000, // 1 menit
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  connectionTimeoutMillis: 12000,
  // Nama aplikasi membantu saat memeriksa pg_stat_activity.
  application_name: 'nutricare-api',
  // Query sederhana cukup; batasi waktu tunggu agar tidak menggantung.
  statement_timeout: 20000,
});

// Supabase menutup koneksi yang menganggur; pool otomatis membuat koneksi baru.
// Cukup catat pesannya supaya log tidak dipenuhi dump objek Client.
pool.on('error', (err) => {
  console.warn(`Koneksi database terputus, pool akan menyambung ulang: ${err.message}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing database pool...');
  await pool.end();
  process.exit(0);
});

// Helper untuk transaksi
export async function transaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Helper untuk hari ini di zona Asia/Jakarta
export function todayWIB() {
  return "(now() AT TIME ZONE 'Asia/Jakarta')::date";
}
