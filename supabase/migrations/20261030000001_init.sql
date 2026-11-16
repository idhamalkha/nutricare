-- Migrasi NutriCare: Skema database lengkap
-- Prinsip: Soft delete, RLS aktif, relasi FK, indeks parsial untuk unique

-- ========== AKUN DAN PROFIL ==========
CREATE TABLE profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('logistik','ahli-gizi','perawat','waiter')),
  username   text NOT NULL,
  nama       text NOT NULL,
  telepon    text NOT NULL DEFAULT '',
  aktif      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX profiles_username_uq ON profiles (lower(username));

CREATE TABLE user_preferences (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kunci   text NOT NULL CHECK (kunci IN ('pasien','kondisi','stok','jadwal','distribusi')),
  aktif   boolean NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, kunci)
);

-- ========== PASIEN DAN GIZI ==========
CREATE TABLE pasien (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama      text NOT NULL,
  rm        text NOT NULL,
  ruangan   text NOT NULL,
  diagnosis text NOT NULL,
  usia      smallint     NOT NULL CHECK (usia BETWEEN 0 AND 120),
  bb        numeric(6,2) NOT NULL CHECK (bb >= 1),
  tb        numeric(6,2) NOT NULL CHECK (tb >= 30),
  kalori    integer      NOT NULL CHECK (kalori BETWEEN 500 AND 5000),
  tekstur   text NOT NULL CHECK (tekstur IN ('Biasa','Lunak','Bubur','Cair')),
  status    text NOT NULL DEFAULT 'Aktif' CHECK (status IN ('Aktif','Evaluasi','Pulang')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX pasien_rm_uq ON pasien (lower(rm)) WHERE deleted_at IS NULL;
CREATE INDEX pasien_nama_idx ON pasien (lower(nama)) WHERE deleted_at IS NULL;

CREATE TABLE pantangan_alergi (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pasien_id  uuid NOT NULL REFERENCES pasien(id) ON DELETE RESTRICT,
  alergi     text NOT NULL DEFAULT '-',
  pantangan  text NOT NULL,
  catatan    text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);
CREATE INDEX pantangan_pasien_idx ON pantangan_alergi (pasien_id) WHERE deleted_at IS NULL;

CREATE TABLE rekomendasi_menu (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal    date NOT NULL,
  pasien_id  uuid NOT NULL REFERENCES pasien(id) ON DELETE RESTRICT,
  waktu      text NOT NULL CHECK (waktu IN ('Sarapan','Makan siang','Makan malam','Snack')),
  tekstur    text NOT NULL CHECK (tekstur IN ('Biasa','Lunak','Bubur','Cair')),
  kalori     integer NOT NULL CHECK (kalori BETWEEN 50 AND 3000),
  diet       text NOT NULL CHECK (diet IN ('Diet Normal','Diet Diabetes','Diet Rendah Garam','Diet Khusus')),
  menu       text NOT NULL,
  komposisi  text NOT NULL,
  catatan    text NOT NULL DEFAULT '',
  status     text NOT NULL DEFAULT 'Draf' CHECK (status IN ('Draf','Dikirim','Evaluasi')),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);
CREATE INDEX rekomendasi_tanggal_idx ON rekomendasi_menu (tanggal DESC) WHERE deleted_at IS NULL;
CREATE INDEX rekomendasi_pasien_idx  ON rekomendasi_menu (pasien_id) WHERE deleted_at IS NULL;

CREATE TABLE jadwal_makan (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pasien_id  uuid NOT NULL REFERENCES pasien(id) ON DELETE RESTRICT,
  waktu      text NOT NULL CHECK (waktu IN ('Sarapan','Makan siang','Makan malam','Snack')),
  menu       text NOT NULL,
  jam        time NOT NULL,
  status     text NOT NULL DEFAULT 'Terjadwal' CHECK (status IN ('Terjadwal','Menunggu','Terkirim')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX jadwal_pasien_waktu_uq ON jadwal_makan (pasien_id, waktu) WHERE deleted_at IS NULL;

CREATE TABLE laporan_kondisi (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pasien_id  uuid NOT NULL REFERENCES pasien(id) ON DELETE RESTRICT,
  info       text NOT NULL,
  tanggal    date NOT NULL,
  waktu      time NOT NULL,
  status     text NOT NULL DEFAULT 'Baru' CHECK (status IN ('Baru','Evaluasi','Ditinjau')),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);
CREATE INDEX laporan_pasien_idx ON laporan_kondisi (pasien_id) WHERE deleted_at IS NULL;

-- ========== PERSEDIAAN ==========
CREATE TABLE bahan (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama        text NOT NULL,
  kategori    text NOT NULL,
  stok        numeric(12,2) NOT NULL CHECK (stok >= 0),
  satuan      text NOT NULL,
  minimum     numeric(12,2) NOT NULL CHECK (minimum >= 0),
  kedaluwarsa date NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  deleted_by  uuid REFERENCES profiles(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX bahan_nama_uq ON bahan (lower(nama)) WHERE deleted_at IS NULL;

CREATE TABLE stok_transaksi (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal    date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')::date,
  bahan_id   uuid NOT NULL REFERENCES bahan(id) ON DELETE RESTRICT,
  jenis      text NOT NULL CHECK (jenis IN ('Masuk','Keluar')),
  jumlah     numeric(12,2) NOT NULL CHECK (jumlah > 0),
  satuan     text NOT NULL,
  keterangan text NOT NULL DEFAULT '',
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stok_tanggal_idx ON stok_transaksi (tanggal DESC);

CREATE SEQUENCE pengajuan_kode_seq START 1;
CREATE TABLE pengajuan_bahan (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kode              text NOT NULL UNIQUE DEFAULT ('PG-' || lpad(nextval('pengajuan_kode_seq')::text, 3, '0')),
  tanggal           date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')::date,
  bahan_id          uuid NOT NULL REFERENCES bahan(id) ON DELETE RESTRICT,
  jumlah            numeric(12,2) NOT NULL CHECK (jumlah > 0),
  satuan            text NOT NULL,
  tanggal_kebutuhan date,
  alasan            text NOT NULL DEFAULT '',
  status            text NOT NULL DEFAULT 'Menunggu' CHECK (status IN ('Menunggu','Disetujui')),
  disetujui_oleh    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_by        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pengembalian_bahan (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal    date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')::date,
  bahan_id   uuid NOT NULL REFERENCES bahan(id) ON DELETE RESTRICT,
  jumlah     numeric(12,2) NOT NULL CHECK (jumlah > 0),
  satuan     text NOT NULL,
  kondisi    text NOT NULL CHECK (kondisi IN ('Layak digunakan','Perlu diperiksa','Tidak layak')),
  alasan     text NOT NULL DEFAULT '',
  status     text NOT NULL CHECK (status IN ('Diterima','Pemeriksaan','Dipisahkan')),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE persiapan_dapur (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal  date NOT NULL,
  waktu    text NOT NULL CHECK (waktu IN ('Sarapan','Makan siang','Makan malam','Snack')),
  porsi    integer NOT NULL DEFAULT 0 CHECK (porsi >= 0),
  status   text NOT NULL DEFAULT 'Menunggu' CHECK (status IN ('Selesai','Diproses','Menunggu')),
  progres  smallint NOT NULL DEFAULT 0 CHECK (progres BETWEEN 0 AND 100),
  catatan  text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tanggal, waktu)
);

-- ========== AUDIT LOG ==========
CREATE TABLE audit_log (
  id         bigserial PRIMARY KEY,
  user_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  role       text,
  aksi       text NOT NULL CHECK (aksi IN ('create','update','delete','restore','login','reset')),
  entitas    text NOT NULL,
  entitas_id text,
  sebelum    jsonb,
  sesudah    jsonb,
  waktu      timestamptz NOT NULL DEFAULT now()
);

-- ========== TRIGGERS UNTUK updated_at ==========
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER pasien_updated_at BEFORE UPDATE ON pasien FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER pantangan_updated_at BEFORE UPDATE ON pantangan_alergi FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER rekomendasi_updated_at BEFORE UPDATE ON rekomendasi_menu FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER jadwal_updated_at BEFORE UPDATE ON jadwal_makan FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER laporan_updated_at BEFORE UPDATE ON laporan_kondisi FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER bahan_updated_at BEFORE UPDATE ON bahan FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER pengajuan_updated_at BEFORE UPDATE ON pengajuan_bahan FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER persiapan_updated_at BEFORE UPDATE ON persiapan_dapur FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ========== FUNGSI SOFT DELETE PASIEN ==========
CREATE OR REPLACE FUNCTION soft_delete_pasien(p_id uuid, p_user uuid) RETURNS void
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_ts timestamptz := now();
BEGIN
  UPDATE pantangan_alergi SET deleted_at = v_ts, deleted_by = p_user WHERE pasien_id = p_id AND deleted_at IS NULL;
  UPDATE rekomendasi_menu SET deleted_at = v_ts, deleted_by = p_user WHERE pasien_id = p_id AND deleted_at IS NULL;
  UPDATE jadwal_makan     SET deleted_at = v_ts, deleted_by = p_user WHERE pasien_id = p_id AND deleted_at IS NULL;
  UPDATE laporan_kondisi  SET deleted_at = v_ts, deleted_by = p_user WHERE pasien_id = p_id AND deleted_at IS NULL;
  UPDATE pasien           SET deleted_at = v_ts, deleted_by = p_user WHERE id = p_id AND deleted_at IS NULL;
END $$;

-- ========== FUNGSI RESTORE PASIEN ==========
CREATE OR REPLACE FUNCTION restore_pasien(p_id uuid) RETURNS void
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_ts timestamptz;
BEGIN
  SELECT deleted_at INTO v_ts FROM pasien WHERE id = p_id;
  IF v_ts IS NULL THEN RETURN; END IF;
  UPDATE pasien           SET deleted_at = NULL, deleted_by = NULL WHERE id = p_id;
  UPDATE pantangan_alergi SET deleted_at = NULL, deleted_by = NULL WHERE pasien_id = p_id AND deleted_at = v_ts;
  UPDATE rekomendasi_menu SET deleted_at = NULL, deleted_by = NULL WHERE pasien_id = p_id AND deleted_at = v_ts;
  UPDATE jadwal_makan     SET deleted_at = NULL, deleted_by = NULL WHERE pasien_id = p_id AND deleted_at = v_ts;
  UPDATE laporan_kondisi  SET deleted_at = NULL, deleted_by = NULL WHERE pasien_id = p_id AND deleted_at = v_ts;
END $$;

-- ========== ROW LEVEL SECURITY ==========
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences   ENABLE ROW LEVEL SECURITY;
ALTER TABLE pasien             ENABLE ROW LEVEL SECURITY;
ALTER TABLE pantangan_alergi   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rekomendasi_menu   ENABLE ROW LEVEL SECURITY;
ALTER TABLE jadwal_makan       ENABLE ROW LEVEL SECURITY;
ALTER TABLE laporan_kondisi    ENABLE ROW LEVEL SECURITY;
ALTER TABLE bahan              ENABLE ROW LEVEL SECURITY;
ALTER TABLE stok_transaksi     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengajuan_bahan    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengembalian_bahan ENABLE ROW LEVEL SECURITY;
ALTER TABLE persiapan_dapur    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log          ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION soft_delete_pasien(uuid, uuid), restore_pasien(uuid) FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
