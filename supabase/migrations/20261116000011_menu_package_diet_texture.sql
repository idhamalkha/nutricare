-- Menjadikan diet dan tekstur bagian dari paket menu.
-- Data rekomendasi lama tetap menjadi snapshot historis dan tidak diubah.
-- Pemutakhiran eksplisit hanya untuk daftar nama paket dari server/seeds/master-menu.mjs.
BEGIN;

ALTER TABLE menu_paket
  ADD COLUMN IF NOT EXISTS diet text NOT NULL DEFAULT 'Diet Normal',
  ADD COLUMN IF NOT EXISTS tekstur text NOT NULL DEFAULT 'Biasa';

-- Existing packages get safe non-NULL defaults from the column definitions.
-- Do not infer clinical diet/texture from package names; staff can classify each
-- package through the menu editor after review.
UPDATE menu_paket
SET diet = COALESCE(diet, 'Diet Normal'),
    tekstur = COALESCE(tekstur, 'Biasa')
WHERE diet IS NULL OR tekstur IS NULL;

ALTER TABLE menu_paket
  DROP CONSTRAINT IF EXISTS menu_paket_diet_check,
  ADD CONSTRAINT menu_paket_diet_check
    CHECK (diet IN ('Diet Normal','Diet Diabetes','Diet Rendah Garam','Diet Khusus')),
  DROP CONSTRAINT IF EXISTS menu_paket_tekstur_check,
  ADD CONSTRAINT menu_paket_tekstur_check
    CHECK (tekstur IN ('Biasa','Lunak','Bubur','Cair'));

COMMIT;
