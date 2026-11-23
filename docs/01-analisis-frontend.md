# 01 — Analisis Frontend NutriCare

> Sumber: `index.html`, `pages/*.html`, `js/nutricare.js`, `js/perawat.js`, `js/waiter.js`, `js/pengaturan.js`, skrip inline di `ahli-gizi.html` dan `logistik.html`.
> Aturan emas: **frontend tidak boleh diubah.** Dokumen ini adalah "kontrak" yang harus dipenuhi backend dan database.

## 1. Arsitektur frontend saat ini

- HTML statis multi-halaman + JavaScript murni (tanpa build, tanpa framework).
- Semua data disimpan di **localStorage** lewat `NC.store(nama, dataAwal)` di `js/nutricare.js`. Kunci: `nutricare-<nama>`.
- API store bersifat **sinkron**: `all()`, `add(row)`, `update(id, values)`, `remove(id)`, `reset()`.
  - `update` menggabungkan (`Object.assign`) → backend harus mendukung **PATCH parsial**.
  - `all()` mengembalikan seluruh baris; pencarian, filter, dan sortir dilakukan di browser.
  - `add` membuat `id` berupa **string** (`<store>-<timestamp>-<acak>`).
- `NC.crud({...})` membuat tabel + form dari konfigurasi (kolom, field, validasi). Error dari store/validasi ditampilkan lewat `error.message`.
- Tema (`dark` / `light` / `original`) disimpan di `localStorage['nutricare-theme']`. **Tetap di sisi klien**, tidak perlu masuk database.

## 2. Halaman dan peran

| Peran (role key) | File | Halaman (hash) | Status data |
|---|---|---|---|
| `ahli-gizi` | `pages/ahli-gizi.html` | dashboard, pasien, pantangan, rekomendasi, jadwal, perawat, bahan, riwayat, laporan, pengaturan | Terhubung ke store |
| `perawat` | `pages/perawat.html` + `js/perawat.js` | dashboard, pasien (baca), catatan (laporan kondisi), jadwal (baca) | Terhubung ke store |
| `waiter` | `pages/waiter.html` + `js/waiter.js` | dashboard, distribusi, menu (baca) | Terhubung ke store |
| `logistik` | `pages/logistik.html` | dashboard, bahan, stok, pengajuan, pengembalian, dapur, laporan | **Masih statis** (angka dan tabel hardcode, form belum punya handler) |
| semua | `pages/pengaturan.html?role=<role>` | tema, profil, kata sandi, notifikasi, reset data demo | Profil/preferensi di localStorage |
| — | `index.html` | login + tautan dashboard demo | Form belum diverifikasi (`action="#" method="get"`) |

## 3. Entitas yang sudah terhubung (6 store)

Tipe JSON harus **persis** seperti di tabel: angka = number, tanggal = `YYYY-MM-DD`, jam = `HH:MM` (tanpa detik), `id` = string.

### 3.1 `pasien`
| Field | Tipe | Aturan form |
|---|---|---|
| id | string | dibuat server |
| nama | string | wajib |
| rm | string | wajib, **unik tanpa peduli huruf besar/kecil** |
| ruangan | string | wajib (contoh `Melati 102`) |
| diagnosis | string | wajib |
| usia | number | wajib, 0–120 |
| bb | number (kg) | wajib, ≥ 1 |
| tb | number (cm) | wajib, ≥ 30 |
| kalori | number (kkal) | wajib, 500–5000 |
| tekstur | enum | `Biasa`, `Lunak`, `Bubur`, `Cair` |
| status | enum | `Aktif`, `Evaluasi`, `Pulang` (default `Aktif`) |

Seed: Andi Pratama RM00124, Siti Rahma RM00125, Budi Santoso RM00126, Dewi Lestari RM00127 (lihat `03-skema-database.md`).

### 3.2 `pantangan` (pantangan dan alergi)
| Field | Tipe | Aturan |
|---|---|---|
| id | string | |
| pasien | string (**nama pasien**) | wajib, dipilih dari daftar nama pasien |
| alergi | string | default `-`; boleh beberapa dipisah koma (`Udang, kacang`) |
| pantangan | string | wajib |
| catatan | string | opsional |

Satu pasien boleh punya lebih dari satu baris (kode menggabungkan semua baris saat memeriksa alergi).

### 3.3 `rekomendasi` (rekomendasi menu, juga dipakai untuk "Riwayat")
| Field | Tipe | Aturan |
|---|---|---|
| id | string | |
| tanggal | date | wajib, default hari ini |
| pasien | string (nama) | wajib |
| waktu | enum | `Sarapan`, `Makan siang`, `Makan malam`, `Snack` |
| tekstur | enum | `Biasa`, `Lunak`, `Bubur`, `Cair` (terpisah dari tekstur pasien) |
| kalori | number | wajib, 50–3000 |
| diet | enum | `Diet Normal`, `Diet Diabetes`, `Diet Rendah Garam`, `Diet Khusus` |
| menu | string | wajib |
| komposisi | string | wajib |
| catatan | string | opsional ("Catatan untuk dapur") |
| status | enum | `Draf` (default), `Dikirim`, `Evaluasi` |

Aksi khusus "Kirim ke dapur" = `update(id, {status:'Dikirim'})` (hanya status, **tanpa** validasi alergi/stok).

### 3.4 `jadwal` (jadwal makan / distribusi)
| Field | Tipe | Aturan |
|---|---|---|
| id | string | |
| pasien | string (nama) | wajib |
| waktu | enum | `Sarapan`, `Makan siang`, `Makan malam`, `Snack` |
| menu | string | wajib, teks bebas (tidak ada relasi ke rekomendasi) |
| jam | time `HH:MM` | wajib, default `06:00` |
| status | enum | `Terjadwal` (default), `Menunggu`, `Terkirim` |

**Tidak ada field tanggal.** Unik per (pasien, waktu). Aksi khusus "Tandai terkirim" = `update(id, {status:'Terkirim'})`.

### 3.5 `perawat` (= laporan kondisi pasien; nama store memang `perawat`)
| Field | Tipe | Aturan |
|---|---|---|
| id | string | |
| pasien | string (nama) | wajib |
| info | string | wajib |
| tanggal | date | wajib, default hari ini |
| waktu | time `HH:MM` | wajib, default jam sekarang |
| status | enum | `Baru` (default), `Evaluasi`, `Ditinjau` |

Aksi khusus (ahli gizi) "Tandai ditinjau" = `update(id, {status:'Ditinjau'})`.

### 3.6 `bahan` (persediaan bahan; `NC.bahan`)
| Field | Tipe | Aturan |
|---|---|---|
| id | string | |
| nama | string | wajib |
| kategori | string | wajib (lihat temuan T4) |
| stok | number | wajib, ≥ 0 |
| satuan | string | wajib (lihat temuan T4) |
| minimum | number | wajib, ≥ 0 |
| kedaluwarsa | date | wajib |

Status bahan **tidak disimpan**, dihitung (lihat bagian 5).

## 4. Aturan bisnis yang saat ini ada di frontend (wajib ditiru backend)

Pesan error ditampilkan apa adanya ke pengguna, jadi teksnya harus sama.

| Kode | Resource | Aturan | Pesan |
|---|---|---|---|
| BR-1 | pasien | `rm` unik (case-insensitive), kecuali baris yang sedang diubah | `Nomor rekam medis {rm} sudah dipakai pasien lain.` |
| BR-2 | jadwal | Unik (pasien, waktu) | Peran `waiter`: `{pasien} sudah memiliki jadwal {waktu huruf kecil}.` — peran lain: `{pasien} sudah punya jadwal {waktu huruf kecil}. Ubah jadwal yang ada.` |
| BR-3 | rekomendasi | Teks `menu + " " + komposisi` (huruf kecil) tidak boleh memuat alergi pasien. Alergi = semua baris `pantangan` pasien, dipecah koma, di-trim, abaikan kosong dan `-`. Pencocokan substring. Hit pertama yang dilaporkan. | `Komposisi mengandung {alergi huruf kecil}, alergi yang tercatat untuk {pasien}.` |
| BR-4 | rekomendasi | Jika ada bahan berstatus **Habis** yang namanya (huruf kecil) muncul sebagai substring teks yang sama | `Stok {nama huruf kecil} sedang habis. Pilih bahan pengganti.` |
| BR-5 | rekomendasi | BR-3 dan BR-4 dijalankan saat create dan update isi (pasien/menu/komposisi). **Tidak** dijalankan pada patch status saja. Berlaku untuk form "Rekomendasi" maupun "Riwayat". | — |
| BR-6 | semua | Rename pasien harus tercermin di semua data turunan (frontend melakukannya manual lewat callback `saved`). | — |

## 5. Nilai turunan yang dihitung di klien

- **Status bahan** (`NC.bahanStatus`), urutan prioritas:
  1. `kedaluwarsa < hari ini` → `Kedaluwarsa`
  2. `stok <= 0` → `Habis`
  3. `kedaluwarsa <= hari ini + 7` → `Periksa`
  4. `stok <= minimum` → `Menipis`
  5. selain itu → `Aman`
- BMI = `bb / (tb/100)^2` (1 desimal) di dialog detail pasien.
- Ringkasan dashboard: jumlah pasien, rekomendasi, pasien beralergi, pasien berstatus Evaluasi, pasien tanpa pantangan, jumlah jadwal per waktu makan, jumlah bahan per status, sebaran kalori (4 rentang), jumlah rekomendasi per jenis diet, laporan perawat yang belum `Ditinjau`.
- Slot waktu makan: Sarapan 06.00–08.00, Makan siang 11.00–13.00, Makan malam 17.00–19.00, Snack 09.00 dan 15.00.

Semua ini cukup dihitung ulang di browser dari data mentah. Backend **tidak wajib** menyediakan agregat untuk halaman yang sudah hidup.

## 6. Matriks izin sesuai UI saat ini

C = tambah, R = lihat, U = ubah, D = hapus, A = aksi khusus.

| Resource | ahli-gizi | perawat | waiter | logistik |
|---|---|---|---|---|
| pasien | C R U D | R | – | – |
| pantangan | C R U D | – | – | – |
| rekomendasi | C R U D, A (Kirim ke dapur) | – | R | – |
| jadwal | C R U D, A (Tandai terkirim) | R | C R U D, A (Tandai terkirim) | – |
| perawat (laporan kondisi) | C R U D, A (Tandai ditinjau) | C R U D | – | – |
| bahan | C R U D | – | – | C R U D (form ada, belum aktif) |

Catatan: "D" (hapus) di backend berarti **soft delete**. Izin di atas sengaja mengikuti UI. Backend yang lebih ketat dari ini akan membuat tombol di UI gagal.

## 7. Bagian logistik yang masih statis (rancangan data dari tampilan)

Belum ada JavaScript, tetapi tabel dan formulirnya menunjukkan bentuk data yang akan dipakai:

| Halaman | Kolom/form | Nilai yang terlihat |
|---|---|---|
| Stok masuk/keluar | tanggal, bahan, jenis, jumlah, satuan, keterangan | jenis: `Masuk` / `Keluar` (form: "Stok masuk" / "Stok keluar") |
| Pengajuan bahan | kode, tanggal, bahan, jumlah, satuan, tanggal kebutuhan, alasan, status | kode `PG-001`; status `Menunggu`, `Disetujui` |
| Pengembalian | tanggal, bahan, jumlah, satuan, kondisi, alasan, status | kondisi `Layak digunakan` / `Perlu diperiksa` / `Tidak layak` → status `Diterima` / `Pemeriksaan` / `Dipisahkan` |
| Persiapan dapur | jadwal (waktu makan), porsi, status, progres %, catatan | status `Selesai` / `Diproses` / `Menunggu` |
| Laporan | pemakaian per hari (Sen–Min), kondisi stok (%), ringkasan bahan | dihitung dari stok dan transaksi |
| Dashboard | jenis bahan, stok menipis, pengajuan aktif, pengembalian | agregat |

## 8. Pengaturan, profil, preferensi

- Profil per peran: `nama`, `email`, `telepon` (default nama: `Ahli Gizi`, `Petugas Logistik`, `Perawat`, `Waiter`; default email ahli gizi `ahligizi@nutricare.com`).
- Ganti kata sandi: validasi lama wajib, baru ≥ 8 karakter, ulangi harus sama. Saat ini hanya menampilkan pesan bahwa fitur butuh sistem akun.
- 5 preferensi notifikasi (boolean, per peran): `pasien`, `kondisi`, `stok`, `jadwal`, `distribusi`.
- Tombol "Kembalikan data contoh": menghapus store `pasien`, `pantangan`, `rekomendasi`, `jadwal`, `perawat`, `bahan` lalu memuat ulang (data logistik statis tidak ikut).

## 9. Login (`index.html`)

- Input: `role` (`logistik`, `ahli-gizi`, `waiter`, `dapur`), `username` (username atau email), `password`, `remember`. Akun Perawat dan Dokter menggunakan aplikasi Nadi.
- Saat ini tidak ada verifikasi; tautan "dashboard demo" membuka halaman **tanpa login**.

## 10. Temuan dan dampaknya ke backend

| # | Temuan | Dampak / keputusan |
|---|---|---|
| T1 | `id` dibandingkan dengan `===` terhadap atribut HTML (string) | ID di JSON **harus string** (UUID atau teks), bukan integer |
| T2 | Relasi memakai **nama pasien**, bukan id | Database tetap memakai `pasien_id` (FK), API menerima/mengembalikan `pasien` = nama. Jika nama ganda, kembalikan error 422 yang jelas |
| T3 | Hapus pasien tidak dicegah dan tidak ditangani (tanpa try/catch) | Jangan blokir hapus. Pakai **soft delete** (K2 diputuskan): pasien dan data turunannya disembunyikan dalam satu transaksi, sehingga UI berperilaku seperti sebelumnya (baris hilang) tetapi data medis tetap tersimpan |
| T4 | Pilihan `kategori` dan `satuan` berbeda antara halaman ahli gizi dan logistik | Simpan sebagai teks, validasi pada gabungan: kategori `Karbohidrat, Protein, Sayuran, Buah, Bumbu, Lainnya, Bahan pokok, Protein hewani, Protein nabati`; satuan `kg, gram, liter, ml, butir, ikat, pack`. Jangan pakai ENUM database |
| T5 | `jadwal` tanpa tanggal | Cerminkan frontend (tanpa tanggal, unik pasien+waktu). Perluasan opsional di keputusan K4 |
| T6 | Jam dikembalikan `HH:MM`; `row.waktu.replace(':','.')` | Serializer harus memotong detik (`08:15`, bukan `08:15:00`) |
| T7 | Kolom NUMERIC Postgres sering dikembalikan sebagai string oleh driver | Serializer wajib mengonversi ke number |
| T8 | Halaman demo bisa dibuka tanpa login | Backend butuh mode `demo` (tanpa token) selain mode `strict` |
| T9 | Perubahan `rekomendasi` dari aksi "Kirim ke dapur" hanya mengirim `{status}` | Gunakan PATCH parsial, validasi isi hanya bila field isi ikut dikirim |
| T10 | Pesan duplikat jadwal berbeda antara halaman ahli gizi dan waiter | Pilih pesan berdasarkan peran (BR-2) |
| T11 | Angka di dashboard logistik (48 bahan, 05 menipis, dst.) tidak sama dengan data seed (5 bahan) | Itu data hiasan; backend menghitung dari data nyata |
| T12 | Tema dan state UI ada di localStorage | Tetap di klien |

## 11. Selisih dengan deskripsi peran (dokumen tertulis) dan keputusan

| Deskripsi peran | Yang ada di frontend | Keputusan |
|---|---|---|
| Perawat menginput data pasien (nama, kamar, penyakit, alergi, pantangan) | Ahli gizi yang CRUD pasien dan pantangan; perawat hanya melihat pasien dan membuat laporan kondisi | **Ikuti frontend.** Izin perawat bisa dilonggarkan lewat konfigurasi RBAC bila nanti UI berubah |
| Perawat memberi info menu dan kamar ke waiter | Waiter melihat rekomendasi (baca) dan mengelola jadwal distribusi sendiri | Ikuti frontend |
| Kepala dapur memberi tahu petugas saat makanan siap | Halaman "Persiapan Dapur" (status Selesai/Diproses/Menunggu) | Modelkan sebagai `persiapan_dapur` |
| Waiter memberi tahu petugas saat makanan terkirim | Aksi "Tandai terkirim" pada jadwal | Ikuti frontend |
| Logistik menerima rekomendasi menu | Halaman logistik belum menampilkan rekomendasi | Backend menyediakan endpoint baca; tampilan menyusul |
| Logistik juga disebut kepala dapur; ahli gizi tidak ikut menyetujui bahan | Belum ada UI persetujuan | K6 diputuskan: hanya peran `logistik` yang menyetujui pengajuan bahan |
