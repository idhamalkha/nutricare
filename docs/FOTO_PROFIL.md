# Fitur Foto Profil NutriCare

Foto profil disimpan di **Supabase Storage** (bucket publik `foto-profil`), diunggah oleh server,
dan hanya dapat diubah dari `admin-panel.html`. Service role key tidak pernah dikirim ke browser.
Driver GitHub Contents API tetap tersedia sebagai alternatif (`PHOTO_STORAGE=github`).

## 1. Skema database

Migrasi: `supabase/migrations/20261101000005_profile_photo.sql`

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS foto_profil text;
COMMENT ON COLUMN profiles.foto_profil IS
  'URL foto profil. NULL berarti tampilkan avatar inisial.';
```

- Aditif dan nullable: tidak mengubah atau menghapus data pengguna yang sudah ada.
- Sudah dijalankan pada database proyek (4 profil, 0 foto saat migrasi).
- Jalankan ulang kapan saja (idempoten): `cd server && node scripts/apply-profile-photo-migration.mjs`

Kolom ini ikut disertakan pada respons:

| Endpoint | Perubahan |
|---|---|
| `POST /api/auth/login` | `user.foto_profil` |
| `GET /api/me` | `foto_profil` |
| `GET /api/admin/users` | `foto_profil` per pengguna |

## 2. Penyimpanan foto

Konfigurasi `server/.env`:

```
PHOTO_STORAGE=supabase          # supabase (default) | github
SUPABASE_URL=                   # sudah dipakai backend
SUPABASE_SERVICE_ROLE_KEY=      # hanya di server
SUPABASE_PHOTO_BUCKET=foto-profil
MAX_PHOTO_SIZE_MB=2
ALLOWED_PHOTO_TYPES=image/jpeg,image/png,image/webp
ALLOWED_PHOTO_EXTENSIONS=jpg,jpeg,png,webp

# Hanya bila PHOTO_STORAGE=github
GITHUB_TOKEN=
GITHUB_OWNER=
GITHUB_REPO=
GITHUB_BRANCH=main
GITHUB_UPLOAD_PATH=profile-photos
```

**Supabase Storage (aktif)**
- Bucket `foto-profil` dibuat otomatis saat unggah pertama: `public: true`, batas 2 MB,
  hanya menerima `image/jpeg`, `image/png`, `image/webp`.
- Nama objek: `profile-photos/user-{id}-{timestamp}.{ext}` (unik, tidak tersangkut cache).
- URL tersimpan: `{SUPABASE_URL}/storage/v1/object/public/foto-profil/profile-photos/{file}`.
- Saat foto diganti atau dihapus, file lama dihapus dari bucket. Kegagalan hapus hanya
  dicatat di log server dan tidak menggagalkan proses utama.

**GitHub Contents API (alternatif, `PHOTO_STORAGE=github`)**
- URL tersimpan: `https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}/{file}`.
- Jika repository masih kosong, unggahan pertama dibuat tanpa parameter `branch` agar GitHub
  membuat commit pertama pada branch default.
- Token butuh izin **Contents: Read and write**.

Penghapusan file lama mengikuti bentuk URL yang tersimpan, sehingga foto lama dari driver
lain tetap dibersihkan saat berganti driver.

## 3. Endpoint backend

Keduanya wajib header `X-NC-Admin-Key` (nilai `ADMIN_API_KEY` di `server/.env`).
Tersedia di dua prefix: `/api/users/...` dan `/api/admin/users/...`.

### `POST /api/users/:id/foto-profil`

- `Content-Type: multipart/form-data`, field file: `foto`.
- Validasi isi file lewat magic bytes (JPG/PNG/WEBP), bukan nama atau `Content-Type` klien.
- Batas ukuran: `MAX_PHOTO_SIZE_MB` (default 2 MB) — juga dibatasi pada level parser multipart.

Respons sukses:

```json
{ "success": true, "message": "Foto profil berhasil diperbarui.", "foto_profil": "https://<project>.supabase.co/storage/v1/object/public/foto-profil/..." }
```

Contoh galat (bahasa Indonesia):

| Status | Kondisi |
|---|---|
| 401 | Kunci admin tidak dikirim |
| 403 | Kunci admin salah |
| 422 | ID tidak valid / file kosong / bukan JPG-PNG-WEBP / bukan multipart |
| 404 | Pengguna tidak ditemukan |
| 413 | Ukuran file melebihi batas |
| 503 | `ADMIN_API_KEY` belum diisi, penyimpanan belum dikonfigurasi, atau (driver GitHub) token tanpa izin tulis |

### `DELETE /api/users/:id/foto-profil`

Mengosongkan `foto_profil` (kembali ke avatar inisial) dan menghapus file di penyimpanan.
Idempoten: jika belum ada foto, tetap `200` dengan pesan "Pengguna ini belum memiliki foto profil."

## 4. Frontend

- `admin-panel.html`: kolom **Foto** (pratinjau bulat) + tombol **Ubah foto** / **Hapus foto**.
  Memilih file menampilkan pratinjau lebih dulu, lalu **Simpan** / **Batal**. Status proses
  memakai `alert` yang sudah ada. Input **Kunci admin** di header menyimpan kunci ke
  `sessionStorage` (hanya untuk sesi tab tersebut).
- `js/nutricare.js`: komponen bersama `NC.applyProfilePhoto(url)` dipakai semua halaman.
  Avatar topbar memakai `<img>` dengan `object-fit: cover` pada ukuran yang sama (36–37 px);
  jika `foto_profil` kosong atau gambar gagal dimuat (`onerror`), kembali ke inisial hijau.
- `pages/profil.html`: foto bulat 92 px (hanya baca) + keterangan
  "Foto profil hanya dapat diubah oleh admin." Tanpa tombol unggah/hapus.

## 5. Keamanan

- `.env` sudah ada di `.gitignore` (root dan `server/`).
- `server/.env.example` berisi daftar kunci tanpa nilai (token/URL/kunci dikosongkan).
- Kunci penyimpanan (`SUPABASE_SERVICE_ROLE_KEY`, `GITHUB_TOKEN`) hanya dibaca di server
  (`server/src/modules/photo-storage*.ts`); tidak ada kemunculan di HTML/JS/CSS.
- Log server tidak mencetak kunci; hanya status dan potongan pesan galat.
- Ukuran request dibatasi pada parser multipart (`fileSize`, `files: 1`, `parts: 6`).

## 6. Cara menguji

### API (terminal)

```bash
# 1) tanpa kunci -> 401
curl -i -X POST http://localhost:3017/api/admin/users/<id>/foto-profil

# 2) kunci salah -> 403
curl -i -X POST -H "X-NC-Admin-Key: salah" http://localhost:3017/api/admin/users/<id>/foto-profil

# 3) unggah foto (kunci dari server/.env)
curl -i -X POST -H "X-NC-Admin-Key: $ADMIN_API_KEY" \
  -F "foto=@foto.jpg;type=image/jpeg" \
  http://localhost:3017/api/admin/users/<id>/foto-profil

# 4) hapus foto
curl -i -X DELETE -H "X-NC-Admin-Key: $ADMIN_API_KEY" \
  http://localhost:3017/api/admin/users/<id>/foto-profil
```

### UI

1. Buka `http://localhost:3017/admin-panel.html`.
2. Isi **Kunci admin** (nilai `ADMIN_API_KEY` dari `server/.env`) lalu klik **Simpan**.
3. Pada baris pengguna, klik **Ubah foto** → pilih JPG/PNG/WEBP ≤ 2 MB → pratinjau muncul →
   klik **Simpan**. Notifikasi sukses tampil dan pratinjau berubah.
4. Login sebagai pengguna tersebut → avatar topbar menampilkan foto.
5. Buka `profil.html` → foto tampil besar (92 px, bulat) tanpa tombol unggah.
6. Klik **Hapus foto** di panel admin → avatar kembali ke inisial di semua halaman.

## 7. Catatan operasional

- Cek kesiapan penyimpanan kapan saja: `cd server && node scripts/check-photo-storage.mjs`
  (mengikuti `PHOTO_STORAGE`, tidak mencetak kunci).
- Driver GitHub sempat dicoba namun token di `.env` belum punya izin tulis
  (`403 Resource not accessible by personal access token`), karena itu penyimpanan dipindah
  ke Supabase Storage. Untuk kembali ke GitHub: perbaiki izin **Contents: Read and write**
  lalu set `PHOTO_STORAGE=github` dan restart server.
- `admin-panel.html` sendiri masih berupa halaman statis tanpa login. Endpoint ubah/hapus foto
  sudah dijaga kunci admin di server; endpoint manajemen pengguna lain belum diubah.

## 6. Catatan tampilan avatar (penting)

Foto profil dipasang oleh `NC.applyProfilePhoto()` di `js/nutricare.js` ke setiap elemen
`[data-role-avatar]` (topbar) dan `[data-photo-avatar]` (halaman profil).

- Ukuran gambar diatur **inline** (`width/height 100%`, `object-fit: cover`, `border-radius: inherit`),
  jadi tetap rapi di halaman yang tidak memuat `css/dashboard.css` (mis. `logistik.html`).
  Sebelumnya `logistik.html` hanya punya CSS `.avatar` tanpa aturan `img`, sehingga foto tampil
  seukuran aslinya dan menutupi topbar.
- `NC.hydrateProfilePhoto()` dijalankan saat `DOMContentLoaded` pada semua halaman: memakai
  `Authorization: Bearer` bila ada token, atau `X-NC-Role` pada mode demo, lalu menyegarkan
  nama dan foto dari `GET /api/me`.
- `GET /api/me` mode demo kini mengambil baris `profiles` sesuai peran (nama tampilan tetap label
  ramah seperti "Petugas Logistik"), sehingga foto yang tampil adalah foto profil peran tersebut.
- Nama pada topbar hanya diambil dari `sessionStorage` bila perannya cocok dengan halaman,
  agar nama antar peran tidak tertukar saat berpindah halaman.
- `pages/profil.html` dan `pages/pengaturan.html` memuat `js/api-adapter.js` agar peran halaman
  (termasuk `?role=`) dikenali dan data yang dimuat sesuai peran.
