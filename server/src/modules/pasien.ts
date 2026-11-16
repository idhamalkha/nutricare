// Modul Pasien: CRUD + soft delete
import { pool, transaction } from '../db/pool.js';
import { serializePasien, serializePantangan } from '../serializers/index.js';
import { NotFoundError, ValidationError } from '../http/errors.js';
import { validateRMUnique } from '../rules/validations.js';

export async function getAllPasien() {
  const result = await pool.query(
    'SELECT * FROM pasien WHERE deleted_at IS NULL ORDER BY created_at DESC'
  );
  return result.rows.map(serializePasien);
}

// Notifikasi pasien dipakai tiga alur: pasien baru, intake perawat, dan pasien
// lama yang masuk kembali. Semua mengirim rincian yang sama supaya kotak masuk
// ahli gizi dan perawat bisa menampilkan data pasien tanpa membuka halaman lain.
function patientNotificationDetail(row: any) {
  return {
    roleLinks: {
      perawat: '/pages/perawat.html#pasien',
      'ahli-gizi': '/pages/ahli-gizi.html#pasien',
    },
    detail: {
      kind: 'pasien' as const,
      ringkas: `${row.nama} terdaftar sebagai pasien aktif${row.ruangan ? ` di ${row.ruangan}` : ''}.`,
      fields: [
        { label: 'Nama', value: String(row.nama || '-') },
        { label: 'No. RM', value: String(row.rm || '-') },
        { label: 'Ruangan', value: String(row.ruangan || '-') },
        { label: 'Diagnosis', value: String(row.diagnosis || '-') },
        { label: 'Usia', value: row.usia ? `${row.usia} tahun` : '-' },
        { label: 'Berat / tinggi', value: row.bb || row.tb ? `${row.bb || '-'} kg / ${row.tb || '-'} cm` : '-' },
        { label: 'Target kalori', value: row.kalori ? `${row.kalori} kkal` : '-' },
        { label: 'Tekstur', value: String(row.tekstur || '-') },
      ],
    },
  };
}

function notifyPatientIntake(row: any, title = 'Pasien baru ditambahkan') {
  const payload = patientNotificationDetail(row);
  void import('../routes/push.js').then(({ sendPushToRole }) => sendPushToRole(
    ['perawat', 'ahli-gizi'],
    title,
    `${row.nama} · ${row.ruangan || 'tanpa ruangan'} · ${row.kalori || '-'} kkal`,
    payload,
  )).catch(() => {});
}

// Pasien yang sudah pulang tetap tersimpan sebagai riwayat (soft delete).
// Dipakai perawat untuk memilih "pasien lama" saat pasien yang sama masuk lagi.
export async function getDischargedPasien() {
  const result = await pool.query(
    `SELECT id, nama, rm, ruangan, diagnosis, usia, bb, tb, kalori, tekstur, status, deleted_at
     FROM pasien WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 200`
  );
  return result.rows.map((row) => ({
    ...serializePasien(row),
    pulang_pada: row.deleted_at,
  }));
}

export async function createPatientIntake(data: any, userId?: string) {
  await validateRMUnique(data.rm);
  const created = await transaction(async (client) => {
    // Status pasien tidak lagi dipilih manual: pasien baru selalu aktif.
    const patientResult = await client.query(
      `INSERT INTO pasien (nama, rm, ruangan, diagnosis, usia, bb, tb, kalori, tekstur, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Aktif') RETURNING *`,
      [data.nama, data.rm, data.ruangan, data.diagnosis, data.usia, data.bb, data.tb, data.kalori, data.tekstur]
    );
    const patient = patientResult.rows[0];
    const restrictionsResult = await client.query(
      `INSERT INTO pantangan_alergi (pasien_id, alergi, pantangan, catatan)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [patient.id, String(data.alergi || '-').trim() || '-', String(data.pantangan || 'Tidak ada').trim() || 'Tidak ada', data.catatanPantangan || '']
    );
    return { patient, restrictions: restrictionsResult.rows };
  });
  // Alur intake adalah jalur yang dipakai tombol Tambah pasien di halaman
  // perawat. Tanpa panggilan ini notifikasi tidak pernah dibuat.
  notifyPatientIntake(created.patient);
  return {
    patient: serializePasien(created.patient),
    restrictions: created.restrictions.map((row: any) => serializePantangan({ ...row, pasien_nama: created.patient.nama })),
  };
}

export async function createPasien(data: any, userId?: string) {
  // Validasi field wajib lebih dulu supaya kesalahan input dijawab 422,
  // bukan 500 dari pelanggaran NOT NULL di database.
  const wajib = ['nama', 'rm'];
  const kosong = wajib.filter((f) => !String(data?.[f] ?? '').trim());
  if (kosong.length > 0) {
    throw new ValidationError(`Field wajib belum diisi: ${kosong.join(', ')}.`, kosong[0]);
  }

  // Validasi RM unik
  await validateRMUnique(data.rm);
  
  const result = await pool.query(
    `INSERT INTO pasien (nama, rm, ruangan, diagnosis, usia, bb, tb, kalori, tekstur, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Aktif')
     RETURNING *`,
    [
      data.nama,
      data.rm,
      data.ruangan,
      data.diagnosis,
      data.usia,
      data.bb,
      data.tb,
      data.kalori,
      data.tekstur,
    ]
  );
  
  const row = result.rows[0];
  // Beri tahu perawat dan ahli gizi bahwa ada pasien baru, lengkap dengan
  // rincian datanya supaya bisa dibaca langsung dari kotak masuk.
  notifyPatientIntake(row);

  return serializePasien(row);
}

// Pasien lama (pernah dirawat, sudah pulang) masuk kembali.
// Identitas dipertahankan, data episode baru diperbarui, dan catatan
// alergi/pantangan sebelumnya dipulihkan agar tidak hilang.
export async function readmitPasien(id: string, data: any, userId?: string) {
  if (data.rm) await validateRMUnique(data.rm, id);

  const row = await transaction(async (client) => {
    const found = await client.query(
      'SELECT * FROM pasien WHERE id = $1 AND deleted_at IS NOT NULL FOR UPDATE',
      [id]
    );
    if (found.rows.length === 0) {
      throw new NotFoundError('Pasien lama tidak ditemukan atau sudah aktif kembali.');
    }
    const previous = found.rows[0];
    const result = await client.query(
      `UPDATE pasien SET nama = $2, rm = $3, ruangan = $4, diagnosis = $5, usia = $6, bb = $7, tb = $8,
         kalori = $9, tekstur = $10, status = 'Aktif', deleted_at = NULL, deleted_by = NULL, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [
        id,
        String(data.nama ?? previous.nama).trim(),
        String(data.rm ?? previous.rm).trim(),
        data.ruangan ?? previous.ruangan,
        data.diagnosis ?? previous.diagnosis,
        data.usia ?? previous.usia,
        data.bb ?? previous.bb,
        data.tb ?? previous.tb,
        data.kalori ?? previous.kalori,
        data.tekstur ?? previous.tekstur,
      ]
    );
    await client.query(
      'UPDATE pantangan_alergi SET deleted_at = NULL, deleted_by = NULL WHERE pasien_id = $1 AND deleted_at IS NOT NULL',
      [id]
    );
    return result.rows[0];
  });

  notifyPatientIntake(row, 'Pasien lama masuk kembali');
  return serializePasien(row);
}

export async function updatePasien(id: string, data: any, userId?: string) {
  // Validasi RM unik jika RM berubah
  if (data.rm) {
    await validateRMUnique(data.rm, id);
  }
  
  // Build dynamic update query (PATCH parsial)
  const fields: string[] = [];
  const values: any[] = [];
  let paramCount = 1;
  
  const allowedFields = ['nama', 'rm', 'ruangan', 'diagnosis', 'usia', 'bb', 'tb', 'kalori', 'tekstur', 'status'];
  
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
    `UPDATE pasien SET ${fields.join(', ')} 
     WHERE id = $${paramCount} AND deleted_at IS NULL
     RETURNING *`,
    values
  );
  
  if (result.rows.length === 0) {
    throw new NotFoundError('Pasien tidak ditemukan.');
  }
  
  return serializePasien(result.rows[0]);
}

export async function deletePasien(id: string, userId: string) {
  // Gunakan fungsi soft_delete_pasien untuk hapus pasien + turunannya
  await pool.query('SELECT soft_delete_pasien($1, $2)', [id, userId === 'demo-user' ? null : userId]);

  // Tandai status Pulang agar riwayat tetap terbaca sebagai "pasien pulang",
  // bukan sekadar data yang hilang.
  await pool.query(
    "UPDATE pasien SET status = 'Pulang' WHERE id = $1",
    [id]
  );
  
  // Cek apakah pasien ada (untuk error 404)
  const check = await pool.query(
    'SELECT id FROM pasien WHERE id = $1 AND deleted_at IS NOT NULL',
    [id]
  );
  
  if (check.rows.length === 0) {
    throw new NotFoundError('Pasien tidak ditemukan.');
  }
}
