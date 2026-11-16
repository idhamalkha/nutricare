// Cek kesiapan penyimpanan foto profil sesuai PHOTO_STORAGE di server/.env.
// Pakai: cd server && node scripts/check-photo-storage.mjs
// Tidak mencetak token/kunci. Hanya status dan pesan kesalahan.
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const driver = (process.env.PHOTO_STORAGE || 'supabase').trim().toLowerCase();
const maxMb = parseFloat(process.env.MAX_PHOTO_SIZE_MB || '2');

console.log(`Driver: ${driver}`);

function done(code = 0) {
  process.exitCode = code;
}

if (driver === 'github') {
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH, GITHUB_UPLOAD_PATH } = process.env;
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    console.log('✗ GITHUB_TOKEN / GITHUB_OWNER / GITHUB_REPO belum lengkap');
    done(1);
  } else {
    const headers = {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'NutriCare-Photo-Check',
      'Content-Type': 'application/json',
    };
    console.log(`Repo : ${GITHUB_OWNER}/${GITHUB_REPO} @ ${GITHUB_BRANCH || 'main'} (folder: ${GITHUB_UPLOAD_PATH || 'profile-photos'})`);

    const repo = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`, { headers });
    if (!repo.ok) {
      console.log(`✗ Repo tidak dapat diakses token ini (${repo.status})`);
      done(1);
    } else {
      const path = `${(GITHUB_UPLOAD_PATH || 'profile-photos').replace(/^\/+|\/+$/g, '')}/.izin-tulis.txt`;
      const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;
      const put = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ message: 'chore: uji izin tulis foto profil', content: Buffer.from('uji').toString('base64') }),
      });
      if (!put.ok) {
        console.log(`✗ Token tidak dapat menulis ke repository (HTTP ${put.status})`);
        console.log('  Perbaiki: Fine-grained token → Repository permissions → Contents: Read and write');
        done(1);
      } else {
        console.log('✓ Token dapat menulis — unggah foto siap dipakai');
        const info = await put.json();
        if (info?.content?.sha) {
          await fetch(url, {
            method: 'DELETE',
            headers,
            body: JSON.stringify({ message: 'chore: bersihkan uji izin tulis', sha: info.content.sha }),
          });
          console.log('✓ File uji sudah dihapus');
        }
      }
    }
  }
} else {
  const bucket = (process.env.SUPABASE_PHOTO_BUCKET || 'foto-profil').trim();
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('✗ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diisi');
    done(1);
  } else {
    const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    console.log(`Bucket: ${bucket}`);

    const { data: existing, error: getErr } = await client.storage.getBucket(bucket);
    if (getErr || !existing) {
      const { error } = await client.storage.createBucket(bucket, {
        public: true,
        fileSizeLimit: Math.round(maxMb * 1024 * 1024),
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      });
      console.log(error && !/already exists/i.test(error.message)
        ? `✗ Bucket tidak bisa dibuat: ${error.message}`
        : '✓ Bucket dibuat (publik)');
      if (error && !/already exists/i.test(error.message)) done(1);
    } else {
      console.log(`✓ Bucket ada (public: ${existing.public})`);
    }

    // PNG 1x1 transparan — bucket hanya menerima image/jpeg, image/png, image/webp.
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
    const path = `profile-photos/.uji-${Date.now()}.png`;
    const { error: upErr } = await client.storage
      .from(bucket)
      .upload(path, tinyPng, { contentType: 'image/png', upsert: true });

    if (upErr) {
      console.log(`✗ Unggah uji gagal: ${upErr.message}`);
      done(1);
    } else {
      const { data } = client.storage.from(bucket).getPublicUrl(path);
      const res = await fetch(data.publicUrl);
      console.log(res.ok ? '✓ Unggah + URL publik berfungsi' : `✗ URL publik tidak dapat dibuka (${res.status})`);
      await client.storage.from(bucket).remove([path]);
      console.log('✓ File uji sudah dihapus');
      if (!res.ok) done(1);
    }
  }
}
