-- Pengambilan ompreng dan evaluasi makanan pasien.
-- 1) jadwal_makan mencatat kapan makanan ditandai terkirim (dasar batas 30 menit).
-- 2) pengambilan_ompreng mencatat hasil pengambilan oleh waiter: Habis / Tidak habis.
-- 3) evaluasi_makanan dibuat otomatis untuk hasil 'Tidak habis' dan ditindaklanjuti ahli gizi.

ALTER TABLE jadwal_makan ADD COLUMN IF NOT EXISTS terkirim_at timestamptz;

-- Data lama yang sudah berstatus Terkirim memakai updated_at sebagai perkiraan terbaik.
UPDATE jadwal_makan
   SET terkirim_at = updated_at
 WHERE status = 'Terkirim' AND terkirim_at IS NULL;

CREATE TABLE pengambilan_ompreng (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal      date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')::date,
  jadwal_id    uuid NOT NULL REFERENCES jadwal_makan(id) ON DELETE RESTRICT,
  pasien_id    uuid NOT NULL REFERENCES pasien(id) ON DELETE RESTRICT,
  hasil        text NOT NULL CHECK (hasil IN ('Habis','Tidak habis')),
  diambil_at   timestamptz NOT NULL DEFAULT now(),
  diambil_oleh uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  deleted_by   uuid REFERENCES profiles(id) ON DELETE SET NULL
);
-- Satu jadwal hanya diambil satu kali per hari.
CREATE UNIQUE INDEX pengambilan_jadwal_tanggal_uq ON pengambilan_ompreng (jadwal_id, tanggal) WHERE deleted_at IS NULL;
CREATE INDEX pengambilan_pasien_idx ON pengambilan_ompreng (pasien_id) WHERE deleted_at IS NULL;
CREATE INDEX pengambilan_tanggal_idx ON pengambilan_ompreng (tanggal DESC) WHERE deleted_at IS NULL;
CREATE TRIGGER pengambilan_ompreng_updated_at BEFORE UPDATE ON pengambilan_ompreng FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE evaluasi_makanan (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pengambilan_id    uuid NOT NULL REFERENCES pengambilan_ompreng(id) ON DELETE RESTRICT,
  pasien_id         uuid NOT NULL REFERENCES pasien(id) ON DELETE RESTRICT,
  status            text NOT NULL DEFAULT 'Perlu evaluasi' CHECK (status IN ('Perlu evaluasi','Selesai')),
  bagian_tersisa    text NOT NULL DEFAULT '',   -- makanan apa yang tidak dihabiskan
  alasan            text NOT NULL DEFAULT '',   -- kenapa tidak dihabiskan
  tindak_lanjut     text NOT NULL DEFAULT '',
  dievaluasi_oleh   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  dievaluasi_at     timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz,
  deleted_by        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT evaluasi_selesai_lengkap CHECK (
    status <> 'Selesai' OR (length(btrim(bagian_tersisa)) > 0 AND length(btrim(alasan)) > 0 AND dievaluasi_at IS NOT NULL)
  )
);
CREATE UNIQUE INDEX evaluasi_pengambilan_uq ON evaluasi_makanan (pengambilan_id) WHERE deleted_at IS NULL;
CREATE INDEX evaluasi_status_idx ON evaluasi_makanan (status) WHERE deleted_at IS NULL;
CREATE INDEX evaluasi_pasien_idx ON evaluasi_makanan (pasien_id) WHERE deleted_at IS NULL;
CREATE TRIGGER evaluasi_makanan_updated_at BEFORE UPDATE ON evaluasi_makanan FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Keamanan: RLS aktif tanpa policy untuk anon/authenticated; backend memakai koneksi langsung.
ALTER TABLE pengambilan_ompreng ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluasi_makanan    ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE pengambilan_ompreng, evaluasi_makanan FROM anon, authenticated;
