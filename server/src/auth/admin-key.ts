// Otorisasi admin untuk seluruh endpoint /api/admin.
// Kunci dibandingkan di server (timing-safe) dan tidak pernah dikirim ke klien
// selain oleh panel admin itu sendiri lewat header X-NC-Admin-Key.
import { timingSafeEqual } from 'crypto';
import { config } from '../config.js';
import { AppError, ForbiddenError, UnauthorizedError } from '../http/errors.js';

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function isAdminKeyConfigured(): boolean {
  return Boolean(config.admin.apiKey);
}

export function assertAdminKey(request: any, action = 'mengakses panel admin'): void {
  if (request.user && request.user.role === 'admin') return;

  const provided = String(request.headers['x-nc-admin-key'] || '');
  const expected = config.admin.apiKey;

  if (!expected) {
    throw new AppError(
      503,
      'Kunci admin belum dikonfigurasi di server. Hubungi administrator sistem.',
      'ADMIN_NOT_CONFIGURED'
    );
  }

  if (!provided) {
    throw new UnauthorizedError('Akses ditolak. Kunci admin wajib diisi.');
  }

  if (!safeEqual(provided, expected)) {
    throw new ForbiddenError(`Akses ditolak. Hanya admin yang dapat ${action}.`);
  }
}
