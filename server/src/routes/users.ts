// Endpoint foto profil pengguna (khusus admin).
// - POST   /users/:id/foto-profil  (multipart/form-data, field: foto)
// - DELETE /users/:id/foto-profil
// Otorisasi diperiksa di server lewat kunci admin (header X-NC-Admin-Key),
// bukan hanya dengan menyembunyikan tombol di tampilan.
import { FastifyPluginAsync } from 'fastify';
import { pool } from '../db/pool.js';
import { config } from '../config.js';
import { AppError, NotFoundError, ValidationError } from '../http/errors.js';
import { assertAdminKey } from '../auth/admin-key.js';
import {
  buildFilename,
  deleteProfilePhoto,
  uploadProfilePhoto,
  validateImage,
  isStorageConfigured,
} from '../modules/photo-storage.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function findProfile(id: string): Promise<{ id: string; foto_profil: string | null }> {
  if (!UUID_RE.test(id)) {
    throw new ValidationError('ID pengguna tidak valid.');
  }

  const result = await pool.query(
    'SELECT id, foto_profil FROM profiles WHERE id = $1',
    [id]
  );

  if (result.rowCount === 0) {
    throw new NotFoundError('Pengguna tidak ditemukan.');
  }

  return result.rows[0];
}

const userPhotoRoutes: FastifyPluginAsync = async (fastify) => {
  // Unggah / ganti foto profil
  fastify.post('/users/:id/foto-profil', async (request: any, reply) => {
    assertAdminKey(request, 'mengubah foto profil');

    if (!isStorageConfigured()) {
      throw new AppError(
        503,
        'Penyimpanan foto belum dikonfigurasi di server. Hubungi administrator.',
        'STORAGE_NOT_CONFIGURED'
      );
    }

    const { id } = request.params as { id: string };
    const profile = await findProfile(id);

    const contentType = String(request.headers['content-type'] || '');
    if (!contentType.includes('multipart/form-data')) {
      throw new ValidationError('Kirim foto sebagai multipart/form-data dengan field "foto".');
    }

    let part: any;
    try {
      part = await request.file({
        limits: {
          fileSize: Math.round(config.photo.maxSizeMb * 1024 * 1024),
          files: 1,
        },
      });
    } catch {
      throw new ValidationError('Berkas tidak dapat dibaca. Coba unggah ulang foto.');
    }

    if (!part) {
      throw new ValidationError('Pilih file foto terlebih dahulu.');
    }

    let buffer: Buffer;
    try {
      buffer = await part.toBuffer();
    } catch (error: any) {
      if (error?.code === 'FST_REQ_FILE_TOO_LARGE' || error?.code === 'FST_FILES_LIMIT') {
        throw new AppError(
          413,
          `Ukuran foto melebihi batas ${config.photo.maxSizeMb} MB.`,
          'FILE_TOO_LARGE'
        );
      }
      throw new ValidationError('File foto gagal dibaca. Coba unggah ulang.');
    }

    // Validasi dari isi file (magic bytes), bukan dari nama atau header klien.
    const info = validateImage(buffer);

    const filename = buildFilename(id, info.ext);
    const photoUrl = await uploadProfilePhoto(buffer, filename, info);

    const updated = await pool.query(
      `UPDATE profiles
       SET foto_profil = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, foto_profil`,
      [photoUrl, id]
    );

    if (updated.rowCount === 0) {
      throw new NotFoundError('Pengguna tidak ditemukan.');
    }

    // Hapus file lama (best effort, tidak menggagalkan proses utama).
    if (profile.foto_profil && profile.foto_profil !== photoUrl) {
      await deleteProfilePhoto(profile.foto_profil);
    }

    return {
      success: true,
      message: 'Foto profil berhasil diperbarui.',
      foto_profil: photoUrl,
    };
  });

  // Hapus foto profil (kembali ke avatar inisial)
  fastify.delete('/users/:id/foto-profil', async (request: any) => {
    assertAdminKey(request, 'mengubah foto profil');

    const { id } = request.params as { id: string };
    const profile = await findProfile(id);

    if (!profile.foto_profil) {
      return {
        success: true,
        message: 'Pengguna ini belum memiliki foto profil.',
        foto_profil: null,
      };
    }

    await pool.query(
      'UPDATE profiles SET foto_profil = NULL, updated_at = NOW() WHERE id = $1',
      [id]
    );

    await deleteProfilePhoto(profile.foto_profil);

    return {
      success: true,
      message: 'Foto profil berhasil dihapus.',
      foto_profil: null,
    };
  });
};

export default userPhotoRoutes;
