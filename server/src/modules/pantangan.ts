// Modul Pantangan: CRUD dengan resolusi nama pasien
import { pool } from '../db/pool.js';
import { serializePantangan } from '../serializers/index.js';
import { NotFoundError } from '../http/errors.js';
import { resolvePasienByName } from '../db/resolvers.js';

export async function getAllPantangan() {
  const result = await pool.query(
    `SELECT pa.*, p.nama as pasien_nama
     FROM pantangan_alergi pa
     JOIN pasien p ON p.id = pa.pasien_id
     WHERE pa.deleted_at IS NULL AND p.deleted_at IS NULL
     ORDER BY pa.created_at DESC`
  );
  return result.rows.map(serializePantangan);
}

export async function createPantangan(data: any, userId?: string) {
  // Resolusi nama → pasien_id
  const pasienId = await resolvePasienByName(data.pasien);
  
  const result = await pool.query(
    `INSERT INTO pantangan_alergi (pasien_id, alergi, pantangan, catatan)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [pasienId, data.alergi || '-', data.pantangan, data.catatan || '']
  );
  
  // Join dengan nama pasien untuk response
  const joined = await pool.query(
    `SELECT pa.*, p.nama as pasien_nama
     FROM pantangan_alergi pa
     JOIN pasien p ON p.id = pa.pasien_id
     WHERE pa.id = $1`,
    [result.rows[0].id]
  );
  
  return serializePantangan(joined.rows[0]);
}

export async function updatePantangan(id: string, data: any, userId?: string) {
  // Resolusi nama jika pasien berubah
  let pasienId: string | undefined;
  if (data.pasien) {
    pasienId = await resolvePasienByName(data.pasien);
  }
  
  const fields: string[] = [];
  const values: any[] = [];
  let paramCount = 1;
  
  if (pasienId !== undefined) {
    fields.push(`pasien_id = $${paramCount}`);
    values.push(pasienId);
    paramCount++;
  }
  
  if (data.alergi !== undefined) {
    fields.push(`alergi = $${paramCount}`);
    values.push(data.alergi);
    paramCount++;
  }
  
  if (data.pantangan !== undefined) {
    fields.push(`pantangan = $${paramCount}`);
    values.push(data.pantangan);
    paramCount++;
  }
  
  if (data.catatan !== undefined) {
    fields.push(`catatan = $${paramCount}`);
    values.push(data.catatan);
    paramCount++;
  }
  
  if (fields.length === 0) {
    throw new Error('Tidak ada field yang diubah.');
  }
  
  values.push(id);
  
  const result = await pool.query(
    `UPDATE pantangan_alergi SET ${fields.join(', ')}
     WHERE id = $${paramCount} AND deleted_at IS NULL
     RETURNING *`,
    values
  );
  
  if (result.rows.length === 0) {
    throw new NotFoundError('Pantangan tidak ditemukan.');
  }
  
  // Join dengan nama pasien
  const joined = await pool.query(
    `SELECT pa.*, p.nama as pasien_nama
     FROM pantangan_alergi pa
     JOIN pasien p ON p.id = pa.pasien_id
     WHERE pa.id = $1`,
    [result.rows[0].id]
  );
  
  return serializePantangan(joined.rows[0]);
}

export async function deletePantangan(id: string, userId: string) {
  const result = await pool.query(
    'UPDATE pantangan_alergi SET deleted_at = now(), deleted_by = $1 WHERE id = $2 AND deleted_at IS NULL',
    [userId, id]
  );
  
  if (result.rowCount === 0) {
    throw new NotFoundError('Pantangan tidak ditemukan.');
  }
}
