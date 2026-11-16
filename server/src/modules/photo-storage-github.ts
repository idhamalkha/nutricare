// Driver penyimpanan foto profil: GitHub Contents API.
// Token hanya dibaca di server dari .env dan tidak pernah dikirim ke klien.
import { config } from '../config.js';
import { AppError } from '../http/errors.js';
import type { ImageInfo } from './photo-storage.js';

const API_BASE = 'https://api.github.com';

export function isGithubConfigured(): boolean {
  return Boolean(config.github.token && config.github.owner && config.github.repo);
}

function contentsPath(filename: string): string {
  const dir = config.github.uploadPath.replace(/^\/+|\/+$/g, '');
  return dir ? `${dir}/${filename}` : filename;
}

export function rawUrlFor(filename: string, branch: string = config.github.branch): string {
  const path = contentsPath(filename);
  return `https://raw.githubusercontent.com/${config.github.owner}/${config.github.repo}/${branch}/${path}`;
}

function githubHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${config.github.token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'NutriCare-Profile-Photo',
    'Content-Type': 'application/json',
  };
}

// Ambil path relatif dari URL raw GitHub yang tersimpan di database.
function pathFromRawUrl(url: string): string | null {
  const marker = `/${config.github.owner}/${config.github.repo}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  let rest = url.slice(idx + marker.length);
  if (rest.startsWith(`${config.github.branch}/`)) {
    rest = rest.slice(config.github.branch.length + 1);
  }
  const clean = rest.split('?')[0];
  return clean || null;
}

type BranchInfo = { name: string; exists: boolean };

// Repository bisa masih kosong (belum punya branch). Dalam kondisi itu
// GitHub Contents API membuat commit pertama hanya jika `branch` tidak dikirim.
async function resolveBranch(): Promise<BranchInfo> {
  const configured = config.github.branch;

  try {
    const check = await fetch(
      `${API_BASE}/repos/${config.github.owner}/${config.github.repo}/branches/${encodeURIComponent(configured)}`,
      { headers: githubHeaders() }
    );
    if (check.ok) return { name: configured, exists: true };
  } catch {
    return { name: configured, exists: true };
  }

  try {
    const repo = await fetch(`${API_BASE}/repos/${config.github.owner}/${config.github.repo}`, {
      headers: githubHeaders(),
    });
    if (repo.ok) {
      const data = (await repo.json()) as { default_branch?: string };
      return { name: data.default_branch || configured, exists: false };
    }
  } catch {
    /* abaikan, pakai konfigurasi */
  }

  return { name: configured, exists: false };
}

export async function uploadGithub(
  buffer: Buffer,
  filename: string,
  info: ImageInfo
): Promise<string> {
  const branch = await resolveBranch();
  const path = contentsPath(filename);
  const url = `${API_BASE}/repos/${config.github.owner}/${config.github.repo}/contents/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;

  const send = async (includeBranch: boolean, sha?: string) => {
    const body: Record<string, unknown> = {
      message: `chore(foto-profil): unggah ${filename}`,
      content: buffer.toString('base64'),
    };
    if (includeBranch) body.branch = branch.name;
    if (sha) body.sha = sha;

    return fetch(url, {
      method: 'PUT',
      headers: githubHeaders(),
      body: JSON.stringify(body),
    });
  };

  let response: Response;
  try {
    response = await send(branch.exists);

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      const retryable = !branch.exists || /not found|empty repository/i.test(detail);
      if (retryable) {
        response = await send(false);
      } else if (response.status === 409 || /sha/i.test(detail)) {
        const meta = await fetch(`${url}?ref=${encodeURIComponent(branch.name)}`, {
          headers: githubHeaders(),
        });
        if (meta.ok) {
          const metaJson = (await meta.json()) as { sha?: string };
          if (metaJson.sha) response = await send(true, metaJson.sha);
        }
      }

      if (!response.ok) {
        const detail2 = await response.text().catch(() => '');
        console.error('[foto-profil] GitHub upload gagal', response.status, detail2.slice(0, 300), 'mime:', info.mime);

        if (response.status === 401 || response.status === 403) {
          throw new AppError(
            503,
            'Token GitHub di server tidak memiliki izin menulis ke repository foto (butuh Contents: Read and write).',
            'STORAGE_FORBIDDEN'
          );
        }

        throw new AppError(
          502,
          'Foto gagal diunggah ke penyimpanan. Coba lagi beberapa saat.',
          'STORAGE_UPLOAD_FAILED'
        );
      }
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      502,
      'Foto gagal diunggah ke penyimpanan. Periksa koneksi server lalu coba lagi.',
      'STORAGE_UNREACHABLE'
    );
  }

  return rawUrlFor(filename, branch.name);
}

// Hapus file lama di repository. Kegagalan hanya dicatat di log.
export async function deleteGithub(photoUrl: string): Promise<void> {
  if (!photoUrl || !isGithubConfigured()) return;

  const path = pathFromRawUrl(photoUrl);
  if (!path) return;

  try {
    const metaUrl = `${API_BASE}/repos/${config.github.owner}/${config.github.repo}/contents/${path
      .split('/')
      .map(encodeURIComponent)
      .join('/')}?ref=${encodeURIComponent(config.github.branch)}`;

    const meta = await fetch(metaUrl, { headers: githubHeaders() });
    if (!meta.ok) {
      console.warn('[foto-profil] File lama tidak ditemukan di repository:', path, meta.status);
      return;
    }

    const metaJson = (await meta.json()) as { sha?: string };
    if (!metaJson.sha) return;

    const del = await fetch(
      `${API_BASE}/repos/${config.github.owner}/${config.github.repo}/contents/${path
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`,
      {
        method: 'DELETE',
        headers: githubHeaders(),
        body: JSON.stringify({
          message: `chore(foto-profil): hapus ${path.split('/').pop()}`,
          sha: metaJson.sha,
          branch: config.github.branch,
        }),
      }
    );

    if (!del.ok) {
      console.warn('[foto-profil] Gagal menghapus file lama:', path, del.status);
    }
  } catch (error) {
    console.warn('[foto-profil] Gagal menghapus file lama:', (error as Error).message);
  }
}
