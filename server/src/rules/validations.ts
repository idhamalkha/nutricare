// BR-1: RM unik (case-insensitive) di antara pasien aktif
// BR-2: Jadwal unik per (pasien, waktu) di antara jadwal aktif
// BR-3: Alergi tidak boleh ada di menu/komposisi
// BR-4: Bahan habis tidak boleh dipakai di menu/komposisi
// BR-5: BR-3 dan BR-4 dijalankan saat create/update isi, tidak saat patch status saja
// BR-6: Rename pasien harus tercermin di data turunan (ditangani database cascade update)

import { pool } from '../db/pool.js';
import { ValidationError } from '../http/errors.js';
import { bahanStatus } from './bahan-status.js';

// BR-1: Validasi RM unik
export async function validateRMUnique(rm: string, excludeId?: string) {
  const result = await pool.query(
    `SELECT id, nama FROM pasien 
     WHERE lower(rm) = lower($1) AND deleted_at IS NULL ${excludeId ? 'AND id != $2' : ''}`,
    excludeId ? [rm, excludeId] : [rm]
  );
  
  if (result.rows.length > 0) {
    throw new ValidationError(
      `Nomor rekam medis ${rm} sudah dipakai pasien lain.`,
      'rm'
    );
  }
}

// BR-2: Validasi jadwal unik per pasien+waktu
export async function validateJadwalUnique(
  pasienId: string,
  waktu: string,
  role: string,
  excludeId?: string
) {
  const result = await pool.query(
    `SELECT j.id, p.nama 
     FROM jadwal_makan j
     JOIN pasien p ON p.id = j.pasien_id
     WHERE j.pasien_id = $1 AND j.waktu = $2 AND j.deleted_at IS NULL ${excludeId ? 'AND j.id != $3' : ''}`,
    excludeId ? [pasienId, waktu, excludeId] : [pasienId, waktu]
  );
  
  if (result.rows.length > 0) {
    const pasienNama = result.rows[0].nama;
    const waktuLower = waktu.toLowerCase();
    
    // Pesan berbeda per role (BR-2)
    if (role === 'waiter') {
      throw new ValidationError(
        `${pasienNama} sudah memiliki jadwal ${waktuLower}.`
      );
    } else {
      throw new ValidationError(
        `${pasienNama} sudah punya jadwal ${waktuLower}. Ubah jadwal yang ada.`
      );
    }
  }
}

// BR-3: Validasi alergi tidak ada di menu/komposisi
export async function validateNoAllergens(
  pasienId: string,
  menu: string,
  komposisi: string
) {
  // Ambil semua alergi pasien dari pantangan_alergi
  const result = await pool.query(
    `SELECT alergi FROM pantangan_alergi 
     WHERE pasien_id = $1 AND deleted_at IS NULL`,
    [pasienId]
  );
  
  if (result.rows.length === 0) return; // Tidak ada pantangan
  
  // Gabungkan semua alergi, split by comma, trim
  const allergens: string[] = [];
  for (const row of result.rows) {
    const parts = row.alergi.split(',').map((s: string) => s.trim());
    allergens.push(...parts);
  }
  
  // Filter kosong dan "-"
  const validAllergens = allergens.filter(a => a && a !== '-');
  if (validAllergens.length === 0) return;
  
  // Cek substring di menu + komposisi (case-insensitive)
  const text = (menu + ' ' + komposisi).toLowerCase();
  
  for (const allergen of validAllergens) {
    if (text.includes(allergen.toLowerCase())) {
      // Ambil nama pasien untuk pesan
      const pasienResult = await pool.query(
        'SELECT nama FROM pasien WHERE id = $1',
        [pasienId]
      );
      const pasienNama = pasienResult.rows[0]?.nama || 'pasien';
      
      throw new ValidationError(
        `Komposisi mengandung ${allergen.toLowerCase()}, alergi yang tercatat untuk ${pasienNama}.`
      );
    }
  }
}

// BR-4: Validasi bahan habis tidak boleh dipakai
export async function validateRecipeStock(menu: string, portions: number) {
  if (!Number.isInteger(portions) || portions <= 0) {
    throw new ValidationError('Jumlah porsi harus bilangan bulat lebih dari nol.');
  }
  const result = await pool.query(
    `SELECT b.nama AS bahan, r.jumlah_per_porsi, r.satuan, b.stok,
            b.satuan AS stok_satuan, b.kedaluwarsa
     FROM menu_resep_bahan r JOIN bahan b ON b.id=r.bahan_id
     WHERE lower(r.menu)=lower($1) AND b.deleted_at IS NULL`, [menu]
  );
  if (!result.rows.length) throw new ValidationError(`Resep menu ${menu} belum dikonfigurasi.`);
  for (const row of result.rows) {
    const unit = String(row.satuan).trim().toLowerCase();
    const stockUnit = String(row.stok_satuan).trim().toLowerCase();
    if (unit !== stockUnit) throw new ValidationError(`Satuan resep ${row.bahan} (${row.satuan}) tidak cocok dengan satuan stok (${row.stok_satuan}).`);
    const status = bahanStatus({ kedaluwarsa: row.kedaluwarsa, stok: Number(row.stok), minimum: 0 });
    const required = Number(row.jumlah_per_porsi) * portions;
    const available = Number(row.stok);
    if (status === 'Kedaluwarsa') throw new ValidationError(`${row.bahan} sudah kedaluwarsa.`);
    if (available <= 0 || required > available + 1e-9) {
      throw new ValidationError(`${row.bahan}: butuh ${Number(required.toFixed(3))} ${row.satuan} untuk ${portions} porsi; stok ${available} ${row.stok_satuan}.`);
    }
  }
}

export async function validateNoOutOfStock(menu: string, komposisi: string) {
  // Ambil semua bahan aktif
  const result = await pool.query(
    `SELECT nama, stok, minimum, kedaluwarsa 
     FROM bahan WHERE deleted_at IS NULL`
  );
  
  const text = (menu + ' ' + komposisi).toLowerCase();
  
  for (const row of result.rows) {
    const status = bahanStatus({
      kedaluwarsa: row.kedaluwarsa,
      stok: parseFloat(row.stok),
      minimum: parseFloat(row.minimum),
    });
    
    const namaLower = String(row.nama).toLowerCase().trim();
    const tokens = namaLower.split(/[^a-z0-9]+/).filter((token: string) => token.length >= 4);
    const isMentioned = text.includes(namaLower) || tokens.some((token: string) => new RegExp(`(^|[^a-z0-9])${token}([^a-z0-9]|$)`, 'i').test(text));
    if (isMentioned && (status === 'Habis' || status === 'Kedaluwarsa')) {
      const reason = status === 'Kedaluwarsa' ? 'sudah kedaluwarsa' : 'sedang habis';
      throw new ValidationError(`Stok ${namaLower} ${reason}. Pilih bahan pengganti.`);
    }
  }
}

// BR-5: Validasi rekomendasi (alergi + stok) - hanya jika isi berubah
export async function validateRekomendasi(
  pasienId: string,
  menu: string,
  komposisi: string
) {
  await validateNoAllergens(pasienId, menu, komposisi);
  await validateNoOutOfStock(menu, komposisi);
}
