import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';

/**
 * Popup notifikasi punya satu aksi utama yang menyebut tujuannya. Notifikasi
 * lama tanpa tautan tetap tampil, hanya tanpa tombol aksi.
 */
describe('notification detail actions', () => {
  it('labels the popup action by destination and falls back to the notification kind', async () => {
    const app = buildApp();
    const script = await app.inject({ method: 'GET', url: '/js/notification-center.js' });
    expect(script.statusCode).toBe(200);

    expect(script.body).toContain('actionFor(notif, detail)');
    expect(script.body).toContain('actionLabel(target, kind)');
    expect(script.body).toContain("'Buka data pasien'");
    expect(script.body).toContain("'Buka rekomendasi menu'");
    expect(script.body).toContain("'Buka jadwal distribusi'");
    expect(script.body).toContain("'Buka persiapan dapur'");
    expect(script.body).toContain('notif-dialog-actions');
    expect(script.body).toContain('notif-dialog-hint');
    expect(script.body).toContain('data-notif-action');

    // Tautan lokal saja yang boleh dijadikan tombol.
    expect(script.body).toContain("String(notif.link).startsWith('/')");
    // Notifikasi tanpa rincian memakai label netral, bukan nama bagian tertentu.
    expect(script.body).toContain("label: detail ? this.actionLabel(link, kind) : 'Buka halaman terkait'");

    const css = await app.inject({ method: 'GET', url: '/css/notifications-center.css' });
    expect(css.statusCode).toBe(200);
    expect(css.body).toContain('.notif-dialog-actions');
    expect(css.body).toContain('.notif-dialog-link svg');
    // Popup harus di tengah layar, juga di halaman yang memakai `* { margin: 0 }`.
    expect(css.body).toMatch(/\.notif-dialog \{[^}]*position: fixed;[^}]*inset: 0;[^}]*margin: auto;/);

    await app.close();
  });

  it('marks notifications read with body-less PATCH requests', async () => {
    const app = buildApp();
    const script = await app.inject({ method: 'GET', url: '/js/notification-center.js' });
    expect(script.statusCode).toBe(200);

    // Kedua permintaan penandaan tidak membawa body, jadi tidak boleh memasang
    // Content-Type JSON: server menolaknya sebagai galat 500.
    expect(script.body).toContain('`/api/notifications/${encodeURIComponent(id)}/read`');
    expect(script.body).toContain("fetch('/api/notifications/read-all'");
    expect(script.body).not.toContain("'Content-Type': 'application/json'");

    // Tampilkan state proses dahulu, lalu ubah daftar hanya setelah respons sukses.
    expect(script.body).toContain("this.setButtonBusy(button, 'Menyimpan...')");
    expect(script.body).toContain('unread.forEach(notif => {');
    expect(script.body).toContain('notif.read = true;');
    expect(script.body).toContain("this.notifyFailure('Gagal menandai semua notifikasi. Coba lagi.')");
    expect(script.body).not.toContain('const snapshot = unread.map');

    // Membuka popup menandai notifikasi yang ditekan sebagai sudah dibaca.
    expect(script.body).toContain('if (!notif.read) this.markAsRead(notif.id);');

    // Rute penandaan ada dan permintaan tanpa body sampai ke pemeriksaan sesi
    // (401), bukan ditolak saat membaca body.
    const readAll = await app.inject({ method: 'PATCH', url: '/api/notifications/read-all' });
    expect(readAll.statusCode).toBe(401);
    const readOne = await app.inject({
      method: 'PATCH',
      url: '/api/notifications/11111111-1111-4111-8111-111111111111/read',
    });
    expect(readOne.statusCode).toBe(401);

    await app.close();
  });
});
