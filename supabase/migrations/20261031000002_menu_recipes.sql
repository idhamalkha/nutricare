-- Structured recipe quantities so kitchen stock checks can scale by patient portions.
CREATE TABLE menu_resep_bahan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu text NOT NULL CHECK (length(trim(menu)) > 0),
  bahan_id uuid NOT NULL REFERENCES bahan(id) ON DELETE RESTRICT,
  jumlah_per_porsi numeric(12,3) NOT NULL CHECK (jumlah_per_porsi > 0),
  satuan text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX menu_resep_bahan_menu_item_uq ON menu_resep_bahan (lower(menu), bahan_id);
CREATE INDEX menu_resep_bahan_menu_idx ON menu_resep_bahan (lower(menu));
ALTER TABLE menu_resep_bahan ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON menu_resep_bahan FROM anon, authenticated;
