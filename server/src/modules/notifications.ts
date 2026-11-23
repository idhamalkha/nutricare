import { pool } from '../db/pool.js';
import { NotFoundError, ValidationError } from '../http/errors.js';

const validRoles = ['ahli-gizi', 'perawat', 'waiter', 'logistik', 'dapur'];
const validTypes = ['info', 'success', 'warning', 'error'];

export interface NotificationField {
  label: string;
  value: string;
}

export interface NotificationItem {
  judul: string;
  meta?: string;
  nilai?: string;
}

// Rincian yang disimpan bersama notifikasi supaya kotak masuk bisa menampilkan
// popup berisi data nyata (pasien baru, rekomendasi menu, kesiapan dapur) tanpa
// harus membuka halaman lain lebih dulu.
export interface NotificationDetail {
  kind: 'pasien' | 'rekomendasi' | 'distribusi' | 'dapur' | 'evaluasi' | 'umum';
  ringkas?: string;
  fields?: NotificationField[];
  items?: NotificationItem[];
}

export interface NewNotification {
  title: string;
  body: string;
  type?: string;
  link?: string | null;
  roleLinks?: Record<string, string>;
  detail?: NotificationDetail | null;
}

// Kolom `detail` ditambahkan lewat migrasi 20261104000007. Bila migrasi belum
// diterapkan di sebuah lingkungan, notifikasi tetap dikirim/dibaca tanpa rincian
// agar kotak masuk tidak mati total.
function isMissingDetailColumn(error: any) {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  return code === '42703' || /column .*detail.* does not exist/i.test(message);
}

export async function createNotificationsForRoles(roles: string[], input: NewNotification) {
  const title = String(input.title || '').trim();
  const body = String(input.body || '').trim();
  const type = input.type || 'info';
  const link = input.link || null;
  const roleLinks = input.roleLinks || {};
  const targets = [...new Set(roles.filter((role) => validRoles.includes(role)))];
  if (!targets.length) return 0;
  if (!title || !body || title.length > 160 || body.length > 1000 || !validTypes.includes(type)) {
    throw new ValidationError('Isi notifikasi tidak valid.');
  }
  const validLocalLink = (value: string) => value.startsWith('/') && !value.startsWith('//');
  if (link && !validLocalLink(link)) throw new ValidationError('Tautan notifikasi harus berupa path lokal.');
  for (const [role, target] of Object.entries(roleLinks)) {
    if (targets.includes(role) && !validLocalLink(target)) throw new ValidationError('Tautan notifikasi harus berupa path lokal.');
  }
  // Rincian dibatasi 8000 karakter agar payload tetap ringan dan tidak bisa
  // dipakai menyimpan data besar di kotak masuk.
  let detail: string | null = null;
  if (input.detail) {
    detail = JSON.stringify(input.detail);
    if (detail.length > 8000) throw new ValidationError('Rincian notifikasi terlalu besar.');
  }
  const baseParams = [targets, type, title, body, link, JSON.stringify(roleLinks)];
  try {
    const result = await pool.query(
      `INSERT INTO notifications(user_id, role, type, title, body, link, detail)
       SELECT p.id, p.role, $2, $3, $4, COALESCE($6::jsonb ->> p.role, $5), $7::jsonb
       FROM profiles p
       WHERE p.aktif = true AND p.role = ANY($1::text[])`,
      [...baseParams, detail]
    );
    return result.rowCount || 0;
  } catch (error) {
    if (!isMissingDetailColumn(error)) throw error;
    const result = await pool.query(
      `INSERT INTO notifications(user_id, role, type, title, body, link)
       SELECT p.id, p.role, $2, $3, $4, COALESCE($6::jsonb ->> p.role, $5)
       FROM profiles p
       WHERE p.aktif = true AND p.role = ANY($1::text[])`,
      baseParams
    );
    return result.rowCount || 0;
  }
}

export async function listNotifications(userId: string, limit = 50) {
  const params = [userId, Math.max(1, Math.min(100, Number(limit) || 50))];
  let result;
  try {
    result = await pool.query(
      `SELECT id, type, title, body, link, detail, read_at, created_at
       FROM notifications WHERE user_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      params
    );
  } catch (error) {
    if (!isMissingDetailColumn(error)) throw error;
    result = await pool.query(
      `SELECT id, type, title, body, link, read_at, created_at
       FROM notifications WHERE user_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      params
    );
  }
  return {
    notifications: result.rows.map((row: any) => ({
      id: String(row.id), type: row.type, title: row.title, body: row.body,
      link: row.link, detail: row.detail || null, read: Boolean(row.read_at),
      read_at: row.read_at, created_at: row.created_at,
    })),
  };
}

export async function markNotificationRead(userId: string, id: string) {
  const result = await pool.query(
    `UPDATE notifications SET read_at = COALESCE(read_at, now())
     WHERE user_id = $1 AND id = $2 RETURNING id`, [userId, id]
  );
  if (!result.rowCount) throw new NotFoundError('Notifikasi tidak ditemukan.');
  return true;
}

export async function markAllNotificationsRead(userId: string) {
  const result = await pool.query(
    `UPDATE notifications SET read_at = now()
     WHERE user_id = $1 AND read_at IS NULL RETURNING id`, [userId]
  );
  return result.rowCount || 0;
}

export async function clearNotifications(userId: string) {
  const result = await pool.query('DELETE FROM notifications WHERE user_id = $1 RETURNING id', [userId]);
  return result.rowCount || 0;
}
