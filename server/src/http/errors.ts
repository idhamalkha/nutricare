// Error types dan format untuk kontrak API
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code: string = 'ERROR',
    public field?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, field?: string) {
    super(422, message, 'VALIDATION', field);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Data tidak ditemukan.') {
    super(404, message, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Anda tidak memiliki izin untuk aksi ini.') {
    super(403, message, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Autentikasi diperlukan.') {
    super(401, message, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

// Aturan CHECK di database diterjemahkan menjadi kalimat yang bisa ditindak-
// lanjuti: kolom apa, dan nilai apa saja yang boleh. Kunci = nama constraint.
const ATURAN_KOLOM: Record<string, { pesan: string; field?: string }> = {
  pasien_status_check: { field: 'status', pesan: 'Status pasien harus salah satu: Aktif, Evaluasi, atau Pulang.' },
  pasien_tekstur_check: { field: 'tekstur', pesan: 'Tekstur makanan harus salah satu: Biasa, Lunak, Bubur, atau Cair.' },
  pasien_kalori_check: { field: 'kalori', pesan: 'Kalori pasien harus antara 500 sampai 5000 kkal.' },
  pasien_bb_check: { field: 'bb', pesan: 'Berat badan minimal 1 kg.' },
  pasien_tb_check: { field: 'tb', pesan: 'Tinggi badan minimal 30 cm.' },
  pasien_usia_check: { field: 'usia', pesan: 'Usia harus antara 0 sampai 120 tahun.' },

  rekomendasi_menu_status_check: { field: 'status', pesan: 'Status rekomendasi harus: Draf, Dikirim, atau Evaluasi.' },
  rekomendasi_menu_tekstur_check: { field: 'tekstur', pesan: 'Tekstur harus salah satu: Biasa, Lunak, Bubur, atau Cair.' },
  rekomendasi_menu_waktu_check: { field: 'waktu', pesan: 'Waktu makan harus: Sarapan, Makan siang, Makan malam, atau Snack.' },
  rekomendasi_menu_diet_check: { field: 'diet', pesan: 'Jenis diet harus: Diet Normal, Diet Diabetes, Diet Rendah Garam, atau Diet Khusus.' },
  rekomendasi_menu_kalori_check: { field: 'kalori', pesan: 'Kalori rekomendasi harus antara 50 sampai 3000 kkal.' },

  jadwal_makan_status_check: { field: 'status', pesan: 'Status jadwal harus: Terjadwal, Menunggu, atau Terkirim.' },
  jadwal_makan_waktu_check: { field: 'waktu', pesan: 'Waktu makan harus: Sarapan, Makan siang, Makan malam, atau Snack.' },

  persiapan_dapur_status_check: { field: 'status', pesan: 'Status persiapan harus: Menunggu, Diproses, atau Selesai.' },
  persiapan_dapur_waktu_check: { field: 'waktu', pesan: 'Waktu harus: Sarapan, Makan siang, Makan malam, atau Snack.' },
  persiapan_dapur_progres_check: { field: 'progres', pesan: 'Progres persiapan harus antara 0 sampai 100 persen.' },
  persiapan_dapur_porsi_check: { field: 'porsi', pesan: 'Jumlah porsi tidak boleh negatif.' },

  bahan_stok_check: { field: 'stok', pesan: 'Stok bahan tidak boleh negatif.' },
  bahan_minimum_check: { field: 'minimum', pesan: 'Stok minimum tidak boleh negatif.' },
  stok_transaksi_jenis_check: { field: 'jenis', pesan: 'Jenis transaksi harus Masuk atau Keluar.' },
  stok_transaksi_jumlah_check: { field: 'jumlah', pesan: 'Jumlah transaksi harus lebih dari 0.' },

  pengajuan_bahan_status_check: { field: 'status', pesan: 'Status pengajuan harus Menunggu atau Disetujui.' },
  pengajuan_bahan_jumlah_check: { field: 'jumlah', pesan: 'Jumlah pengajuan harus lebih dari 0.' },
  pengembalian_bahan_status_check: { field: 'status', pesan: 'Status pengembalian harus: Diterima, Pemeriksaan, atau Dipisahkan.' },
  pengembalian_bahan_kondisi_check: { field: 'kondisi', pesan: 'Kondisi barang harus: Layak digunakan, Perlu diperiksa, atau Tidak layak.' },
  pengembalian_bahan_jumlah_check: { field: 'jumlah', pesan: 'Jumlah pengembalian harus lebih dari 0.' },

  laporan_kondisi_status_check: { field: 'status', pesan: 'Status laporan harus: Baru, Evaluasi, atau Ditinjau.' },
  menu_resep_bahan_jumlah_per_porsi_check: { field: 'jumlah_per_porsi', pesan: 'Jumlah per porsi harus lebih dari 0.' },
  menu_resep_bahan_menu_check: { field: 'menu', pesan: 'Nama menu tidak boleh kosong.' },

  profiles_role_check: { field: 'role', pesan: 'Peran harus salah satu: ahli-gizi, perawat, waiter, logistik, atau dapur.' },
  user_preferences_kunci_check: { field: 'kunci', pesan: 'Preferensi tidak dikenal.' },
  audit_log_aksi_check: { pesan: 'Jenis aksi audit tidak dikenal.' },
};

// Format error response sesuai kontrak
export function formatError(error: unknown) {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      body: {
        message: error.message,
        code: error.code,
        ...(error.field && { field: error.field }),
      },
    };
  }
  
  // Error database PostgreSQL
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const pgError = error as any;
    
    // Unique violation
    if (pgError.code === '23505') {
      return {
        statusCode: 422,
        body: {
          message: 'Data sudah ada.',
          code: 'VALIDATION',
        },
      };
    }
    
    // Foreign key violation
    if (pgError.code === '23503') {
      return {
        statusCode: 422,
        body: {
          message: 'Data terkait tidak ditemukan.',
          code: 'VALIDATION',
        },
      };
    }
    
    // Not-null violation: field wajib belum diisi
    if (pgError.code === '23502') {
      return {
        statusCode: 422,
        body: {
          message: pgError.column
            ? `Field wajib belum diisi: ${pgError.column}.`
            : 'Ada field wajib yang belum diisi.',
          code: 'VALIDATION',
        },
      };
    }

    // Format nilai tidak valid (mis. UUID salah ketik)
    if (pgError.code === '22P02') {
      return {
        statusCode: 422,
        body: {
          message: 'Format data tidak valid.',
          code: 'VALIDATION',
        },
      };
    }

    // Check constraint violation: pesan mentah PostgreSQL tidak ditampilkan,
    // tetapi aturan yang dilanggar diterjemahkan supaya pengguna tahu kolom
    // mana yang salah dan nilai apa yang diperbolehkan.
    if (pgError.code === '23514') {
      const aturan = ATURAN_KOLOM[String(pgError.constraint || '')];
      return {
        statusCode: 422,
        body: {
          message: aturan
            ? aturan.pesan
            : 'Nilai tidak diizinkan untuk kolom ini.',
          code: 'VALIDATION',
          ...(aturan?.field && { field: aturan.field }),
        },
      };
    }
  }
  
  // Koneksi database habis / ditolak pooler (mis. EMAXCONNSESSION, 53300).
  // Ini kondisi sementara: jawab 503 agar klien tahu harus mencoba lagi.
  if (typeof error === 'object' && error !== null) {
    const dbError = error as any;
    const kode = String(dbError.code || '');
    const pesan = String(dbError.message || '');
    const kehabisanKoneksi =
      kode === 'XX000' || kode === '53300' || kode === '57P01' || kode === '08006' || kode === '08003' ||
      /EMAXCONNSESSION|max clients|too many clients|Connection terminated|timeout expired/i.test(pesan) ||
      dbError.name === 'TimeoutError';
    if (kehabisanKoneksi) {
      console.warn('Koneksi database penuh/terputus:', pesan.slice(0, 120));
      return {
        statusCode: 503,
        body: {
          message: 'Server sedang sibuk menghubungi database. Coba lagi beberapa detik lagi.',
          code: 'DB_UNAVAILABLE',
        },
      };
    }
  }

  // Default error
  console.error('Unhandled error:', error);
  return {
    statusCode: 500,
    body: {
      message: 'Terjadi kesalahan server.',
      code: 'INTERNAL_ERROR',
    },
  };
}
