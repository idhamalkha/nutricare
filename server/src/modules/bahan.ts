// Modul Bahan: CRUD + validasi nama unik
import { pool } from '../db/pool.js';
import { serializeBahan } from '../serializers/index.js';
import { NotFoundError, ValidationError } from '../http/errors.js';

export async function getAllBahan() {
  const result = await pool.query(
    'SELECT * FROM bahan WHERE deleted_at IS NULL ORDER BY created_at DESC'
  );
  return result.rows.map(serializeBahan);
}

export async function createBahan(data: any, userId?: string) {
  // Aturan ledger stok diperiksa lebih dulu: stok tidak boleh diisi lewat CRUD bahan.
  if (data.stok !== undefined && Number(data.stok) !== 0) {
    throw new ValidationError('Perubahan stok wajib melalui transaksi stok.', 'stok');
  }
  const nama = String(data?.nama ?? '').trim();
  if (!nama) {
    throw new ValidationError('Nama bahan wajib diisi.', 'nama');
  }
  const satuan = String(data?.satuan ?? '').trim();
  if (!satuan) {
    throw new ValidationError('Satuan wajib diisi.', 'satuan');
  }
  // Validasi nama unik (case-insensitive)
  const check = await pool.query(
    'SELECT id, nama FROM bahan WHERE lower(nama) = lower($1) AND deleted_at IS NULL',
    [nama]
  );
  
  if (check.rows.length > 0) {
    throw new ValidationError(`Bahan ${nama} sudah terdaftar.`, 'nama');
  }
  
  const kategori = String(data?.kategori ?? '').trim() || 'Lainnya';
  const stok = 0;
  const minimum = Number(data?.minimum ?? 0) || 0;
  let kedaluwarsa = data?.kedaluwarsa ? String(data.kedaluwarsa).slice(0, 10) : null;
  if (!kedaluwarsa) {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    kedaluwarsa = d.toISOString().slice(0, 10);
  }

  const result = await pool.query(
    `INSERT INTO bahan (nama, kategori, stok, satuan, minimum, kedaluwarsa)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      nama,
      kategori,
      stok,
      satuan,
      minimum,
      kedaluwarsa,
    ]
  );
  
  return serializeBahan(result.rows[0]);
}

export async function updateBahan(id: string, data: any, userId?: string) {
  if (data.stok !== undefined) {
    throw new ValidationError('Perubahan stok wajib melalui transaksi stok.', 'stok');
  }
  // Validasi nama unik jika nama berubah
  if (data.nama) {
    const check = await pool.query(
      'SELECT id FROM bahan WHERE lower(nama) = lower($1) AND deleted_at IS NULL AND id != $2',
      [data.nama, id]
    );
    
    if (check.rows.length > 0) {
      throw new ValidationError(`Bahan ${data.nama} sudah terdaftar.`, 'nama');
    }
  }
  
  const fields: string[] = [];
  const values: any[] = [];
  let paramCount = 1;
  
  const allowedFields = ['nama', 'kategori', 'stok', 'satuan', 'minimum', 'kedaluwarsa'];
  for (const field of allowedFields) {
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
    `UPDATE bahan SET ${fields.join(', ')}
     WHERE id = $${paramCount} AND deleted_at IS NULL
     RETURNING *`,
    values
  );
  
  if (result.rows.length === 0) {
    throw new NotFoundError('Bahan tidak ditemukan.');
  }
  
  return serializeBahan(result.rows[0]);
}

export async function deleteBahan(id: string, userId: string) {
  const result = await pool.query(
    'UPDATE bahan SET deleted_at = now(), deleted_by = $1 WHERE id = $2 AND deleted_at IS NULL',
    [userId, id]
  );
  
  if (result.rowCount === 0) {
    throw new NotFoundError('Bahan tidak ditemukan.');
  }
}
