// Driver penyimpanan foto profil: Supabase Storage (bucket publik).
// Service role key hanya dipakai di server, tidak pernah dikirim ke klien.
import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { AppError } from '../http/errors.js';
import type { ImageInfo } from './photo-storage.js';

const client = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BUCKET = config.photo.supabaseBucket;

export function isSupabaseConfigured(): boolean {
  return Boolean(config.supabase.url && config.supabase.serviceRoleKey && BUCKET);
}

function storagePath(filename: string): string {
  const dir = config.github.uploadPath.replace(/^\/+|\/+$/g, '') || 'profile-photos';
  return `${dir}/${filename}`;
}

let bucketReady = false;

async function ensureBucket(): Promise<void> {
  if (bucketReady) return;

  const { data, error } = await client.storage.getBucket(BUCKET);
  if (!error && data) {
    bucketReady = true;
    return;
  }

  const { error: createError } = await client.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: Math.round(config.photo.maxSizeMb * 1024 * 1024),
    allowedMimeTypes: config.photo.allowedTypes,
  });

  if (createError && !/already exists|duplicate/i.test(createError.message)) {
    console.error('[foto-profil] Gagal menyiapkan bucket Supabase:', createError.message);
    throw new AppError(
      503,
      'Penyimpanan foto belum siap di server. Hubungi administrator.',
      'STORAGE_NOT_READY'
    );
  }

  bucketReady = true;
}

export async function uploadSupabase(
  buffer: Buffer,
  filename: string,
  info: ImageInfo
): Promise<string> {
  await ensureBucket();

  const path = storagePath(filename);

  const { error } = await client.storage.from(BUCKET).upload(path, buffer, {
    contentType: info.mime,
    cacheControl: '3600',
    upsert: true,
  });

  if (error) {
    console.error('[foto-profil] Supabase upload gagal:', error.message, '| mime:', info.mime);
    throw new AppError(
      502,
      'Foto gagal diunggah ke penyimpanan. Coba lagi beberapa saat.',
      'STORAGE_UPLOAD_FAILED'
    );
  }

  const { data } = client.storage.from(BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new AppError(
      502,
      'URL foto tidak dapat dibuat. Coba lagi beberapa saat.',
      'STORAGE_URL_FAILED'
    );
  }

  return data.publicUrl;
}

// Ambil path objek dari URL publik Supabase Storage.
function pathFromSupabaseUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const path = url.slice(idx + marker.length).split('?')[0];
  return path ? decodeURIComponent(path) : null;
}

// Hapus file lama di bucket. Kegagalan hanya dicatat di log.
export async function deleteSupabase(photoUrl: string): Promise<void> {
  if (!photoUrl || !isSupabaseConfigured()) return;

  const path = pathFromSupabaseUrl(photoUrl);
  if (!path) return;

  try {
    const { error } = await client.storage.from(BUCKET).remove([path]);
    if (error) {
      console.warn('[foto-profil] Gagal menghapus file lama di Supabase:', path, error.message);
    }
  } catch (error) {
    console.warn('[foto-profil] Gagal menghapus file lama di Supabase:', (error as Error).message);
  }
}
