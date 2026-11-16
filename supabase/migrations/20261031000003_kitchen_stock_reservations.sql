-- Atomic stock consumption ledger entries produced when a kitchen slot is marked ready.
CREATE TABLE persiapan_bahan_reservasi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal date NOT NULL,
  waktu text NOT NULL CHECK (waktu IN ('Sarapan','Makan siang','Makan malam','Snack')),
  menu text NOT NULL CHECK (length(trim(menu)) > 0),
  bahan_id uuid NOT NULL REFERENCES bahan(id) ON DELETE RESTRICT,
  jumlah numeric(12,3) NOT NULL CHECK (jumlah > 0),
  stok_transaksi_id uuid NOT NULL REFERENCES stok_transaksi(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'Aktif' CHECK(status IN ('Aktif','Dikembalikan','Terkirim')),
  pengembalian_transaksi_id uuid REFERENCES stok_transaksi(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX persiapan_reservasi_aktif_uq ON persiapan_bahan_reservasi(tanggal,waktu,menu,bahan_id) WHERE status='Aktif';
CREATE INDEX persiapan_reservasi_slot_idx ON persiapan_bahan_reservasi (tanggal,waktu);
ALTER TABLE persiapan_bahan_reservasi ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON persiapan_bahan_reservasi FROM anon, authenticated;
