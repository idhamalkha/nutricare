// Facade penyimpanan foto profil.
// Driver dipilih lewat PHOTO_STORAGE: 'supabase' (default) atau 'github'.
// Validasi file tetap sama untuk kedua driver.
import { config } from '../config.js';
import { AppError, ValidationError } from '../http/errors.js';
import { deleteGithub, isGithubConfigured, uploadGithub } from './photo-storage-github.js';
import { deleteSupabase, isSupabaseConfigured, uploadSupabase } from './photo-storage-supabase.js';

export type ImageInfo = { mime: string; ext: string };
export type StorageDriver = 'supabase' | 'github';

export function activeDriver(): StorageDriver {
  return config.photo.driver === 'github' ? 'github' : 'supabase';
}

export function isStorageConfigured(): boolean {
  return activeDriver() === 'github' ? isGithubConfigured() : isSupabaseConfigured();
}

// Deteksi tipe gambar dari isi file (magic bytes), bukan dari nama/ekstensi.
export function detectImageType(buffer: Buffer): ImageInfo | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: 'png' };
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { mime: 'image/webp', ext: 'webp' };
  }
  return null;
}

// Validasi isi file terhadap MAX_PHOTO_SIZE_MB / ALLOWED_PHOTO_*.
export function validateImage(buffer: Buffer): ImageInfo {
  if (!buffer || buffer.length === 0) {
    throw new ValidationError('File foto kosong. Pilih file lain.');
  }

  const maxBytes = Math.round(config.photo.maxSizeMb * 1024 * 1024);
  if (buffer.length > maxBytes) {
    throw new ValidationError(`Ukuran foto maksimal ${config.photo.maxSizeMb} MB.`);
  }

  const info = detectImageType(buffer);
  if (!info) {
    throw new ValidationError('Format file tidak didukung. Gunakan foto JPG, PNG, atau WEBP.');
  }

  if (config.photo.allowedTypes.length && !config.photo.allowedTypes.includes(info.mime)) {
    throw new ValidationError('Tipe foto tidak diizinkan. Gunakan foto JPG, PNG, atau WEBP.');
  }

  if (config.photo.allowedExtensions.length && !config.photo.allowedExtensions.includes(info.ext)) {
    throw new ValidationError('Ekstensi foto tidak diizinkan. Gunakan foto JPG, PNG, atau WEBP.');
  }

  return info;
}

export function buildFilename(userId: string, ext: string): string {
  return `user-${userId}-${Date.now()}.${ext}`;
}

export async function uploadProfilePhoto(
  buffer: Buffer,
  filename: string,
  info: ImageInfo
): Promise<string> {
  if (!isStorageConfigured()) {
    throw new AppError(
      503,
      'Penyimpanan foto belum dikonfigurasi di server. Hubungi administrator.',
      'STORAGE_NOT_CONFIGURED'
    );
  }

  return activeDriver() === 'github'
    ? uploadGithub(buffer, filename, info)
    : uploadSupabase(buffer, filename, info);
}

// Penghapusan mengikuti bentuk URL, sehingga foto lama dari driver lain tetap dibersihkan.
export async function deleteProfilePhoto(photoUrl: string): Promise<void> {
  if (!photoUrl) return;

  if (photoUrl.includes('/storage/v1/object/public/')) {
    await deleteSupabase(photoUrl);
    return;
  }

  if (photoUrl.includes('githubusercontent.com')) {
    await deleteGithub(photoUrl);
  }
}
