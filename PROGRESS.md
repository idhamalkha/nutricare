# Progres Pengerjaan Backend NutriCare

## Tandai sudah dibaca pada notifikasi (5 November 2026)
- Dua aksi penandaan terbaca tidak pernah sampai ke server. Tombol "Tandai semua dibaca" tidak mengubah apa pun, dan menekan satu notifikasi sampai popup rinciannya terbuka tetap membiarkannya berstatus belum dibaca. Penyebabnya permintaan `PATCH /api/notifications/read-all` dan `PATCH /api/notifications/:id/read` dikirim dengan header `Content-Type: application/json` tetapi tanpa isi. Pembaca body JSON menolak permintaan seperti itu sebelum sampai ke penangan rute, sehingga server menjawab galat 500 dan perubahan di layar dibatalkan lagi.
- Perbaikan di `js/notification-center.js`: kedua permintaan penandaan tidak lagi memasang `Content-Type` karena memang tidak membawa isi, ditambah `credentials: 'same-origin'`. "Tandai semua dibaca" sekarang menandai seluruh notifikasi di layar lebih dulu (badge dan penghitung ikut hilang, tombol menjadi nonaktif), lalu menyimpan ke server; bila server menolak, tampilan dikembalikan ke keadaan semula dan muncul pemberitahuan "Gagal menandai semua notifikasi. Coba lagi." Penandaan satu notifikasi juga mengembalikan status lamanya bila gagal, dan jawaban 404 dianggap wajar karena notifikasi tersebut sudah tidak ada. Semua kegagalan kini terlihat oleh pengguna, tidak lagi hanya tercatat di konsol.
- Verifikasi: bentuk permintaan diuji langsung ke server rilis. Permintaan tanpa `Content-Type` dijawab 401 (sampai ke pemeriksaan sesi, artinya rute berjalan), sedangkan bentuk lama dengan `Content-Type: application/json` tanpa isi dijawab 500. Halaman statis berstub yang meniru penolakan itu dipakai untuk menguji ulang: menekan satu notifikasi menandai item tersebut (badge 3 menjadi 2) dan popup terbuka, "Tandai semua dibaca" membuat badge hilang dan tombol nonaktif, dan keadaan terbaca tetap bertahan setelah halaman dimuat ulang. Tes `notification-detail-actions.test.ts` ditambah satu kasus yang mengunci larangan `Content-Type` pada permintaan tanpa isi serta memastikan kedua rute menjawab 401 tanpa sesi. `tests/core` 36 berkas / 97 tes lulus, `check:frontend` 25/25 dengan checksum ditulis ulang, berkas disalin ke folder rilis (sha256 cocok) dan disajikan server di `http://127.0.0.1:3017` dengan health `strict`. Tidak ada mutasi ke database.

---

## Popup notifikasi di tengah layar (5 November 2026)
- Popup rincian notifikasi di halaman logistik muncul di pojok kiri atas, bukan di tengah. Penyebabnya `pages/logistik.html` memuat aturan `* { margin: 0 }` yang mematikan `margin: auto` bawaan peramban untuk `<dialog>`, sehingga posisi dialog jatuh ke `inset: 0` tanpa pemusatan. Halaman lain tidak memakai aturan itu, jadi masalahnya hanya terlihat di logistik.
- Perbaikan: `.notif-dialog` di `css/notifications-center.css` sekarang menuliskan sendiri `position: fixed; inset: 0; margin: auto;` sehingga tidak bergantung pada gaya bawaan peramban. Varian ponsel (lembar bawah) tetap berlaku karena ditulis setelahnya di media query.
- Verifikasi: popup diukur pada halaman statis berstub, lebar 1440px menghasilkan jarak kiri 440px, kanan 440px, atas 320px, bawah 320px (tepat di tengah). Pada lebar 390px popup tetap menempel di bawah, lebar penuh, sudut atas membulat, tanpa luapan horizontal. Tes `notification-detail-actions.test.ts` ditambah pemeriksaan aturan pemusatan ini, `tests/core` 96 tes lulus, `check:frontend` 25/25, berkas disalin ke folder rilis dan disajikan server di `http://127.0.0.1:3017`.

---

## Sidebar logistik mengikuti tema halaman (5 November 2026)
- Sidebar mengambang di halaman logistik tetap hijau gelap walaupun halaman dipindah ke tema terang atau gelap. Penyebabnya warna permukaan, garis, dan bayangan sidebar ditulis sebagai nilai tetap pada `css/role-pages.css` dengan selektor `.app.layout > .sidebar`, yang spesifisitasnya sama dengan aturan tema di `css/theme.css` tetapi dimuat belakangan, sehingga aturan tema selalu kalah.
- Perbaikan: `css/role-pages.css` sekarang punya blok `body[data-theme="dark"]` dan `body[data-theme="light"]` yang menimpa variabel `--sb-surface`, `--sb-hairline`, dan `--sb-shadow`, lalu warna teks menu, ikon, label bagian, pil tanggal, keadaan hover, dan item aktif. Tema bawaan (original) tidak berubah. Tema gelap memakai nada biru arang seperti halaman lain, tema terang memakai permukaan putih kehijauan dengan teks gelap.
- Cahaya latar `body::before` juga diredupkan pada tema terang supaya tidak berbayang keruh di atas latar terang.
- Verifikasi: halaman statis berstub diuji pada tiga tema. Tema terang menghasilkan permukaan `#ffffff` ke `#f2f7ec`, teks menu `#566151`, item aktif `#1d2a17` dengan latar hijau muda; tema gelap menghasilkan permukaan `rgba(28,34,46)` dengan teks menu `#a0a9b8`; tema original tetap seperti sebelumnya. Diperiksa juga keadaan sidebar mengecil (84px) dan lebar ponsel 390px tanpa luapan horizontal. Tes integrasi logistik ditambah pemeriksaan blok tema, `tests/core` 96 tes lulus, `check:frontend` 25/25, berkas disalin ke folder rilis (sha256 cocok) dan disajikan server di `http://127.0.0.1:3017`.

---

## Perbaikan temuan di halaman logistik (5 November 2026)
- **Angka ketersediaan bahan tidak lagi berbeda antar tempat.** Sebelumnya kartu "Stok menipis" menulis 02 dan panel "Ketersediaan bahan" menulis 2 menipis, padahal tabel "Stok perlu diperiksa" berisi 3 baris. Penyebabnya server menghitung status bahan dengan urutan prioritas kedaluwarsa lebih dulu (bahan yang hampir kedaluwarsa berstatus "Periksa", bukan "Menipis"), sedangkan tabel memakai aturan stok di bawah minimum. Sekarang kartu, panel, dan tabel memakai satu aturan yang sama, dihitung dari daftar bahan yang benar-benar tampil, jadi jumlah baris tabel selalu sama dengan angka kartu dan sisanya dihitung sebagai aman. Untuk data yang sama hasilnya menjadi 05 jenis bahan, 03 stok menipis, panel 2 aman / 3 menipis / 40%.
- Status pada tabel dan kartu bahan kini membedakan **Habis** (stok nol) dari **Menipis**, bukan menyebut semuanya menipis.
- **Tombol popup notifikasi tidak lagi menjanjikan hal yang tidak ada.** Notifikasi lama tanpa rincian yang tautannya menuju satu bagian halaman (misalnya "Ada jadwal makan baru" dengan tombol "Buka persiapan dapur") sekarang memakai label netral "Buka halaman terkait". Label yang menyebut tujuan hanya dipakai bila rincian notifikasi tersedia.
- **Badge jumlah pada lonceng notifikasi diperbaiki.** Badge berbentuk pil sesuai angka (sebelumnya terhimpit jadi 17x8 piksel karena aturan titik 8px dari `profile-dropdown.css` masih menang di urutan berkas), tidak memotong ikon lonceng, dan memakai warna aksen yang sama dengan penghitung di panel notifikasi.
- Verifikasi: `tests/core` 36 berkas / 96 tes lulus (dua tes diperbarui dan ditambah untuk mengunci aturan angka ketersediaan serta label tombol popup), `check:frontend` 25/25 dengan checksum ditulis ulang, halaman statis berstub diuji dengan data yang meniru temuan (5 bahan, 2 di antaranya hampir kedaluwarsa) dan popup notifikasi lama. Berkas statis disalin ke folder rilis (sha256 cocok) dan disajikan 200 oleh server di `http://127.0.0.1:3017`. Tidak ada mutasi ke database.

---

## Logistik, ahli gizi, dan popup notifikasi: isi halaman ikut dirapikan (5 November 2026)
- **Logistik (isi, bukan cuma bentuk).** Tabel Data Bahan yang tadinya enam kolom bergaris diganti kisi kartu: nama bahan, kategori, sisa stok dengan satuan, batas minimum, tanggal kedaluwarsa, dan penanda status. Bahan yang stoknya di bawah minimum diberi garis tepi kuning, jadi tidak perlu membaca kolom angka untuk tahu mana yang menipis. Riwayat stok masuk/keluar menjadi daftar bergaris waktu (tanggal, jenis, jumlah, keterangan). Rekomendasi dapur dan jadwal persiapan juga menjadi kartu, dengan tombol Detail tetap di tempatnya.
- Semua kartu memakai data dari endpoint yang sama seperti sebelumnya; tidak ada permintaan API baru, tidak ada id atau kelas data yang dihapus, dan tombol Tandai siap serta alur handoff dapur tidak disentuh.
- **Ahli gizi: kartu pasien + penanda pantangan.** Daftar pasien yang tadinya tabel lebar sekarang satu kartu per pasien: nama, nomor rekam medis, ruangan, status, diagnosis, dua penanda **Alergi** (merah) dan **Pantangan** (kuning), lalu ringkasan gizi (BB, TB, IMT, kebutuhan kalori, tekstur) di kaki kartu. Pasien tanpa catatan memakai penanda bergaris putus-putus dengan tulisan "Tidak ada", bukan sel kosong, supaya bedanya jelas antara "tidak ada pantangan" dan "belum diisi". Penanda memakai kelas yang sudah dipakai perawat agar arti warna konsisten di seluruh aplikasi. Halaman tetap hanya-baca: tidak ada tombol ubah atau hapus, dan tombol Detail membuka rincian yang sama.
- **Popup notifikasi: tombol aksi yang menyebut tujuannya.** Kaki popup tidak lagi berisi tautan generik "Buka halaman terkait". Tautan dibaca lebih dulu: `#pasien` menjadi "Buka data pasien", `#rekomendasi` menjadi "Buka rekomendasi menu", `#distribusi` menjadi "Buka jadwal distribusi", `#dapur` menjadi "Buka persiapan dapur", `#jadwal` menjadi "Buka jadwal makan". Notifikasi lama tanpa tautan memakai jenis rinciannya sebagai cadangan; bila keduanya tidak ada, popup menampilkan keterangan "Rincian ini tidak menaut ke halaman lain" dan hanya menyisakan tombol Tutup. Menekan tombol aksi menandai notifikasi terbaca lalu menutup popup. Di ponsel tombol aksi dan Tutup melebar penuh dengan aksi utama di atas.
- Hanya tautan lokal (diawali `/`) yang boleh menjadi tombol, sama seperti aturan validasi di server, sehingga isi notifikasi tidak bisa dipakai untuk mengarahkan ke situs luar.
- Catatan teknis: penggantian tabel menjadi kartu memakai satu penolong `setCards` di `js/logistik.js` (mengisi kisi kartu, menampilkan teks kosong bila tidak ada data, dan mengosongkan wadah saat memuat ulang). Saat pengujian, blok penanganan galat sempat mengembalikan panel "Ketersediaan bahan" ke "Belum ada data" padahal angka kartu sudah terisi; reset itu dihapus agar angka terakhir yang sah tetap tampil.
- Verifikasi: `tests/core` 36 berkas / 96 tes lulus (satu tes integrasi logistik diperbarui dari `setRows` ke `setCards`, satu berkas tes baru untuk tombol aksi popup), `check:frontend` 25/25 dengan checksum yang ditulis ulang, `node --check` bersih untuk `js/logistik.js` dan `js/notification-center.js`. Halaman statis berstub diuji pada 1440px dan 390px: 6 kartu bahan (4 bertanda menipis), 4 baris riwayat, 3 kartu rekomendasi dengan tombol Detail, 3 kartu persiapan, 5 kartu pasien dengan penanda alergi/pantangan yang benar, popup 4 jenis notifikasi plus satu notifikasi lama, tema gelap dan terang, tanpa gulir horizontal. Tidak ada mutasi ke Supabase live. Berkas statis disalin ke folder rilis (sha256 cocok) dan disajikan 200 oleh server di `http://127.0.0.1:3017` dengan health `strict`.

---

## Halaman logistik, ahli gizi, waiter: shell dan dashboard diselaraskan (4 November 2026)
- Halaman logistik sebelumnya memakai tata letak sendiri: sidebar menempel rata kiri dan tidak bisa diperkecil. Sekarang sidebar mengambang dengan geometri yang sama seperti halaman perawat (lebar 254px, jarak 16px, sudut 26px, permukaan kaca), tombol perkecil di tepi kanan sidebar, dan status perkecil tersimpan di perangkat. Di ponsel sidebar kembali menjadi satu kolom penuh, status perkecil diabaikan agar tidak menyisakan kolom sempit.
- Kepala dashboard ketiga peran diganti pola hero yang sama dengan perawat: label kecil dengan titik status, judul besar, satu paragraf penjelas, dan tombol aksi. Logistik memakai hero dua kolom dengan panel "Ketersediaan bahan" (persentase, batang kemajuan, jumlah aman dan menipis) yang dihitung dari data server. Ahli gizi dan waiter memakai hero satu kolom karena belum ada angka ringkas yang layak ditampilkan di sana.
- Kartu ringkasan dashboard logistik diberi garis aksen kiri berwarna per kategori, angka tabular, dan reaksi angkat saat disorot. Daftar aktivitas berubah dari tumpukan ikon menjadi garis waktu dengan pemisah putus-putus.
- Ikon notifikasi kosong pada lima halaman (perawat, ahli gizi, logistik, waiter, pengaturan, profil) tidak lagi memakai emoji lonceng, melainkan ikon garis yang sama dengan tombol notifikasi.
- Placeholder angka yang sebelumnya memakai tanda pisah panjang diganti elipsis, dan sel tabel kosong memakai tanda hubung biasa, supaya tidak ada em dash atau en dash di antarmuka.
- Catatan teknis: lebar sidebar saat diperkecil ditulis langsung (84px) alih-alih lewat variabel CSS, karena transisi lebar pada elemen `position: fixed` sempat tertinggal satu langkah di Chromium. Tombol perkecil dibuat otomatis oleh `js/nutricare.js`, jadi tidak ada markup baru yang perlu ditambahkan per halaman.
- Berkas baru `css/role-pages.css` memuat lapisan bentuk ini dan dimuat paling akhir pada tiga halaman, sehingga menang atas gaya inline lama tanpa mengubah aturan yang sudah ada. Tidak ada id, kelas data, atau alur kerja yang diubah; `js/logistik.js` hanya ditambah pengisian empat simpul hero dan penggantian placeholder.
- Verifikasi: `check:frontend` lulus 25/25 (checksum baru untuk `css/role-pages.css`), halaman statis berstub diuji pada 1440px dan 390px, tema gelap dan terang, tanpa gulir horizontal; sidebar 254px ke 84px dan kembali, lebar utama ikut menyesuaikan. Exe tidak dibangun ulang karena tidak ada perubahan backend; berkas statis disalin ke folder rilis dan disajikan 200 oleh server di `http://127.0.0.1:3017`.

---

## Notifikasi: judul nyata + popup rincian (4 November 2026)
- Judul notifikasi tidak lagi seragam "NutriCare". Tiap kejadian punya judulnya sendiri: "Pasien baru ditambahkan", "Rekomendasi menu baru", "Rekomendasi menu diperbarui", "Makanan siap didistribusikan", dan "Status distribusi diperbarui". Isi pesan juga menyebut nama pasien, menu, dan waktunya.
- Notifikasi kini menyimpan rincian terstruktur (`detail`: jenis, ringkasan, daftar field, daftar item). Klik satu notifikasi membuka popup berisi data nyata: data pasien baru (nama, no. RM, ruangan, diagnosis, usia, BB/TB, target kalori, tekstur), rincian rekomendasi menu (pasien, tanggal, waktu makan, menu, komposisi, kalori, diet, tekstur), atau daftar menu siap diantar beserta jumlah porsi.
- Notifikasi pasien baru adalah tambahan baru: saat pasien didaftarkan, perawat dan ahli gizi menerima notifikasi berisi data pasien tersebut. Sebelumnya kejadian ini tidak diberitakan sama sekali.
- Notifikasi lama tanpa rincian tetap bisa dibuka; popup menampilkan pesan singkat dan catatan bahwa rincian belum tersedia. Tidak ada data yang dikarang.
- Desain kotak masuk diselaraskan dengan halaman perawat: panel mengambang bersudut 18px, penanda jenis (informasi, selesai, perlu perhatian, gagal), penanda "Ada rincian", chip jumlah belum dibaca, dan popup dua kolom data yang di ponsel berubah menjadi bottom sheet. Ikon emoji diganti ikon garis. Tombol tutup tunggal di kaki popup (tombol X di kepala hanya ikon).
- Kontras dijaga di tiga tema (original, dark, light); label data dinaikkan ke 70% warna teks agar lolos WCAG AA. Gulir halaman dikunci selama popup terbuka memakai `:has()` karena event `close` dialog tidak selalu terpicu.
- Migrasi `20261104000007_notification_detail.sql` menambah kolom `notifications.detail` (jsonb, nullable). Migrasi sudah diterapkan ke database live atas persetujuan pengguna; kolom terverifikasi ada (jsonb, nullable) dan 14 notifikasi lama tetap utuh tanpa rincian. Bila migrasi belum diterapkan di lingkungan lain, server otomatis mengirim dan membaca notifikasi tanpa rincian, jadi kotak masuk tidak pernah mati total.
- Verifikasi: `tsc --noEmit` bersih, `tests/core` 35 berkas / 95 tes lulus (termasuk 5 tes baru untuk detail, batas ukuran, dan fallback kolom), `check:frontend` 24/24, exe dibangun ulang (97.456.784 byte) dan tersaji di `http://127.0.0.1:3017`. Diuji pada halaman statis berstub untuk empat jenis notifikasi, tiga tema, dan lebar 390px. Tidak ada perubahan data bisnis di Supabase live: satu-satunya operasi tulis adalah migrasi kolom (disetujui) dan satu uji insert yang dibatalkan lewat rollback (terverifikasi 0 baris tersisa).

---

## Laporan kondisi: aksi cepat "Tandai ditinjau" (4 November 2026)
- Tiap kartu laporan yang statusnya belum "Ditinjau" kini punya tombol aksi cepat **Tandai ditinjau** di depan tombol Ubah/Hapus. Satu klik mengubah status lewat `PATCH /perawat/:id` (endpoint yang sama dengan form ubah), lalu kartu, badge, dan ringkasan "N laporan · N baru · N evaluasi" ikut menyesuaikan tanpa memuat ulang halaman.
- Bila permintaan gagal, status tidak berubah dan muncul pesan "Gagal memperbarui status: …" — tidak ada perubahan setengah jalan.
- Tombol aksi cepat dibedakan secara visual (garis dan teks hijau) supaya terbaca sebagai aksi utama, dan hanya muncul pada laporan yang masih perlu ditindak.
- `NC.crud` mendapat opsi `actionsFirst` untuk menaruh aksi khusus sebelum Ubah/Hapus; opsi ini opsional sehingga halaman lain tidak berubah.
- Perbaikan bug: pencarian baris pada `NC.crud` memakai perbandingan ketat, sehingga tombol Ubah/Hapus/aksi khusus gagal pada data yang ID-nya berupa angka (semua data dari API). Sekarang dibandingkan sebagai string, jadi tombol aksi menemukan barisnya dengan benar di seluruh halaman.
- Verifikasi: `node --check` OK untuk `js/perawat.js` dan `js/nutricare.js`, `tests/core` 35 berkas / 90 tes lulus, `check:frontend` 23/23, aset tersaji dari server rilis (200), `/api/health` mode strict. Diuji pada halaman statis berstub: klik "Tandai ditinjau" mengubah badge Evaluasi → Ditinjau, tombol aksi hilang dari kartu itu, ringkasan berubah "1 evaluasi" → "0 evaluasi", pesan sukses muncul. Tidak ada mutasi ke Supabase live.

---

## Jadwal makan: tahap 6 desain (4 November 2026)
- Jadwal kini tampil sebagai agenda per jam (satu kolom kartu): jam besar + label waktu makan, nama pasien, ruangan · menu, dan badge status. Urutan tetap menaik menurut jam, jadi perawat membaca dari pagi ke malam.
- Filter status berubah dari dropdown menjadi chip (Semua, Terjadwal, Menunggu, Terkirim); ringkasan kepala panel menampilkan "N jadwal · N menunggu · N terkirim". ID panel memakai `p-jadwal-panel` agar tidak bentrok dengan `p-jadwal-ringkas` milik dashboard.
- Klik kartu membuka laci detail berisi ruangan, waktu makan, jam antar, menu, dan status, dengan catatan berbeda untuk Terkirim / Menunggu / Terjadwal.
- Panel "Handoff ke waiter · siap diantar" tidak lagi memakai tabel: tiap menu siap menjadi baris ringkas (jam, pasien, ruangan · menu, penanda "Siap"), memakai data `/jadwal/distribusi-siap` yang sama — tidak ada perubahan API dan tidak ada tombol aksi baru.
- Halaman tetap `readOnly: true`; perawat hanya membaca jadwal, alur "Tandai siap" di sisi dapur tidak disentuh.
- Tema terang: badge netral (Terjadwal) diberi latar dan border lebih tegas, teks jam/menu/ruangan dinaikkan kontrasnya, baris handoff memakai latar putih.
- Verifikasi: `node --check` OK, suite `tests/core` 35 berkas / 90 tes lulus, `check:frontend` 23/23 OK, aset tersaji dari server rilis (200), `/api/health` mode strict. Diuji 1440×1000 tema gelap/terang, chip "Menunggu" (6 kartu → 2 kartu), laci detail, handoff 2 baris, dan 390×844 tanpa luapan horizontal.

---

## Laporan kondisi: tahap 5 desain (4 November 2026)
- Tabel laporan diganti kartu bertumpuk satu kolom di dalam panel (`.crud-cards` di-scope lewat `#crud-catatan`), karena panel ini berbagi lebar dengan panel pengingat di sebelahnya.
- Tiap kartu menampilkan kolom waktu (jam besar + tanggal ringkas `04 Nov`), nama pasien + ruangan, badge status, isi laporan, lalu tombol Ubah/Hapus. Urutan tetap terbaru di atas (tanggal lalu jam menurun).
- Filter status berubah dari dropdown menjadi chip (Semua, Baru, Evaluasi, Ditinjau); ringkasan kepala panel menampilkan "N laporan · N baru · N evaluasi".
- Klik kartu (atau Enter/Spasi) membuka laci detail berisi pasien, tanggal, waktu, status tindak lanjut, dan isi laporan; laporan berstatus Evaluasi mendapat catatan agar dikoordinasikan dengan ahli gizi.
- CRUD tetap aktif untuk perawat (tambah/ubah/hapus laporan), memakai dialog modal yang sudah ada; tidak ada perubahan pada API atau struktur data.
- `#catatan .grid-2` memakai `align-items: start` agar panel pengingat tidak ikut memanjang mengikuti daftar kartu.
- Tema terang: teks laporan, ruangan, dan tanggal dinaikkan kontrasnya; badge status diperbesar sedikit (9,5 px) agar tetap terbaca di kartu padat.
- Verifikasi: `node --check` OK, suite `tests/core` 35 berkas / 90 tes lulus, `check:frontend` 23/23 OK, aset tersaji dari server rilis (200). Diuji 1440×1000 tema gelap/terang, chip "Evaluasi" (5 kartu → 1 kartu), laci detail, dan 390×844 tanpa luapan horizontal.

---

## Rekomendasi menu: tahap 4 desain (4 November 2026)
- `NC.crud` mendapat opsi `source` (fungsi pengganti `store.all()`), sehingga satu store bisa ditampilkan sebagian. Halaman perawat memakai `source: recommendationRows` agar hanya rekomendasi berstatus `Dikirim` yang tampil, tanpa mengubah data di store.
- Halaman Rekomendasi menu kini memakai `NC.crud` dengan `readOnly: true`: tombol tambah/ubah/hapus tidak dirender, jadi perawat hanya membaca. Ini juga menghapus render tabel manual di `render()` yang sebelumnya menimpa isi `#p-rekomendasi` setiap kali store berubah.
- Kartu menu menampilkan nama menu, pasien + ruangan, pil kalori, pil waktu makan, tekstur, dan diet; komposisi dibatasi tiga baris agar kartu tetap sejajar.
- Peringatan alergi otomatis: komposisi dan nama menu dicocokkan dengan catatan alergi pasien (dipisah koma/titik koma/"dan"). Bila cocok, kartu menampilkan strip merah "⚠ Mengandung … — tercatat sebagai alergi pasien" dan laci detail menambahkan catatan konfirmasi ke ahli gizi. Fitur ini hanya membaca data, tidak mengubah apa pun.
- Chip waktu makan (Semua, Sarapan, Makan siang, Makan malam, Snack) dan pencarian menu/pasien/komposisi/diet memakai mesin filter yang sama dengan halaman lain.
- Klik kartu membuka laci detail berisi 8 baris: pasien, tanggal, waktu makan, tekstur, target kalori, diet, komposisi, catatan dapur.
- Ringkasan di kepala panel: "N menu terkirim untuk N pasien · klik kartu untuk melihat komposisi".
- Tema terang: pil diet biru, pil kalori hijau, kotak peringatan merah, dan teks komposisi dinaikkan kontrasnya.
- Verifikasi: `node --check` OK, suite `tests/core` 35 berkas / 90 tes lulus, `check:frontend` 23/23 OK, aset tersaji dari server rilis (200). Diuji 1440×1000 tema gelap/terang, chip "Makan siang" (5 kartu → 2 kartu), laci detail dengan peringatan udang, dan 390×844 tanpa luapan horizontal.

---

## Alergi & pantangan: tahap 3 desain (4 November 2026)
- `NC.crud` mendapat opsi `layout: 'cards'` + `card(row)`: saat dipakai, data dirender sebagai kartu (bukan tabel) dengan tombol aksi di kaki kartu. Opsi lain (`dense`, `chips`, `rowBadge`, `onRowClick`) tetap kompatibel, jadi tabel pasien, rekomendasi, laporan, dan jadwal tidak berubah.
- Halaman Alergi & pantangan memakai kartu per pasien: nama + ruangan di kepala kartu, dua baris status (`Alergi` merah, `Pantangan` kuning), catatan gizi opsional, dan tombol Ubah/Hapus.
- Status kosong tidak lagi berbentuk kotak placeholder: dipakai latar netral dengan tanda centang dan teks "Tidak ada", sehingga status negatif tetap terbaca tetapi tidak bersaing dengan entri yang berisi.
- Chip kategori dihitung dari data: Semua, Ada alergi, Ada pantangan, Nihil. Ringkasan di kepala panel menampilkan "N pasien tercatat · N alergi · N pantangan" dan ikut diperbarui setiap render.
- Klik kartu (atau Enter/Spasi) membuka laci detail berisi ruangan, alergi, pantangan, dan catatan. Tombol di dalam kartu tidak memicu pembukaan laci.
- Tema terang: kartu berlatar putih-hijau sangat muda, tag alergi merah tua, tag pantangan amber tua, label kategori dan status kosong dinaikkan kontrasnya agar tidak menyatu dengan latar.
- Verifikasi: `node --check` OK, suite `tests/core` 35 berkas / 90 tes lulus, `check:frontend` 23/23 OK, aset tersaji dari server rilis (200). Diuji 1440×1000 tema gelap/terang, penyaringan chip (5 kartu → 2 kartu alergi), laci detail, dan 390×844 tanpa luapan horizontal.

---

## Data pasien: tahap 2 desain (4 November 2026)
- `NC.crud` mendapat empat opsi baru yang tidak mengubah perilaku CRUD lain: `dense` (tabel padat + kolom nama lengket saat digeser), `chips` (filter berbentuk chip, menggantikan dropdown), `rowBadge` (penanda kecil di sel pertama), dan `onRowClick` (baris dapat diklik / Enter untuk membuka detail).
- Halaman Data pasien memakai chip ruangan (Semua, Anggrek 1, Anggrek 2, Melati 1, Melati 2, Melati 3) yang dihitung dari data pasien, jadi tidak ada daftar ruangan yang ditulis manual.
- Penanda risiko di baris pasien: `Alergi` (merah) bila catatan alergi bukan "Tidak ada", `Pantangan` (kuning) bila hanya pantangan; keterangan lengkap muncul sebagai tooltip.
- `NC.detail` kini tampil sebagai laci dari sisi kanan (430 px, radius 22 px di sisi kiri, latar gelap blur), berisi 12 baris data termasuk alergi, pantangan, catatan gizi, dan tekstur diet. Di layar ≤720 px laci berubah menjadi bottom sheet setinggi 88vh. Tombol tutup memakai label "Tutup".
- Baris tabel memakai `tabindex` dan mendukung tombol Enter/Spasi untuk membuka detail, sehingga tidak hanya bisa diklik dengan mouse.
- Tabel padat: header huruf kapital 9,5 px, isi 11 px, garis pemisah kolom, hover halus, dan lebar minimum kolom pasien 208 px agar nama, nomor RM, dan penanda tidak berdesakan.
- Tema terang: chip aktif hijau tua dengan teks putih, penanda alergi/pantangan dengan teks lebih gelap, hover baris memakai tint hijau tipis.
- Verifikasi: `node --check` OK, suite `tests/core` 35 berkas / 90 tes lulus, `check:frontend` 23/23 OK, aset tersaji dari server rilis (200). Diuji pada 1440×1000, 390×844, tema gelap dan terang, termasuk laci detail dan penyaringan chip.

---

## Dashboard perawat: tahap 1 desain (4 November 2026)
- Hero "shift" baru di `#dashboard`: chip shift otomatis (pagi/siang/malam dari jam perangkat), sapaan waktu, ringkasan `N pasien aktif · N catatan alergi · N jadwal belum terkirim`, dan tiga aksi cepat (Pasien baru, Buat laporan, Jadwal makan).
- Kartu distribusi di sisi kanan hero: angka `terkirim / total`, progress bar yang mengisi sesuai persentase, dan chip ringkas (Terkirim, Belum terkirim, Total jadwal).
- Empat kartu KPI memakai aksen warna per kartu (hijau, biru, merah muda, kuning) dan tipografi lebih besar agar terbaca.
- Panel baru "Aktivitas terbaru": timeline 6 laporan terakhir (jam, pasien · ruangan, isi laporan, titik status Baru/Evaluasi/Ditinjau).
- Semua angka tetap memakai id lama (`p-total`, `p-laporan`, `p-evaluasi`, `p-jadwal`) sehingga tidak ada perubahan pada data atau API; tambahan id baru: `p-shift`, `p-greet`, `p-summary`, `p-distribusi`, `p-distribusi-fill`, `p-distribusi-chips`, `p-timeline`.
- Penyesuaian tema terang: badge status, notice peringatan, track progress, dan chip diberi kontras lebih kuat (teks hijau tua pada latar hijau muda).
- Responsif: hero menjadi satu kolom di bawah 980 px, tombol aksi menjadi grid 2 kolom dengan tombol utama selebar kartu di bawah 560 px; diuji pada 1440×1000 dan 390×844 tanpa overflow.
- Verifikasi: `node --check` OK, seluruh suite `tests/core` 35 berkas / 90 tes lulus, `check:frontend` 23/23 OK, aset tersaji dari server rilis (200).

---

## Sidebar: tombol perkecil / perbesar (4 November 2026)
- Tombol bulat 26 px di tepi kanan kartu sidebar, vertikal tengah, dengan glyph ‹ / ›. Diletakkan di dalam `.app` (bukan `body`) supaya variabel `--sb-w` ikut berubah saat mengecil.
- Keadaan mengecil: lebar kartu 84 px, hanya ikon yang tampil (label disembunyikan lewat `font-size: 0` + ikon dikembalikan ke 15 px), brand hanya logo, tanggal dan label seksi disembunyikan (label seksi diganti hairline), item aktif tetap punya bar aksen.
- Tooltip: setiap `.nav-link` diberi `data-label` (teks tanpa ikon) dan `title` hanya saat mengecil, jadi nama menu tetap terbaca tanpa memperlebar kartu.
- Aksesibilitas: tombol memakai `aria-expanded`, `aria-label` ("Perkecil menu" / "Perbesar menu"), `aria-controls="sidebar-nav"`, dan outline fokus. Sidebar diberi `id="sidebar-nav"` bila belum ada.
- Status disimpan di `localStorage` (`nutricare-sidebar-collapsed`) sehingga pilihan bertahan antar halaman dan sesi; transisi 240 ms pada lebar kartu dan kolom grid.
- Di layar ≤720 px tombol disembunyikan dan seluruh aturan mengecil dinetralkan agar sidebar tetap tampil penuh di atas konten.
- Dijalankan dari `js/nutricare.js` (`initializeSidebar`) yang dimuat semua halaman, jadi markup HTML tidak diubah. Ada penjaga `typeof document.querySelector !== 'function'` agar tetap aman pada lingkungan uji tanpa DOM.
- Verifikasi: lebar 254 → 84 px, konten bergeser 286 → 116 px, tombol ikut bergeser 257 → 87 px, `aria-expanded` berubah, `localStorage` terisi; tes `static-root`, `role-workflow-frontend`, `frontend-store-no-fallback`, `auto-refresh`, `frontend-adapter` lulus (16 tes); `check:frontend` 23/23 OK.

---

## Desain ulang sidebar: kartu mengambang (4 November 2026)
- Sidebar kini berbentuk kartu mengambang: berjarak 16 px dari tepi kiri, atas, dan bawah, radius sudut 26 px, permukaan gradien bertingkat, garis tepi tipis, dan bayangan berlapis. Isi menu **tidak diubah** sama sekali (brand, tanggal, label menu, dan seluruh item tetap).
- Layout: `.app` memakai kolom `calc(var(--sb-w) + var(--sb-gap) * 2)`, sidebar `position: fixed`, dan `.main` dipatok ke `grid-column: 2` agar konten tidak tertimpa. Jarak sidebar–konten 16 px, konsisten dengan jarak tepi.
- Detail permukaan: garis pemisah brand diganti hairline bergradasi (bukan garis penuh), tanggal jadi chip kecil, label seksi lebih terang, item nav radius 14 px dengan ikon berbingkai halus.
- Status aktif kini punya tiga isyarat yang konsisten: bar aksen 3 px di kiri, isian gradien aksen, dan teks putih tebal. Hover memakai isian netral + ikon berwarna aksen agar berbeda dari status aktif. Fokus keyboard diberi outline aksen.
- Ambient glow tipis di belakang layout (`body::before`) supaya kesan melayang terbaca di latar gelap.
- Tema terang dan gelap disesuaikan di `theme.css`; aturan status nav diletakkan di akhir berkas karena aturan lama `.nav-link:hover/.active` menang secara urutan.
- Responsif: ≤1100 px kartu menyempit (232 px, gap 12 px); ≤720 px sidebar menjadi kartu penuh di atas konten dengan padding tepi, grid nav 2 kolom, dan `.main` kembali ke `grid-column: 1`.
- Verifikasi: `npm run check:frontend` 23/23 OK setelah manifest diperbarui; tes `static-root`, `role-workflow-frontend`, `frontend-store-no-fallback`, `auto-refresh` lulus. QA visual lewat salinan halaman statis (tanpa login/API) pada 1440×900 dan 390×844 untuk tema asli, gelap, dan terang.
- Berkas berubah: `css/dashboard.css`, `css/theme.css`, `docs/frontend-checksums.txt` (sudah disalin ke folder rilis).

---

## Perapian frontend perawat: menu terpisah, formulir modal, pasien pulang & pasien lama (4 November 2026)
- Menu perawat dipecah: **Data pasien**, **Alergi & pantangan**, **Rekomendasi menu** kini menjadi halaman terpisah, tidak lagi menumpuk dalam satu panel. Section `#pasien` hanya memuat daftar pasien; `#pantangan` dan `#rekomendasi` punya halaman sendiri dengan tautan navigasi baru.
- Formulir tambah/ubah seluruh area CRUD (`NC.crud`) dipindahkan dari inline di atas tabel menjadi `<dialog class="crud-dialog">` di atas halaman. Berlaku untuk semua peran yang memakai renderer yang sama (perawat, ahli gizi, logistik, waiter). Termasuk judul/subjudul, tombol tutup, klik backdrop untuk menutup, fokus otomatis ke isian pertama, dan scroll internal pada layar pendek.
- Judul formulir diperbaiki dari “Tambah pasien pasien” menjadi “Tambah pasien”; aksi hapus kini bisa diberi label khusus (`deleteLabel`, `deleteTitle`, `deleteNote`, `deleteConfirmLabel`, `deleteSuccess`).
- Formulir pasien tidak lagi menampilkan pilihan status. Server memaksa `status='Aktif'` pada `createPasien` dan `createPatientIntake`. Aksi hapus diganti menjadi **Pasien pulang** dengan dialog konfirmasi khusus; `deletePasien` menandai `status='Pulang'` sebelum soft delete sehingga riwayat terbaca sebagai pasien pulang.
- Endpoint baru: `GET /api/pasien/pulang` (riwayat pasien soft-deleted, maks. 200, termasuk `pulang_pada`) dan `POST /api/pasien/:id/masuk-kembali` (`readmitPasien`: memulihkan baris pasien + catatan alergi/pantangan sebelumnya, status kembali `Aktif`, identitas dipertahankan).
- Formulir pasien baru punya pemilih **Pasien baru / Pasien lama** di atas kolom nama. Mode lama menampilkan pencarian nama/no. RM dari daftar pasien pulang; memilih salah satu mengisi identitas (nama & RM dikunci) dan menyembunyikan field alergi karena dipulihkan server. `patients.readmit()` ditambahkan pada store frontend.
- `js/auto-refresh.js`: deteksi “sedang mengisi” tidak lagi memakai keberadaan `.crud-form` (dialog selalu ada di DOM) melainkan `dialog[open]`, agar auto-refresh tidak berhenti permanen.
- Verifikasi: `npx vitest run tests/core` → 35 file/90 tes lulus (termasuk `pasien-readmit.test.ts` baru dan `pasien-delete-demo` yang diperluas); `npm run build` lulus; `npm run check:frontend` lulus 23/23 setelah manifest diperbarui; `node --check` untuk `nutricare.js`, `perawat.js`, `auto-refresh.js` lulus.
- QA visual dengan harness statis (API palsu, tanpa menyentuh database): dialog tambah pasien, mode pasien lama + pencarian, penyimpanan (baris bertambah, dialog tertutup, toast), formulir ubah (tanpa field status), dialog “Tandai pasien pulang?”, serta tampilan 390×844. Tidak ada mutasi pada database live.

---

## Perbaikan rekomendasi dapur dan tabel resep (2 November 2026)
- Akar penyebab rekomendasi tidak tampil: frontend memfilter status Dikirim sekaligus tanggal hari ini, sedangkan API mengembalikan rekomendasi Dikirim tanggal 28–31 Oktober. Filter tanggal dihilangkan untuk tabel rekomendasi; kolom tanggal ditampilkan supaya umur pesanan jelas. Aksi modal menandai slot persiapan siap, sehingga satu pesanan lampau dapat melengkapi slot meal-time yang sama; belum diuji sebagai mutasi DB live.
- Tabel resep kembali mempertahankan kolom MENU, BAHAN, KEBUTUHAN/PORSI, dan SATUAN sesuai record; kolom AKSI terpisah untuk Edit dan Hapus.
- Diperbarui `server/tests/core/logistik-page-integration.test.ts` dan `server/tests/core/menu-recipe-management.test.ts`.
- Verifikasi final: dua suite terpilih lulus (5 tes), TypeScript build, `node --check ../js/logistik.js`, pemeriksaan checksum (22/22), dan `build:exe` lulus.
- Executable dibangun ulang; folder `Nutricare Final Revisi` disinkronkan dan proses server dimulai ulang untuk menyajikan rilis terbaru.

---

## Frontend — Responsivitas login & scrollbar sidebar (31 Oktober 2026)

## Frontend — Responsivitas login & scrollbar sidebar (31 Oktober 2026)
- Login desktop pada viewport pendek menggunakan mode kompak agar kartu tidak terdorong keluar layar; pada ponsel gambar dekoratif disembunyikan, jarak dan kontrol dipadatkan, dan pada layar pendek konten promosi ditangguhkan agar form lebih cepat dijangkau. Halaman tetap boleh scroll pada tinggi yang tidak cukup, sehingga form/konten tidak dipotong.
- Scrollbar sidebar disembunyikan lintas browser (`scrollbar-width`, `-ms-overflow-style`, pseudo-element WebKit); `overflow-y:auto` tetap aktif. Aturan juga diterapkan pada sidebar inline halaman logistik.
- Ditambahkan regression test `server/tests/core/responsive-login-sidebar.test.ts` (login breakpoints dan scrollbar, termasuk aturan overflow tetap auto).
- Visual approach dipertahankan, tidak menambah dekorasi atau mengubah palet; login diperlakukan sebagai surface **Configure**. Fokus perubahan pada densitas dan akses form di layar pendek.
- Koreksi setelah perbandingan dengan screenshot target: foto harus tetap memakai komposisi asli—besar, lengkung di bagian atas, `object-fit:cover`, daun dekoratif, dan caption overlay. Aturan compact sebelumnya yang mengubahnya menjadi foto persegi/caption bawah dihapus. Pada layar pendek ukurannya kini menyesuaikan viewport, sementara animasi posisi tengah tetap berfungsi.
- Validasi setelah koreksi ini: regression test lulus (2/2), build TypeScript lulus, checksum frontend lulus (21/21 file). Browser 1600×789: card 1240×765 (top 12, bottom 777), tanpa page overflow; foto x=273–739, y=278–594; caption overlay y=461–518; footer y=718–752. Screenshot browser dibandingkan dengan target: komposisi lengkung, daun, dan caption overlay sesuai serta tidak menyentuh footer. Full suite terakhir lulus 35 file/86 tes sebelum koreksi visual terakhir; belum dijalankan ulang sesudahnya.
- File: `css/style.css`, `css/dashboard.css`, `pages/logistik.html`, `server/tests/core/responsive-login-sidebar.test.ts`, `docs/frontend-checksums.txt`.

## Status: ✅ Fase 0-2 Selesai, Fase 3-7 Dalam Proses

## Status: ✅ Fase 0-2 Selesai, Fase 3-7 Dalam Proses

## Task 4 — Web Push (31 Oktober 2026)
- Implementasi langganan Web Push berbasis VAPID: endpoint key publik, simpan/hapus subscription per user, serta pengiriman payload notifikasi generik tanpa detail pasien. Subscription tidak valid yang sudah kedaluwarsa dihapus saat server push berikutnya.
- Pengaturan kini menyediakan aksi opt-in. Service worker menampilkan notifikasi dan meminta tab aktif melakukan refresh; polling dashboard tetap fallback dan tidak dinonaktifkan.
- Migrasi lokal `supabase/migrations/20261031000004_web_push.sql` membuat tabel penyimpanan subscription. Konfigurasi server: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, opsional `VAPID_SUBJECT`. Tanpa public+private key, API menyatakan disabled dan UI menampilkan status jelas.
- Pengujian lokal: `npm run build` berhasil; `npm run test:run` berhasil (34 file, 84 tes); pemeriksaan checksum frontend berhasil. Ada fixture ledger failure yang dicetak oleh E2E existing tetapi suite lulus.
- Domain events memicu notifikasi generik setelah transaksi DB berhasil commit (rekomendasi terkirim/diubah, dapur siap, distribusi terkirim); kegagalan push ditelan sebagai best-effort dan polling tetap fallback. Worker mengirim pesan refresh ke tab aktif.
- Uji fixture PGlite kini juga mengeksekusi migrasi push dan mengecek RLS serta kolom role. Build dan seluruh backend suite lulus (34 file/84 tes); browser/layanan push eksternal belum diuji. Migrasi remote belum dijalankan; push memerlukan VAPID config.
- Audit npm install mencatat 11 vulnerability (4 moderate, 5 high, 2 critical), belum ditangani.
- Berkas utama: `server/src/routes/push.ts`, `server/src/app.ts`, `server/tests/push.test.ts`, migrasi baru, `pages/pengaturan.html`, `js/push-notifications.js`, `js/auto-refresh.js`, `service-worker.js`, `docs/frontend-checksums.txt`.

## Status: ✅ Fase 0-2 Selesai, Fase 3-7 Dalam Proses

### ✅ Fase 0: Kunci Frontend dan Siapkan Lingkungan
- [x] Frontend disalin ke struktur proyek
- [x] Checksum frontend dikunci (`docs/frontend-checksums.txt`)
- [x] Struktur folder lengkap dibuat
- [x] package.json, tsconfig.json, .gitignore
- [x] Supabase config.toml
- [x] .env.example dan README.md

**Verifikasi**: `sha256sum -c docs/frontend-checksums.txt` ✅ LOLOS (17/17 files OK)

### ✅ Fase 1: Skema dan Seed
- [x] Migrasi database lengkap (`supabase/migrations/20261030000001_init.sql`)
  - [x] Tabel profiles, user_preferences
  - [x] Tabel pasien, pantangan_alergi, rekomendasi_menu, jadwal_makan, laporan_kondisi
  - [x] Tabel bahan, stok_transaksi, pengajuan_bahan, pengembalian_bahan, persiapan_dapur
  - [x] Tabel audit_log
  - [x] Fungsi soft_delete_pasien() dan restore_pasien()
  - [x] Triggers updated_at otomatis
  - [x] Row Level Security (RLS) aktif semua tabel
  - [x] REVOKE semua akses anon/authenticated
- [x] Seed data demo (`supabase/seed.sql`)
  - [x] 4 pasien (Andi, Siti, Budi, Dewi)
  - [x] 3 pantangan alergi
  - [x] 4 rekomendasi menu
  - [x] 3 jadwal makan
  - [x] 3 laporan kondisi
  - [x] 5 bahan (termasuk Telur stok 0 = Habis)
  - [x] Transaksi stok, pengajuan, pengembalian, persiapan dapur
- [x] Script seed akun auth (`server/seeds/create-auth-users.ts`)

**Status**: Siap dijalankan dengan `supabase db reset`

### ✅ Fase 2: Fondasi HTTP
- [x] Error handler (`src/http/errors.ts`)
  - [x] AppError, ValidationError, NotFoundError, ForbiddenError, UnauthorizedError, ConflictError
  - [x] Format error sesuai kontrak: `{message, code, field?}`
  - [x] Handler PostgreSQL error codes
- [x] Database pool (`src/db/pool.ts`)
  - [x] pg Pool dengan connection string
  - [x] Helper transaction()
  - [x] Helper todayWIB() untuk zona Asia/Jakarta
- [x] Serializers (`src/serializers/`)
  - [x] base.ts: serializeId (string), serializeNumber, serializeTime (HH:MM), serializeDate (YYYY-MM-DD)
  - [x] index.ts: serialize per resource (Pasien, Pantangan, Rekomendasi, Jadwal, Laporan, Bahan)
- [x] Config (`src/config.ts`)
  - [x] Load dotenv
  - [x] Validasi AUTH_MODE tidak boleh demo di production
- [x] Rules (`src/rules/`)
  - [x] bahan-status.ts: bahanStatus() sesuai prioritas frontend
  - [x] validations.ts: BR-1 sampai BR-5
    - [x] validateRMUnique (BR-1)
    - [x] validateJadwalUnique (BR-2, pesan berbeda per role)
    - [x] validateNoAllergens (BR-3)
    - [x] validateNoOutOfStock (BR-4)
    - [x] validateRekomendasi (BR-5, gabungan BR-3 + BR-4)

**Testing**: 
- ✅ 14 tests lolos (serializer + bahan-status)
- ✅ Vitest config setup

### ✅ Fase 3: Auth dan RBAC
- [x] Auth mode demo dan strict (`src/auth/index.ts`)
  - [x] getDemoUser (baca dari X-NC-Role header)
  - [x] getAuthUser (validasi Bearer token Supabase)
  - [x] login (cari username → email → signInWithPassword)
- [x] RBAC (`src/rbac.ts`)
  - [x] Matriks izin lengkap (ahli-gizi, perawat, waiter, logistik)
  - [x] checkPermission() dan requirePermission()
- [x] Resolver nama → ID (`src/db/resolvers.ts`)
  - [x] resolvePasienByName (nama → pasien_id)
  - [x] resolveBahanByName (nama → bahan_id)

### ✅ Fase 4: Resource Inti
- [x] Modul Pasien (`src/modules/pasien.ts`)
  - [x] getAllPasien, createPasien, updatePasien, deletePasien
  - [x] Validasi BR-1 (RM unik case-insensitive)
  - [x] PATCH parsial (hanya field yang dikirim)
  - [x] Soft delete dengan soft_delete_pasien()
- [x] Modul Pantangan (`src/modules/pantangan.ts`)
  - [x] CRUD dengan resolusi nama pasien
  - [x] Join nama pasien untuk response
- [x] Modul Bahan (`src/modules/bahan.ts`)
  - [x] CRUD + validasi nama unik
  - [x] Soft delete
- [x] Modul Rekomendasi (`src/modules/rekomendasi.ts`)
  - [x] CRUD + validasi alergi & stok
  - [x] BR-5: validasi hanya jika field isi berubah, tidak jika patch status saja
- [x] Modul Jadwal (`src/modules/jadwal.ts`)
  - [x] CRUD + validasi unik (pasien, waktu)
  - [x] BR-2: pesan berbeda per role (waiter vs lainnya)
- [x] Modul Laporan Kondisi (`src/modules/perawat.ts`)
  - [x] CRUD dengan resolusi nama pasien

### ✅ Routes
- [x] `src/routes/pasien.ts`
- [x] `src/routes/pantangan.ts`
- [x] `src/routes/rekomendasi.ts`
- [x] `src/routes/jadwal.ts`
- [x] `src/routes/perawat.ts`
- [x] `src/routes/bahan.ts`

### ✅ Main Server
- [x] `src/app.ts`
  - [x] Fastify setup
  - [x] CORS
  - [x] Static files (frontend)
  - [x] Auth middleware (mode demo/strict)
  - [x] Error handler global
  - [x] Register semua routes
  - [x] Health check endpoint

### 🔄 Fase 5: Modul Logistik (Implementasi ada, validasi penuh pending)
- [x] `/api/logistik/stok` (transaksi + update stok bahan)
- [x] `/api/logistik/pengajuan` (kode PG-nnn, persetujuan)
- [x] `/api/logistik/pengembalian` (status turunan dari kondisi)
- [x] `/api/logistik/persiapan` (4 slot per tanggal)
- [x] `/api/logistik/ringkasan` dan `/api/logistik/laporan/*`
- [ ] Tes kontrak/round-trip tiap endpoint logistik dan alur persetujuan/pengembalian
- [ ] Halaman logistik masih statis dan belum tersambung ke endpoint.

### 🔄 Fase 6: Akun dan Pengaturan (Parsial)
- [x] `/api/me` (GET profile); demo identity mengikuti role request (tes regresi 4 role)
- [x] `/api/me` (PATCH update profile) dan `/api/me/password` (PATCH) tersedia, tetapi strict mode belum dapat diverifikasi tanpa profil akun
- [x] `/api/me/preferensi` (GET/PUT) tersedia; demo mode hanya membaca default dan tidak menyimpan perubahan
- [x] `/api/auth/login` publik terhadap middleware role demo; invalid/missing account harus menghasilkan 401
- [x] Profil Auth yang metadata role-nya jelas dipetakan melalui `supabase/provision_profiles.sql` pada Supabase live; terverifikasi 3 akun Auth, 2 profil terhubung (ahli-gizi/perawat), 1 akun role admin tetap unmapped karena tidak ada role admin dalam RBAC aplikasi.
- [ ] Login strict belum diuji dengan kredensial pengguna; server login memakai email Auth aktual yang terhubung ke profil, tanpa domain email hard-code. Tidak mencoba password/menebak kredensial.
- [ ] Preferensi UI dipersist ke API; saat ini pengaturan frontend masih memakai localStorage
- [ ] `/api/demo/reset` — sengaja belum dibuat/diaktifkan karena reset atomik dan izin operasional belum aman
- [ ] `/api/auth/logout` revoke sesi (endpoint sekarang hanya menerima request, token Supabase stateless)

### 🔄 Fase 7: Tes dan Penguncian Kontrak (Parsial)
- [ ] Tes kontrak penuh seluruh fixtures frontend
- [x] Tes dasar RBAC, serializer, bahan-status, account demo/login boundary
- [ ] Tes konkurensi
- [x] Build TypeScript, suite Vitest, dan checksum frontend terverifikasi

### 🔄 Fase 8: Menghubungkan Frontend (Parsial)
- [x] Adapter API ditambahkan ke halaman ahli gizi, perawat, waiter; pasien ahli gizi diverifikasi lewat browser/API
- [x] Waiter jadwal diuji create → patch status → soft-delete → GET; record uji dibersihkan, daftar kembali 3 jadwal seeded
- [ ] Semua halaman/store dan CRUD perlu pemetaan serta pengujian end-to-end
- [x] Waiter memakai `/api/jadwal/pasien-distribusi` yang hanya mengembalikan nama dan ruangan; `/api/pasien` penuh tetap mendapat 403 (endpoint diuji di server + browser, route/RBAC dilindungi tes).
- [x] Laporan perawat diuji create → soft-delete → GET; actor demo dinormalisasi agar aman pada kolom UUID dan record uji terverifikasi tidak tersisa.
- [x] Dashboard logistik menampilkan ringkasan, stok bahan, riwayat stok, pengajuan, dan pengembalian dari API live.
- [x] Persiapan dapur dan laporan analitik dihubungkan ke endpoint aktual dan divalidasi di browser (porsi/status, pemakaian mingguan, kondisi stok, serta tabel inventaris).
- [x] Form transaksi stok, pengajuan, dan pengembalian mengirim payload ke endpoint domain; pemilihan bahan dari API dan validasi form dites di browser dengan POST stub (tanpa menulis database).
- [ ] Belum dilakukan write round-trip pada Supabase untuk form logistik; khusus stok perlu strategi cleanup kompensasi dan verifikasi kuantitas sebelum tes live.
- [x] Halaman pengaturan membaca profil dan preferensi dari API; mode demo menampilkan nilai read-only, menonaktifkan simpan/reset, agar tidak mengklaim perubahan lokal sebagai tersimpan server.
- [ ] Form tambah bahan masih hanya demonstrasi; jangan mengubah stok melalui CRUD bahan.
- [x] Frontend checksum logistik diperbarui setelah integrasi pembacaan API.

- **Verifikasi terkini:** build TypeScript dan 45 tes lulus (17 file); skrip frontend classic dan script inline ahli-gizi/logistik valid; seluruh 20 checksum cocok. Smoke HTTP localhost menegaskan `/` menyajikan form `POST` dan `js/login.js`/`js/api-adapter.js` terbaru.
- **Perbaikan form login:** pengiriman GET lama yang dapat menaruh kredensial dalam URL diganti fetch POST JSON ke `/api/auth/login`; keberhasilan menyimpan access token di `sessionStorage` dan membuka dashboard sesuai role. Adapter, settings, dan modul logistik memakai Bearer token bila tersedia, sementara header role hanya tetap menjadi fallback demo. Klik tautan logout menghapus token lokal. Token tidak direvoke server; `POST /api/auth/logout` saat ini no-op. Tidak ada percobaan kredensial live, dan login strict end-to-end belum terverifikasi.
- **Audit dummy berlanjut:** nilai default nama/email hard-coded pada pemanggilan `NC.settings` halaman ahli-gizi dan logistik dihapus. Empat referensi menu tertanam di halaman ahli-gizi diganti dengan opsi unik dari rekomendasi API; layar kosong menyatakan belum ada referensi server. Nama default pada semua elemen `data-user-name` di lima halaman dashboard (Ahli Gizi, Perawat, Waiter, Petugas Logistik, Pengguna) serta fallback `NC.settings` waiter dan perawat dikosongkan agar tidak menampilkan identitas statis seolah nama akun; tes lintas halaman/fallback dibuat merah pada fixture awal lalu hijau setelah perbaikan. Kegagalan fetch preferensi mengunci kontrol dan menampilkan pesan error. Reset demo tetap dinonaktifkan. Endpoint akun masih mengembalikan identitas demo di mode demo; penggantian profil database perlu akun/mapping autentikasi valid.
- **Batasan audit:** fixture teks di lima halaman disaring; opsi form, placeholder, contoh teks input, nilai waktu/status default bukan data baris. Belum tuntas audit penuh setiap label/skrip/response DB; jangan klaim seluruh dummy terhapus. Repo bukan Git repository, tidak ada commit.
- [x] `NC.store()` tidak lagi menampilkan seeded dummy saat route/API tidak tersedia; mutasi tanpa route dan reset demo ditolak. Argumen seed dummy pada store halaman ahli gizi, perawat, waiter, serta store bahan telah dihapus; tes regresi mengunci keadaan ini.
- [x] Smoke test browser sebelumnya memverifikasi ahli gizi (4 pasien), perawat (4 pasien, 3 laporan, 3 jadwal), dan waiter (3 distribusi, 4 menu) membaca record API. Setelah penghapusan argumen seed, browser belum diuji ulang.
- [x] Dashboard logistik: angka ringkasan, kartu laporan/stok/persiapan, tabel data, form pilihan bahan, dan aktivitas menunggu respons API (bukan menampilkan angka/tabel contoh); data tampil dari endpoint live saat terisi. Smoke test browser menampilkan dashboard 5 bahan, 2 stok menipis, 2 pengajuan aktif, 2 pengembalian; kartu stok dan persiapan/laporan mengikuti respons server.
- [x] Jadwal dan laporan kondisi menormalkan `demo-user` ke `null` untuk kolom audit UUID saat mode demo.
- [ ] Mutasi logistik telah dipetakan ke endpoint, tetapi belum diuji write-live; form tambah bahan tetap read-only/tidak aktif.
- [x] Halaman pengaturan membaca profil dan preferensi dari `/api/me` dan `/api/me/preferensi`; browser verifikasi role logistik sukses.
- [x] Mutasi profil, password, preferensi dan reset demo dinonaktifkan secara eksplisit pada mode demo (API hanya memberi demo defaults/read-only).
- [ ] Penyimpanan akun memerlukan profile Auth yang valid; akun live sebelumnya belum mempunyai baris `public.profiles` dan belum diuji.
- [ ] Dummy data store yang belum terhubung belum boleh diklaim telah dihapus
- K7: pendekatan adapter disetujui; perubahan frontend belakangan diizinkan untuk penggantian dummy data, tetapi cakupan perlu diselesaikan dan diuji bertahap.

---

## Keputusan Status

| ID | Keputusan | Status | Nilai |
|----|-----------|--------|-------|
| K1 | Stack | ✅ Final | Node.js + TypeScript + Fastify + Supabase |
| K2 | Hapus data | ✅ Final | Soft delete |
| K3 | Mode auth | ⚠️ Default | demo (dev), strict (prod) |
| K4 | Tanggal jadwal | ⚠️ Default | Tidak ada (ikuti frontend) |
| K5 | Nama bahan unik | ⚠️ Default | Ya (implemented) |
| K6 | Persetujuan pengajuan | ✅ Final | Hanya logistik |
| K7 | Cara hubungkan frontend | ❓ **BUTUH JAWABAN** | - |
| K8 | Izin peran | ⚠️ Default | Ikuti UI (implemented) |

---

## Checklist Definition of Done

### Fase 0-4 (Resource Inti)
- [x] Sesuai kontrak API (bentuk, tipe, pesan error)
- [x] Tabel dan constraint sesuai skema DB
- [x] Tes dasar hijau (serializer, bahan-status)
- [x] Frontend checksums lolos ✅
- [x] Izin peran sesuai matriks
- [x] Query baca menyaring deleted_at IS NULL
- [x] Tidak ada rahasia di repo (.env di .gitignore)

### TODO untuk Fase 5-7
- [ ] Semua endpoint lolos tes kontrak
- [ ] Migrasi berjalan dari DB kosong (supabase db reset)
- [ ] RLS aktif, anon key tidak bisa baca data
- [ ] Tes integrasi end-to-end

---

## Cara Menjalankan (Saat Ini)

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Setup Supabase (Local atau Remote)
```bash
# Jika pakai local
supabase init
supabase start

# Atau setup remote di https://supabase.com
```

### 3. Konfigurasi .env
Edit `server/.env` dengan nilai Supabase yang sesuai

### 4. Jalankan Migrasi & Seed
```bash
# Dari root proyek
supabase db reset

# Buat akun demo
cd server
npm run seed:auth
```

### 5. Jalankan Server
```bash
npm run dev
```

Server: http://localhost:3000

### 6. Test API (Mode Demo)
```bash
# GET pasien
curl -H "X-NC-Role: ahli-gizi" http://localhost:3000/api/pasien

# POST pasien baru
curl -X POST -H "X-NC-Role: ahli-gizi" -H "Content-Type: application/json" \
  -d '{"nama":"Test","rm":"RM99999","ruangan":"Test 101","diagnosis":"Test","usia":30,"bb":65,"tb":170,"kalori":1800,"tekstur":"Biasa"}' \
  http://localhost:3000/api/pasien
```

### 7. Verifikasi Frontend Tetap Aman
```bash
npm run check:frontend
```

---

## File Penting

| File | Status | Catatan |
|------|--------|---------|
| `docs/frontend-checksums.txt` | ✅ | Jangan diubah |
| `supabase/migrations/20261030000001_init.sql` | ✅ | DDL lengkap |
| `supabase/seed.sql` | ✅ | Data demo |
| `server/src/app.ts` | ✅ | Main server |
| `server/src/rbac.ts` | ✅ | Matriks izin |
| `server/src/rules/validations.ts` | ✅ | BR-1 sampai BR-5 |
| `server/src/rules/bahan-status.ts` | ✅ | Status bahan |
| `server/seeds/create-auth-users.ts` | ✅ | Seed akun Auth |
| Frontend (index.html, pages/, css/, js/, assets/) | 🔒 | READ ONLY |

---

## Next Steps

1. **Fase 5**: Implementasi modul logistik
2. **Fase 6**: Endpoint akun & pengaturan
3. **Fase 7**: Tes kontrak & aturan bisnis lengkap
4. **Fase 8**: Tanya K7 ke pemilik proyek, lalu hubungkan frontend

---

## Catatan Lanjutan — Identitas Profil dan Verifikasi
- [x] Smoke test browser menemukan nama role demo (Ahli Gizi/Perawat/Logistik) muncul kembali setelah halaman dashboard membaca `/api/me` tanpa token, walau elemen nama awal sudah dikosongkan.
- [x] Ubah pemuatan profil dan preferensi agar hanya aktif ketika token autentikasi tersimpan; tanpa token, nama akun tetap kosong dan data demo tidak disajikan sebagai profil server.
- [x] Tambah assertion regresi pada `settings-page-integration.test.ts`; terkonfirmasi gagal sebelum implementasi dan lulus setelah perbaikan.
- [x] Build berhasil; 45 tes dari 17 file lulus; sintaks frontend lulus; checksum frontend diperbarui dan diverifikasi.
- [x] Audit tahap logistik menemukan fallback `bahan.slice(0, 3)` yang mengisi tabel “Stok Perlu Diperiksa” dengan bahan server berstatus aman saat tidak ada stok rendah; hapus overwrite tersebut agar tabel hanya berisi hasil filter stok rendah dan empty-state server.
- [x] Tambah regresi di `server/tests/core/logistik-page-integration.test.ts`; gagal sebelum perubahan dan lulus sesudahnya. Smoke browser cache-busted melihat data stok live/server pada tabel dan tidak ada fallback sampel.
- [x] Audit perawat/waiter: tidak ditemukan array fixture pasien/jadwal di skrip dashboard; current source menampilkan nilai dari API. Waiter memakai proyeksi `/api/jadwal/pasien-distribusi` berisi nama dan ruangan, tanpa detail pasien penuh. Nama akun tetap kosong tanpa token.
- [x] Smoke test pada server dev terisolasi port 3017 mengonfirmasi dashboard waiter merender jadwal dari API dan perawat merender pasien/laporan dari resource API. Server lama di port 3000 belum mengenali route proyeksi waiter (`404`); source saat ini mendaftarkan route tersebut, jadi port 3000 tampak menjalankan build/proses lama. Jangan gunakan runtime lama untuk menilai source baru.
- [ ] Data pasien/menu yang terlihat cocok dengan seed SQL database; ini membuktikan API rendering, bukan bahwa rekaman adalah data rumah sakit produksi. Audit dummy seluruh halaman masih berjalan; jangan klaim semua dummy hilang.
- [x] Audit awal semua enam halaman HTML aplikasi (index + lima dashboard) dan skrip terkait: tidak ditemukan fixture record nama/RM/menu tertanam di HTML dashboard; contoh di placeholder form adalah teks petunjuk, seed SQL tetap data demo database.
- [x] Audit sesi menemukan endpoint logout sebelumnya hanya mengembalikan 204 tanpa revoke Supabase; implementasikan revokasi scope `local` memakai bearer token, kirim logout dari client sebelum menghapus token dan navigasi.
- [x] Tambah `account-logout-revoke.test.ts` dengan client Supabase dimock; regresi awal merah (revoke tidak dipanggil), hijau setelah implementasi. Tes login/logout targeted lulus.
- [x] Build berhasil; 46 tes dari 18 file lulus setelah perubahan logout. Sintaks frontend dan seluruh 20 checksum diverifikasi kembali; manifest `js/nutricare.js` diperbarui.
- [x] Logout bearer memanggil revokasi Supabase scope `local`; tes memakai mock. Verifikasi server revoke terhadap Supabase live dan login akun nyata belum dilakukan; jangan gunakan akun/kredensial live tanpa instruksi eksplisit. Token tes hanya nilai dummy.
- [x] Audit mapping kode/schema: `profiles.role` dan `AuthUser` hanya mendukung `logistik`, `ahli-gizi`, `perawat`, `waiter`; login mencocokkan username/email ke `auth.users` yang tertaut, memastikan keunikan dan role; profile aktif yang hilang ditolak. Provisioning mengubah `gizi→ahli-gizi`, `nurse→perawat`, dan melewati metadata admin/tidak dikenal; tidak ada role admin yang didefinisikan aplikasi.
- [x] Audit live read-only berhasil: 3 akun Auth, 2 profile aktif; metadata role `gizi` terpetakan ke `ahli-gizi` (1), `nurse` ke `perawat` (1), dan 1 akun `admin` belum memiliki profile. Role admin belum didefinisikan untuk aplikasi, jadi dibiarkan tidak terpetakan; tidak ada akun yang diubah.
- [x] Audit alur mutasi logistik: transaksi stok menggunakan satu transaksi DB untuk UPDATE bahan + INSERT stok_transaksi dan menolak stok minus; penerimaan pengembalian layak menambah stok di transaksi. Tidak ditemukan jalur mutasi stok lain pada backend selain logistik dan CRUD bahan.
- [x] Menutup celah CRUD bahan yang bisa mengubah stok secara langsung saat create/update: pembuatan hanya menerima stok awal 0/diabaikan; update ditolak jika properti stok disertakan. Tes regresi merah sebelum patch, lalu 4 tes mutasi/ledger lulus.
- [x] Build lulus dan 50 tes dari 20 file lulus setelah audit logistik.
- [ ] Tidak ada write logistik live; tes hanya menggunakan mock DB. Penerimaan/kompensasi real belum diuji.
- [x] Final QA: `npm run build` lulus; `npm run test:run` lulus (50 tes/20 file); pemeriksaan sintaks frontend lulus; semua 20 checksum cocok dengan manifest.
- [x] Status Git diperiksa: folder proyek bukan repository Git; tidak ada commit dibuat.
- [ ] Blocker tersisa: keadaan profile/Auth live belum dibaca ulang (catatan lama konflik); pencabutan sesi belum diuji terhadap Supabase live; login live dan transaksi logistik live sengaja tidak diuji.

Tanggal: 2026-10-31
Status: Audit awal halaman, autentikasi, mapping kode/schema, dan alur mutasi logistik selesai; final QA lulus dengan batasan live di atas.

## Catatan Lanjutan — Penyelarasan Alur Rumah Sakit
- [x] Perawat: ubah daftar pasien menjadi dapat tambah/edit dengan nama, RM, ruangan, diagnosis, usia, BB/TB, kalori, tekstur, dan status; tambah CRUD alergi/pantangan dan laporan kondisi untuk dikirim ke ahli gizi.
- [x] Perawat: tampilkan rekomendasi berstatus `Dikirim` dan daftar menu/ruangan yang sudah siap dari dapur; Waiter dibatasi ke endpoint proyeksi siap antar.
- [x] Logistik: tampilkan rekomendasi yang dikirim ahli gizi dan aksi menandai persiapan dapur `Selesai`; waiter mengonfirmasi terkirim lewat endpoint yang memeriksa status dapur.
- [x] Menyesuaikan RBAC untuk hak input pasien/pantangan perawat, baca rekomendasi logistik, dan proyeksi minimum waiter. Build dan tes backend penuh lulus: 63 tes dari 23 file.
- [x] Pemeriksaan sintaks Node untuk `api-adapter.js`, `perawat.js`, `logistik.js`, dan `waiter.js` lulus; semua 20 checksum frontend cocok setelah diperbarui.
- [x] Smoke browser pada port 3000: perawat dapat melihat form pasien, alergi/pantangan, laporan kondisi, rekomendasi yang dikirim dan panel handoff; logistik memuat rekomendasi serta tombol persiapan; waiter hanya menampilkan daftar siap antar. Uji API read-only: distribusi siap mengembalikan proyeksi minimal (saat ini kosong karena tidak ada jadwal yang cocok dengan persiapan dapur hari ini), rekomendasi/logistik dan jadwal/perawat berhasil.
- [x] Proses lama port 3000 dipastikan milik NutriCare, dihentikan beserta process tree `tsx watch`, lalu source terbaru diluncurkan ulang sekali; verifikasi menunjukkan tepat satu listener NutriCare dan `/api/health` merespons `{status: ok, mode: demo}`.
- [x] Tambah auto-refresh tanpa restart server: role pages memperbarui store/API secara berkala (30 detik; logistik 60 detik) dan saat tab kembali terlihat; logistik hydrate ulang, perawat memperbarui proyeksi siap antar. Smoke browser memanggil refresh, enam request API terpantau dan UI tetap merender 4 pasien.
- [x] Build lulus, 65 tes dari 24 file lulus, sintaks JS lulus, dan semua 21 checksum cocok.
- [x] Intake perawat pasien+alergi/pantangan digabung dalam `POST /api/pasien/intake` dan satu transaksi DB; tes rollback/commit `patient-intake-atomic.test.ts` lulus.
- [x] Rekomendasi berstatus `Dikirim` disinkronkan ke jadwal pasien/menu/waktu dalam transaksi; distribusi Waiter serta hitung porsi dapur hanya menghitung rekomendasi terkirim hari berjalan yang cocok.
- [x] Persiapan dapur yang ditandai `Selesai` kini menolak slot tanpa rekomendasi terkirim, memvalidasi ulang bahan yang disebutkan pada komposisi terhadap stok habis/kedaluwarsa, dan status enum diperbaiki ke `Diproses` (sesuai schema). Refresh porsi dapur melakukan update porsi tanpa mereset status/progres.
- [x] Konfirmasi antar tidak mengulang jadwal yang sudah `Terkirim`; aksi Waiter memperbarui antrean tanpa reload halaman.
- [x] Verifikasi akhir lulus: `npm run test:run` (72 tes / 28 file), `npm run build`, `npm run check:frontend` (21 checksum), serta `node --check` untuk JS yang berubah. Tidak ada perubahan DB live atau transaksi logistik live.
- [x] Push notification tersedia secara lokal; masih memerlukan konfigurasi VAPID dan belum diuji pada browser/layanan eksternal. Polling tetap aktif sebagai fallback.
- [x] Login: hapus pemilih role dari halaman; API menerima username/password saja dan menentukan role dari profile yang tertaut ke akun Auth. Tes RED/GREEN pada route/login page dan login mapping lulus. Mode demo tetap dibedakan sebagai demo (tautan demo terpisah), bukan autentikasi produksi.
- [x] QA responsive browser pada 390px: login + dashboard Logistik/Ahli Gizi/Perawat/Waiter tidak menunjukkan horizontal overflow; data dashboard selesai hydrate pada server source terisolasi port 3017. CSS breakpoint yang sudah ada memadai pada viewport yang diuji; tidak ada perubahan desain CSS tambahan.
- [ ] Belum ada end-to-end browser test dengan fixture DB lokal yang membuktikan rekomendasi→persiapan→Waiter terkirim. Browser test tidak menulis DB agar tidak ada mutasi live. Stok kuantitatif per resep dan push notification tetap belum tersedia. Folder proyek bukan Git repo; tidak ada commit.

Tanggal: 2026-10-31
Status: Intake atomik, sinkronisasi rekomendasi→jadwal→persiapan→distribusi, role login dari akun, dan smoke responsivitas mobile diterapkan dan lolos full tests/build/checksum. Integrasi DB real dan alur E2E penuh sengaja tidak dimutasi; push notification masih tersisa.

## Catatan Lanjutan — Validasi Kuantitatif Resep
- [x] Migrasi `20261031000002_menu_recipes.sql` berhasil dijalankan pada fixture PostgreSQL terisolasi menggunakan PGlite; tes memeriksa kolom numeric, RLS, uniqueness case-insensitive, foreign key, dan constraint jumlah positif.
- [ ] Belum diterapkan/diverifikasi pada Supabase aktual: `.env` menunjukkan konfigurasi database ada tetapi targetnya mungkin live; perlu kepastian target/izin sebelum menjalankan DDL remote.
- [x] Menambahkan `@electric-sql/pglite` sebagai dev dependency dan `server/tests/core/menu-recipe-migration.test.ts`; tes migrasi isolated lulus.
- [ ] Audit `npm install` melaporkan 11 vulnerability dependency (4 moderate, 5 high, 2 critical); belum menjalankan audit per paket atau perubahan versi.

## Catatan Lanjutan — Validasi Kuantitatif Resep
- [x] Tambah migrasi sumber `supabase/migrations/20261031000002_menu_recipes.sql` untuk master kebutuhan bahan per porsi; migrasi belum diterapkan pada database live.
- [x] Tambah endpoint logistik baca/ganti resep dan formulir UI untuk mengatur menu, bahan, serta jumlah per porsi; satuan resep dikunci mengikuti satuan stok bahan.
- [x] Persiapan dapur tidak dapat ditandai selesai jika resep belum dikonfigurasi, bahan kedaluwarsa, satuan tidak cocok, atau stok total tidak mencukupi `jumlah_per_porsi × jumlah_porsi`.
- [x] Tes resep kuantitatif (stok kurang, resep hilang, stok cukup), manajemen resep (transaksi, satuan, duplikasi bahan), dan gate kesiapan dapur: 9 tes fokus lulus.
- [x] Verifikasi akhir: `npm run test:run` lulus (77 tes/30 file), `npm run build`, `npm run check:frontend` (21 checksum) dan `node --check ../js/logistik.js`.
- [ ] Migrasi resep belum diterapkan ke database aktual; koneksi read-only ke target dari `DATABASE_URL` gagal `ECONNREFUSED`. Tidak ada DDL remote dijalankan.
- [x] Uji API end-to-end Fastify dengan fixture PGlite: intake → rekomendasi → dapur → antrean waiter → konfirmasi terkirim. Tidak menggunakan database live; browser UX belum diuji.
- [x] Migrasi `20261031000003_kitchen_stock_reservations.sql` menambah reservasi per slot/menu/bahan, referensi ledger dan status; RLS aktif dan akses anon/authenticated dicabut.
- [x] Saat dapur jadi `Selesai`, transaksi DB mengunci slot dan bahan, menghitung total kebutuhan resep, mengurangi stok dengan guard `stok >= jumlah`, menulis transaksi `Keluar` dan baris reservasi, lalu update status dapur — semua dalam satu transaksi.
- [x] Status siap idempotent untuk slot sama; rekomendasi tidak boleh diubah setelah dapur selesai (mencegah perubahan jadwal tanpa pembalikan ledger). Pembatalan/pengembalian reservasi masih memerlukan alur kompensasi khusus dan belum tersedia.
- [x] Uji PGlite memverifikasi rollback stok saat trigger ledger sengaja gagal, satu transaksi `Keluar` pada sukses, dan tidak ada pengurangan ganda saat status siap diulang.
- [x] Web Push VAPID, opt-in, subscription endpoints, service worker, dan event domain generic pasca-commit diterapkan; polling tetap fallback. Migrasi push diuji di PGlite, tidak dijalankan pada Supabase remote.
- [ ] Browser push nyata dan layanan push eksternal belum diuji; fitur memerlukan VAPID key. Browser UX alur fixture juga belum diuji.
- [x] Pengguna menerapkan migrasi resep melalui Supabase SQL Editor. Verifikasi read-only PostgREST berhasil: `menu_resep_bahan` tersedia dan dapat dipilih dengan kolom yang diharapkan (`id`, `menu`, `bahan_id`, `jumlah_per_porsi`, `satuan`, timestamps). Script verifikasi: `server/scripts/verify-recipe-migration.mjs`. Tidak ada DDL dijalankan oleh agent.

Tanggal: 2026-10-31
Status: Uji migrasi lokal, alur API E2E fixture, reservasi stok atomik lewat ledger, dan implementasi Web Push lulus validasi lokal. Migrasi resep remote kini diverifikasi. Browser push nyata masih tertahan.

## Tombol Detail + modal pesanan dan folder rilis final (2 November 2026)
- [x] Tabel "Rekomendasi dari Ahli Gizi" kini punya kolom AKSI dengan tombol **Detail** per baris. Klik tombol membuka popup modal berisi detail pesanan (pasien, waktu, menu, tekstur, kalori, diet, komposisi, catatan, status) dan tombol **Tandai siap**.
- [x] Tombol "Tandai siap" dipindahkan dari Daftar Persiapan ke dalam modal; Daftar Persiapan kini menjadi tabel status ringkas tanpa aksi langsung.
- [x] `colspan` tabel diperbaiki: `setRows` dan `prepareLoadingState` kini auto-deteksi jumlah kolom dari `<thead>`, bukan hardcoded 8. Daftar Persiapan colspan diperbaiki dari 4 ke 5.
- [x] Form resep dapur: warna panel, input, label, tombol kini mengikuti token tema (original/terang/gelap), bukan hardcoded.
- [x] Test: 38 file/107 tes, 2 timeout database online (admin-auth, account-login-public) bukan dari perubahan kode. TypeScript build dan `node --check` lulus.
- [x] Exe dibangun ulang (92.9 MB) dan folder **Nutricare Final Revisi** dibuat (94.1 MB, tanpa node_modules).
- [x] Verifikasi: `/api/health` 200, `logistik.html` 200, `logistik.js` 200, `theme.css` 200, `.env` 404, `KREDENSIAL_LOGIN.txt` 404.
- [x] Server berjalan dari folder baru; modal HTML dan fungsi JS (`openPesananModal`, `bindModalActions`, `pesananCache`) terkonfirmasi tersaji.

## Penyesuaian tema form resep dapur (1 November 2026)
- [x] Form resep, label, kolom input dan kontrol tambah/hapus bahan memakai token tema (`--panel`, `--bg`, `--text`, `--green`, `--pink`, `--border`) alih-alih warna hardcoded, agar konsisten pada tema original, terang, dan gelap.
- [x] `npm test -- --run`: 38 file/107 tes lulus; TypeScript build dan `node --check ../js/logistik.js` lulus. Checksum `pages/logistik.html` diperbarui.
- [ ] Browser QA langsung terhalang karena sesi lokal diarahkan ke login; belum diverifikasi melalui screenshot.

## Perbaikan alur persiapan dapur dan formulir resep (1 November 2026)
- [x] Akar 422: hitungan porsi dan transaksi siap dapur sebelumnya mewajibkan join `jadwal_makan` dan pencocokan menu persis, padahal event “Dikirim” dari Ahli Gizi sudah semestinya memasok order ke dapur.
- [x] Persiapan dapur kini menghitung rekomendasi berstatus `Dikirim` pada tanggal/WIB dan slot yang sama secara langsung; tidak mensyaratkan jadwal duplikat. Transaksi stok tetap atomic, memakai resep/ledger, dan mengecualikan pasien soft-deleted.
- [x] Logistik menampilkan hanya rekomendasi dikirim hari ini, termasuk menu dan komposisi; slot tanpa rekomendasi menampilkan aksi nonaktif “Belum ada pesanan”, bukan menawarkan tandai siap.
- [x] Form resep disusun ulang dengan label bahan/jumlah, grid responsif, satuan otomatis saat bahan dipilih, dan validasi jumlah positif.
- [x] Test merah dulu memastikan hitungan tidak bergantung pada jadwal makan; test alur E2E fixture intake→rekomendasi→dapur→waiter lulus. Verifikasi final: 38 file/107 tes lulus, TypeScript build lulus, `node --check ../js/logistik.js` lulus; `pages/logistik.html` dan `js/logistik.js` checksum cocok.
- [ ] `npm run check:frontend` gagal untuk 13 file lama di manifest (13 mismatch yang telah ada selain dua file ini); dua file yang diubah terverifikasi `OK`. Perlu audit/checksum penuh terpisah.
- [ ] Tidak diuji/ditulis pada database live. Browser harness gagal dibuka karena permission error pada endpoint file runtime; UI screenshot belum diverifikasi browser. Aplikasi port 3017 saat ini masih versi berjalan lama sampai restart agar backend baru aktif.
- [ ] Folder rilis terpisah belum disinkronkan dalam tahap ini.

## Cetak label ompreng dan detail makanan (6 November 2026)
- [x] Dialog cetak di Persiapan Dapur menyediakan dua format: label ompreng dan detail makanan. Keduanya memuat nomor pesanan, tanggal, pasien, ruangan, waktu makan, menu, diet, tekstur, kalori; detail menambah komposisi dan catatan dapur.
- [x] Setelah aksi Tandai siap berhasil di server, modal cetak otomatis terbuka. Aksi siap dikonsolidasikan pada satu handler untuk menghindari permintaan PATCH ganda.
- [x] Tombol Cetak label tersedia pada kartu/tabel rekomendasi dan detail sebagai cetak ulang; status persiapan ditampilkan dan label hanya tersedia untuk slot yang siap.
- [x] Serializer dan query rekomendasi menyertakan nama ruangan; escaping HTML diterapkan pada nilai yang dicetak.
- [x] Tes terfokus cetak, integrasi, serializer ruangan, role workflow, dan CRUD feedback: 17/17 lulus. Suite setelah mengecualikan dua tes kontrak frontend lama: 40 file/106 tes lulus. Suite penuh: 40 file lulus, 2 file gagal dengan 18 assertion lama di `frontend-recommendation-form.test.ts` dan `frontend-store-no-fallback.test.ts`, tidak terkait halaman logistik.
- [x] `npx tsc --noEmit -p tsconfig.json`, `node --check ../js/logistik.js`, `npm run build`, dan `npm run check:frontend` lulus; seluruh 31 checksum cocok.
- [x] `npm run build:exe` menghasilkan `NutriCare Server.exe` sebesar 92.9 MB. Runtime QA tidak dilakukan; percobaan QA sebelumnya pada port 3187 diblokir dan tidak diulang.
- [x] Tidak ada mutasi Supabase live. Browser UI/print dialog belum diverifikasi lewat runtime.

## Perbaikan proporsi aksi dan layout cetak (6 November 2026)
- [x] `pages/logistik.html`: tombol Detail/Cetak disusun dalam grid responsif dengan ukuran minimum yang seragam; tombol di footer dialog memakai lebar konsisten dan berubah satu kolom pada layar sempit.
- [x] Layout cetak label diatur ke kertas ompreng 100 × 120 mm, orientasi potret; halaman cetak menyembunyikan chrome aplikasi, tiap label/order mendapat pemisah halaman, dan semua informasi tetap tercetak. Detail makanan menggunakan A4 potret.
- [x] `npm run check:frontend`, `node --check ../js/logistik.js`, typecheck, dan build server lulus; empat file tes terfokus lulus (8 tes).
- [ ] Pembuatan EXE terbaru gagal karena `EBUSY` saat menyalin runtime ke `NutriCare Server.exe` yang terkunci. EXE baru belum terverifikasi/dipaketkan; runtime dan preview cetak setelah perubahan belum diuji. Jangan klaim hasil visual sudah final tanpa preview aktual.

## Perbaikan format tanggal di notifikasi (6 November 2026)
- [x] `server/src/modules/rekomendasi.ts`: kolom `tanggal` dari Supabase (JS Date object) diformat dengan `formatTanggalId()` sebelum masuk ke `detail.fields`. Output: "6 November 2026" bukan "Fri Nov 06 2026 00:00:00 GMT+0700 (Western Indonesia Time)".
- [x] `server/src/modules/logistik.ts`: hal yang sama untuk notifikasi "Makanan siap didistribusikan".
- [x] `npx tsc --noEmit`, tes terfokus 3/3 lulus, `npm run build` lulus. EXE belum dipaketkan ulang.

## Build final + folder Netlify (6 November 2026)
- [x] `NutriCare Server.exe` dibangun ulang — 93 MB, exit 0, path: `C:\Users\Idham-\Downloads\nutricare\NutriCare Server.exe`.
- [x] Bug drawer mobile diperbaiki: `role-pages.css` `@media max-width:720px` yang menimpa `position:static` pada sidebar diubah scope-nya ke `body:not(.clinic)` agar tidak mengganggu drawer `hms-clinic.css`.
- [x] Format tanggal di notifikasi diperbaiki: `formatTanggalId()` di `rekomendasi.ts` dan `logistik.ts` mengeluarkan "6 November 2026" bukan `Fri Nov 06 2026...`.
- [x] Folder `Nutricare Hosting Netlify` dibuat di `C:\Users\Idham-\Downloads\`. Berisi: seluruh frontend (HTML/CSS/JS/assets), `netlify.toml`, `package.json`, dan Netlify Functions untuk semua endpoint API (auth/login, auth/logout, bootstrap, pasien, pantangan, rekomendasi, bahan, jadwal, logistik, notifications, health).
- [ ] Folder Netlify belum di-deploy; perlu isi env vars `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` di Netlify Dashboard. Endpoint `perawat` dan `account/profile` belum diimplementasikan di functions (bisa ditambah bila dibutuhkan).
