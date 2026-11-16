-- Arsitektur Menu Paket: satu menu = kumpulan resep. Kalori otomatis dari resep.
-- 1. Tambah kalori_per_porsi ke resep bahan
ALTER TABLE menu_resep_bahan
  ADD COLUMN IF NOT EXISTS kalori_per_porsi numeric(8,2) NOT NULL DEFAULT 0 CHECK (kalori_per_porsi >= 0);

-- 2. Tabel menu paket (paket diet bernama)
CREATE TABLE IF NOT EXISTS menu_paket (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama        text NOT NULL CHECK (length(trim(nama)) > 0),
  deskripsi   text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Unique case-insensitive: ekspresi wajib jadi INDEX terpisah, bukan CONSTRAINT dalam tabel
CREATE UNIQUE INDEX IF NOT EXISTS menu_paket_nama_lower_uq ON menu_paket (lower(nama));

-- 3. Tabel join: menu paket <-> resep (many-to-many)
CREATE TABLE IF NOT EXISTS menu_paket_resep (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paket_id    uuid NOT NULL REFERENCES menu_paket(id) ON DELETE CASCADE,
  resep_nama  text NOT NULL CHECK (length(trim(resep_nama)) > 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Unique case-insensitive pada (paket_id, resep_nama)
CREATE UNIQUE INDEX IF NOT EXISTS menu_paket_resep_uq ON menu_paket_resep (paket_id, lower(resep_nama));

CREATE INDEX IF NOT EXISTS menu_paket_resep_paket_idx ON menu_paket_resep (paket_id);

-- 4. View: menu paket lengkap dengan total kalori (dihitung otomatis dari resep)
CREATE OR REPLACE VIEW v_menu_paket AS
SELECT
  mp.id,
  mp.nama,
  mp.deskripsi,
  mp.created_at,
  mp.updated_at,
  COALESCE(
    json_agg(
      json_build_object('resep', mpr.resep_nama, 'kalori', rk.total_kalori)
      ORDER BY mpr.resep_nama
    ) FILTER (WHERE mpr.id IS NOT NULL),
    '[]'::json
  ) AS resep_list,
  COALESCE(
    SUM(rk.total_kalori),
    0
  ) AS total_kalori
FROM menu_paket mp
LEFT JOIN menu_paket_resep mpr ON mpr.paket_id = mp.id
LEFT JOIN (
  SELECT lower(menu) AS menu_key, SUM(kalori_per_porsi) AS total_kalori
  FROM menu_resep_bahan
  GROUP BY lower(menu)
) rk ON rk.menu_key = lower(mpr.resep_nama)
GROUP BY mp.id, mp.nama, mp.deskripsi, mp.created_at, mp.updated_at;

-- 5. RLS
ALTER TABLE menu_paket ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_paket_resep ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON menu_paket FROM anon, authenticated;
REVOKE ALL ON menu_paket_resep FROM anon, authenticated;
REVOKE ALL ON v_menu_paket FROM anon, authenticated;
