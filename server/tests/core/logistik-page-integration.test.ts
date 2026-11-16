import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';

describe('logistics page API integration', () => {
  it('loads the logistics adapter script from the dashboard', async () => {
    const app = buildApp();
    const page = await app.inject({ method: 'GET', url: '/pages/logistik.html' });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('../js/logistik.js');
    expect(page.body).not.toContain('<strong data-user-name>Petugas Logistik</strong>');
    expect(page.body).toContain('data-user-name');
    const script = await app.inject({ method: 'GET', url: '/js/logistik.js' });
    expect(script.statusCode).toBe(200);
    expect(script.body).toContain('/api/logistik/ringkasan');
    expect(page.body).toContain('id="cari-data-bahan"');
    expect(page.body).toContain('id="form-tambah-bahan"');
    expect(page.body).toContain('id="modal-bahan-title"');
    expect(page.body).toContain('id="btn-simpan-bahan"');
    expect(script.body).toContain("search.addEventListener('input', () => renderBahanCards())");
    expect(script.body).toContain('data-bahan-edit=');
    expect(script.body).toContain('data-bahan-delete=');
    expect(script.body).toContain("patch('/api/bahan/' + encodeURIComponent(editBahanId), payload)");
    expect(script.body).toContain("deleteRequest('/api/bahan/' + encodeURIComponent(item.id))");
    expect(script.body).toContain("NutriCareUI.confirm('Hapus bahan?'");
    expect(script.body).toContain("method: 'DELETE'");
    expect(script.body).toContain("get('/api/bahan')");
    expect(script.body).toContain('bahanCache.filter((item) => !query');
    expect(script.body).toContain("setCards('#stok-cards'");
    expect(script.body).toContain("method: 'POST'");
    // Sidebar mengambang harus ikut tema, bukan tetap gelap saat tema terang.
    const css = await app.inject({ method: 'GET', url: '/css/role-pages.css' });
    expect(css.statusCode).toBe(200);
    expect(css.body).toContain('body[data-theme="light"] .app.layout > .sidebar {');
    expect(css.body).toContain('body[data-theme="dark"] .app.layout > .sidebar {');
    expect(css.body).toContain('body[data-theme="light"] .app.layout > .sidebar .nav-link { color: #566151; }');
    await app.close();
  });
});
