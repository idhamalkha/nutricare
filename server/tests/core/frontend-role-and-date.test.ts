import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('peran halaman dan tanggal sidebar', () => {
  it('memakai peran sesi sebelum menebak dari nama berkas', () => {
    const adapter = read('../../../js/api-adapter.js');
    expect(adapter).toContain('nutricare-user');
    expect(adapter).toContain('sessionRole');
    // Urutan: parameter ?role= dulu, lalu peran sesi, baru tebakan nama berkas.
    const queryAt = adapter.indexOf('queryRole && allowed[queryRole]');
    const sessionAt = adapter.indexOf('sessionRole && allowed[sessionRole]');
    const guessAt = adapter.indexOf("location.pathname.indexOf('logistik')");
    expect(queryAt).toBeGreaterThan(-1);
    expect(sessionAt).toBeGreaterThan(queryAt);
    expect(guessAt).toBeGreaterThan(sessionAt);
  });

  it('tidak mematikan NC ketika satu toko gagal dimuat', () => {
    const script = read('../../../js/nutricare.js');
    expect(script).toContain("bahanStore = makeStore('bahan')");
    expect(script).toContain('Data bahan belum dapat dimuat untuk peran ini.');
    // Fallback harus tetap menyediakan pembacaan kosong agar halaman tidak error.
    expect(script).toContain('all: function () { return []; }');
  });

  it('mengisi tanggal sidebar sendiri bila skrip halaman berhenti', () => {
    const shell = read('../../../js/hms-shell.js');
    expect(shell).toContain("querySelectorAll('.sidebar-date')");
    expect(shell).toContain("Intl.DateTimeFormat('id-ID'");
  });
});
