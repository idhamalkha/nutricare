// Main server: Fastify + routes
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import fastifyCompress from '@fastify/compress';
import { config } from './config.js';
import { formatError, UnauthorizedError } from './http/errors.js';
import { getDemoUser, getAuthUser } from './auth/index.js';
import { pool } from './db/pool.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

// Routes
import { pasienRoutes } from './routes/pasien.js';
import { pantanganRoutes } from './routes/pantangan.js';
import { rekomendasiRoutes } from './routes/rekomendasi.js';
import { jadwalRoutes } from './routes/jadwal.js';
import { pengambilanRoutes, evaluasiRoutes } from './routes/pengambilan.js';
import { perawatRoutes } from './routes/perawat.js';
import { bahanRoutes } from './routes/bahan.js';
import { logistikRoutes } from './routes/logistik.js';
import { accountRoutes } from './routes/account.js';
import { pushRoutes } from './routes/push.js';
import { notificationRoutes } from './routes/notifications.js';
import adminRoutes from './routes/admin.js';
import userPhotoRoutes from './routes/users.js';
import { bootstrapRoutes } from './routes/bootstrap.js';

// Modules under /api/logistik allow logistik C/R/U and ahli-gizi read only.

// Saat dibundel menjadi .exe (Node SEA) berkas ini berjalan sebagai CommonJS,
// jadi __filename sudah tersedia dan import.meta.url tidak boleh disentuh.
const currentFile = typeof __filename !== 'undefined' ? __filename : fileURLToPath(import.meta.url);
const __dirname = dirname(currentFile);

export function buildApp() {
const app = Fastify({
  logger: config.node_env === 'development',
});

// CORS
// Origin frontend boleh diatur lewat CORS_ORIGIN (dipisah koma). Di produksi
// tanpa konfigurasi, CORS dimatikan (aplikasi tetap jalan karena frontend
// disajikan oleh server yang sama), bukan dibuka untuk semua origin.
const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

app.register(fastifyCors, {
  origin: corsOrigins.length > 0 ? corsOrigins : config.node_env === 'production' ? false : true,
  credentials: true,
});

// Upload foto profil: batasi ukuran request agar tidak bisa dipakai mengunggah file besar.
app.register(fastifyMultipart, {
  limits: {
    fileSize: Math.round(config.photo.maxSizeMb * 1024 * 1024),
    files: 1,
    fields: 4,
    parts: 6,
  },
});

// Kompresi respons (JSON & aset teks) supaya transfer lebih ringan.
app.register(fastifyCompress, {
  global: true,
  threshold: 1024,
  encodings: ['gzip', 'deflate'],
});

// Static files: source runs from src/ (../../), compiled app from dist/src/ (../../../).
// Cari folder yang benar-benar berisi index.html: dist/src, src, folder .exe,
// atau folder kerja (dipakai saat dijalankan sebagai .exe hasil bundel).
const rootCandidates = [
  join(__dirname, '../../'),
  join(__dirname, '../../../'),
  dirname(process.execPath),
  join(dirname(process.execPath), '..'),
  process.cwd(),
  join(process.cwd(), '..'),
];
const projectRoot = rootCandidates.find((dir) => existsSync(join(dir, 'index.html'))) || rootCandidates[0];

// Hanya berkas frontend yang boleh diakses publik. Tanpa daftar ini, seluruh folder
// proyek (termasuk server/.env dan file kredensial) ikut tersaji lewat HTTP.
const PUBLIC_FILES = new Set([
  '/',
  '/index.html',
  '/admin-panel.html',
  '/service-worker.js',
  '/manifest.webmanifest',
  '/manifest.json',
  '/favicon.ico',
  '/robots.txt',
]);
const PUBLIC_DIRS = ['/css/', '/js/', '/assets/', '/pages/', '/components/'];

app.register(fastifyStatic, {
  root: projectRoot,
  prefix: '/',
  index: ['index.html'],
  serveDotFiles: false,
  cacheControl: true,
  maxAge: 0,
  allowedPath: (pathname: string) => {
    const clean = pathname.split('?')[0].split('#')[0];
    if (PUBLIC_FILES.has(clean)) return true;
    return PUBLIC_DIRS.some((dir) => clean.startsWith(dir));
  },
  setHeaders: (res, filePath) => {
    const normalized = filePath.replace(/\\/g, '/');
    if (normalized.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (normalized.includes('/assets/')) {
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    } else if (normalized.includes('/css/') || normalized.includes('/js/')) {
      res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
    }
  },
});

// Middleware: Auth (inject user ke request)
app.decorateRequest('user', null);

app.addHook('preHandler', async (request, reply) => {
  // Health check dan admin routes sengaja publik; endpoint API lainnya wajib terautentikasi.
  // '/api/users/' berisi endpoint foto profil yang otorisasinya memakai kunci admin
  // (diperiksa di dalam handler), bukan token pengguna.
  // '/api/auth/logout' juga publik: logout harus tetap berhasil walau token sudah kedaluwarsa.
  // Kunci publik VAPID memang untuk browser (bukan rahasia), jadi boleh diambil
  // tanpa token agar pendaftaran notifikasi tetap jalan di mode demo.
  const publicPaths = ['/api/health', '/api/auth/login', '/api/auth/logout', '/api/admin/', '/api/users/', '/api/push/vapid-public-key'];
  const isPublic = publicPaths.some(path => request.url.startsWith(path));
  
  if (request.url.startsWith('/api') && !isPublic) {
    try {
      const authHeader = request.headers.authorization;
      
      // Priority 1: Check for real token first
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        request.user = await getAuthUser(token);
      } 
      // Priority 2: Fallback to demo mode (for backward compatibility)
      else if (config.auth.mode === 'demo') {
        const roleHeader = request.headers['x-nc-role'] as string;
        request.user = getDemoUser(roleHeader);
      } 
      // Priority 3: No auth provided
      else {
        throw new UnauthorizedError('Token wajib diisi.');
      }
    } catch (error: any) {
      const formatted = formatError(error);
      return reply.status(formatted.statusCode).send(formatted.body);
    }
  }
});

// Cache respons GET /api di memori (TTL pendek) + invalidasi otomatis saat ada
// operasi tulis. Database berada di region jauh (~240 ms per query), jadi ini
// membuat perpindahan halaman terasa instan tanpa menyajikan data basi.
const API_CACHE_TTL_MS = Number(process.env.API_CACHE_TTL_MS || 15000);
const API_CACHE_MAX_ENTRIES = 300;
// Selama data masih "baru saja kedaluwarsa" (grace), respons lama disajikan
// seketika lalu diperbarui di latar belakang (stale-while-revalidate).
const API_CACHE_STALE_MS = Number(process.env.API_CACHE_STALE_MS || 60000);
const apiCache = new Map<string, { body: unknown; status: number; expires: number }>();
const revalidating = new Set<string>();

function apiCacheKey(request: any): string {
  const role = request.user?.role || request.headers['x-nc-role'] || 'anon';
  const user = request.user?.id || '';
  return `${role}|${user}|${request.url}`;
}

// Ulangi permintaan yang sama di dalam proses (tanpa jaringan) untuk mengisi cache.
function revalidate(key: string, request: any) {
  if (revalidating.has(key)) return;
  revalidating.add(key);
  const headers: Record<string, string> = { 'x-nc-cache-bypass': '1' };
  for (const name of ['authorization', 'x-nc-role', 'x-nc-admin-key']) {
    const value = request.headers[name];
    if (typeof value === 'string') headers[name] = value;
  }
  app
    .inject({ method: 'GET', url: request.url, headers })
    .then((res) => {
      if (res.statusCode !== 200) return;
      const body = JSON.parse(res.payload);
      if (apiCache.size >= API_CACHE_MAX_ENTRIES) apiCache.clear();
      apiCache.set(key, { body, status: 200, expires: Date.now() + API_CACHE_TTL_MS });
    })
    .catch(() => {
      /* biarkan data lama; percobaan berikutnya akan mengulang */
    })
    .finally(() => revalidating.delete(key));
}

app.addHook('preHandler', async (request, reply) => {
  if (request.method !== 'GET' || !request.url.startsWith('/api')) return;
  if (request.url.startsWith('/api/health')) return;
  // Permintaan internal untuk memperbarui cache tidak boleh membaca cache.
  if (request.headers['x-nc-cache-bypass']) return;

  const key = apiCacheKey(request);
  const hit = apiCache.get(key);
  if (!hit) return;

  const now = Date.now();
  if (hit.expires <= now) {
    if (now - hit.expires > API_CACHE_STALE_MS) {
      apiCache.delete(key);
      return;
    }
    revalidate(key, request);
    reply.header('x-nc-cache', 'stale').code(hit.status).send(hit.body);
    return;
  }

  reply.header('x-nc-cache', 'hit').code(hit.status).send(hit.body);
});

app.addHook('onSend', async (request, reply, payload) => {
  if (!request.url.startsWith('/api')) return payload;

  // Operasi tulis berhasil -> data lama tidak boleh dipakai lagi.
  if (request.method !== 'GET') {
    if (reply.statusCode < 400) apiCache.clear();
    return payload;
  }

  // Respons yang dilayani dari cache (hit/stale) tidak boleh memperbarui TTL.
  if (reply.getHeader('x-nc-cache')) return payload;

  if (reply.statusCode === 200 && typeof payload === 'string') {
    try {
      const body = JSON.parse(payload);
      if (apiCache.size >= API_CACHE_MAX_ENTRIES) apiCache.clear();
      apiCache.set(apiCacheKey(request), { body, status: 200, expires: Date.now() + API_CACHE_TTL_MS });
    } catch {
      /* payload bukan JSON, lewati cache */
    }
  }

  return payload;
});

// Respons API bersifat dinamis: jangan disimpan di cache browser/proxy.
app.addHook('onSend', async (request, reply, payload) => {
  // Header keamanan dasar untuk semua respons.
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'SAMEORIGIN');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  reply.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  if (request.url.startsWith('/api')) {
    reply.header('Cache-Control', 'no-store');
  }
  return payload;
});

// Error handler global
app.setErrorHandler((error, request, reply) => {
  const formatted = formatError(error);
  reply.status(formatted.statusCode).send(formatted.body);
});

// Health check
app.get('/api/health', async () => {
  return { status: 'ok', mode: config.auth.mode };
});

// Register routes
app.register(pushRoutes, { prefix: '/api' });
app.register(notificationRoutes, { prefix: '/api' });
app.register(adminRoutes, { prefix: '/api/admin' });
app.register(userPhotoRoutes, { prefix: '/api' });
app.register(userPhotoRoutes, { prefix: '/api/admin' });
app.register(bootstrapRoutes, { prefix: '/api' });
app.register(pasienRoutes, { prefix: '/api/pasien' });
app.register(pantanganRoutes, { prefix: '/api/pantangan' });
app.register(rekomendasiRoutes, { prefix: '/api/rekomendasi' });
app.register(jadwalRoutes, { prefix: '/api/jadwal' });
app.register(pengambilanRoutes, { prefix: '/api/pengambilan' });
app.register(evaluasiRoutes, { prefix: '/api/evaluasi' });
app.register(perawatRoutes, { prefix: '/api/perawat' });
app.register(bahanRoutes, { prefix: '/api/bahan' });
app.register(logistikRoutes, { prefix: '/api/logistik' });
app.register(accountRoutes, { prefix: '/api' });

return app;
}

// Berkas ini hanya menyediakan buildApp()/startServer(); entry point ada di main.ts.
export async function startServer(): Promise<void> {
  const app = buildApp();
  const start = async () => {
    // Bind dual-stack (IPv6 + IPv4). Tanpa ini, 'localhost' di Windows mencoba ::1
    // lebih dulu dan menunggu ~200 ms sebelum jatuh ke 127.0.0.1 pada setiap koneksi baru.
    // Di produksi, default hanya loopback agar tidak terbuka ke jaringan tanpa
    // disengaja; set HOST=0.0.0.0 bila memang ingin diakses dari perangkat lain.
    const hostEnv = (process.env.HOST || '').trim();
    const hosts = hostEnv ? [hostEnv] : config.node_env === 'production' ? ['127.0.0.1'] : ['::', '0.0.0.0'];
    let lastError: unknown = null;
    for (const host of hosts) {
      try {
        await app.listen({ port: config.port, host });
        console.log(`✅ Server berjalan di http://localhost:${config.port} (host ${host})`);
        console.log(`✅ Auth mode: ${config.auth.mode}`);
        if (config.node_env === 'production' && config.auth.mode === 'demo') {
          console.warn(
            '⚠️  PERINGATAN: NODE_ENV=production tetapi AUTH_MODE=demo. ' +
              'Header X-NC-Role dapat memalsukan peran siapa pun. ' +
              'Set AUTH_MODE=strict sebelum membuka akses publik.'
          );
        }
        // Hangatkan koneksi database: handshake TLS ke region jauh butuh ~1 detik,
        // jadi lakukan sekarang agar pengguna pertama tidak menunggunya.
        const warm = Number(process.env.DB_WARM_CONNECTIONS || 4);
        await Promise.all(
          Array.from({ length: warm }, () =>
            pool.query('SELECT 1').catch(() => undefined)
          )
        );
        console.log(`✅ Database siap (${warm} koneksi)`);
        return;
      } catch (err) {
        lastError = err;
        if (host === '0.0.0.0') {
          app.log.error(err);
          process.exit(1);
        }
      }
    }
    // Semua kandidat host gagal (mis. port sudah dipakai) — laporkan ke pemanggil.
    throw lastError instanceof Error ? lastError : new Error('Server gagal dijalankan.');
  };
  await start();
}
