-- Preserve small ingredient quantities through stock, ledger and kitchen reservations.
-- Recipe units such as grams can convert to fractional kilograms below 0.01 kg.
ALTER TABLE bahan
  ALTER COLUMN stok TYPE numeric(14,4) USING stok::numeric(14,4),
  ALTER COLUMN minimum TYPE numeric(14,4) USING minimum::numeric(14,4);

ALTER TABLE stok_transaksi
  ALTER COLUMN jumlah TYPE numeric(14,4) USING jumlah::numeric(14,4);

ALTER TABLE persiapan_bahan_reservasi
  ALTER COLUMN jumlah TYPE numeric(14,4) USING jumlah::numeric(14,4);
