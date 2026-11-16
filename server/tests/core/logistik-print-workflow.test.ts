import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

const root = new URL('../../../', import.meta.url);
const source = (path: string) => readFileSync(new URL(path, root), 'utf8');

describe('alur cetak rekomendasi dapur', () => {
  it('mencetak label ompreng dengan identitas pasien dan informasi makan', () => {
    const script = source('js/logistik.js');
    const page = source('pages/logistik.html');

    expect(script).toContain("['Nomor pesanan', orderNumber(item)]");
    expect(script).toContain("['Tanggal', date(item.tanggal)]");
    expect(script).toContain("['Nama pasien', item.pasien || '-']");
    expect(script).toContain("['Ruangan', item.ruangan || '-']");
    expect(script).toContain("['Menu', item.menu || '-']");
    expect(script).toContain("window.setTimeout(() => window.print(), 50)");
    expect(script).toContain("if (kind === 'detail')");
    expect(script).toContain("fields.push(['Komposisi', item.komposisi || '-'], ['Catatan dapur', item.catatan || '-'])");
    expect(script.match(/await patch\('\/api\/logistik\/persiapan\//g) || []).toHaveLength(1);
    expect(script.match(/openPrintDialog\(ordersToPrint\)/g) || []).toHaveLength(1);
    expect(page).toContain('@page ompreng { size: 100mm 120mm; margin: 5mm; }');
    expect(page).toContain('#print-sheet[data-print-kind="label"] .print-order:not(:last-child) { break-after: page; page-break-after: always; }');
    expect(page).toContain('.print-order-label header { display: grid;');
    expect(script).toContain("+ `<header><strong>NutriCare</strong><span>${kind === 'label' ? 'Label Ompreng' : 'Detail Makanan'}</span></header>`");
    expect(page).toContain('.data-card-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));');
    expect(page).toContain('.data-card-actions .button { min-width: 0; min-height: 42px; padding: 9px 6px; font-size: 10px; white-space: nowrap;');
  });

  it('membuka pilihan cetak otomatis setelah siap dan tersedia untuk cetak ulang manual', () => {
    const script = source('js/logistik.js');
    const page = source('pages/logistik.html');

    expect(script).toContain('openPrintDialog(ordersToPrint)');
    expect(script).toContain('data-print-order=');
    expect(script).toContain('openPrintDialog([item])');
    expect(script).toContain("const isReady = /selesai/i.test(prepStatusCache.get(item.waktu)?.status || '');");
    expect(script).toContain('${isReady ? `<button');
    expect(script).toContain("data-print-order=\"${esc(item.id)}\">Cetak label");
    expect(script).toContain("${isReady ? 'Siap didistribusikan' : 'Periksa ketersediaan bahan'}");
    expect(page).toContain('id="modal-cetak-pesanan"');
    expect(page).toContain('data-print-label');
    expect(page).toContain('data-print-detail');
    expect(page).toContain('@media print');
  });
});
