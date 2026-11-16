# 04 — Alur Pembuatan Database dan Backend

Tujuan: membangun backend yang **menyesuaikan diri ke frontend yang sudah jadi**. Tidak ada tahap di bawah ini yang mengubah file frontend, kecuali Fase 8 opsi A, yang butuh persetujuan tertulis dari pemilik proyek.

## 1. Keputusan

Status 30 Okt 2026: **K1, K2, K6 sudah diputuskan pemilik proyek.** K3, K4, K5, K7, K8 masih memakai default sampai dikonfirmasi.

| ID | Keputusan | Default yang dipakai rencana ini | Alternatif |
|---|---|---|---|
| K1 ✅ | Stack | **Diputuskan:** Node.js 20 + TypeScript + Fastify/Express sebagai satu-satunya API; **Supabase** (PostgreSQL + Supabase Auth); migrasi Supabase CLI; koneksi `pg` lewat pooler untuk transaksi; tes Vitest + Supertest | — |
| K2 ✅ | Hapus data | **Diputuskan: soft delete** (`deleted_at`/`deleted_by`; hapus pasien menyembunyikan turunannya; indeks unik parsial) | — |
| K3 | Mode autentikasi | `AUTH_MODE=demo` saat pengembangan, `strict` di produksi | Hanya `strict` bila tautan demo dihapus (itu mengubah frontend) |
| K4 | Tanggal pada `jadwal` | Tidak ada, meniru frontend | Tambah kolom `tanggal` (default hari ini) di DB dan API hanya menampilkan jadwal hari ini; perilaku UI sedikit berbeda |
| K5 | Nama bahan unik | Ya (untuk pemilihan bahan lewat nama di form logistik) | Pilih bahan lewat `id` (butuh perubahan frontend) |
| K6 ✅ | Siapa yang menyetujui pengajuan bahan | **Diputuskan:** hanya peran `logistik` (Logistik & Kepala Dapur) | — |
| K7 | Cara menghubungkan frontend ke API | Opsi B (injeksi dari server, file frontend tidak berubah) | Opsi A (tambah 1 tag script di 7 HTML) |
| K8 | Izin peran | Ikuti UI (`01` bagian 6) | Ikuti deskripsi peran tertulis (perawat input pasien, dst.), butuh perubahan UI |

## 2. Struktur proyek target

```
nutricare/
├─ index.html  pages/  css/  js/  assets/        ← FRONTEND (read-only, lihat docs/frontend-checksums.txt)
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/               # YYYYMMDDHHMMSS_init.sql, ... (DDL di docs/03)
│  └─ seed.sql                  # data tabel demo (bukan akun Auth)
├─ server/                       # Node.js + TypeScript
│  ├─ src/
│  │  ├─ app.ts                 # inisialisasi, static file, middleware
│  │  ├─ config.ts              # env (lihat di bawah)
│  │  ├─ db/                    # pool pg, helper transaksi
│  │  ├─ http/                  # error handler, format {message, code, field}
│  │  ├─ auth/                  # login via Supabase Auth, verifikasi token, mode demo (X-NC-Role)
│  │  ├─ rbac.ts                # satu tabel izin (matriks 01 bagian 6)
│  │  ├─ serializers/           # baris DB → bentuk frontend (string id, number, HH:MM)
│  │  ├─ rules/                 # BR-1..BR-6, bahanStatus (satu sumber kebenaran)
│  │  └─ modules/               # pasien, pantangan, rekomendasi, jadwal, perawat, bahan, logistik, me, demo
│  ├─ seeds/                    # skrip buat akun Supabase Auth + profiles
│  └─ tests/
│     ├─ contract/              # tes kontrak vs frontend (fixtures)
│     └─ rules/                 # tes aturan bisnis
├─ docs/                         # file .md ini
├─ skills/                       # petunjuk kerja untuk agent
└─ agent.md
```

Variabel lingkungan (`server/.env.example`): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (rahasia, hanya server), `SUPABASE_ANON_KEY`, `DATABASE_URL` (connection string pooler), `AUTH_MODE` (`demo`|`strict`), `NODE_ENV`, `SEED_DEMO_PASSWORD`.

## 3. Alur kerja (urutan wajib)

### Fase 0 — Kunci frontend dan siapkan lingkungan
1. Salin frontend ke repositori, buat tag `frontend-locked`.
2. Letakkan `docs/frontend-checksums.txt`; jalankan `sha256sum -c docs/frontend-checksums.txt` dan pastikan lolos.
3. Pasang pemeriksaan itu sebagai skrip `npm run check:frontend` dan di CI.
4. Inisialisasi `supabase/` (`supabase init`) dan `server/`, lengkap dengan `.env.example` (daftar di bagian 2). Buat proyek Supabase dev dan pasang `supabase link`.

Selesai bila: checksum lolos, server kosong berjalan dan bisa menyajikan `index.html` apa adanya.

### Fase 1 — Skema dan seed
1. Terjemahkan `03-skema-database.md` ke `supabase/migrations/<timestamp>_init.sql` (termasuk soft delete, indeks parsial, fungsi `soft_delete_pasien`/`restore_pasien`, RLS).
2. Buat seed demo dari bagian 5 dokumen yang sama (tanggal relatif ke hari seed).
3. Tes: `supabase db reset` bersih; seed menghasilkan 4 pasien, 3 pantangan, 4 rekomendasi, 3 jadwal, 3 laporan, 5 bahan; pembacaan tabel dengan **anon key** ditolak (RLS).

### Fase 2 — Fondasi HTTP
1. Handler error satu format `{message, code, field?}`.
2. Serializer per resource (id string, number, `HH:MM`, `YYYY-MM-DD`, nama pasien dari join).
3. Fungsi `today()` berbasis `Asia/Jakarta`.
4. Modul `rules/bahanStatus` (urutan prioritas persis `NC.bahanStatus`).

### Fase 3 — Auth dan RBAC
1. `AUTH_MODE=demo`: peran dari header `X-NC-Role`; tanpa header → 401.
2. `AUTH_MODE=strict`: login (`role`, `username|email`, `password`) → cari email dari `profiles`, `signInWithPassword` Supabase Auth, cek `profiles.role`; middleware memvalidasi access token Supabase dan memuat `profiles`. Kredensial tidak disimpan di tabel kita.
3. `rbac.ts` sebagai tabel konfigurasi; semua route lewat middleware yang membaca tabel itu.
4. Tes: setiap sel matriks izin (peran × resource × operasi) memberi 200/201/204 atau 403 sesuai tabel.

### Fase 4 — Resource inti (urutan karena ketergantungan)
1. `pasien` (BR-1).
2. `pantangan` (resolusi nama→id, nama ganda/tidak ada → 422).
3. `bahan` (nama unik di antara bahan aktif; hapus = soft delete, riwayat transaksi tetap).
4. `rekomendasi` (BR-3, BR-4, BR-5; patch status saja melewati validasi).
5. `jadwal` (BR-2 dengan pesan per peran).
6. `perawat` (laporan kondisi).

Semua `DELETE` adalah soft delete (K2): hapus pasien memakai `soft_delete_pasien()`; semua query baca menyaring `deleted_at IS NULL`.

Setiap resource dianggap selesai bila lolos checklist di `02-kontrak-api.md` bagian 6 dan tes kontrak.

### Fase 5 — Modul logistik
1. `stok` (transaksi database: simpan baris + ubah `bahan.stok`; tolak stok negatif).
2. `pengajuan` (kode `PG-nnn`, patch status).
3. `pengembalian` (status turunan; hanya `Diterima` menambah stok).
4. `persiapan` (4 slot per tanggal, auto-buat).
5. `ringkasan` dan `laporan/*`.

### Fase 6 — Akun dan pengaturan
`/api/me`, `/api/me/password`, `/api/me/preferensi`, `/api/demo/reset` (hanya mode demo; kosongkan lalu seed ulang dalam satu transaksi).

### Fase 7 — Tes dan penguncian kontrak
1. Tes kontrak: contoh respons dibandingkan dengan fixture yang diambil dari data awal `NC.store(...)` di frontend.
2. Tes aturan bisnis: contoh BR-1..BR-6 dan `bahanStatus` (kedaluwarsa, habis, periksa 7 hari, menipis, aman, termasuk batas hari).
3. Tes konkurensi sederhana: dua transaksi stok bersamaan tidak membuat stok negatif.
4. `npm run check:frontend` harus lolos di akhir setiap fase.

### Fase 8 — Menghubungkan frontend ke API (hanya setelah Fase 1–7 lolos)

Masalah teknis: `NC.store` di `nutricare.js` **sinkron** dan berbasis localStorage, sedangkan HTTP bersifat asinkron. Ada tiga jalan:

| Opsi | Cara | File frontend berubah? | Catatan |
|---|---|---|---|
| **A** | Tambah `js/nc-api-adapter.js` dan satu tag `<script>` setelah `nutricare.js` di tiap HTML | Ya (7 file HTML) | Paling mudah dipahami, tetapi melanggar aturan "jangan ubah frontend" tanpa izin |
| **B** (rekomendasi) | Server menyisipkan tag adapter saat menyajikan HTML (HTML di disk tetap sama) | Tidak | Adapter di-serve dari `server/`, bukan `js/` |
| C | Tulis ulang store menjadi asinkron | Ya, besar | Di luar lingkup |

Rancangan adapter (opsi A/B, **belum diuji**, harus divalidasi di browser nyata sebelum dianggap selesai):
1. Sebelum skrip halaman berjalan, adapter mengisi `localStorage['nutricare-<store>']` dari data server (data awal disisipkan inline oleh server, atau diambil dengan XHR sinkron saat halaman dibuka). Dengan begitu kode frontend yang ada tetap membaca "storage" seperti biasa.
2. Adapter membungkus metode `add`, `update`, `remove` pada store: kirim ke API (sinkron), bila server menolak lempar `Error(message)` agar form menampilkan pesan yang sama; bila berhasil, terapkan baris dari server (id asli) ke store lokal.
3. Adapter mengirim header `X-NC-Role` sesuai halaman (mode demo) atau memakai cookie sesi (mode strict).
4. `reset()` dan tombol "Kembalikan data contoh" dipetakan ke `POST /api/demo/reset`.
5. Risiko: XHR sinkron di main thread usang tetapi masih berfungsi; cukup untuk jaringan lokal rumah sakit skala kecil. Migrasi ke store asinkron (opsi C) adalah pekerjaan terpisah.

Fase 8 tidak boleh dimulai tanpa jawaban pemilik proyek atas K7.

## 4. Definisi selesai (Definition of Done) tiap fitur

- [ ] Sesuai `02-kontrak-api.md` (bentuk, tipe, pesan error).
- [ ] Tabel dan constraint sesuai `03-skema-database.md`.
- [ ] Tes kontrak dan tes aturan hijau.
- [ ] `sha256sum -c docs/frontend-checksums.txt` lolos (frontend tidak berubah).
- [ ] Izin peran sesuai matriks.
- [ ] `supabase db reset` berjalan dari database kosong.
- [ ] RLS aktif di semua tabel baru; anon key tidak bisa membaca data.
- [ ] Query baca menyaring `deleted_at IS NULL`.
- [ ] Tidak ada rahasia (kata sandi, token) di repositori.

## 5. Keamanan dan privasi (data pasien)

- Kata sandi dan hash dikelola Supabase Auth; tidak ada di tabel kita dan tidak pernah dikembalikan oleh API.
- **RLS aktif di semua tabel `public`** tanpa policy untuk `anon`/`authenticated`; `SUPABASE_SERVICE_ROLE_KEY` hanya ada di server (tidak boleh masuk frontend/repo).
- Access token dikirim sebagai Bearer (atau cookie `HttpOnly`, `SameSite=Lax`, `Secure` di produksi); CORS dibatasi ke origin aplikasi.
- Validasi dan parameterisasi semua query (tanpa string SQL gabungan).
- Rate limit pada `/api/auth/login`.
- `audit_log` untuk create/update/delete data pasien, pantangan, rekomendasi.
- Respons error produksi tidak membocorkan stack trace.
- Log tidak memuat isi data pasien.
- `AUTH_MODE=demo` dilarang di produksi (aplikasi menolak start bila `NODE_ENV=production` dan mode demo).

## 6. Risiko

| Risiko | Mitigasi |
|---|---|
| Pesan error beda tipis dari frontend | Tes kontrak membandingkan string persis |
| Nama pasien ganda memecah relasi berbasis nama | Error 422 yang jelas; usulkan nama + RM pada UI sebagai pekerjaan terpisah |
| Frontend berubah diam-diam | Checksum dan CI |
| Modul logistik belum punya JS | Backend siap; tampilan tetap statis sampai ada persetujuan |
| Adapter sinkron lambat | Skala kecil; evaluasi opsi C bila beban naik |
| Tabel `public` Supabase terbuka lewat PostgREST | RLS + `REVOKE ALL` pada anon/authenticated, diuji di Fase 1 |
| Pooler mode transaksi tidak mendukung prepared statement/`SET` sesi | Pakai driver tanpa prepared statement di pooler, hitung "hari ini" di SQL/aplikasi, bukan `SET timezone` |
| Soft delete membuat data menumpuk dan lupa menyaring `deleted_at` | Semua query lewat repositori yang menyaring otomatis; tes kontrak memeriksa baris terhapus tidak muncul |
