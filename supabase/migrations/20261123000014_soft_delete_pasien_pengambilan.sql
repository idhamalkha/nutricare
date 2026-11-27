-- Soft delete pasien kini ikut mencakup pengambilan ompreng dan evaluasi makanan.
-- Restore memakai deleted_at yang sama dengan pasien, sehingga hanya baris yang
-- ikut terhapus bersama pasien yang dipulihkan.

CREATE OR REPLACE FUNCTION soft_delete_pasien(p_id uuid, p_user uuid) RETURNS void
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_ts timestamptz := now();
BEGIN
  UPDATE evaluasi_makanan   SET deleted_at = v_ts, deleted_by = p_user WHERE pasien_id = p_id AND deleted_at IS NULL;
  UPDATE pengambilan_ompreng SET deleted_at = v_ts, deleted_by = p_user WHERE pasien_id = p_id AND deleted_at IS NULL;
  UPDATE pantangan_alergi   SET deleted_at = v_ts, deleted_by = p_user WHERE pasien_id = p_id AND deleted_at IS NULL;
  UPDATE rekomendasi_menu   SET deleted_at = v_ts, deleted_by = p_user WHERE pasien_id = p_id AND deleted_at IS NULL;
  UPDATE jadwal_makan       SET deleted_at = v_ts, deleted_by = p_user WHERE pasien_id = p_id AND deleted_at IS NULL;
  UPDATE laporan_kondisi    SET deleted_at = v_ts, deleted_by = p_user WHERE pasien_id = p_id AND deleted_at IS NULL;
  UPDATE pasien             SET deleted_at = v_ts, deleted_by = p_user WHERE id = p_id AND deleted_at IS NULL;
END $$;

CREATE OR REPLACE FUNCTION restore_pasien(p_id uuid) RETURNS void
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_ts timestamptz;
BEGIN
  SELECT deleted_at INTO v_ts FROM pasien WHERE id = p_id;
  IF v_ts IS NULL THEN RETURN; END IF;
  UPDATE pasien              SET deleted_at = NULL, deleted_by = NULL WHERE id = p_id;
  UPDATE pantangan_alergi    SET deleted_at = NULL, deleted_by = NULL WHERE pasien_id = p_id AND deleted_at = v_ts;
  UPDATE rekomendasi_menu    SET deleted_at = NULL, deleted_by = NULL WHERE pasien_id = p_id AND deleted_at = v_ts;
  UPDATE jadwal_makan        SET deleted_at = NULL, deleted_by = NULL WHERE pasien_id = p_id AND deleted_at = v_ts;
  UPDATE laporan_kondisi     SET deleted_at = NULL, deleted_by = NULL WHERE pasien_id = p_id AND deleted_at = v_ts;
  UPDATE pengambilan_ompreng SET deleted_at = NULL, deleted_by = NULL WHERE pasien_id = p_id AND deleted_at = v_ts;
  UPDATE evaluasi_makanan    SET deleted_at = NULL, deleted_by = NULL WHERE pasien_id = p_id AND deleted_at = v_ts;
END $$;

REVOKE EXECUTE ON FUNCTION soft_delete_pasien(uuid, uuid), restore_pasien(uuid) FROM PUBLIC, anon, authenticated;

-- Baris yang sudah ada milik pasien yang telah pulang ikut ditandai terhapus,
-- memakai waktu hapus pasien agar restore tetap mengenalinya.
UPDATE pengambilan_ompreng o SET deleted_at = p.deleted_at, deleted_by = p.deleted_by
  FROM pasien p WHERE o.pasien_id = p.id AND p.deleted_at IS NOT NULL AND o.deleted_at IS NULL;
UPDATE evaluasi_makanan e SET deleted_at = p.deleted_at, deleted_by = p.deleted_by
  FROM pasien p WHERE e.pasien_id = p.id AND p.deleted_at IS NOT NULL AND e.deleted_at IS NULL;
