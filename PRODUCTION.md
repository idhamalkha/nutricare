# Panduan Rilis Produksi — NutriCare

Status: **PRODUKSI BERJALAN** di <http://localhost:3017> — `NODE_ENV=production`,
`AUTH_MODE=strict`, bind `127.0.0.1`, PID dicatat di `server/prod.log`.

Akun yang bisa login (password sesuai yang diberikan pemilik sistem):

| Email | Peran |
|---|---|
| `ahligizi@nutricare.com` | ahli-gizi |
| `perawat@nutricare.com` | perawat |
| `waiter@nutricare.com` | waiter |
| `logistik@nutricare.com` | logistik |

Masuk lewat <http://localhost:3017/index.html>. Membuka halaman dashboard tanpa
login akan otomatis diarahkan kembali ke halaman login (`js/auth-guard.js`).

---

## 1. Kredensial (sudah beres)

Keempat akun sudah diuji dan berhasil login dengan password yang diberikan
pemilik sistem. Tidak ada reset yang diperlukan.

Kalau nanti ada akun yang perlu direset:

```bash
cd server
node scripts/reset-password.mjs <username-atau-email>
# skrip meminta password baru lewat stdin (tidak tersimpan di riwayat shell)
```

Cek cepat satu akun:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3017/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"ahligizi@nutricare.com","password":"PASSWORD"}'
```

`200` = password benar, `401` = perlu reset.

---

## 2. Menjalankan / menyalakan ulang produksi

```bash
cd server
# .env saat ini sudah: NODE_ENV=production, AUTH_MODE=strict, PORT=3017
npm run build
node dist/src/app.js
```

Untuk berjalan di latar belakang (Windows, tanpa jendela):

```powershell
cd C:\Users\Idham-\Downloads\nutricare\server
Start-Process node -ArgumentList 'dist/src/app.js' -WindowStyle Hidden `
  -RedirectStandardOutput prod.log -RedirectStandardError prod.err.log
```

Menghentikan server: `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` lalu
`taskkill /PID <pid> /T /F` (cari proses dengan `dist/src/app.js`).

### Bind address

`HOST` kosong pada produksi = `127.0.0.1` saja (hanya mesin ini). Isi
`HOST=0.0.0.0` di `.env` bila dashboard harus diakses dari perangkat lain di
jaringan — lakukan hanya jika Anda memang menghendakinya.

---

## 3. Checklist verifikasi (sudah dijalankan, hasil di kanan)

| Cek | Perintah | Hasil |
|---|---|---|
| Health | `curl http://localhost:3017/api/health` | ✅ `{"status":"ok","mode":"strict"}` |
| Tanpa token | `curl -o /dev/null -w "%{http_code}" http://localhost:3017/api/pasien` | ✅ `401` |
| Header demo diabaikan | tambah `-H "X-NC-Role: ahli-gizi"` | ✅ tetap `401` |
| Admin tanpa kunci | `curl -o /dev/null -w "%{http_code}" http://localhost:3017/api/admin/users` | ✅ `401` |
| File rahasia | `/server/.env`, `/KREDENSIAL_LOGIN.txt`, `/debug-token.html` | ✅ `404` |
| Header keamanan | `curl -sI http://localhost:3017/index.html` | ✅ `nosniff`, `SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy` |
| Login 4 akun | lewat halaman login | ✅ 200, masuk dashboard sesuai peran |
| RBAC | waiter `POST /api/pasien` | ✅ `403` |
| Logout | `POST /api/auth/logout` lalu pakai token lama | ✅ `204` lalu `401` |
| Halaman tanpa sesi | buka `/pages/logistik.html` tanpa login | ✅ diarahkan ke `/index.html` |

---

## 4. Yang sengaja belum dirilis

- **Notifikasi push (Web Push)**: `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` kosong,
  endpoint melaporkan `enabled:false`. Bel notifikasi tetap tampil dengan keadaan
  kosong dan tidak melakukan polling yang gagal.
- **Notifikasi dalam aplikasi**: endpoint `/api/notifications` belum ada; bel
  menampilkan "Tidak ada notifikasi".

---

## 5. Rollback

```bash
cd server
# kembalikan .env: NODE_ENV=development, AUTH_MODE=demo
npm run build && node dist/src/app.js
```

Mode `demo` memakai header `X-NC-Role` / parameter `?role=` untuk berpindah peran
dan **tidak boleh** dibuka ke jaringan publik.

---

## 6. Hasil uji (2026-11-01)

- Build TypeScript: 0 error. Vitest: **36 berkas, 95 tes lulus**.
- API lintas peran: semua endpoint baca 200, kontrak field lengkap, gzip aktif.
- Validasi tulis: payload kosong/salah → 422 (bukan 500), tanpa baris tertulis.
- Uji tulis terkontrol (data `UJI-RILIS`, sudah dihapus): pasien, pantangan,
  rekomendasi, kirim ke dapur → jadwal otomatis, jadwal, intake atomik, ledger
  stok masuk/keluar, pengajuan + persetujuan, pengembalian bahan. Semua sesuai
  aturan; stok dan jumlah baris kembali persis ke baseline.
- RBAC: waiter/perawat/logistik ditolak 403 pada aksi di luar perannya.
- Keamanan: `/api/admin/*` wajib `X-NC-Admin-Key` (timing-safe), mode strict
  menolak tanpa token, file `.env`/kredensial tidak tersaji, header keamanan aktif.
- UI: 7 halaman tanpa error JS/HTTP, avatar termuat, navigasi/dialog/form CRUD
  berfungsi, tanpa overflow horizontal pada 1920/1536/1366/768/390 px.
- Performa: DOMContentLoaded ±120 ms, load ±230 ms.
