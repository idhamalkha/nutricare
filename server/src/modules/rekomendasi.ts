// Modul Rekomendasi: CRUD + validasi alergi & stok
import { pool, transaction } from '../db/pool.js';
import { serializeRekomendasi } from '../serializers/index.js';
import { ConflictError, NotFoundError } from '../http/errors.js';
import { resolvePasienByName } from '../db/resolvers.js';
import { validateRekomendasi } from '../rules/validations.js';

const mealTimes: Record<string, string> = { Sarapan: '06:00', 'Makan siang': '11:00', 'Makan malam': '17:00', Snack: '14:00' };

// Supabase driver mengembalikan kolom `date` sebagai JS Date (UTC midnight),
// sehingga String(row.tanggal) menghasilkan format panjang. Fungsi ini
// mengeluarkan tanggal lokal Indonesia dari Date maupun string ISO.
function formatTanggalId(val: unknown): string {
  if (!val) return '-';
  // Jika sudah string ISO "YYYY-MM-DD", parse langsung tanpa timezone shift.
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y, m, d] = val.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  const date = val instanceof Date ? val : new Date(String(val));
  if (Number.isNaN(date.getTime())) return String(val);
  // Gunakan UTC components untuk hindari timezone shift saat kolom = date-only.
  const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export async function syncRecommendationSchedule(db: any, row: any) {
  if (row.status !== 'Dikirim') return null;
  const prepared = await db.query(
    `SELECT id FROM persiapan_dapur WHERE tanggal=$1 AND waktu=$2 AND status='Selesai' FOR UPDATE`,
    [row.tanggal, row.waktu]
  );
  if (prepared.rowCount) throw new ConflictError('Slot dapur sudah siap; rekomendasi tidak dapat diubah tanpa pembalikan stok melalui ledger.');
  const result = await db.query(
    `INSERT INTO jadwal_makan (pasien_id,waktu,menu,jam,status)
     VALUES ($1,$2,$3,$4,'Menunggu')
     ON CONFLICT (pasien_id,waktu) WHERE deleted_at IS NULL
     DO UPDATE SET menu=EXCLUDED.menu,jam=EXCLUDED.jam,status='Menunggu'
     RETURNING *`,
    [row.pasien_id, row.waktu, row.menu, mealTimes[row.waktu] || '12:00']
  );
  await db.query(
    `UPDATE persiapan_dapur SET status='Menunggu', progres=0
     WHERE waktu=$1 AND tanggal=(now() AT TIME ZONE 'Asia/Jakarta')::date AND status='Selesai'`,
    [row.waktu]
  );
  return result.rows[0];
}

export async function resolveMenuComposition(menu: string): Promise<string> {
  if (!menu || !String(menu).trim()) return '-';
  const cleanMenu = String(menu).trim();

  // 1. Cek langsung resep bahan
  const direct = await pool.query(
    `SELECT b.nama as bahan, r.jumlah_per_porsi, r.satuan
     FROM menu_resep_bahan r
     JOIN bahan b ON b.id = r.bahan_id
     WHERE lower(r.menu) = lower($1) AND b.deleted_at IS NULL
     ORDER BY b.nama`,
    [cleanMenu]
  );

  if (direct.rows.length > 0) {
    return direct.rows
      .map((r: any) => `${r.bahan} ${Number(r.jumlah_per_porsi)} ${r.satuan}`)
      .join(', ');
  }

  // 2. Cek paket menu: komposisi dikelompokkan per hidangan
  const paketRes = await pool.query(
    `SELECT mpr.resep_nama,
            b.nama AS bahan,
            r.jumlah_per_porsi,
            r.satuan
     FROM menu_paket mp
     JOIN menu_paket_resep mpr ON mpr.paket_id = mp.id
     LEFT JOIN menu_resep_bahan r ON lower(r.menu) = lower(mpr.resep_nama)
     LEFT JOIN bahan b ON b.id = r.bahan_id AND b.deleted_at IS NULL
     WHERE lower(mp.nama) = lower($1)
     ORDER BY mpr.id, b.nama`,
    [cleanMenu]
  );

  if (paketRes.rows.length > 0) {
    const perHidangan = new Map<string, string[]>();
    for (const row of paketRes.rows) {
      const hidangan = String(row.resep_nama);
      const daftar = perHidangan.get(hidangan) || [];
      if (row.bahan) daftar.push(`${row.bahan} ${Number(row.jumlah_per_porsi)} ${row.satuan}`);
      perHidangan.set(hidangan, daftar);
    }
    const items = [...perHidangan.entries()].map(([hidangan, daftar]) =>
      daftar.length ? `${hidangan}: ${daftar.join(', ')}` : hidangan
    );
    if (items.length > 0) return items.join(' · ');
  }

  return '-';
}

export async function getAllRekomendasi() {
  const result = await pool.query(
    `SELECT r.*, p.nama as pasien_nama, p.ruangan, dr.dokter_nama
     FROM rekomendasi_menu r
     JOIN pasien p ON p.id = r.pasien_id
     LEFT JOIN LATERAL (
       SELECT pf.nama AS dokter_nama
       FROM pasien_rs prs
       JOIN kunjungan k ON k.pasien_rs_id = prs.id AND k.deleted_at IS NULL
       JOIN rekam_medis rm ON rm.kunjungan_id = k.id AND rm.final_oleh IS NOT NULL
       JOIN profiles pf ON pf.id = rm.final_oleh
       WHERE lower(prs.rm) = lower(p.rm) AND prs.deleted_at IS NULL
       ORDER BY rm.final_at DESC NULLS LAST, rm.created_at DESC
       LIMIT 1
     ) dr ON true
     WHERE r.deleted_at IS NULL AND p.deleted_at IS NULL
     ORDER BY r.tanggal DESC, r.created_at DESC`
  );
  return result.rows.map(serializeRekomendasi);
}

async function resolveMenuPackageAttributes(menu: string) {
  const result = await pool.query(
    `SELECT mp.diet, mp.tekstur, COALESCE((
       SELECT SUM(sub.k) FROM (
         SELECT COALESCE(SUM(mrb.kalori_per_porsi),0) AS k
         FROM menu_paket_resep mpr
         JOIN menu_resep_bahan mrb ON lower(mrb.menu)=lower(mpr.resep_nama)
         WHERE mpr.paket_id=mp.id
         GROUP BY lower(mpr.resep_nama)
       ) sub
     ),0) AS total_kalori
     FROM menu_paket mp WHERE lower(mp.nama)=lower($1) LIMIT 1`,
    [String(menu || '').trim()]
  );
  if (!result.rowCount) throw new NotFoundError('Menu paket tidak ditemukan.');
  return { diet: result.rows[0].diet, tekstur: result.rows[0].tekstur, kalori: Number(result.rows[0].total_kalori) };
}

export async function createRekomendasi(data: any, userId?: string) {
  const pasienId = await resolvePasienByName(data.pasien);
  const menuAttributes = await resolveMenuPackageAttributes(data.menu);
  data.diet = menuAttributes.diet;
  data.tekstur = menuAttributes.tekstur;
  data.kalori = menuAttributes.kalori;

  let komposisi = typeof data.komposisi === 'string' ? data.komposisi.trim() : '';
  if (!komposisi || komposisi === '-') {
    komposisi = await resolveMenuComposition(data.menu);
  }
  data.komposisi = komposisi;

  // Validasi alergi + stok (BR-3, BR-4, BR-5)
  await validateRekomendasi(pasienId, data.menu, data.komposisi);
  
  const row = await transaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO rekomendasi_menu
       (tanggal, pasien_id, waktu, tekstur, kalori, diet, menu, komposisi, catatan, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [data.tanggal, pasienId, data.waktu, data.tekstur, data.kalori, data.diet, data.menu,
        data.komposisi, data.catatan || '', data.status || 'Draf', userId === 'demo-user' ? null : userId || null]
    );
    const recommendation = inserted.rows[0];
    await syncRecommendationSchedule(client, recommendation);
    const joined = await client.query(
      `SELECT r.*, p.nama AS pasien_nama, p.ruangan FROM rekomendasi_menu r JOIN pasien p ON p.id=r.pasien_id WHERE r.id=$1`,
      [recommendation.id]
    );
    return joined.rows[0];
  });
  const result = serializeRekomendasi(row);
  if (row.status === 'Dikirim') void import('../routes/push.js').then(({sendPushToRole})=>sendPushToRole(['logistik','dapur','waiter'],'Rekomendasi menu baru',`${row.menu} · ${row.waktu} · ${row.pasien_nama}`,{
        roleLinks: { logistik: '/pages/dapur.html#persiapan', dapur: '/pages/dapur.html#persiapan', waiter: '/pages/waiter.html#distribusi' },
        detail: {
          kind: 'rekomendasi',
          ringkas: `${row.menu} untuk ${row.pasien_nama} (${row.waktu}).`,
          fields: [
            { label: 'Pasien', value: String(row.pasien_nama || '-') },
            { label: 'Tanggal', value: formatTanggalId(row.tanggal) },
            { label: 'Waktu makan', value: String(row.waktu || '-') },
            { label: 'Menu', value: String(row.menu || '-') },
            { label: 'Komposisi', value: String(row.komposisi || '-') },
            { label: 'Kalori', value: row.kalori ? `${row.kalori} kkal` : '-' },
            { label: 'Diet', value: String(row.diet || '-') },
            { label: 'Tekstur', value: String(row.tekstur || '-') },
          ],
        },
      })).catch(()=>{});
  return result;
}

export async function updateRekomendasi(id: string, data: any, userId?: string) {
  // BR-5: Validasi hanya jika field isi (pasien/menu/komposisi) berubah
  const hasContentChange = data.pasien || data.menu || data.komposisi;
  
  let pasienId: string | undefined;
  let finalMenuAttributes: { diet: string; tekstur: string; kalori: number } | undefined;
  if (data.pasien) {
    pasienId = await resolvePasienByName(data.pasien);
  }

  if (data.menu) {
    finalMenuAttributes = await resolveMenuPackageAttributes(data.menu);
    data.diet = finalMenuAttributes.diet;
    data.tekstur = finalMenuAttributes.tekstur;
    data.kalori = finalMenuAttributes.kalori;
    if (!data.komposisi || String(data.komposisi).trim() === '' || String(data.komposisi).trim() === '-') {
      data.komposisi = await resolveMenuComposition(data.menu);
    }
  }

  if (!finalMenuAttributes && (hasContentChange || data.diet !== undefined || data.tekstur !== undefined || data.kalori !== undefined)) {
    const currentMenuResult = await pool.query(
      'SELECT menu FROM rekomendasi_menu WHERE id=$1 AND deleted_at IS NULL', [id]
    );
    const currentMenu = String(currentMenuResult.rows[0]?.menu || '');
    finalMenuAttributes = await resolveMenuPackageAttributes(currentMenu);
    data.menu = currentMenu;
    data.diet = finalMenuAttributes.diet;
    data.tekstur = finalMenuAttributes.tekstur;
    data.kalori = finalMenuAttributes.kalori;
  }
  // Jika ada perubahan konten, ambil data lama untuk validasi lengkap
  if (hasContentChange) {
    const current = await pool.query(
      `SELECT r.*, p.nama as pasien_nama, p.ruangan
       FROM rekomendasi_menu r
       JOIN pasien p ON p.id = r.pasien_id
       WHERE r.id = $1 AND r.deleted_at IS NULL`,
      [id]
    );
    
    if (current.rows.length === 0) {
      throw new NotFoundError('Rekomendasi tidak ditemukan.');
    }
    
    const row = current.rows[0];
    
    // Gabungkan data lama + baru untuk validasi
    const finalPasienId = pasienId || row.pasien_id;
    const finalMenu = data.menu ?? row.menu;
    const finalKomposisi = data.komposisi ?? row.komposisi;
    
    await validateRekomendasi(finalPasienId, finalMenu, finalKomposisi);
  }
  
  // Build update query
  const fields: string[] = [];
  const values: any[] = [];
  let paramCount = 1;
  
  const fieldMap: Record<string, any> = {
    tanggal: data.tanggal,
    pasien_id: pasienId,
    waktu: data.waktu,
    tekstur: data.tekstur,
    kalori: data.kalori,
    diet: data.diet,
    menu: data.menu,
    komposisi: data.komposisi,
    catatan: data.catatan,
    status: data.status,
  };
  
  for (const [field, value] of Object.entries(fieldMap)) {
    if (value !== undefined) {
      fields.push(`${field} = $${paramCount}`);
      values.push(value);
      paramCount++;
    }
  }
  
  if (fields.length === 0) {
    throw new Error('Tidak ada field yang diubah.');
  }
  
  values.push(id);
  
  const row = await transaction(async (client) => {
    const updated = await client.query(
      `UPDATE rekomendasi_menu SET ${fields.join(', ')}
       WHERE id = $${paramCount} AND deleted_at IS NULL RETURNING *`, values
    );
    if (!updated.rowCount) throw new NotFoundError('Rekomendasi tidak ditemukan.');
    if (updated.rows[0].status === 'Dikirim') await syncRecommendationSchedule(client, updated.rows[0]);
    const joined = await client.query(
      `SELECT r.*, p.nama AS pasien_nama, p.ruangan FROM rekomendasi_menu r JOIN pasien p ON p.id=r.pasien_id WHERE r.id=$1`,
      [updated.rows[0].id]
    );
    return joined.rows[0];
  });
  const result = serializeRekomendasi(row);
  if (row.status === 'Dikirim') void import('../routes/push.js').then(({sendPushToRole})=>sendPushToRole(['logistik','dapur','waiter'],'Rekomendasi menu diperbarui',`${row.menu} · ${row.waktu} · ${row.pasien_nama}`,{
        roleLinks: { logistik: '/pages/dapur.html#persiapan', dapur: '/pages/dapur.html#persiapan', waiter: '/pages/waiter.html#distribusi' },
        detail: {
          kind: 'rekomendasi',
          ringkas: `${row.menu} untuk ${row.pasien_nama} (${row.waktu}).`,
          fields: [
            { label: 'Pasien', value: String(row.pasien_nama || '-') },
            { label: 'Tanggal', value: formatTanggalId(row.tanggal) },
            { label: 'Waktu makan', value: String(row.waktu || '-') },
            { label: 'Menu', value: String(row.menu || '-') },
            { label: 'Komposisi', value: String(row.komposisi || '-') },
            { label: 'Kalori', value: row.kalori ? `${row.kalori} kkal` : '-' },
            { label: 'Diet', value: String(row.diet || '-') },
            { label: 'Tekstur', value: String(row.tekstur || '-') },
          ],
        },
      })).catch(()=>{});
  return result;
}

export async function deleteRekomendasi(id: string, userId: string) {
  const result = await pool.query(
    'UPDATE rekomendasi_menu SET deleted_at = now(), deleted_by = $1 WHERE id = $2 AND deleted_at IS NULL',
    [userId, id]
  );
  
  if (result.rowCount === 0) {
    throw new NotFoundError('Rekomendasi tidak ditemukan.');
  }
}
