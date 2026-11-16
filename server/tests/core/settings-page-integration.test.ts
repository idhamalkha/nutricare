import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';

describe('settings page API integration', () => {
  it('loads settings from account and preferences endpoints', async () => {
    const app = buildApp();
    const page = await app.inject({ method: 'GET', url: '/pages/pengaturan.html?role=logistik' });
    const giziPage = await app.inject({ method: 'GET', url: '/pages/ahli-gizi.html' });
    const core = await app.inject({ method: 'GET', url: '/js/nutricare.js' });
    const script = await app.inject({ method: 'GET', url: '/js/pengaturan.js' });
    expect(script.body).toContain('resetBtn.disabled = true;');
    expect(script.body).toContain('Reset demo dinonaktifkan');
    expect(script.body).not.toContain('localStorage.setItem(prefKey');
    expect(core.body).not.toContain("localStorage.setItem(key, JSON.stringify(profile))");
    expect(core.body).not.toContain("localStorage.getItem(prefKey)");
    expect(core.body).toContain("fetch('/api' + window.NutriCareApi.resources.me");
    expect(core.body).toContain("fetch('/api' + window.NutriCareApi.resources.preferensi");
    expect(core.body).toContain('Boolean(authToken && window.NutriCareApi && window.NutriCareApi.resources && window.NutriCareApi.resources.me)');
    expect(page.body).toContain('id="reset-demo" disabled');
    expect(page.body).not.toContain('Kembalikan data contoh');
    expect(giziPage.body).toContain('id="reset-demo" disabled');
    expect(core.body).toContain('if (reset) reset.disabled = true;');
    const apiAdapter = await app.inject({ method: 'GET', url: '/js/api-adapter.js' });
    expect(apiAdapter.body).toContain("routes.me = '/me';");
    expect(apiAdapter.body).toContain("routes.preferensi = '/me/preferensi';");
    expect(core.body).toContain("fetch('/api' + window.NutriCareApi.resources.me");
    expect(core.body).toContain("fetch('/api' + window.NutriCareApi.resources.preferensi");
    expect(core.body).not.toContain("localStorage.setItem(key, JSON.stringify(profile))");
    expect(core.body).not.toContain("localStorage.getItem(prefKey)");
    expect(core.body).not.toContain("localStorage.removeItem('nutricare-' + name)");
    expect(page.body).toContain('id="theme-msg"');
    expect(page.body).not.toContain('id="form-profil"');
    expect(giziPage.body).not.toContain("nama: 'Ahli Gizi', email: 'ahligizi@nutricare.com'");
    const logisticsPage = await app.inject({ method: 'GET', url: '/pages/logistik.html' });
    expect(logisticsPage.body).not.toContain("nama: 'Petugas Logistik'");
    const settingsJs = await app.inject({ method: 'GET', url: '/js/nutricare.js' });
    expect(settingsJs.body).toContain('Preferensi gagal dimuat dari server.');
    expect(page.statusCode).toBe(200);
    expect(apiAdapter.statusCode).toBe(200);
    expect(script.statusCode).toBe(200);
    // Halaman pengaturan hanya memakai /me untuk identitas topbar, preferensi tetap dari API.
    expect(script.body).toContain("NutriCareAPI.get('/me'");
    expect(script.body).toContain('/me/preferensi');
    await app.close();
  });
});
