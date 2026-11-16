-- ===== Foto profil pengguna =====
-- Menyimpan URL foto profil (disimpan di repository GitHub via Contents API).
-- Sifat: aditif dan nullable. Tidak mengubah atau menghapus data pengguna yang ada.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS foto_profil text;

COMMENT ON COLUMN profiles.foto_profil IS
  'URL foto profil (raw GitHub). NULL berarti tampilkan avatar inisial.';
