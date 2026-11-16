import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync } from 'fs';

// Saat dibundel menjadi .exe (Node SEA) berkas ini berjalan sebagai CommonJS,
// jadi __filename sudah tersedia dan import.meta.url tidak boleh disentuh.
const currentFile = typeof __filename !== 'undefined' ? __filename : fileURLToPath(import.meta.url);
const __dirname = dirname(currentFile);

// Cari .env di lokasi yang wajar: folder kerja (npm start), folder .exe
// (double-click), atau subfolder server/ di samping .exe.
const envCandidates = [
  resolve(process.cwd(), '.env'),
  resolve(dirname(process.execPath), '.env'),
  resolve(dirname(process.execPath), 'server', '.env'),
  resolve(__dirname, '../.env'),
  resolve(__dirname, '../../.env'),
];
const envFile = envCandidates.find((candidate) => existsSync(candidate));
if (envFile) dotenv.config({ path: envFile });

export const config = {
  node_env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3017', 10),
  
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  
  database: {
    url: process.env.DATABASE_URL || '',
  },
  
  auth: {
    mode: (process.env.AUTH_MODE || 'demo') as 'demo' | 'strict',
  },
  
  seed: {
    demoPassword: process.env.SEED_DEMO_PASSWORD || '',
  },

  // Kunci untuk endpoint admin (upload/hapus foto profil).
  // Tidak pernah dikirim ke klien; dibandingkan di server.
  admin: {
    apiKey: process.env.ADMIN_API_KEY || '',
  },

  // Penyimpanan foto profil (driver alternatif): GitHub Contents API.
  github: {
    token: process.env.GITHUB_TOKEN || '',
    owner: process.env.GITHUB_OWNER || '',
    repo: process.env.GITHUB_REPO || '',
    branch: process.env.GITHUB_BRANCH || 'main',
    uploadPath: process.env.GITHUB_UPLOAD_PATH || 'profile-photos',
  },

  photo: {
    // 'supabase' (default) memakai Supabase Storage; 'github' memakai GitHub Contents API.
    driver: (process.env.PHOTO_STORAGE || 'supabase').trim().toLowerCase(),
    supabaseBucket: (process.env.SUPABASE_PHOTO_BUCKET || 'foto-profil').trim(),
    maxSizeMb: parseFloat(process.env.MAX_PHOTO_SIZE_MB || '2'),
    allowedTypes: (process.env.ALLOWED_PHOTO_TYPES || 'image/jpeg,image/png,image/webp')
      .split(',').map((v) => v.trim()).filter(Boolean),
    allowedExtensions: (process.env.ALLOWED_PHOTO_EXTENSIONS || 'jpg,jpeg,png,webp')
      .split(',').map((v) => v.trim().toLowerCase()).filter(Boolean),
  },
};

// Validasi konfigurasi penting
if (config.node_env === 'production' && config.auth.mode === 'demo') {
  throw new Error('AUTH_MODE=demo tidak boleh dipakai di production');
}

if (!config.supabase.url || !config.supabase.serviceRoleKey) {
  throw new Error('SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi');
}
