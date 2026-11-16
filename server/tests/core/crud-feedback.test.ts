import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const shared = read('../../../js/nutricare.js');
const adapter = read('../../../js/api-adapter.js');
const utilities = read('../../../js/ui-utils.js');
const nurse = read('../../../js/perawat.js');
const waiter = read('../../../js/waiter.js');
const logistics = read('../../../js/logistik.js');
const notifications = read('../../../js/notification-center.js');
const settings = read('../../../js/pengaturan.js');
const clinicStyles = read('../../../css/hms-clinic.css');
const toastStyles = read('../../../css/notifications.css');

describe('umpan balik aksi CRUD', () => {
  it('menunggu paint sebelum mutasi dan memulihkan tombol setelah proses', () => {
    expect(shared).toContain('function waitForPaint()');
    expect(shared.match(/await waitForPaint\(\);/g)?.length).toBeGreaterThanOrEqual(3);
    expect(shared).toContain("setAttribute('aria-busy', 'true')");
    expect(shared).toContain('button.textContent = label');
    expect(shared).toContain('await options.store.remove(id)');
    expect(shared).toContain('await options.store.update(old.id, values)');
  });

  it('memisahkan GET sinkron dari mutasi async sehingga hidrasi tidak menerima Promise', () => {
    expect(adapter).toMatch(/request:\s*function\s*\(method, path, body\)[\s\S]*?syncRequest\(method, path, body\)/);
    expect(adapter).toContain('requestAsync: function (method, path, body)');
    expect(shared).toContain("method === 'GET'");
    expect(shared).toContain("requestAsync('POST', '/pasien/intake', row)");
    expect(nurse).toContain("await reports.update(row.id, { status: 'Ditinjau' })");
  });

  it('membangun toast aksesibel dari teks, dengan peran error yang tepat', () => {
    expect(utilities).toContain("container.setAttribute('aria-live', 'polite')");
    expect(utilities).toContain("toast.setAttribute('role', safeType === 'error' ? 'alert' : 'status')");
    expect(utilities).toContain('body.textContent = String(message)');
    expect(shared).toContain("toast('Gagal menghapus: ' + (error.message || 'coba lagi.'), 'error')");
    expect(shared).toContain("'success');");
  });

  it('menyesuaikan toast dengan token tema klinik dan layar ponsel, serta hormat reduced motion', () => {
    expect(toastStyles).toContain('body.clinic');
    expect(toastStyles).toContain('var(--c-surface)');
    expect(toastStyles).toContain('var(--c-brand)');
    expect(toastStyles).toContain('@media (max-width: 480px)');
    expect(toastStyles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(clinicStyles).toContain('body.clinic[data-theme="dark"]');
  });

  it('menangani mutasi perawat dan waiter setelah server menjawab', () => {
    expect(nurse).toContain('create: async function (values)');
    expect(nurse).toContain('mutates: true');
    expect(nurse).toContain("await reports.update(row.id, { status: 'Ditinjau' })");
    expect(waiter).toContain("await api.requestAsync('PATCH', '/jadwal/'");
    expect(waiter).toContain("NC.toast('Konfirmasi pengantaran gagal: ' + (error.message || 'coba lagi.'), 'error')");
    expect(waiter).toContain("submitButton.setAttribute('aria-busy', 'true')");
  });

  it('memberi loading state dan toast sukses/gagal pada CRUD logistik khusus', () => {
    expect(logistics).toContain("setButtonBusy(remove, 'Menghapus...')");
    expect(logistics).toContain("showError(error.message || 'Resep gagal dihapus.')");
    expect(logistics).toContain("setButtonBusy(button, 'Memproses...')");
    expect(logistics).toContain("showSuccess('Transaksi berhasil disimpan.')");
    expect(logistics).toContain("showError(error.message || 'Transaksi gagal disimpan.')");
  });

  it('mengunci tombol pengaturan dan pusat notifikasi selama mutasi', () => {
    expect(settings).toContain("i.disabled = true");
    expect(settings).toContain("NutriCareUI.error(error.message || 'Preferensi gagal disimpan.'");
    expect(notifications).toContain("setButtonBusy(button, 'Menyimpan...')");
    expect(notifications).toContain("setButtonBusy(button, 'Menghapus...')");
    expect(notifications).toContain("this.notifyFailure('Notifikasi gagal dihapus. Coba lagi.')");
    expect(notifications).toContain("this.setButtonBusy(button, 'Menyimpan...')");
    expect(notifications).toContain("this.setButtonBusy(button, 'Menghapus...')");
  });
});
