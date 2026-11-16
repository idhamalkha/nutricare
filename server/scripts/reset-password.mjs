#!/usr/bin/env node
// Reset password akun NutriCare lewat Supabase Admin API.
//
// Pemakaian (password TIDAK ditulis di baris perintah agar tidak tersimpan di
// riwayat shell; skrip akan meminta lewat stdin):
//
//   node scripts/reset-password.mjs <username>
//
// Atau non-interaktif (mis. dari CI):
//   NEW_PASSWORD='...' node scripts/reset-password.mjs <username>
//
// Skrip hanya mengubah password Auth user yang tertaut ke profil tersebut dan
// tidak menyentuh data lain.
import 'dotenv/config';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { createInterface } from 'node:readline/promises';

const username = process.argv[2];
if (!username) {
  console.error('Pemakaian: node scripts/reset-password.mjs <username>');
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diisi di .env');
  process.exit(1);
}

let password = process.env.NEW_PASSWORD;
if (!password) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  password = await rl.question(`Password baru untuk ${username}: `);
  rl.close();
}
if (!password || password.length < 8) {
  console.error('Password minimal 8 karakter.');
  process.exit(1);
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
const found = await db.query('SELECT id, username, role, nama FROM profiles WHERE lower(username)=lower($1)', [username]);
await db.end();

if (found.rowCount === 0) {
  console.error(`Profil "${username}" tidak ditemukan.`);
  process.exit(1);
}
if (found.rowCount > 1) {
  console.error('Username tidak unik; hentikan.');
  process.exit(1);
}

const profile = found.rows[0];
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
const { error } = await supabase.auth.admin.updateUserById(profile.id, { password });
if (error) {
  console.error('Gagal reset:', error.message);
  process.exit(1);
}
console.log(`Password diperbarui untuk ${profile.username} (${profile.role} / ${profile.nama}).`);
console.log('Minta pengguna mengganti password setelah login pertama.');
