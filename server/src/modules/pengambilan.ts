// Modul Pengambilan ompreng (waiter) dan Evaluasi makanan pasien (ahli gizi).
// Alur: makanan ditandai terkirim -> setelah 30 menit waiter mengambil ompreng ->
// hasil 'Habis' selesai, hasil 'Tidak habis' membuat baris evaluasi untuk ahli gizi.
import { pool } from '../db/pool.js';
import { ConflictError, NotFoundError, ValidationError } from '../http/errors.js';

export const BATAS_AMBIL_MENIT = 30;
const HASIL_VALID = ['Habis', 'Tidak habis'];
const TODAY = `(now() AT TIME ZONE 'Asia/Jakarta')::date`;

function actorId(userId?: string) {
  return !userId || userId === 'demo-user' ? null : userId;
}

function toIso(value: unknown) {
  return value instanceof Date ? value.toISOString() : value ? String(value) : null;
}

// Antrean: makanan yang sudah terkirim hari ini dan ompreng-nya belum diambil.
export async function getAntreanPengambilan() {
  const result = await pool.query(
    `SELECT j.id, p.nama AS pasien_nama, p.ruangan, j.menu, j.waktu, j.terkirim_at,
            to_char(j.terkirim_at AT TIME ZONE 'Asia/Jakarta', 'HH24:MI') AS jam_terkirim
     FROM jadwal_makan j
     JOIN pasien p ON p.id = j.pasien_id
     WHERE j.deleted_at IS NULL AND p.deleted_at IS NULL
       AND j.status = 'Terkirim' AND j.terkirim_at IS NOT NULL
       AND (j.terkirim_at AT TIME ZONE 'Asia/Jakarta')::date = ${TODAY}
       AND NOT EXISTS (
         SELECT 1 FROM pengambilan_ompreng o
         WHERE o.jadwal_id = j.id AND o.tanggal = ${TODAY} AND o.deleted_at IS NULL
       )
     ORDER BY j.terkirim_at, p.nama`
  );
  return result.rows.map((row) => ({
    id: String(row.id), pasien: row.pasien_nama, ruangan: row.ruangan,
    menu: row.menu, waktu: row.waktu, jamTerkirim: row.jam_terkirim,
    terkirimAt: toIso(row.terkirim_at), batasMenit: BATAS_AMBIL_MENIT,
  }));
}

// Riwayat pengambilan hari ini.
export async function getRiwayatPengambilan() {
  const result = await pool.query(
    `SELECT o.id, p.nama AS pasien_nama, p.ruangan, j.menu, j.waktu, o.hasil,
            to_char(o.tanggal, 'YYYY-MM-DD') AS tanggal,
            to_char(o.diambil_at AT TIME ZONE 'Asia/Jakarta', 'HH24:MI') AS jam_diambil
     FROM pengambilan_ompreng o
     JOIN pasien p ON p.id = o.pasien_id
     JOIN jadwal_makan j ON j.id = o.jadwal_id
     WHERE o.deleted_at IS NULL AND o.tanggal = ${TODAY}
     ORDER BY o.diambil_at DESC`
  );
  return result.rows.map((row) => ({
    id: String(row.id), pasien: row.pasien_nama, ruangan: row.ruangan,
    menu: row.menu, waktu: row.waktu, hasil: row.hasil,
    tanggal: row.tanggal, jamDiambil: row.jam_diambil,
  }));
}

export async function createPengambilan(data: any, userId?: string) {
  const jadwalId = String(data?.jadwalId || '').trim();
  const hasil = String(data?.hasil || '').trim();
  if (!jadwalId) throw new ValidationError('Pilih makanan yang akan diambil ompreng-nya.', 'jadwalId');
  if (!HASIL_VALID.includes(hasil)) throw new ValidationError('Hasil harus Habis atau Tidak habis.', 'hasil');

  const cek = await pool.query(
    `SELECT j.status, j.terkirim_at,
            EXTRACT(EPOCH FROM (now() - j.terkirim_at)) AS detik_berlalu
     FROM jadwal_makan j
     WHERE j.id = $1 AND j.deleted_at IS NULL`,
    [jadwalId]
  );
  if (!cek.rowCount) throw new NotFoundError('Jadwal makan tidak ditemukan.');
  const jadwal = cek.rows[0];
  if (jadwal.status !== 'Terkirim' || !jadwal.terkirim_at) {
    throw new ConflictError('Makanan ini belum dikonfirmasi terkirim, jadi ompreng belum bisa diambil.');
  }
  const sisaDetik = BATAS_AMBIL_MENIT * 60 - Number(jadwal.detik_berlalu);
  if (sisaDetik > 0) {
    const sisaMenit = Math.ceil(sisaDetik / 60);
    throw new ConflictError(`Ompreng baru bisa diambil ${BATAS_AMBIL_MENIT} menit setelah makanan terkirim. Tunggu sekitar ${sisaMenit} menit lagi.`);
  }

  // Satu statement: simpan pengambilan, dan bila tidak habis, buat baris evaluasi.
  let inserted;
  try {
    inserted = await pool.query(
      `WITH ins AS (
         INSERT INTO pengambilan_ompreng (jadwal_id, pasien_id, hasil, diambil_oleh)
         SELECT j.id, j.pasien_id, $2, $3
         FROM jadwal_makan j
         WHERE j.id = $1 AND j.deleted_at IS NULL AND j.status = 'Terkirim'
           AND j.terkirim_at <= now() - make_interval(mins => ${BATAS_AMBIL_MENIT})
         RETURNING id, pasien_id, hasil
       ), ev AS (
         INSERT INTO evaluasi_makanan (pengambilan_id, pasien_id)
         SELECT id, pasien_id FROM ins WHERE hasil = 'Tidak habis'
         RETURNING id
       )
       SELECT id, hasil FROM ins`,
      [jadwalId, hasil, actorId(userId)]
    );
  } catch (error: any) {
    if (error?.code === '23505') throw new ConflictError('Ompreng untuk jadwal ini sudah diambil.');
    throw error;
  }
  if (!inserted.rowCount) throw new ConflictError('Ompreng belum bisa diambil. Muat ulang daftar lalu coba lagi.');

  const created = { id: String(inserted.rows[0].id), hasil };

  if (hasil === 'Tidak habis') {
    void import('../routes/push.js').then(async ({ sendPushToRole }) => {
      const info = await pool.query(
        `SELECT j.menu, j.waktu, p.nama, p.ruangan
         FROM jadwal_makan j JOIN pasien p ON p.id = j.pasien_id
         WHERE j.id = $1`,
        [jadwalId]
      );
      const row = info.rows[0] || {};
      await sendPushToRole(
        ['ahli-gizi'],
        'Makanan pasien tidak habis',
        `${row.nama || 'Pasien'} · ${row.menu || 'Menu'} · perlu evaluasi`,
        {
          roleLinks: { 'ahli-gizi': '/pages/ahli-gizi.html#evaluasi' },
          detail: {
            kind: 'evaluasi',
            ringkas: `${row.nama || 'Pasien'} tidak menghabiskan ${row.menu || 'menu'}. Datangi pasien dan catat evaluasinya.`,
            fields: [
              { label: 'Pasien', value: String(row.nama || '-') },
              { label: 'Ruangan', value: String(row.ruangan || '-') },
              { label: 'Waktu makan', value: String(row.waktu || '-') },
              { label: 'Menu', value: String(row.menu || '-') },
              { label: 'Hasil', value: 'Tidak habis' },
            ],
          },
        }
      );
    }).catch(() => {});
  }

  return created;
}

// Evaluasi: yang perlu ditindaklanjuti tampil lebih dulu.
export async function getAllEvaluasi() {
  const result = await pool.query(
    `SELECT e.id, e.status, e.bagian_tersisa, e.alasan, e.tindak_lanjut,
            p.nama AS pasien_nama, p.ruangan, p.diagnosis,
            j.menu, j.waktu,
            to_char(o.tanggal, 'YYYY-MM-DD') AS tanggal,
            to_char(o.diambil_at AT TIME ZONE 'Asia/Jakarta', 'HH24:MI') AS jam_diambil,
            to_char(e.dievaluasi_at AT TIME ZONE 'Asia/Jakarta', 'DD/MM/YYYY HH24:MI') AS dievaluasi_pada,
            pr.nama AS evaluator
     FROM evaluasi_makanan e
     JOIN pengambilan_ompreng o ON o.id = e.pengambilan_id
     JOIN pasien p ON p.id = e.pasien_id
     JOIN jadwal_makan j ON j.id = o.jadwal_id
     LEFT JOIN profiles pr ON pr.id = e.dievaluasi_oleh
     WHERE e.deleted_at IS NULL AND o.deleted_at IS NULL
     ORDER BY (e.status = 'Perlu evaluasi') DESC, o.diambil_at DESC
     LIMIT 200`
  );
  return result.rows.map((row) => ({
    id: String(row.id), status: row.status, pasien: row.pasien_nama, ruangan: row.ruangan,
    diagnosis: row.diagnosis, menu: row.menu, waktu: row.waktu,
    tanggal: row.tanggal, jamDiambil: row.jam_diambil,
    bagianTersisa: row.bagian_tersisa, alasan: row.alasan, tindakLanjut: row.tindak_lanjut,
    dievaluasiPada: row.dievaluasi_pada || '', evaluator: row.evaluator || '',
  }));
}

export async function simpanEvaluasi(id: string, data: any, userId?: string) {
  const bagianTersisa = String(data?.bagianTersisa || '').trim();
  const alasan = String(data?.alasan || '').trim();
  const tindakLanjut = String(data?.tindakLanjut || '').trim();
  if (!bagianTersisa) throw new ValidationError('Isi makanan apa yang tidak dihabiskan pasien.', 'bagianTersisa');
  if (!alasan) throw new ValidationError('Isi alasan pasien tidak menghabiskan makanan.', 'alasan');

  const result = await pool.query(
    `UPDATE evaluasi_makanan
        SET status = 'Selesai', bagian_tersisa = $2, alasan = $3, tindak_lanjut = $4,
            dievaluasi_oleh = $5, dievaluasi_at = now()
      WHERE id = $1 AND deleted_at IS NULL AND status = 'Perlu evaluasi'
      RETURNING id`,
    [id, bagianTersisa, alasan, tindakLanjut, actorId(userId)]
  );
  if (!result.rowCount) throw new NotFoundError('Evaluasi tidak ditemukan atau sudah diselesaikan.');
  return { id: String(result.rows[0].id), status: 'Selesai' };
}
