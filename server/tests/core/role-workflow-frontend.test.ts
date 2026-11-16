import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('role workflow frontend', () => {
  it('lets nurses enter patients and maintain allergy/diet restriction data', () => {
    const page = read('../../../pages/perawat.html');
    const script = read('../../../js/perawat.js');
    const adapter = read('../../../js/api-adapter.js');
    expect(page).toContain('id="crud-pantangan-perawat"');
    expect(script).toContain("mount: '#crud-pasien-perawat'");
    expect(script).toContain("addLabel: 'Tambah pasien'");
    expect(script).toContain("key: 'diagnosis'");
    expect(script).toContain("mount: '#crud-pantangan-perawat'");
    expect(script).toContain("key: 'alergi'");
    expect(script).toContain("key: 'pantangan'");
    expect(script).toContain("NC.store('pantangan')");
    expect(adapter).toContain("perawat: ['pasien', 'pantangan', 'rekomendasi', 'jadwal', 'perawat']");
  });

  it('shows dietitian recommendations to nurses and kitchen staff', () => {
    const nurse = read('../../../js/perawat.js');
    const logistics = read('../../../js/logistik.js');
    const adapter = read('../../../js/api-adapter.js');
    expect(nurse).toContain("NC.store('rekomendasi')");
    expect(logistics).toContain("get('/api/rekomendasi')");
    expect(adapter).toContain("logistik: ['rekomendasi']");
  });

  it('limits waiter to ready distribution rows and delivery confirmation', () => {
    const waiter = read('../../../js/waiter.js');
    const adapter = read('../../../js/api-adapter.js');
    expect(adapter).toContain("key === 'jadwal' && pageRole === 'waiter' ? '/jadwal/distribusi-siap'");
    expect(waiter).toContain('readOnly: true');
    expect(waiter).toContain("/terkirim'");
    expect(waiter).toContain('row.ruangan');
    expect(waiter).not.toContain("NC.store('rekomendasi')");
    expect(waiter).not.toContain("key: 'status'");
  });

  it('lets logistics mark kitchen preparation ready and exposes that handoff', () => {
    const logistics = read('../../../js/logistik.js');
    const page = read('../../../pages/logistik.html');
    expect(page).toContain('Rekomendasi dari Ahli Gizi');
    expect(logistics).toContain("data-prep-status=\"Selesai\"");
    expect(logistics).toContain("await patch('/api/logistik/persiapan/' + encodeURIComponent(waktu)");
    expect(logistics).toContain('openPrintDialog(ordersToPrint)');
    expect(logistics).toContain("item.status === 'Selesai'");
  });
});
