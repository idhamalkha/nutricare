// Modul Jadwal: CRUD + validasi unik (pasien, waktu)
import { pool } from '../db/pool.js';
import { serializeJadwal } from '../serializers/index.js';
import { NotFoundError } from '../http/errors.js';
import { resolvePasienByName } from '../db/resolvers.js';
import { validateJadwalUnique } from '../rules/validations.js';

export async function getDistributionPatients() {
  const result = await pool.query(
    `SELECT nama, ruangan FROM pasien WHERE deleted_at IS NULL ORDER BY nama`
  );
  return result.rows.map((row) => ({ nama: row.nama, ruangan: row.ruangan }));
}

export async function getReadyDistribution() {
  const result = await pool.query(
    `SELECT j.id, p.nama AS pasien_nama, p.ruangan, j.menu, j.waktu,
            to_char(j.jam, 'HH24:MI') AS jam, j.status
     FROM jadwal_makan j
     JOIN pasien p ON p.id = j.pasien_id
     JOIN persiapan_dapur d ON d.waktu = j.waktu
       AND d.tanggal = (now() AT TIME ZONE 'Asia/Jakarta')::date
       AND d.status = 'Selesai'
     WHERE j.deleted_at IS NULL AND p.deleted_at IS NULL
       AND j.status <> 'Terkirim'
       AND EXISTS (
         SELECT 1 FROM rekomendasi_menu r
         WHERE r.pasien_id = j.pasien_id AND r.waktu = j.waktu AND r.menu = j.menu
           AND r.tanggal = (now() AT TIME ZONE 'Asia/Jakarta')::date
           AND r.status = 'Dikirim' AND r.deleted_at IS NULL
       )
     ORDER BY j.jam, p.nama`
  );
  return result.rows.map((row) => ({
    id: String(row.id), pasien: row.pasien_nama, ruangan: row.ruangan,
    menu: row.menu, waktu: row.waktu, jam: row.jam, status: row.status,
  }));
}

export async function getDeliveredDistribution() {
  const result = await pool.query(
    `SELECT j.id, p.nama AS pasien_nama, p.ruangan, j.menu, j.waktu,
            to_char(j.jam, 'HH24:MI') AS jam, j.status
     FROM jadwal_makan j
     JOIN pasien p ON p.id = j.pasien_id
     WHERE j.deleted_at IS NULL AND p.deleted_at IS NULL
       AND j.status = 'Terkirim'
       AND EXISTS (
         SELECT 1 FROM rekomendasi_menu r
         WHERE r.pasien_id = j.pasien_id AND r.waktu = j.waktu AND r.menu = j.menu
           AND r.tanggal = (now() AT TIME ZONE 'Asia/Jakarta')::date
           AND r.status = 'Dikirim' AND r.deleted_at IS NULL
       )
     ORDER BY j.jam, p.nama`
  );
  return result.rows.map((row) => ({
    id: String(row.id), pasien: row.pasien_nama, ruangan: row.ruangan,
    menu: row.menu, waktu: row.waktu, jam: row.jam, status: row.status,
  }));
}

export async function markDelivered(id: string) {
  const result = await pool.query(
    `UPDATE jadwal_makan j SET status = 'Terkirim', terkirim_at = now()
     WHERE j.id = $1 AND j.deleted_at IS NULL AND j.status <> 'Terkirim'
       AND EXISTS (
         SELECT 1 FROM persiapan_dapur d
         WHERE d.waktu = j.waktu
           AND d.tanggal = (now() AT TIME ZONE 'Asia/Jakarta')::date
           AND d.status = 'Selesai'
       )
       AND EXISTS (
         SELECT 1 FROM rekomendasi_menu r
         WHERE r.pasien_id = j.pasien_id AND r.waktu = j.waktu AND r.menu = j.menu
           AND r.tanggal = (now() AT TIME ZONE 'Asia/Jakarta')::date
           AND r.status = 'Dikirim' AND r.deleted_at IS NULL
       )
     RETURNING j.id`, [id]
  );
  if (!result.rowCount) throw new NotFoundError('Jadwal belum siap dari dapur atau tidak ditemukan.');
  const delivered = { id: String(result.rows[0].id), status: 'Terkirim' };
  void import('../routes/push.js').then(async ({ sendPushToRole }) => {
    const info = await pool.query(
      `SELECT j.menu, j.waktu, p.nama, p.ruangan
       FROM jadwal_makan j JOIN pasien p ON p.id = j.pasien_id
       WHERE j.id = $1`,
      [id]
    );
    const detailRow = info.rows[0] || {};
    await sendPushToRole(
      ['perawat', 'ahli-gizi'],
      'Status distribusi diperbarui',
      `${detailRow.nama || 'Pasien'} · ${detailRow.menu || 'Menu'} · terkirim`,
      {
        roleLinks: { perawat: '/pages/perawat.html#jadwal', 'ahli-gizi': '/pages/ahli-gizi.html#jadwal' },
        detail: {
          kind: 'distribusi',
          ringkas: `${detailRow.menu || 'Menu'} untuk ${detailRow.nama || 'pasien'} sudah ditandai terkirim.`,
          fields: [
            { label: 'Pasien', value: String(detailRow.nama || '-') },
            { label: 'Ruangan', value: String(detailRow.ruangan || '-') },
            { label: 'Waktu makan', value: String(detailRow.waktu || '-') },
            { label: 'Menu', value: String(detailRow.menu || '-') },
            { label: 'Status', value: 'Terkirim' },
          ],
        },
      }
    );
  }).catch(()=>{});
  return delivered;
}

export async function getAllJadwal() {
  const result = await pool.query(
    `SELECT j.*, p.nama as pasien_nama
     FROM jadwal_makan j
     JOIN pasien p ON p.id = j.pasien_id
     WHERE j.deleted_at IS NULL AND p.deleted_at IS NULL
     ORDER BY j.created_at DESC`
  );
  return result.rows.map(serializeJadwal);
}

export async function createJadwal(data: any, role: string, userId?: string) {
  const pasienId = await resolvePasienByName(data.pasien);
  
  // BR-2: Validasi unik (pasien, waktu)
  await validateJadwalUnique(pasienId, data.waktu, role);
  
  const result = await pool.query(
    `INSERT INTO jadwal_makan (pasien_id, waktu, menu, jam, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [pasienId, data.waktu, data.menu, data.jam, data.status || 'Terjadwal']
  );
  
  const joined = await pool.query(
    `SELECT j.*, p.nama as pasien_nama
     FROM jadwal_makan j
     JOIN pasien p ON p.id = j.pasien_id
     WHERE j.id = $1`,
    [result.rows[0].id]
  );
  
  return serializeJadwal(joined.rows[0]);
}

export async function updateJadwal(id: string, data: any, role: string, userId?: string) {
  // Jika pasien atau waktu berubah, validasi unik
  if (data.pasien || data.waktu) {
    // Ambil data lama
    const current = await pool.query(
      `SELECT j.*, p.nama as pasien_nama
       FROM jadwal_makan j
       JOIN pasien p ON p.id = j.pasien_id
       WHERE j.id = $1 AND j.deleted_at IS NULL`,
      [id]
    );
    
    if (current.rows.length === 0) {
      throw new NotFoundError('Jadwal tidak ditemukan.');
    }
    
    const row = current.rows[0];
    const finalPasienId = data.pasien ? await resolvePasienByName(data.pasien) : row.pasien_id;
    const finalWaktu = data.waktu ?? row.waktu;
    
    await validateJadwalUnique(finalPasienId, finalWaktu, role, id);
  }
  
  const fields: string[] = [];
  const values: any[] = [];
  let paramCount = 1;
  
  if (data.pasien) {
    const pasienId = await resolvePasienByName(data.pasien);
    fields.push(`pasien_id = $${paramCount}`);
    values.push(pasienId);
    paramCount++;
  }
  
  const simpleFields = ['waktu', 'menu', 'jam', 'status'];
  for (const field of simpleFields) {
    if (data[field] !== undefined) {
      fields.push(`${field} = $${paramCount}`);
      values.push(data[field]);
      paramCount++;
    }
  }
  
  if (fields.length === 0) {
    throw new Error('Tidak ada field yang diubah.');
  }
  
  values.push(id);
  
  const result = await pool.query(
    `UPDATE jadwal_makan SET ${fields.join(', ')}
     WHERE id = $${paramCount} AND deleted_at IS NULL
     RETURNING *`,
    values
  );
  
  if (result.rows.length === 0) {
    throw new NotFoundError('Jadwal tidak ditemukan.');
  }
  
  const joined = await pool.query(
    `SELECT j.*, p.nama as pasien_nama
     FROM jadwal_makan j
     JOIN pasien p ON p.id = j.pasien_id
     WHERE j.id = $1`,
    [result.rows[0].id]
  );
  
  return serializeJadwal(joined.rows[0]);
}

export async function deleteJadwal(id: string, userId: string) {
  const result = await pool.query(
    'UPDATE jadwal_makan SET deleted_at = now(), deleted_by = $1 WHERE id = $2 AND deleted_at IS NULL',
    [userId === 'demo-user' ? null : userId, id]
  );
  
  if (result.rowCount === 0) {
    throw new NotFoundError('Jadwal tidak ditemukan.');
  }
}
