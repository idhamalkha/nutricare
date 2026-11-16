-- Seed data master NutriCare: bahan makanan, resep, dan menu paket.
-- Dibuat otomatis oleh server/seeds/master-menu.mjs, jangan diedit manual.
-- Idempoten: aman dijalankan berulang. Resep dan bahan yang sudah ada dilewati.
BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Bahan makanan (stok awal ikut dicatat ke stok_transaksi)
-- ---------------------------------------------------------------------------
DO $$
DECLARE v RECORD;
BEGIN
  FOR v IN
    SELECT * FROM (VALUES
    ('Beras merah', 'Karbohidrat', 25, 'kg', 10, 330),
    ('Kentang', 'Karbohidrat', 18, 'kg', 8, 60),
    ('Roti gandum', 'Karbohidrat', 8, 'kg', 4, 14),
    ('Bihun', 'Karbohidrat', 20, 'bungkus', 6, 240),
    ('Makaroni', 'Karbohidrat', 15, 'bungkus', 5, 240),
    ('Tepung terigu', 'Karbohidrat', 20, 'kg', 8, 300),
    ('Tepung maizena', 'Karbohidrat', 5, 'kg', 2, 300),
    ('Singkong', 'Karbohidrat', 6, 'kg', 3, 21),
    ('Daging sapi', 'Protein', 14, 'kg', 6, 180),
    ('Ikan kembung', 'Protein', 12, 'kg', 5, 90),
    ('Ikan lele', 'Protein', 10, 'kg', 5, 90),
    ('Tempe', 'Protein', 25, 'kg', 10, 7),
    ('Tahu', 'Protein', 30, 'kg', 10, 5),
    ('Kacang hijau', 'Protein', 12, 'kg', 5, 300),
    ('Kacang tanah', 'Protein', 8, 'kg', 3, 300),
    ('Hati ayam', 'Protein', 5, 'kg', 2, 120),
    ('Udang', 'Protein', 6, 'kg', 2, 120),
    ('Bayam', 'Sayuran', 15, 'kg', 6, 3),
    ('Kangkung', 'Sayuran', 15, 'kg', 6, 3),
    ('Buncis', 'Sayuran', 9, 'kg', 4, 7),
    ('Brokoli', 'Sayuran', 6, 'kg', 3, 7),
    ('Labu siam', 'Sayuran', 8, 'kg', 3, 14),
    ('Sawi hijau', 'Sayuran', 15, 'ikat', 6, 4),
    ('Kol', 'Sayuran', 7, 'kg', 3, 14),
    ('Timun', 'Sayuran', 6, 'kg', 3, 7),
    ('Daun bawang', 'Sayuran', 5, 'kg', 2, 5),
    ('Seledri', 'Sayuran', 4, 'kg', 2, 5),
    ('Pisang', 'Buah', 15, 'kg', 6, 6),
    ('Pepaya', 'Buah', 12, 'kg', 5, 6),
    ('Jeruk', 'Buah', 10, 'kg', 4, 14),
    ('Apel', 'Buah', 9, 'kg', 4, 21),
    ('Semangka', 'Buah', 12, 'kg', 5, 10),
    ('Bawang merah', 'Bumbu', 7, 'kg', 3, 30),
    ('Bawang putih', 'Bumbu', 7, 'kg', 3, 45),
    ('Cabai merah', 'Bumbu', 4, 'kg', 2, 14),
    ('Kemiri', 'Bumbu', 3, 'kg', 1, 180),
    ('Ketumbar', 'Bumbu', 2, 'kg', 1, 180),
    ('Jahe', 'Bumbu', 3, 'kg', 1, 45),
    ('Lengkuas', 'Bumbu', 3, 'kg', 1, 45),
    ('Daun salam', 'Bumbu', 2, 'kg', 1, 14),
    ('Serai', 'Bumbu', 2, 'kg', 1, 14),
    ('Garam', 'Bumbu', 5, 'kg', 2, 365),
    ('Gula pasir', 'Bumbu', 10, 'kg', 4, 365),
    ('Kecap manis', 'Bumbu', 6, 'liter', 2, 240),
    ('Minyak goreng', 'Bumbu', 20, 'liter', 8, 180),
    ('Susu UHT full cream', 'Susu & Olahan', 24, 'liter', 10, 45),
    ('Susu skim bubuk', 'Susu & Olahan', 6, 'kg', 2, 300),
    ('Keju cheddar', 'Susu & Olahan', 6, 'bungkus', 2, 90),
    ('Mentega', 'Susu & Olahan', 3, 'kg', 1, 120),
    ('Yogurt plain', 'Susu & Olahan', 6, 'kg', 2, 14),
    ('Madu', 'Lainnya', 2, 'kg', 1, 365),
    ('Agar-agar bubuk', 'Lainnya', 10, 'bungkus', 3, 365)
    ) AS t(nama, kategori, stok, satuan, minimum, umur_hari)
  LOOP
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM bahan WHERE lower(nama) = lower(v.nama) AND deleted_at IS NULL
    );

    INSERT INTO bahan (nama, kategori, stok, satuan, minimum, kedaluwarsa)
    VALUES (v.nama, v.kategori, v.stok, v.satuan, v.minimum, current_date + v.umur_hari);

    INSERT INTO stok_transaksi (tanggal, bahan_id, jenis, jumlah, satuan, keterangan)
    SELECT current_date, b.id, 'Masuk', v.stok, v.satuan, 'Saldo awal data master'
    FROM bahan b
    WHERE lower(b.nama) = lower(v.nama) AND b.deleted_at IS NULL;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Resep (hidangan beserta bahan dan kalori per porsi)
--    Resep dengan nama yang sama dilewati agar tidak menimpa perubahan manual.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _seed_resep (
  menu text, bahan text, jumlah numeric, satuan text, kalori numeric
) ON COMMIT DROP;

INSERT INTO _seed_resep (menu, bahan, jumlah, satuan, kalori) VALUES
    ('Nasi putih', 'Beras', 50, 'gram', 178),
    ('Nasi tim', 'Beras', 45, 'gram', 160),
    ('Nasi tim', 'Garam', 0.5, 'gram', 0),
    ('Bubur nasi', 'Beras', 30, 'gram', 107),
    ('Bubur nasi', 'Garam', 0.5, 'gram', 0),
    ('Nasi merah', 'Beras merah', 55, 'gram', 181),
    ('Kentang rebus', 'Kentang', 150, 'gram', 105),
    ('Kentang rebus', 'Garam', 0.5, 'gram', 0),
    ('Roti gandum', 'Roti gandum', 60, 'gram', 150),
    ('Roti gandum', 'Mentega', 5, 'gram', 36),
    ('Ayam goreng', 'Daging ayam', 60, 'gram', 180),
    ('Ayam goreng', 'Minyak goreng', 5, 'ml', 44),
    ('Ayam goreng', 'Bawang putih', 3, 'gram', 4),
    ('Ayam goreng', 'Garam', 0.5, 'gram', 0),
    ('Ayam kukus', 'Daging ayam', 70, 'gram', 210),
    ('Ayam kukus', 'Jahe', 3, 'gram', 2),
    ('Ayam kukus', 'Bawang putih', 3, 'gram', 4),
    ('Ayam kukus', 'Garam', 0.5, 'gram', 0),
    ('Sup ayam', 'Daging ayam', 50, 'gram', 150),
    ('Sup ayam', 'Wortel', 30, 'gram', 11),
    ('Sup ayam', 'Kentang', 30, 'gram', 25),
    ('Sup ayam', 'Daun bawang', 5, 'gram', 2),
    ('Sup ayam', 'Garam', 0.5, 'gram', 0),
    ('Telur dadar', 'Telur', 1, 'butir', 92),
    ('Telur dadar', 'Minyak goreng', 5, 'ml', 44),
    ('Telur dadar', 'Garam', 0.3, 'gram', 0),
    ('Telur balado', 'Telur', 1, 'butir', 92),
    ('Telur balado', 'Cabai merah', 10, 'gram', 3),
    ('Telur balado', 'Bawang merah', 5, 'gram', 2),
    ('Telur balado', 'Minyak goreng', 5, 'ml', 44),
    ('Ikan kembung goreng', 'Ikan kembung', 60, 'gram', 75),
    ('Ikan kembung goreng', 'Minyak goreng', 5, 'ml', 44),
    ('Ikan kembung goreng', 'Bawang putih', 3, 'gram', 4),
    ('Ikan kembung goreng', 'Garam', 0.5, 'gram', 0),
    ('Ikan kukus', 'Ikan kembung', 80, 'gram', 100),
    ('Ikan kukus', 'Jahe', 3, 'gram', 2),
    ('Ikan kukus', 'Bawang putih', 3, 'gram', 4),
    ('Ikan kukus', 'Jeruk', 10, 'gram', 4),
    ('Ikan kukus', 'Garam', 0.3, 'gram', 0),
    ('Pepes ikan', 'Ikan kembung', 70, 'gram', 88),
    ('Pepes ikan', 'Kemiri', 3, 'gram', 20),
    ('Pepes ikan', 'Daun salam', 1, 'gram', 1),
    ('Pepes ikan', 'Cabai merah', 5, 'gram', 2),
    ('Pepes ikan', 'Garam', 0.3, 'gram', 0),
    ('Semur daging', 'Daging sapi', 50, 'gram', 105),
    ('Semur daging', 'Kecap manis', 8, 'ml', 20),
    ('Semur daging', 'Bawang merah', 5, 'gram', 2),
    ('Semur daging', 'Bawang putih', 3, 'gram', 4),
    ('Semur daging', 'Kentang', 20, 'gram', 17),
    ('Perkedel kentang', 'Kentang', 80, 'gram', 56),
    ('Perkedel kentang', 'Telur', 0.5, 'butir', 46),
    ('Perkedel kentang', 'Daun bawang', 3, 'gram', 1),
    ('Perkedel kentang', 'Minyak goreng', 5, 'ml', 44),
    ('Hati ayam kecap', 'Hati ayam', 50, 'gram', 70),
    ('Hati ayam kecap', 'Kecap manis', 8, 'ml', 20),
    ('Hati ayam kecap', 'Bawang merah', 5, 'gram', 2),
    ('Hati ayam kecap', 'Minyak goreng', 5, 'ml', 44),
    ('Udang tumis', 'Udang', 60, 'gram', 55),
    ('Udang tumis', 'Bawang putih', 3, 'gram', 4),
    ('Udang tumis', 'Cabai merah', 5, 'gram', 2),
    ('Udang tumis', 'Minyak goreng', 5, 'ml', 44),
    ('Tempe bacem', 'Tempe', 50, 'gram', 100),
    ('Tempe bacem', 'Gula pasir', 5, 'gram', 20),
    ('Tempe bacem', 'Kecap manis', 8, 'ml', 20),
    ('Tempe bacem', 'Bawang putih', 3, 'gram', 4),
    ('Tempe bacem', 'Ketumbar', 1, 'gram', 3),
    ('Tahu goreng', 'Tahu', 60, 'gram', 45),
    ('Tahu goreng', 'Minyak goreng', 5, 'ml', 44),
    ('Tahu goreng', 'Garam', 0.5, 'gram', 0),
    ('Tempe orek', 'Tempe', 50, 'gram', 100),
    ('Tempe orek', 'Kecap manis', 8, 'ml', 20),
    ('Tempe orek', 'Cabai merah', 5, 'gram', 2),
    ('Tempe orek', 'Minyak goreng', 5, 'ml', 44),
    ('Sayur bening bayam', 'Bayam', 70, 'gram', 25),
    ('Sayur bening bayam', 'Labu siam', 30, 'gram', 8),
    ('Sayur bening bayam', 'Bawang merah', 5, 'gram', 2),
    ('Sayur bening bayam', 'Garam', 0.5, 'gram', 0),
    ('Tumis buncis', 'Buncis', 80, 'gram', 30),
    ('Tumis buncis', 'Bawang putih', 3, 'gram', 4),
    ('Tumis buncis', 'Minyak goreng', 3, 'ml', 27),
    ('Tumis buncis', 'Garam', 0.3, 'gram', 0),
    ('Sup wortel kentang', 'Wortel', 50, 'gram', 18),
    ('Sup wortel kentang', 'Kentang', 40, 'gram', 34),
    ('Sup wortel kentang', 'Daun bawang', 5, 'gram', 2),
    ('Sup wortel kentang', 'Seledri', 3, 'gram', 1),
    ('Sup wortel kentang', 'Garam', 0.3, 'gram', 0),
    ('Tumis kangkung', 'Kangkung', 80, 'gram', 24),
    ('Tumis kangkung', 'Bawang putih', 3, 'gram', 4),
    ('Tumis kangkung', 'Minyak goreng', 3, 'ml', 27),
    ('Tumis kangkung', 'Garam', 0.3, 'gram', 0),
    ('Cah brokoli', 'Brokoli', 80, 'gram', 28),
    ('Cah brokoli', 'Wortel', 20, 'gram', 7),
    ('Cah brokoli', 'Bawang putih', 3, 'gram', 4),
    ('Cah brokoli', 'Minyak goreng', 3, 'ml', 27),
    ('Sayur asem', 'Kangkung', 40, 'gram', 12),
    ('Sayur asem', 'Buncis', 30, 'gram', 11),
    ('Sayur asem', 'Labu siam', 30, 'gram', 8),
    ('Sayur asem', 'Tomat', 20, 'gram', 4),
    ('Sayur asem', 'Serai', 3, 'gram', 1),
    ('Sayur asem', 'Garam', 0.3, 'gram', 0),
    ('Salad timun tomat', 'Timun', 50, 'gram', 8),
    ('Salad timun tomat', 'Tomat', 50, 'gram', 10),
    ('Salad timun tomat', 'Jeruk', 10, 'gram', 4),
    ('Pepaya potong', 'Pepaya', 100, 'gram', 46),
    ('Pisang', 'Pisang', 100, 'gram', 92),
    ('Jeruk', 'Jeruk', 100, 'gram', 45),
    ('Apel', 'Apel', 100, 'gram', 58),
    ('Semangka', 'Semangka', 150, 'gram', 42),
    ('Susu UHT', 'Susu UHT full cream', 200, 'ml', 130),
    ('Susu skim', 'Susu skim bubuk', 25, 'gram', 90),
    ('Yogurt buah', 'Yogurt plain', 100, 'gram', 60),
    ('Yogurt buah', 'Madu', 5, 'gram', 15),
    ('Yogurt buah', 'Pisang', 30, 'gram', 28);

-- Buang baris yang bahannya belum terdaftar, dan seluruh resep yang sudah ada.
DELETE FROM _seed_resep s
 WHERE NOT EXISTS (SELECT 1 FROM bahan b WHERE lower(b.nama) = lower(s.bahan) AND b.deleted_at IS NULL);
DELETE FROM _seed_resep s
 WHERE EXISTS (SELECT 1 FROM menu_resep_bahan r WHERE lower(r.menu) = lower(s.menu));

INSERT INTO menu_resep_bahan (menu, bahan_id, jumlah_per_porsi, satuan, kalori_per_porsi)
SELECT s.menu, b.id, s.jumlah, s.satuan, s.kalori
FROM _seed_resep s
JOIN bahan b ON lower(b.nama) = lower(s.bahan) AND b.deleted_at IS NULL
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Menu paket (kumpulan resep)
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _seed_paket (
  nama text, deskripsi text, resep text
) ON COMMIT DROP;

INSERT INTO _seed_paket (nama, deskripsi, resep) VALUES
    ('Sehat Sempurna', 'Menu lengkap gizi seimbang: makanan pokok, protein hewani, protein nabati, sayur, dan buah.', 'Nasi putih'),
    ('Sehat Sempurna', 'Menu lengkap gizi seimbang: makanan pokok, protein hewani, protein nabati, sayur, dan buah.', 'Ayam goreng'),
    ('Sehat Sempurna', 'Menu lengkap gizi seimbang: makanan pokok, protein hewani, protein nabati, sayur, dan buah.', 'Tempe bacem'),
    ('Sehat Sempurna', 'Menu lengkap gizi seimbang: makanan pokok, protein hewani, protein nabati, sayur, dan buah.', 'Sayur bening bayam'),
    ('Sehat Sempurna', 'Menu lengkap gizi seimbang: makanan pokok, protein hewani, protein nabati, sayur, dan buah.', 'Pepaya potong'),
    ('Sehat Sempurna Vegetarian', 'Versi tanpa bahan hewani dengan protein nabati ganda dari tahu dan tempe.', 'Nasi putih'),
    ('Sehat Sempurna Vegetarian', 'Versi tanpa bahan hewani dengan protein nabati ganda dari tahu dan tempe.', 'Tahu goreng'),
    ('Sehat Sempurna Vegetarian', 'Versi tanpa bahan hewani dengan protein nabati ganda dari tahu dan tempe.', 'Tempe orek'),
    ('Sehat Sempurna Vegetarian', 'Versi tanpa bahan hewani dengan protein nabati ganda dari tahu dan tempe.', 'Tumis buncis'),
    ('Sehat Sempurna Vegetarian', 'Versi tanpa bahan hewani dengan protein nabati ganda dari tahu dan tempe.', 'Pisang'),
    ('Diet Diabetes Seimbang', 'Karbohidrat kompleks dari nasi merah, rendah gula tambahan, tinggi serat.', 'Nasi merah'),
    ('Diet Diabetes Seimbang', 'Karbohidrat kompleks dari nasi merah, rendah gula tambahan, tinggi serat.', 'Ayam kukus'),
    ('Diet Diabetes Seimbang', 'Karbohidrat kompleks dari nasi merah, rendah gula tambahan, tinggi serat.', 'Tahu goreng'),
    ('Diet Diabetes Seimbang', 'Karbohidrat kompleks dari nasi merah, rendah gula tambahan, tinggi serat.', 'Cah brokoli'),
    ('Diet Diabetes Seimbang', 'Karbohidrat kompleks dari nasi merah, rendah gula tambahan, tinggi serat.', 'Apel'),
    ('Rendah Garam Seimbang', 'Pengolahan kukus tanpa tambahan garam berlebih untuk pasien hipertensi.', 'Nasi putih'),
    ('Rendah Garam Seimbang', 'Pengolahan kukus tanpa tambahan garam berlebih untuk pasien hipertensi.', 'Ikan kukus'),
    ('Rendah Garam Seimbang', 'Pengolahan kukus tanpa tambahan garam berlebih untuk pasien hipertensi.', 'Tempe bacem'),
    ('Rendah Garam Seimbang', 'Pengolahan kukus tanpa tambahan garam berlebih untuk pasien hipertensi.', 'Sayur bening bayam'),
    ('Rendah Garam Seimbang', 'Pengolahan kukus tanpa tambahan garam berlebih untuk pasien hipertensi.', 'Jeruk'),
    ('TKTP Pemulihan', 'Tinggi kalori tinggi protein untuk pasien pasca operasi dan pemulihan.', 'Nasi putih'),
    ('TKTP Pemulihan', 'Tinggi kalori tinggi protein untuk pasien pasca operasi dan pemulihan.', 'Semur daging'),
    ('TKTP Pemulihan', 'Tinggi kalori tinggi protein untuk pasien pasca operasi dan pemulihan.', 'Telur dadar'),
    ('TKTP Pemulihan', 'Tinggi kalori tinggi protein untuk pasien pasca operasi dan pemulihan.', 'Sup wortel kentang'),
    ('TKTP Pemulihan', 'Tinggi kalori tinggi protein untuk pasien pasca operasi dan pemulihan.', 'Pisang'),
    ('TKTP Pemulihan', 'Tinggi kalori tinggi protein untuk pasien pasca operasi dan pemulihan.', 'Susu UHT'),
    ('Lunak Mudah Cerna', 'Tekstur lunak dengan bubur dan sup untuk pasien gangguan pencernaan.', 'Bubur nasi'),
    ('Lunak Mudah Cerna', 'Tekstur lunak dengan bubur dan sup untuk pasien gangguan pencernaan.', 'Sup ayam'),
    ('Lunak Mudah Cerna', 'Tekstur lunak dengan bubur dan sup untuk pasien gangguan pencernaan.', 'Tahu goreng'),
    ('Lunak Mudah Cerna', 'Tekstur lunak dengan bubur dan sup untuk pasien gangguan pencernaan.', 'Sayur bening bayam'),
    ('Lunak Mudah Cerna', 'Tekstur lunak dengan bubur dan sup untuk pasien gangguan pencernaan.', 'Pepaya potong'),
    ('Bubur Pagi Rumah Sakit', 'Menu sarapan tekstur bubur dengan lauk kukus dan susu.', 'Bubur nasi'),
    ('Bubur Pagi Rumah Sakit', 'Menu sarapan tekstur bubur dengan lauk kukus dan susu.', 'Ayam kukus'),
    ('Bubur Pagi Rumah Sakit', 'Menu sarapan tekstur bubur dengan lauk kukus dan susu.', 'Sayur bening bayam'),
    ('Bubur Pagi Rumah Sakit', 'Menu sarapan tekstur bubur dengan lauk kukus dan susu.', 'Susu UHT'),
    ('Sarapan Roti Gandum', 'Sarapan praktis dengan karbohidrat kompleks dan protein telur.', 'Roti gandum'),
    ('Sarapan Roti Gandum', 'Sarapan praktis dengan karbohidrat kompleks dan protein telur.', 'Telur dadar'),
    ('Sarapan Roti Gandum', 'Sarapan praktis dengan karbohidrat kompleks dan protein telur.', 'Susu UHT'),
    ('Sarapan Roti Gandum', 'Sarapan praktis dengan karbohidrat kompleks dan protein telur.', 'Apel'),
    ('Diet Ginjal Rendah Protein', 'Pembatasan protein hewani dan kalium untuk pasien gangguan ginjal.', 'Nasi putih'),
    ('Diet Ginjal Rendah Protein', 'Pembatasan protein hewani dan kalium untuk pasien gangguan ginjal.', 'Ikan kukus'),
    ('Diet Ginjal Rendah Protein', 'Pembatasan protein hewani dan kalium untuk pasien gangguan ginjal.', 'Tumis buncis'),
    ('Diet Ginjal Rendah Protein', 'Pembatasan protein hewani dan kalium untuk pasien gangguan ginjal.', 'Apel'),
    ('Menu Anak Seimbang', 'Porsi anak dengan nasi tim, telur, tahu, dan susu.', 'Nasi tim'),
    ('Menu Anak Seimbang', 'Porsi anak dengan nasi tim, telur, tahu, dan susu.', 'Telur dadar'),
    ('Menu Anak Seimbang', 'Porsi anak dengan nasi tim, telur, tahu, dan susu.', 'Tahu goreng'),
    ('Menu Anak Seimbang', 'Porsi anak dengan nasi tim, telur, tahu, dan susu.', 'Sup wortel kentang'),
    ('Menu Anak Seimbang', 'Porsi anak dengan nasi tim, telur, tahu, dan susu.', 'Susu UHT');

INSERT INTO menu_paket (nama, deskripsi)
SELECT DISTINCT nama, deskripsi FROM _seed_paket
ON CONFLICT (lower(nama)) DO NOTHING;

INSERT INTO menu_paket_resep (paket_id, resep_nama)
SELECT p.id, s.resep
FROM _seed_paket s
JOIN menu_paket p ON lower(p.nama) = lower(s.nama)
WHERE EXISTS (
  SELECT 1 FROM menu_resep_bahan r WHERE lower(r.menu) = lower(s.resep)
)
ON CONFLICT DO NOTHING;

COMMIT;
