-- Rincian notifikasi: isi ringkas (judul, ringkasan, daftar field, daftar item)
-- agar kotak masuk bisa menampilkan popup detail tanpa membuka halaman lain.
-- Nullable: notifikasi lama tetap valid dan ditampilkan dengan teks biasa.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS detail jsonb;
