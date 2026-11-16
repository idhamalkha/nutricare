# agent.md — Petunjuk untuk Agent AI (NutriCare Backend)

## Misi
Bangun **database dan backend** NutriCare agar sesuai dengan **frontend yang sudah jadi**.
Frontend adalah sumber kebenaran. Backend dan database yang menyesuaikan diri, bukan sebaliknya.

## ATURAN EMAS (tidak boleh dilanggar)
1. **Jangan mengubah file frontend**: `index.html`, `pages/*.html`, `css/*`, `js/*`, `assets/*`.
2. Sebelum dan sesudah setiap tugas jalankan: `sha256sum -c docs/frontend-checksums.txt` (dari root proyek). Jika gagal, batalkan perubahan pada file frontend.
3. Jika sebuah fitur backend "terasa" memerlukan perubahan frontend, **berhenti dan tanyakan** kepada pemilik proyek. Jangan menebak dan jangan mengubah sendiri.
4. Bila kontrak API bentrok dengan keinginan desain yang lebih rapi, **kontrak frontend menang**.

## Keputusan yang sudah final
- **Stack:** Node.js + TypeScript sebagai satu-satunya API, **Supabase** (PostgreSQL + Supabase Auth). Browser tidak boleh mengakses Supabase langsung; `service_role` key hanya di server.
- **Hapus data = soft delete** (`deleted_at`); tidak ada hapus permanen dari API.
- **Persetujuan pengajuan bahan:** hanya peran `logistik`.
- Keputusan masih terbuka: K3, K4, K5, K7, K8 (lihat `docs/04-alur-pembuatan-backend.md`); pakai default di dokumen sampai pemilik proyek menjawab.

## Urutan membaca (wajib sebelum menulis kode)
1. `docs/01-analisis-frontend.md` — data, aturan bisnis, matriks izin, dan keanehan frontend yang harus ditiru.
2. `docs/02-kontrak-api.md` — bentuk endpoint, JSON, dan pesan error.
3. `docs/03-skema-database.md` — DDL, seed, dan pemetaan store → tabel.
4. `docs/04-alur-pembuatan-backend.md` — fase kerja, keputusan terbuka (K1–K8), definisi selesai.

## Folder `skills/` — kapan memakai apa
Baca `SKILL.md` yang relevan **sebelum** mengerjakan tugas terkait.

| Skill | Pakai saat |
|---|---|
| `skills/frontend-contract-guard/` | Setiap tugas (pemeriksaan sebelum/sesudah), atau saat ragu apakah sesuatu menyentuh frontend |
| `skills/database-schema/` | Membuat atau mengubah tabel, constraint, migrasi |
| `skills/api-endpoint/` | Menambah atau mengubah endpoint/resource, serializer, RBAC, aturan bisnis |
| `skills/seed-and-reset/` | Seed data demo, `POST /api/demo/reset`, data awal |
| `skills/contract-testing/` | Menulis atau menjalankan tes kontrak dan tes aturan bisnis |

## Cara bekerja
- Kerjakan per fase di `docs/04-alur-pembuatan-backend.md`; jangan melompat ke Fase 8 (penghubung frontend) sebelum Fase 1–7 lolos dan K7 dijawab.
- Satu perubahan = satu tujuan. Perbarui dokumen di `docs/` bila kontrak berubah, dan tulis alasannya.
- Pesan error untuk pengguna berbahasa Indonesia dan **persis** seperti di dokumen.
- Jangan menambah fitur di luar yang terlihat di frontend. Perluasan hanya sebagai usulan tertulis.
- Jangan menulis rahasia (kata sandi, token, kunci) di repositori; pakai variabel lingkungan.

## Fakta penting yang sering terlewat
- `id` di JSON harus **string**; angka harus **number**; jam `HH:MM`; tanggal `YYYY-MM-DD`; daftar berupa array polos.
- Relasi di frontend memakai **nama pasien**; di database tetap `pasien_id`.
- `DELETE` = soft delete; semua baca menyaring `deleted_at IS NULL`; indeks unik bersifat parsial.
- RLS harus aktif di semua tabel (Supabase membuka skema `public` lewat PostgREST).
- `PATCH` harus parsial (aksi "Kirim ke dapur" dan "Tandai terkirim" hanya mengirim `{status}`).
- Store `perawat` = laporan kondisi pasien.
- Zona waktu `Asia/Jakarta`.
- Halaman logistik masih statis; endpoint-nya disiapkan tetapi belum terpakai UI.

## Definisi selesai
Lihat `docs/04-alur-pembuatan-backend.md` bagian 4. Ringkas: sesuai kontrak, tes hijau, checksum frontend lolos, izin peran sesuai matriks, migrasi jalan dari DB kosong, tanpa rahasia di repo.

## Jika ada yang tidak jelas
Tuliskan pertanyaan beserta opsi dan dampaknya, lalu tanyakan kepada pemilik proyek. Keputusan tercatat sebagai K1–K8 di dokumen 04.
