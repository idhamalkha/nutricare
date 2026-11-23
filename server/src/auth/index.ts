// Auth: mode demo (X-NC-Role header) dan strict (Supabase token)
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { config } from '../config.js';
import { UnauthorizedError } from '../http/errors.js';
import { pool } from '../db/pool.js';

// Verifikasi token Supabase = satu panggilan jaringan + satu query.
// Hasilnya disimpan sebentar (default 60 detik) agar setiap request API tidak
// membayar dua round-trip. Logout menghapus entri token tersebut.
const TOKEN_TTL_MS = Number(process.env.AUTH_CACHE_TTL_MS || 60000);
const tokenCache = new Map<string, { user: AuthUser; expires: number }>();
const tokenKey = (token: string) => createHash('sha256').update(token).digest('hex');

const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey
);

export type AuthUser = {
  id: string;
  role: 'ahli-gizi' | 'waiter' | 'logistik' | 'dapur';
  nama: string;
  email?: string;
};

// Mode demo: baca role dari header X-NC-Role
export function getDemoUser(roleHeader: string | undefined): AuthUser {
  if (!roleHeader) {
    throw new UnauthorizedError('Header X-NC-Role wajib diisi.');
  }
  
  const validRoles = ['ahli-gizi', 'waiter', 'logistik', 'dapur'];
  if (!validRoles.includes(roleHeader)) {
    throw new UnauthorizedError('Role tidak valid untuk NutriCare. Perawat dan Dokter silakan gunakan aplikasi Nadi.');
  }
  
  return {
    id: 'demo-user',
    role: roleHeader as any,
    nama: roleHeader === 'ahli-gizi' ? 'Ahli Gizi' : 
          roleHeader === 'waiter' ? 'Waiter' :
          roleHeader === 'dapur' ? 'Petugas Dapur' : 'Petugas Logistik',
  };
}

// Mode strict: validasi Bearer token Supabase
export async function getAuthUser(token: string): Promise<AuthUser> {
  const cacheKey = tokenKey(token);
  const cachedUser = tokenCache.get(cacheKey);
  if (cachedUser && cachedUser.expires > Date.now()) return cachedUser.user;

  // Validasi token dengan Supabase
  const authResult = await supabase.auth.getUser(token);
  const data = authResult && authResult.data;
  const error = authResult && authResult.error;

  if (error || !data || !data.user) {
    throw new UnauthorizedError('Token tidak valid.');
  }
  
  // Ambil profile dari database
  const result = await pool.query(
    'SELECT id, role, nama FROM profiles WHERE id = $1 AND aktif = true',
    [data.user.id]
  );
  
  if (result.rows.length === 0) {
    throw new UnauthorizedError('Profil pengguna tidak ditemukan.');
  }
  
  const profile = result.rows[0];
  
  if (profile.role === 'perawat' || profile.role === 'dokter') {
    throw new UnauthorizedError('Akun Perawat/Dokter harus mengakses aplikasi Nadi, bukan NutriCare.');
  }

  const user: AuthUser = {
    id: profile.id,
    role: profile.role,
    nama: profile.nama,
    email: data.user.email,
  };

  if (tokenCache.size > 500) tokenCache.clear();
  tokenCache.set(cacheKey, { user, expires: Date.now() + TOKEN_TTL_MS });

  return user;
}

export async function revokeSession(token: string): Promise<void> {
  tokenCache.delete(tokenKey(token));
  const { error } = await supabase.auth.admin.signOut(token, 'local');
  if (error) throw new UnauthorizedError('Sesi tidak dapat diakhiri.');
}

// Login (untuk mode strict)
export async function login(params: {
  username: string;
  password: string;
}) {
  // Resolve username or verified Auth email from the linked profile.
  const result = await pool.query(
    `SELECT p.id, p.role, p.nama, p.username, p.foto_profil, u.email
     FROM profiles p JOIN auth.users u ON u.id = p.id
     WHERE (lower(p.username) = lower($1) OR lower(u.email) = lower($1)) AND p.aktif = true`,
    [params.username]
  );
  if (result.rows.length > 1) {
    throw new UnauthorizedError('Identitas akun tidak unik.');
  }
  
  if (result.rows.length === 0) {
    throw new UnauthorizedError('Username tidak ditemukan.');
  }
  
  const profile = result.rows[0];
  
  const email = profile.email;
  if (!email) throw new UnauthorizedError('Email akun tidak tersedia.');

  // Always authenticate with the email attached to the matching Auth user.
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: params.password,
  });
  
  if (error || !data.session) {
    throw new UnauthorizedError('Username atau password salah.');
  }
  
  return {
    user: {
      id: profile.id,
      role: profile.role,
      nama: profile.nama,
      email,
      foto_profil: profile.foto_profil || null,
    },
    token: data.session.access_token,
  };
}
