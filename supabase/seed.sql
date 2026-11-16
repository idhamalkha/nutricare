-- Seed data demo untuk NutriCare (aman dijalankan ulang).
-- Jalankan dengan supabase db reset; tidak membuat akun auth.users.
-- Penghapusan dan pengisian ulang berjalan dalam satu transaksi (transaksi luar CLI).
BEGIN;

-- Hilangkan hanya data seed yang dimiliki file ini, termasuk relasi logistik.
DELETE FROM persiapan_dapur
 WHERE tanggal = (now() AT TIME ZONE 'Asia/Jakarta')::date;
DELETE FROM laporan_kondisi WHERE info IN ('Nafsu makan menurun','Kondisi stabil','Keluhan mual setelah makan');
DELETE FROM rekomendasi_menu WHERE menu IN ('Nasi ayam kukus','Menu diet diabetes','Ikan kukus rendah garam','Bubur ayam');
DELETE FROM jadwal_makan WHERE menu IN ('Nasi ayam kukus','Menu diet diabetes','Ikan kukus rendah garam');
DELETE FROM pantangan_alergi WHERE pantangan IN ('Makanan tinggi gula','Makanan tinggi garam','Makanan pemicu keluhan');
DELETE FROM stok_transaksi WHERE keterangan IN ('Penerimaan persediaan','Penggunaan dapur');
DELETE FROM pengajuan_bahan WHERE alasan IN ('Stok menipis','Stok habis','Kebutuhan mingguan');
DELETE FROM pengembalian_bahan WHERE alasan IN ('Sisa tidak terpakai','Kondisi kurang segar','Busuk');
DELETE FROM bahan WHERE nama IN ('Beras','Tomat','Wortel','Daging ayam','Telur') AND deleted_at IS NULL;
DELETE FROM pasien WHERE rm IN ('RM00124','RM00125','RM00126','RM00127') AND deleted_at IS NULL;

DO $$
DECLARE
  today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  yesterday date := (now() AT TIME ZONE 'Asia/Jakarta')::date - 1;
  andi_id uuid;
  siti_id uuid;
  budi_id uuid;
  dewi_id uuid;
  beras_id uuid;
  tomat_id uuid;
  wortel_id uuid;
  ayam_id uuid;
  telur_id uuid;
BEGIN
  INSERT INTO pasien (nama, rm, ruangan, diagnosis, usia, bb, tb, kalori, tekstur, status) VALUES
    ('Andi Pratama', 'RM00124', 'Melati 102', 'Pasca operasi', 35, 65, 170, 1800, 'Biasa', 'Aktif'),
    ('Siti Rahma', 'RM00125', 'Mawar 205', 'Diabetes', 52, 70, 160, 1500, 'Lunak', 'Evaluasi'),
    ('Budi Santoso', 'RM00126', 'Anggrek 301', 'Hipertensi', 58, 78, 168, 1700, 'Biasa', 'Aktif'),
    ('Dewi Lestari', 'RM00127', 'Melati 105', 'Gangguan pencernaan', 41, 55, 158, 1600, 'Bubur', 'Aktif');
  SELECT id INTO STRICT andi_id FROM pasien WHERE rm = 'RM00124' AND deleted_at IS NULL;
  SELECT id INTO STRICT siti_id FROM pasien WHERE rm = 'RM00125' AND deleted_at IS NULL;
  SELECT id INTO STRICT budi_id FROM pasien WHERE rm = 'RM00126' AND deleted_at IS NULL;
  SELECT id INTO STRICT dewi_id FROM pasien WHERE rm = 'RM00127' AND deleted_at IS NULL;

  INSERT INTO pantangan_alergi (pasien_id, alergi, pantangan, catatan) VALUES
    (siti_id, '-', 'Makanan tinggi gula', 'Perhatikan asupan karbohidrat'),
    (budi_id, 'Udang', 'Makanan tinggi garam', 'Perhatikan kandungan natrium'),
    (dewi_id, 'Susu sapi', 'Makanan pemicu keluhan', 'Sesuaikan toleransi pasien');
  INSERT INTO rekomendasi_menu (tanggal, pasien_id, waktu, tekstur, kalori, diet, menu, komposisi, catatan, status) VALUES
    (today, andi_id, 'Sarapan', 'Biasa', 500, 'Diet Normal', 'Nasi ayam kukus', 'Nasi, ayam kukus, wortel, dan sayuran pendamping.', '', 'Dikirim'),
    (today, siti_id, 'Makan siang', 'Lunak', 450, 'Diet Diabetes', 'Menu diet diabetes', 'Nasi merah, ikan panggang, tumis buncis.', 'Tanpa gula tambahan', 'Evaluasi'),
    (yesterday, budi_id, 'Makan malam', 'Biasa', 520, 'Diet Rendah Garam', 'Ikan kukus rendah garam', 'Ikan kukus, kentang, dan sayuran.', '', 'Dikirim'),
    (yesterday, dewi_id, 'Sarapan', 'Bubur', 400, 'Diet Normal', 'Bubur ayam', 'Bubur nasi, ayam suwir, dan sayuran.', '', 'Dikirim');
  INSERT INTO jadwal_makan (pasien_id, waktu, menu, jam, status) VALUES
    (andi_id, 'Sarapan', 'Nasi ayam kukus', '06:00', 'Terjadwal'),
    (siti_id, 'Makan siang', 'Menu diet diabetes', '11:00', 'Menunggu'),
    (budi_id, 'Makan malam', 'Ikan kukus rendah garam', '17:00', 'Terjadwal');
  INSERT INTO laporan_kondisi (pasien_id, info, tanggal, waktu, status) VALUES
    (siti_id, 'Nafsu makan menurun', today, '08:15', 'Evaluasi'),
    (andi_id, 'Kondisi stabil', today, '08:30', 'Baru'),
    (dewi_id, 'Keluhan mual setelah makan', today, '09:00', 'Evaluasi');

  INSERT INTO bahan (nama, kategori, stok, satuan, minimum, kedaluwarsa) VALUES
    ('Beras', 'Karbohidrat', 125, 'kg', 50, today + 240),
    ('Tomat', 'Sayuran', 8, 'kg', 15, today + 8),
    ('Wortel', 'Sayuran', 6, 'kg', 12, today + 14),
    ('Daging ayam', 'Protein', 22, 'kg', 10, today + 5),
    ('Telur', 'Protein', 0, 'butir', 60, today + 21);
  SELECT id INTO STRICT beras_id FROM bahan WHERE nama = 'Beras' AND deleted_at IS NULL;
  SELECT id INTO STRICT tomat_id FROM bahan WHERE nama = 'Tomat' AND deleted_at IS NULL;
  SELECT id INTO STRICT wortel_id FROM bahan WHERE nama = 'Wortel' AND deleted_at IS NULL;
  SELECT id INTO STRICT ayam_id FROM bahan WHERE nama = 'Daging ayam' AND deleted_at IS NULL;
  SELECT id INTO STRICT telur_id FROM bahan WHERE nama = 'Telur' AND deleted_at IS NULL;

  INSERT INTO stok_transaksi (tanggal, bahan_id, jenis, jumlah, satuan, keterangan) VALUES
    (today - 2, beras_id, 'Masuk', 50, 'kg', 'Penerimaan persediaan'),
    (today - 1, tomat_id, 'Keluar', 5, 'kg', 'Penggunaan dapur'),
    (today - 1, ayam_id, 'Keluar', 12, 'kg', 'Penggunaan dapur');
  INSERT INTO pengajuan_bahan (bahan_id, jumlah, satuan, tanggal_kebutuhan, alasan, status) VALUES
    (tomat_id, 10, 'kg', today + 2, 'Stok menipis', 'Menunggu'),
    (telur_id, 100, 'butir', today + 1, 'Stok habis', 'Menunggu'),
    (wortel_id, 15, 'kg', today + 3, 'Kebutuhan mingguan', 'Disetujui');
  INSERT INTO pengembalian_bahan (tanggal, bahan_id, jumlah, satuan, kondisi, alasan, status) VALUES
    (today - 1, beras_id, 3, 'kg', 'Layak digunakan', 'Sisa tidak terpakai', 'Diterima'),
    (today - 1, wortel_id, 2, 'kg', 'Perlu diperiksa', 'Kondisi kurang segar', 'Pemeriksaan'),
    (today, tomat_id, 1, 'kg', 'Tidak layak', 'Busuk', 'Dipisahkan');
  INSERT INTO persiapan_dapur (tanggal, waktu, porsi, status, progres, catatan) VALUES
    (today, 'Sarapan', 120, 'Selesai', 100, ''),
    (today, 'Makan siang', 140, 'Diproses', 65, ''),
    (today, 'Makan malam', 110, 'Menunggu', 0, ''),
    (today, 'Snack', 80, 'Menunggu', 0, '');
END $$;

COMMIT;
