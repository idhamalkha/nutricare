# 02 — Kontrak API (mengikuti frontend, bukan sebaliknya)

Prinsip: bentuk JSON API = bentuk baris yang sudah dipakai `NC.store` di frontend. Dengan begitu lapisan penghubung (lihat `04-alur-pembuatan-backend.md`, Fase 8) cukup tipis dan frontend tidak perlu diubah.

## 1. Konvensi umum

| Hal | Aturan |
|---|---|
| Base path | `/api` |
| Format | JSON, UTF-8 |
| `id` | string (UUID), selalu string |
| Angka | JSON number (bukan string) |
| Tanggal | `YYYY-MM-DD` |
| Jam | `HH:MM` |
| Zona waktu "hari ini" | `Asia/Jakarta` (WIB) |
| Daftar | Array polos tanpa envelope (sama dengan `store.all()`) |
| Hapus | `204 No Content`. Soft delete: baris disembunyikan (`deleted_at`), tidak dihapus permanen; tidak muncul lagi di `GET` |
| Ubah | `PATCH` (parsial, gabung dengan data lama) |
| Header peran (mode demo) | `X-NC-Role: ahli-gizi \| perawat \| waiter \| logistik` |

### Format error

```json
{ "message": "Nomor rekam medis RM00124 sudah dipakai pasien lain.", "code": "VALIDATION", "field": "rm" }
```

- `message` berbahasa Indonesia dan **persis** seperti di `01-analisis-frontend.md` bagian 4, karena frontend menampilkannya langsung.
- Status: `401` belum login, `403` peran tidak berhak, `404` tidak ditemukan, `422` validasi/aturan bisnis gagal, `409` bentrok data, `500` galat server.

## 2. Resource inti (nama path = nama store frontend)

Semua resource punya 5 operasi yang sama:

```
GET    /api/{resource}          → 200 [ row, ... ]
POST   /api/{resource}          → 201 row            (body: field tanpa id)
PATCH  /api/{resource}/{id}     → 200 row            (body: field yang berubah)
DELETE /api/{resource}/{id}     → 204
```

### 2.1 `/api/pasien`
```json
{ "id":"…", "nama":"Andi Pratama", "rm":"RM00124", "ruangan":"Melati 102", "diagnosis":"Pasca operasi",
  "usia":35, "bb":65, "tb":170, "kalori":1800, "tekstur":"Biasa", "status":"Aktif" }
```
Validasi: BR-1, rentang angka dan enum sesuai `01` bagian 3.1.

### 2.2 `/api/pantangan`
```json
{ "id":"…", "pasien":"Budi Santoso", "alergi":"Udang", "pantangan":"Makanan tinggi garam", "catatan":"Perhatikan kandungan natrium" }
```
`pasien` = nama; server mencari `pasien_id` di antara pasien aktif (belum dihapus). Nama tidak ditemukan → 422 `Pasien {nama} tidak ditemukan.` Nama ganda → 422 `Nama pasien {nama} dipakai lebih dari satu pasien.`

### 2.3 `/api/rekomendasi`
```json
{ "id":"…", "tanggal":"2026-10-30", "pasien":"Andi Pratama", "waktu":"Sarapan", "tekstur":"Biasa", "kalori":500,
  "diet":"Diet Normal", "menu":"Nasi ayam kukus", "komposisi":"Nasi, ayam kukus, wortel, dan sayuran pendamping.",
  "catatan":"", "status":"Dikirim" }
```
Validasi: BR-3, BR-4, BR-5.

### 2.3.1 `/api/jadwal`
```json
{ "id":"…", "pasien":"Andi Pratama", "waktu":"Sarapan", "menu":"Nasi ayam kukus", "jam":"06:00", "status":"Terjadwal" }
```
Validasi: BR-2 (pesan tergantung `X-NC-Role`).

### 2.4 `/api/perawat` (laporan kondisi)
```json
{ "id":"…", "pasien":"Siti Rahma", "info":"Nafsu makan menurun", "tanggal":"2026-10-30", "waktu":"08:15", "status":"Evaluasi" }
```

### 2.5 `/api/bahan`
```json
{ "id":"…", "nama":"Tomat", "kategori":"Sayuran", "stok":8, "satuan":"kg", "minimum":15, "kedaluwarsa":"2026-11-07" }
```
Status **tidak** dimasukkan ke resource ini (dihitung klien). Duplikat nama di antara bahan aktif (tanpa peduli huruf besar/kecil) → 422 `Bahan {nama} sudah terdaftar.` (aturan baru karena form transaksi memilih bahan lewat nama; lihat keputusan K5).

### 2.6 Matriks izin yang ditegakkan server

Sama dengan `01-analisis-frontend.md` bagian 6. Implementasikan sebagai satu tabel konfigurasi (`rbac.ts` / `rbac.php`), bukan `if` tersebar.

## 3. Endpoint modul logistik (bentuk dari tampilan statis)

Dibuat sekarang supaya backend siap; baru terpakai setelah halaman logistik dihubungkan (di luar lingkup tanpa persetujuan).

Izin: peran `logistik` penuh (C R U); `ahli-gizi` hanya baca. Persetujuan pengajuan hanya untuk `logistik` (K6).

### 3.1 `/api/logistik/stok`
```json
{ "id":"…", "tanggal":"2026-10-29", "bahan":"Beras", "jenis":"Masuk", "jumlah":50, "satuan":"kg", "keterangan":"Penerimaan persediaan" }
```
- `POST` menerima `jenis` `Masuk` atau `Keluar`.
- Dalam satu transaksi database: simpan baris, lalu `bahan.stok += jumlah` (Masuk) atau `-= jumlah` (Keluar).
- Keluar melebihi stok → 422 `Stok {bahan huruf kecil} tidak mencukupi.`
- Tidak ada PATCH/DELETE (riwayat tidak boleh diubah); koreksi lewat transaksi baru.

### 3.2 `/api/logistik/pengajuan`
```json
{ "id":"…", "kode":"PG-001", "tanggal":"2026-10-29", "bahan":"Tomat", "jumlah":10, "satuan":"kg",
  "tanggalKebutuhan":"2026-11-01", "alasan":"…", "status":"Menunggu" }
```
- `kode` dibuat server (`PG-` + nomor urut 3 digit).
- `PATCH` `{status:"Disetujui"}` untuk persetujuan. Hanya peran `logistik` yang boleh mengubah `status` (keputusan K6, final); peran lain → 403. Server mengisi `disetujui_oleh`.

### 3.3 `/api/logistik/pengembalian`
```json
{ "id":"…", "tanggal":"2026-10-29", "bahan":"Beras", "jumlah":3, "satuan":"kg", "kondisi":"Layak digunakan", "alasan":"…", "status":"Diterima" }
```
- `status` diturunkan server dari `kondisi`: `Layak digunakan`→`Diterima`, `Perlu diperiksa`→`Pemeriksaan`, `Tidak layak`→`Dipisahkan`.
- Hanya `Diterima` menambah `bahan.stok` (satu transaksi).

### 3.4 `/api/logistik/persiapan`
```
GET   /api/logistik/persiapan?tanggal=YYYY-MM-DD   (default hari ini; selalu mengembalikan 4 slot)
PATCH /api/logistik/persiapan/{waktu}              (body: porsi, status, progres, catatan)
```
```json
{ "waktu":"Makan siang", "porsi":140, "status":"Diproses", "progres":65, "catatan":"" }
```
`status`: `Selesai`, `Diproses`, `Menunggu`. `progres` 0–100. Slot yang belum ada dibuat otomatis (`porsi` = jumlah baris `jadwal` pada waktu itu, status `Menunggu`, progres 0).

### 3.5 Laporan
```
GET /api/logistik/ringkasan            → { jenisBahan, stokMenipis, pengajuanAktif, pengembalian }
GET /api/logistik/laporan/pemakaian    → { hari:[{label:"Sen", jumlah:45}, …7 hari], total }
GET /api/logistik/laporan/kondisi-stok → { aman, periksa, menipis, habis, kedaluwarsa }  (jumlah dan persen)
```
Status bahan dihitung dengan aturan yang sama seperti `NC.bahanStatus` (satu fungsi bersama di backend, diuji terhadap contoh).

## 4. Akun, profil, preferensi, demo

| Endpoint | Fungsi | Catatan |
|---|---|---|
| `POST /api/auth/login` | `{role, username, password, remember}` → `{user, token}` | `username` boleh email. Server mencari email dari `profiles.username`, lalu `signInWithPassword` ke Supabase Auth; `token` = access token Supabase. Peran tidak cocok dengan `profiles.role` → 401 `Peran tidak sesuai dengan akun.` |
| `POST /api/auth/logout` | | |
| `GET /api/me` | `{id, role, nama, email, telepon}` | `email` dibaca dari Supabase Auth, sisanya dari `profiles` |
| `PATCH /api/me` | `{nama, email, telepon}` | `nama` wajib; email valid jika diisi (pesan sama dengan UI: `Nama lengkap wajib diisi.`, `Format email belum valid.`). `nama`/`telepon` disimpan di `profiles`; `email` diubah lewat Supabase Auth Admin API |
| `PATCH /api/me/password` | `{lama, baru, ulang}` | Pesan: `Kata sandi lama wajib diisi.`, `Kata sandi baru minimal 8 karakter.`, `Konfirmasi kata sandi tidak sama.`; juga 422 bila `lama` salah. `lama` diverifikasi dengan `signInWithPassword`, penggantian lewat Admin API |
| `GET /api/me/preferensi` / `PUT /api/me/preferensi` | `{pasien, kondisi, stok, jadwal, distribusi}` (boolean, default false) | |
| `POST /api/demo/reset` | Mengembalikan data contoh | Hanya `AUTH_MODE=demo`. Mengosongkan lalu mengisi ulang 6 store inti (dan tabel logistik) |

## 5. Mode autentikasi

| `AUTH_MODE` | Perilaku |
|---|---|
| `demo` | Tanpa token. Peran diambil dari header `X-NC-Role` (wajib, jika tidak ada → 401). Cocok dengan tautan "dashboard demo" yang tidak memakai login |
| `strict` | Wajib access token Supabase (Bearer, divalidasi server). Peran dari `profiles.role`. Dipakai saat produksi |

Default pengembangan: `demo`. Produksi wajib `strict`.

## 6. Checklist kecocokan kontrak (dipakai di tes)

- [ ] `id` string, bukan number.
- [ ] Semua field angka bertipe number.
- [ ] `jam` dan `waktu` berformat `HH:MM`.
- [ ] Tanggal berformat `YYYY-MM-DD` (tanpa jam/zona).
- [ ] `GET` mengembalikan array polos.
- [ ] `PATCH` parsial tidak menghapus field lain.
- [ ] Pesan error identik dengan frontend.
- [ ] Hapus (pasien dan resource lain) tidak diblokir; baris hilang dari `GET` tetapi tetap ada di database (soft delete); data turunan pasien ikut tersembunyi.
- [ ] Resolusi nama pasien/bahan hanya melihat baris aktif.
- [ ] Rename pasien muncul di semua resource turunan.

## 7. Semantik soft delete (K2)

- `DELETE /api/{resource}/{id}` mengisi `deleted_at` dan `deleted_by`; respons tetap `204`.
- Semua `GET`, resolusi nama→id, dan aturan BR-1..BR-4 hanya memakai baris dengan `deleted_at IS NULL`.
- Hapus pasien = fungsi database `soft_delete_pasien()` (pantangan, rekomendasi, jadwal, laporan ikut tersembunyi dalam satu transaksi).
- RM, nama bahan, dan jadwal (pasien+waktu) milik baris yang sudah dihapus lunak boleh dipakai ulang.
- UI tidak punya fitur pulihkan. Pemulihan dilakukan lewat `restore_pasien()` oleh pengelola sistem (skrip/SQL), bukan endpoint publik. Bila bentrok dengan data aktif → hasilnya error unik, diperlakukan sebagai 409.
- Tabel riwayat logistik (`stok`, `pengajuan`, `pengembalian`) tidak punya `DELETE`.

