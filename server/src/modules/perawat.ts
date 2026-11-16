// Modul Laporan Kondisi (store frontend: 'perawat')
import { pool } from '../db/pool.js';
import { serializeLaporan } from '../serializers/index.js';
import { NotFoundError } from '../http/errors.js';
import { resolvePasienByName } from '../db/resolvers.js';

export async function getAllLaporan() {
  const result = await pool.query(
    `SELECT l.*, p.nama as pasien_nama
     FROM laporan_kondisi l
     JOIN pasien p ON p.id = l.pasien_id
     WHERE l.deleted_at IS NULL AND p.deleted_at IS NULL
     ORDER BY l.tanggal DESC, l.waktu DESC`
  );
  return result.rows.map(serializeLaporan);
}

export async function createLaporan(data: any, userId?: string) {
  const pasienId = await resolvePasienByName(data.pasien);
  
  const result = await pool.query(
    `INSERT INTO laporan_kondisi (pasien_id, info, tanggal, waktu, status, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      pasienId,
      data.info,
      data.tanggal,
      data.waktu,
      data.status || 'Baru',
      userId === 'demo-user' ? null : (userId || null),
    ]
  );
  
  const joined = await pool.query(
    `SELECT l.*, p.nama as pasien_nama
     FROM laporan_kondisi l
     JOIN pasien p ON p.id = l.pasien_id
     WHERE l.id = $1`,
    [result.rows[0].id]
  );
  
  return serializeLaporan(joined.rows[0]);
}

export async function updateLaporan(id: string, data: any, userId?: string) {
  const fields: string[] = [];
  const values: any[] = [];
  let paramCount = 1;
  
  if (data.pasien) {
    const pasienId = await resolvePasienByName(data.pasien);
    fields.push(`pasien_id = $${paramCount}`);
    values.push(pasienId);
    paramCount++;
  }
  
  const simpleFields = ['info', 'tanggal', 'waktu', 'status'];
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
    `UPDATE laporan_kondisi SET ${fields.join(', ')}
     WHERE id = $${paramCount} AND deleted_at IS NULL
     RETURNING *`,
    values
  );
  
  if (result.rows.length === 0) {
    throw new NotFoundError('Laporan tidak ditemukan.');
  }
  
  const joined = await pool.query(
    `SELECT l.*, p.nama as pasien_nama
     FROM laporan_kondisi l
     JOIN pasien p ON p.id = l.pasien_id
     WHERE l.id = $1`,
    [result.rows[0].id]
  );
  
  return serializeLaporan(joined.rows[0]);
}

export async function deleteLaporan(id: string, userId: string) {
  const result = await pool.query(
    'UPDATE laporan_kondisi SET deleted_at = now(), deleted_by = $1 WHERE id = $2 AND deleted_at IS NULL',
    [userId === 'demo-user' ? null : userId, id]
  );
  
  if (result.rowCount === 0) {
    throw new NotFoundError('Laporan tidak ditemukan.');
  }
}
