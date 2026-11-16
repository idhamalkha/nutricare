// Helper untuk resolusi nama pasien → pasien_id
// Frontend menggunakan nama pasien, database menggunakan pasien_id
import { pool } from '../db/pool.js';
import { ValidationError } from '../http/errors.js';

export async function resolvePasienByName(nama: string): Promise<string> {
  const result = await pool.query(
    'SELECT id, nama FROM pasien WHERE lower(nama) = lower($1) AND deleted_at IS NULL',
    [nama]
  );
  
  if (result.rows.length === 0) {
    throw new ValidationError(`Pasien ${nama} tidak ditemukan.`);
  }
  
  if (result.rows.length > 1) {
    throw new ValidationError(`Nama pasien ${nama} dipakai lebih dari satu pasien.`);
  }
  
  return result.rows[0].id;
}

// Untuk bahan
export async function resolveBahanByName(nama: string): Promise<string> {
  const result = await pool.query(
    'SELECT id, nama FROM bahan WHERE lower(nama) = lower($1) AND deleted_at IS NULL',
    [nama]
  );
  
  if (result.rows.length === 0) {
    throw new ValidationError(`Bahan ${nama} tidak ditemukan.`);
  }
  
  if (result.rows.length > 1) {
    throw new ValidationError(`Nama bahan ${nama} dipakai lebih dari satu bahan.`);
  }
  
  return result.rows[0].id;
}
