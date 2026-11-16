import { readFileSync } from 'node:fs';
import { runInNewContext, Script } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(new URL('../../../js/nutricare.js', import.meta.url), 'utf8');

function loadStore(api?: { resources: Record<string, string>; request: ReturnType<typeof vi.fn> }) {
  const window: Record<string, unknown> = {};
  if (api) window.NutriCareApi = api;
  const localStorage = { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() };
  const document = {
    body: { setAttribute: vi.fn() },
    addEventListener: vi.fn(),
    querySelectorAll: vi.fn(() => []),
    getElementById: vi.fn(() => null),
  };
  runInNewContext(source, { window, localStorage, document, console, Date, Intl, JSON, String, Number, Object, Array, Math, RegExp });
  return { NC: window.NC as { store: (name: string, defaults?: unknown[]) => { all: () => unknown[]; add: (row: unknown) => unknown; reset: () => void } }, localStorage };
}

describe('frontend stores never substitute demo rows for API data', () => {
  it('returns an empty store and rejects writes when the current role has no API route', () => {
    const { NC } = loadStore({ resources: { pasien: '/pasien' }, request: vi.fn() });
    const store = NC.store('rekomendasi', [{ nama: 'SAMPLE-DATA' }]);

    expect(store.all()).toEqual([]);
    expect(() => store.add({ nama: 'UNSAVED' })).toThrow(/API route.*rekomendasi/i);
  });

  it('does not expose local demo rows when the API adapter is absent', () => {
    const { NC, localStorage } = loadStore();
    expect(source).toContain('if (reset) reset.disabled = true;');
    expect(source).toContain('function makeStore(name, defaults)');
    expect(source).toContain('data server');
    expect(source).not.toContain("localStorage.setItem('nutricare-' + name");
    const store = NC.store('jadwal', [{ pasien: 'SAMPLE-DATA' }]);

    expect(store.all()).toEqual([]);
    expect(() => store.reset()).toThrow(/data server/i);
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it('validates syntax of the edited classic frontend scripts', () => {
    const scripts = [
      '../../../js/nutricare.js',
      '../../../js/logistik.js',
      '../../../js/perawat.js',
      '../../../js/waiter.js',
    ];
    for (const path of scripts) {
      const text = readFileSync(new URL(path, import.meta.url), 'utf8');
      expect(() => new Script(text, { filename: path }), path).not.toThrow();
    }

    const html = readFileSync(new URL('../../../pages/ahli-gizi.html', import.meta.url), 'utf8');
    const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
      .map((match) => match[1].trim())
      .filter(Boolean);
    expect(inlineScripts.length).toBeGreaterThan(0);
    for (const text of inlineScripts) {
      expect(() => new Script(text, { filename: 'pages/ahli-gizi.html:inline' })).not.toThrow();
    }
  });

  it('does not present a hard-coded name as the authenticated user on any dashboard', () => {
    for (const file of ['ahli-gizi.html', 'perawat.html', 'waiter.html', 'logistik.html', 'pengaturan.html']) {
      const page = readFileSync(new URL('../../../pages/' + file, import.meta.url), 'utf8');
      expect(page, file).not.toContain('<strong data-user-name>Ahli Gizi</strong>');
      expect(page, file).not.toContain('<strong data-user-name>Perawat</strong>');
      expect(page, file).not.toContain('<strong data-user-name>Pengguna</strong>');
      expect(page, file).not.toContain('<strong data-user-name>Waiter</strong>');
      expect(page, file).not.toContain('<strong data-user-name>Petugas Logistik</strong>');
      if (file === 'perawat.html') {
        const script = readFileSync(new URL('../../../js/perawat.js', import.meta.url), 'utf8');
        expect(script).not.toContain("nama: 'Perawat'");
      }
    }
  });

  it('does not present a hard-coded waiter name as the authenticated user', () => {
    const page = readFileSync(new URL('../../../pages/waiter.html', import.meta.url), 'utf8');
    const script = readFileSync(new URL('../../../js/waiter.js', import.meta.url), 'utf8');
    expect(page).not.toContain('<strong data-user-name>Waiter</strong>');
    expect(script).not.toContain("nama: 'Waiter'");
  });

  it('builds menu references from loaded recommendation records rather than embedded fixtures', () => {
    const html = readFileSync(new URL('../../../pages/ahli-gizi.html', import.meta.url), 'utf8');
    expect(html).not.toContain("['Nasi ayam kukus', 'Nasi, ayam kukus, wortel, dan sayuran pendamping.', 500]");
    expect(html).toContain('var refs = rekomStore.all().reduce');
    expect(html).toContain('Belum ada referensi menu dari server.');
  });

  it('removes seed arrays from active dashboard store declarations', () => {
    const files = ['../../../js/perawat.js', '../../../js/waiter.js', '../../../js/nutricare.js', '../../../js/logistik.js', '../../../pages/ahli-gizi.html'];
    const contents = files.map((path) => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');

    expect(contents).not.toMatch(/NC\.store\(\s*['"][^'"]+['"]\s*,\s*\[/);
    expect(contents).not.toMatch(/makeStore\(\s*['"]bahan['"]\s*,\s*\[/); 
  });
});
