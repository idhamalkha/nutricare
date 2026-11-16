# Optimasi Performa NutriCare

Dokumen ini mencatat penyebab aplikasi terasa berat dan perbaikan yang sudah dilakukan.

## Ringkasan hasil

| Skenario | Sebelum | Sesudah |
| --- | --- | --- |
| Muat halaman ahli gizi (kunjungan pertama) | ~1.5–1.7 s (6 permintaan berurutan) | ~0.34–0.39 s (1 permintaan) |
| Muat halaman ahli gizi (kunjungan ulang) | ~1.5 s | ~0.06–0.08 s |
| Permintaan API berulang | 240–480 ms | 2–3 ms (cache) |
| Halaman logistik | 10 permintaan paralel, ~1.4 s | 10 permintaan paralel, ~0.1 s render + ~0.5 s data |
| Transfer halaman | tanpa kompresi | gzip, ±70–80% lebih kecil |

## Penyebab yang ditemukan

1. **Database berada di region jauh.** Satu query ≈ 240 ms. Setiap round-trip terasa.
2. **`localhost` di Windows mencoba `::1` lebih dulu.** Setiap koneksi baru menunggu ~200 ms sebelum jatuh ke IPv4.
3. **Enam permintaan API berurutan per halaman.** Frontend memakai XHR **sinkron**, sehingga
   `/pasien`, `/pantangan`, `/jadwal`, `/perawat`, `/bahan`, `/rekomendasi` dijalankan bergantian
   dan memblokir render: 6 × 240 ms ≈ 1.5 s.
4. **Verifikasi token Supabase = 2 round-trip per permintaan** (ambil user + ambil profil).
5. **Tidak ada cache.** Setiap perpindahan halaman mengulang semua query yang sama.
6. **Koneksi database dibuang setelah 30 detik idle.** Permintaan pertama setelah jeda membayar
   handshake TLS ±1 detik.
7. **Tanpa kompresi** dan **static server membuka seluruh folder proyek** (celah keamanan,
   sekaligus memperlambat karena banyak berkas ikut terpindai).

## Perbaikan yang diterapkan

| Berkas | Perubahan |
| --- | --- |
| `src/app.ts` | bind dual-stack `::` (localhost langsung tersambung ±1 ms), `@fastify/compress` (gzip/deflate), static allowlist (`index.html`, `admin-panel.html`, `pages/`, `js/`, `css/`, `assets/`), cache respons GET `/api` + stale-while-revalidate, pemanasan pool saat start |
| `src/routes/bootstrap.ts` (baru) | `GET /api/bootstrap?resources=…` menjalankan semua query halaman **paralel** di server dan menghormati RBAC per resource |
| `js/api-adapter.js` | memakai satu permintaan bootstrap + snapshot 15 s; operasi tulis otomatis membatalkan snapshot |
| `js/nutricare.js` | `refreshAll()` membatalkan snapshot agar data benar-benar diambil ulang (tetap satu permintaan) |
| `src/auth/index.ts` | cache verifikasi token (SHA-256, TTL 60 s), dihapus saat logout |
| `src/db/pool.ts` | `idleTimeoutMillis` 5 menit, `keepAlive`, `connectionTimeoutMillis` 15 s, `statement_timeout` 20 s |
| `src/modules/logistik.ts` | `ringkasan()` 2 query → 1 query (subquery + `json_agg`) |
| `src/rules/bahan-status.ts` | menerima `kedaluwarsa = null` (bahan tanpa tanggal kedaluwarsa tidak lagi dianggap kedaluwarsa) |

## Pengaturan (`.env`)

```env
API_CACHE_TTL_MS=15000      # lama cache respons GET /api (ms), 0 = nonaktif
API_CACHE_STALE_MS=60000    # jendela data lama disajikan sambil diperbarui di latar belakang
DB_WARM_CONNECTIONS=6       # koneksi database yang dihangatkan saat server mulai
```

Cache dibatalkan otomatis setiap ada operasi tulis (POST/PATCH/DELETE) yang berhasil, sehingga
data yang ditampilkan tetap konsisten setelah pengguna menyimpan perubahan.

## Catatan

- Latensi dasar database (±240 ms/query) berasal dari jarak region Supabase. Jika ingin lebih cepat
  lagi, pindahkan project Supabase ke region terdekat (mis. Singapore) — tidak ada perubahan kode
  yang diperlukan.
- Halaman logistik masih memakai 10 permintaan terpisah, tetapi sudah berjalan paralel
  (bukan berurutan), sehingga total waktunya ditentukan permintaan terlama (±0.5 s).
