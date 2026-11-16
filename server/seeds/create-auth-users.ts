// Script untuk membuat akun demo di Supabase Auth
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const accounts = [
  {
    role: 'logistik',
    username: 'logistik',
    email: 'logistik@nutricare.com',
    nama: 'Petugas Logistik',
    telepon: '08123456789',
  },
  {
    role: 'ahli-gizi',
    username: 'ahli-gizi',
    email: 'ahligizi@nutricare.com',
    nama: 'Ahli Gizi',
    telepon: '08123456788',
  },
  {
    role: 'perawat',
    username: 'perawat',
    email: 'perawat@nutricare.com',
    nama: 'Perawat',
    telepon: '08123456787',
  },
  {
    role: 'waiter',
    username: 'waiter',
    email: 'waiter@nutricare.com',
    nama: 'Waiter',
    telepon: '08123456786',
  },
];

async function createAuthUsers() {
  const password = process.env.SEED_DEMO_PASSWORD || '';
  if (password.length < 8) {
    console.error('SEED_DEMO_PASSWORD wajib diisi (minimal 8 karakter) di server/.env.');
    process.exit(1);
  }
  
  console.log('🚀 Membuat akun demo...');
  
  for (const account of accounts) {
    try {
      // Buat user di Supabase Auth
      const { data, error } = await supabase.auth.admin.createUser({
        email: account.email,
        password,
        email_confirm: true,
        user_metadata: {
          nama: account.nama,
          role: account.role,
        },
      });
      
      if (error) {
        if (error.message.includes('already registered')) {
          console.log(`⚠️  ${account.email} sudah ada, skip...`);
          
          // Ambil user ID dari auth.users
          const { data: existingUsers } = await supabase.auth.admin.listUsers();
          const existingUser = existingUsers?.users.find(u => u.email === account.email);
          
          if (existingUser) {
            // Update atau insert profile
            await pool.query(
              `INSERT INTO profiles (id, role, username, nama, telepon, aktif)
               VALUES ($1, $2, $3, $4, $5, true)
               ON CONFLICT (id) DO UPDATE SET
                 role = EXCLUDED.role,
                 username = EXCLUDED.username,
                 nama = EXCLUDED.nama,
                 telepon = EXCLUDED.telepon`,
              [existingUser.id, account.role, account.username, account.nama, account.telepon]
            );
            console.log(`✅ Profile ${account.email} diperbarui`);
          }
          continue;
        }
        throw error;
      }
      
      if (!data.user) {
        console.error(`❌ Gagal membuat ${account.email}`);
        continue;
      }
      
      // Buat profile di database
      await pool.query(
        `INSERT INTO profiles (id, role, username, nama, telepon, aktif)
         VALUES ($1, $2, $3, $4, $5, true)`,
        [data.user.id, account.role, account.username, account.nama, account.telepon]
      );
      
      console.log(`✅ ${account.email} (${account.role}) - password: ${password}`);
    } catch (err: any) {
      console.error(`❌ Error membuat ${account.email}:`, err.message);
    }
  }
  
  console.log('\n✅ Selesai!');
  console.log(`\n📝 Login dengan salah satu akun di atas, password: ${password}`);
  
  await pool.end();
}

createAuthUsers().catch(console.error);
