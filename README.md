# NutriCare Serverless

Varian terpisah untuk deploy ke Netlify atau Vercel. Untuk setup hosting, gunakan panduan [DEPLOYMENT.md](DEPLOYMENT.md) dan jangan ikuti contoh konfigurasi lokal di bawah untuk production. Variabel rahasia hanya di dashboard provider, `AUTH_MODE=strict`, dan jangan commit `.env` atau data pasien.

> Dokumentasi backend lama di bawah tetap sebagai referensi development, bukan instruksi deploy serverless.


## Stack
- Node.js 20+ + TypeScript
- Fastify (HTTP server)
- PostgreSQL (Supabase)
- Soft delete untuk semua data

## Struktur Proyek

```
nutricare/
├── index.html, pages/, css/, js/, assets/  ← FRONTEND (read-only)
├── docs/                                    ← Dokumentasi lengkap
│   ├── 01-analisis-frontend.md
│   ├── 02-kontrak-api.md
│   ├── 03-skema-database.md
│   ├── 04-alur-pembuatan-backend.md
│   └── frontend-checksums.txt
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   └── seed.sql
└── server/
    ├── src/
    │   ├── app.ts
    │   ├── config.ts
    │   ├── rbac.ts
    │   ├── auth/
    │   ├── db/
    │   ├── http/
    │   ├── modules/
    │   ├── routes/
    │   ├── rules/
    │   └── serializers/
    ├── seeds/
    └── tests/
```

## Setup

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Setup Supabase

Buat proyek Supabase di https://supabase.com atau jalankan lokal:

```bash
# Install Supabase CLI jika belum
npm install -g supabase

# Init & start local
supabase init
supabase start
```

### 3. Konfigurasi Environment

Copy `.env.example` ke `.env` dan isi nilai yang sesuai:

```bash
cp .env.example .env
```

Edit `.env`:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://...
AUTH_MODE=demo
PORT=3000
NODE_ENV=development
SEED_DEMO_PASSWORD=isi-password-kuat-buatan-sendiri
```

### 4. Jalankan Migrasi & Seed

```bash
# Migrasi database (buat tabel)
cd ..
supabase db reset

# Seed akan otomatis jalan lewat seed.sql
```

### 5. Buat Akun Demo (untuk mode strict)

```bash
cd server
npm run seed:auth
```

### 6. Jalankan Server

```bash
# Development (auto-reload)
npm run dev

# Production
npm run build
npm start
```

Server akan berjalan di http://localhost:3000

## Mode Autentikasi

### Mode Demo (Development)
- Tanpa token
- Kirim header `X-NC-Role: ahli-gizi` (atau `perawat`, `waiter`, `logistik`)
- Cocok untuk development dan testing

### Mode Strict (Production)
- Wajib Bearer token dari Supabase Auth
- Login lewat `/api/auth/login`
- Token divalidasi setiap request

## API Endpoints

### Resource Inti
```
GET    /api/pasien
POST   /api/pasien
PATCH  /api/pasien/:id
DELETE /api/pasien/:id

GET    /api/pantangan
POST   /api/pantangan
PATCH  /api/pantangan/:id
DELETE /api/pantangan/:id

GET    /api/rekomendasi
POST   /api/rekomendasi
PATCH  /api/rekomendasi/:id
DELETE /api/rekomendasi/:id

GET    /api/jadwal
POST   /api/jadwal
PATCH  /api/jadwal/:id
DELETE /api/jadwal/:id

GET    /api/perawat          (laporan kondisi)
POST   /api/perawat
PATCH  /api/perawat/:id
DELETE /api/perawat/:id

GET    /api/bahan
POST   /api/bahan
PATCH  /api/bahan/:id
DELETE /api/bahan/:id
```

## Testing

```bash
npm test              # Watch mode
npm run test:run      # Run once
```

## Aturan Emas

1. **JANGAN UBAH FILE FRONTEND**: `index.html`, `pages/*.html`, `css/*`, `js/*`, `assets/*`
2. Verifikasi checksum sebelum dan sesudah setiap tugas: `npm run check:frontend`
3. Jika fitur butuh perubahan frontend, **tanya dulu** jangan ubah sendiri
4. Kontrak API mengikuti frontend, bukan sebaliknya

## Fitur Utama

- ✅ Soft delete (data tidak dihapus permanen)
- ✅ RBAC (Role-Based Access Control) sesuai matriks izin frontend
- ✅ Validasi aturan bisnis (BR-1 sampai BR-6)
- ✅ ID berupa string (UUID)
- ✅ Resolusi nama pasien → pasien_id (API terima nama, DB pakai ID)
- ✅ PATCH parsial (hanya field yang dikirim yang diubah)
- ✅ Row Level Security (RLS) aktif di semua tabel
- ✅ Zona waktu Asia/Jakarta

## Dokumentasi Lengkap

Lihat folder `docs/`:
- `01-analisis-frontend.md` — Data, aturan bisnis, matriks izin
- `02-kontrak-api.md` — Endpoint, JSON, error messages
- `03-skema-database.md` — DDL, seed, pemetaan
- `04-alur-pembuatan-backend.md` — Fase kerja, keputusan (K1-K8)
- `agent.md` — Petunjuk untuk AI agent

## Lisensi

ISC
# nutricare
