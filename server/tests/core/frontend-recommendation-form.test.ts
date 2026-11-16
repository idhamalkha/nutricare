import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const page = read('../../../pages/ahli-gizi.html');
const shared = read('../../../js/nutricare.js');

describe('formulir rekomendasi menu ahli gizi', () => {
  it('menghapus panel referensi menu dan mengambil nama menu dari resep logistik', () => {
    expect(page).not.toContain('Referensi menu');
    expect(page).toContain("'/logistik/resep'");
    expect(page).toContain("label: 'Menu makan'");
    expect(shared).toContain("'<datalist id=\"");
    expect(shared).toContain("field.datalist");
    expect(page).toContain("get('/logistik/resep'");
    expect(page).toContain("var resepMenuRows = [];");
    expect(page).toContain("'Ketik untuk mencari resep dapur'");
    expect(page).not.toContain("get('/logistik/resep', { showLoading: false }).then(function (rows) {\n            resepMenuOptions");
    expect(page).toContain("return row.menu === menu");
    expect(shared).toContain('beforeSave(values, old)');
    expect(page).toContain("values.status = old ? old.status : 'Dikirim'");
    expect(page).toContain("window.location.hash = '#rekomendasi'");
    expect(page).toContain("NC.crud({\n        mount: '#crud-pasien'");
    expect(page).toContain("'Rekomendasikan menu'");
    expect(page).toContain('r.kalori ||');
    expect(page).toContain('r.tekstur && r.tekstur');
    expect(page).toContain("empty: { title: 'Belum ada rekomendasi aktif'");
    expect(page).toContain("label: 'Cari tanggal'");
    expect(shared).toContain("instance.dateValue");
    expect(shared).toContain("var batasTanggal = day(0)");
    expect(page).not.toContain("document.getElementById('r-chips')");
    expect(page).not.toContain('Referensi menu');
    const fieldStart = page.indexOf('var rekomFields = [');
    const fieldEnd = page.indexOf('var rekomCols = [', fieldStart);
    const formFields = page.slice(fieldStart, fieldEnd);
    expect(formFields).not.toContain('komposisi');
    expect(formFields).not.toContain("key: 'status'");
    const historyStart = page.indexOf("mount: '#crud-riwayat'");
    expect(page.slice(historyStart, historyStart + 500)).toContain('readOnly: true');
    expect(page).not.toContain('var activeRekomPatient');
  });

  it('menampilkan pesan tanggal kosong yang sesuai filter tanggal', () => {
    expect(shared).toContain('Tidak ada data pada tanggal ini');
    expect(shared).toContain('Semua tanggal');
  });

  it('mengambil komposisi dari resep saat menyimpan, tanpa input komposisi dalam formulir', () => {
    expect(page).toContain('values.komposisi = recipeComposition(values.menu)');
    expect(page).toContain("return row.bahan + ' ' + row.jumlahPerPorsi + ' ' + row.satuan");
  });

  it('mengisi tekstur pilihan dari data pasien agar nilai prefill tetap tersedia', () => {
    expect(page).toContain('pasienStore.all().forEach(function (p) { if (p.tekstur');
  });

  it('menampilkan daftar rekomendasi lama hanya saat tanggalnya dicari', () => {
    expect(shared).toContain('var dateFilterInput = mount.querySelector');
    expect(shared).toContain('dateFilterInput.addEventListener');
    expect(shared).toContain('dateClearButton.addEventListener');
  });

  it('tidak menjalankan mutasi ke database saat halaman atau daftar resep dimuat', () => {
    expect(page).toContain("get('/logistik/resep'");
    expect(page).not.toContain("post('/logistik/resep'");
    expect(page).not.toContain("put('/logistik/resep'");
    expect(page).not.toContain("delete('/logistik/resep'");
  });

  it('mengirimkan field komposisi dan status otomatis saat menyimpan rekomendasi', () => {
    expect(page).toContain("values.status = old ? old.status : 'Dikirim'");
    expect(page).toContain('values.komposisi = recipeComposition(values.menu)');
  });

  it('mengisi nama pasien dalam jendela rekomendasi', () => {
    expect(page).toContain('pasien: r.nama');
  });

  it('mengisi target kalori dalam jendela rekomendasi', () => {
    expect(page).toContain('kalori: r.kalori ||');
  });

  it('mengisi tekstur pasien dalam jendela rekomendasi', () => {
    expect(page).toContain("tekstur: r.tekstur && r.tekstur !== '-' ? r.tekstur : ''");
  });

  it('mengirim data tanggal tanpa menghapus rekomendasi lampau', () => {
    expect(page).toContain('dateFilter: { key: \'tanggal\', label: \'Cari tanggal\' }');
    expect(page).toContain('hidePast: true');
    expect(shared).toContain("var batasTanggal = day(0)");
  });

  it('menghapus area chip referensi menu', () => {
    expect(page).not.toContain("document.getElementById('r-chips')");
    expect(page).not.toContain('Referensi menu');
  });

  it('menyediakan aksi pada area kartu pasien, bukan area pasien generik', () => {
    const patientStart = page.indexOf("mount: '#crud-pasien'");
    const recommendationAction = page.indexOf("label: 'Rekomendasikan menu'", patientStart);
    const recommendationCrud = page.indexOf("mount: '#crud-rekom'");
    expect(recommendationAction).toBeGreaterThan(patientStart);
    expect(recommendationAction).toBeLessThan(recommendationCrud);
  });

  it('mengubah halaman sebelum membuka pop-up rekomendasi', () => {
    const actionStart = page.indexOf("label: 'Rekomendasikan menu'");
    const action = page.slice(actionStart, page.indexOf("label: 'Detail'", actionStart));
    expect(action.indexOf("window.location.hash = '#rekomendasi'")).toBeLessThan(action.indexOf('rekom.open(null'));
  });

  it('mempertahankan komposisi pencarian dari rekomendasi terdahulu, bukan meminta input baru', () => {
    const fields = page.slice(page.indexOf('var rekomFields = ['), page.indexOf('var rekomCols = ['));
    expect(fields).not.toContain("key: 'komposisi'");
    expect(page).toContain("search: ['menu', 'pasien', 'komposisi']");
  });

  it('tidak ada status dropdown pada form rekomendasi', () => {
    const fields = page.slice(page.indexOf('var rekomFields = ['), page.indexOf('var rekomCols = ['));
    expect(fields).not.toContain("key: 'status'");
    expect(fields).not.toContain("label: 'Status'");
  });

  it('menyembunyikan tanggal lama hanya dari daftar aktif, bukan menghapusnya', () => {
    const filterLogic = shared.slice(shared.indexOf('// Filter tanggal:'), shared.indexOf('if (options.sort)', shared.indexOf('// Filter tanggal:')));
    expect(filterLogic).toContain('rows = rows.filter');
    expect(filterLogic).not.toContain('remove(');
    expect(filterLogic).toContain('instance.dateValue');
  });

  it('menyediakan reset agar pencarian tanggal bisa dikosongkan', () => {
    expect(shared).toContain('data-date-clear');
    expect(shared).toContain("instance.dateValue = ''");
  });

  it('memuat daftar resep dari endpoint baca saja', () => {
    const recipeLoad = page.slice(page.indexOf('var resepMenuReady'), page.indexOf('function recipeComposition'));
    expect(recipeLoad).toContain("get('/logistik/resep'");
    expect(recipeLoad).not.toContain('.post(');
    expect(recipeLoad).not.toContain('.put(');
    expect(recipeLoad).not.toContain('.delete(');
  });

  it('menolak menu yang tidak tercantum pada resep logistik', () => {
    expect(page).toContain("return 'Pilih menu makan dari resep yang tersedia di logistik.'");
  });

  it('menyimpan rekomendasi baru langsung dengan status Dikirim', () => {
    expect(page).toContain("values.status = old ? old.status : 'Dikirim'");
  });

  it('mengganti status tanpa dropdown pada popup, tombol kirim manual hanya untuk rekomendasi lama', () => {
    expect(page).toContain("label: 'Kirim ke dapur'");
    const fields = page.slice(page.indexOf('var rekomFields = ['), page.indexOf('var rekomCols = ['));
    expect(fields).not.toContain("key: 'status'");
  });

  it('mengambil daftar bahan resep untuk validasi pantangan dan stok', () => {
    expect(page).toContain('function recipeComposition(menu)');
    expect(page).toContain('row.jumlahPerPorsi');
  });

  it('membuka formulir setelah daftar menu dimuat', () => {
    expect(page).toContain('resepMenuReady.then(function ()');
    expect(page).toContain('rekom.open(null, {');
  });

  it('menampilkan tombol rekomendasi hanya untuk pasien yang benar-benar ada', () => {
    expect(page).toContain('show: function (r) { return !!find(r.nama); }');
  });

  it('mempertahankan indikator status pada tabel rekomendasi, meskipun status tak dapat dipilih saat membuatnya', () => {
    expect(page).toContain("{ label: 'Status', render: function (r) { return NC.badge(r.status); } }");
  });

  it('filter tanggal tidak memaksa pencarian, dan tanggal yang dipilih memunculkan rekam lampau', () => {
    expect(shared).toContain('if (instance.dateValue) {');
    expect(shared).toContain("String(row[dateKey] || '') === instance.dateValue");
  });

  it('memakai tanggal sistem lokal untuk menentukan rekomendasi yang sudah lewat', () => {
    expect(shared).toContain('var batasTanggal = day(0)');
    expect(shared).toContain("String(row[dateKey] || '') >= batasTanggal");
  });

  it('form rekomendasi baru menyimpan menu makan dari pilihan resep, bukan nama bebas', () => {
    expect(page).toContain('datalist: function () { return resepMenuOptions; }');
    expect(page).toContain('resepMenuOptions.some(function (menu) { return menu === v.menu; })');
  });

  it('form rekomendasi menerima ketikan nama resep sebagai pencarian dropdown', () => {
    expect(shared).toContain('<datalist id="');
    expect(page).toContain("placeholder: 'Ketik untuk mencari resep dapur'");
  });

  it('tidak menggunakan reference chips yang sudah dihapus', () => {
    expect(page).not.toContain('r-chips');
    expect(page).not.toContain('data-ref');
  });

  it('tidak mengisi komposisi menu secara manual dalam dialog', () => {
    expect(page).not.toContain("key: 'komposisi', label: 'Komposisi makanan'");
    expect(page).toContain('recipeComposition(values.menu)');
  });

  it('form histori tidak dapat membuat atau mengubah rekomendasi', () => {
    const hist = page.slice(page.indexOf("mount: '#crud-riwayat'"), page.indexOf('/* ---------- Tampilan turunan ---------- */'));
    expect(hist).toContain('readOnly: true');
  });

  it('menyembunyikan komposisi di UI tapi tetap mempertahankan validasi alergi dan stok', () => {
    const primary = page.slice(page.indexOf("mount: '#crud-rekom'"), page.indexOf('/* ---------- CRUD: jadwal ---------- */'));
    expect(primary).toContain('allergens(v.pasien)');
    expect(primary).toContain('NC.bahanStatus(b)');
  });

  it('menangani kegagalan memuat daftar resep tanpa mematikan halaman', () => {
    expect(page).toContain('.catch(function () { return resepMenuOptions; })');
  });

  it('tidak menghapus rekomendasi saat menyaring daftar aktif', () => {
    expect(shared).toContain('rows = rows.filter(function (row) { return String(row[dateKey] || \'\') >= batasTanggal; });');
  });

  it('menutup dialog setelah sukses submit', () => {
    expect(shared).toContain("formDialog.close('saved')");
  });

  it('mengirim status terkirim di payload hanya saat membuat rekomendasi', () => {
    expect(page).toContain("values.status = old ? old.status : 'Dikirim'");
  });

  it('menggunakan pencarian tanggal berupa input type=date', () => {
    expect(shared).toContain('<input type="date" data-date-filter');
  });

  it('memberikan nama field tanggal aksesibel', () => {
    expect(shared).toContain("options.dateFilter.label || 'Tanggal'");
  });

  it('status otomatis tersimpan Dikirim dan server membuat handoff berdasar status tersebut', () => {
    expect(page).toContain("values.status = old ? old.status : 'Dikirim'");
    expect(read('../../../server/src/modules/rekomendasi.ts')).toContain("if (row.status === 'Dikirim')");
  });

  it('tidak melakukan mutasi resep saat mengetik atau memuat modal', () => {
    expect(page).not.toContain('replaceMenuRecipe');
    expect(page).not.toContain('deleteMenuRecipe');
  });

  it('mempertahankan data nama, tekstur, target kalori sebagai nilai awal saat membuka modal', () => {
    expect(page).toContain('pasien: r.nama');
    expect(page).toContain("tekstur: r.tekstur && r.tekstur !== '-' ? r.tekstur : ''");
    expect(page).toContain('kalori: r.kalori ||');
  });

  it('memastikan rekomendasi lama bisa dijangkau lewat input tanggal', () => {
    const activeList = page.slice(page.indexOf("mount: '#crud-rekom'"), page.indexOf('/* ---------- CRUD: jadwal ---------- */'));
    expect(activeList).toContain("dateFilter: { key: 'tanggal', label: 'Cari tanggal' }");
    expect(activeList).toContain('hidePast: true');
  });

  it('tidak menampilkan status field pada form rekomendasi', () => {
    const fields = page.slice(page.indexOf('var rekomFields = ['), page.indexOf('var rekomCols = ['));
    expect(fields).not.toContain("key: 'status'");
  });

  it('menyembunyikan expired recommendation from default view but preserves date lookup', () => {
    const filterCode = shared.slice(shared.indexOf('// Filter tanggal:'), shared.indexOf('if (options.sort)', shared.indexOf('// Filter tanggal:')));
    expect(filterCode).toContain('options.hidePast');
    expect(filterCode).toContain('instance.dateValue');
  });

  it('includes date filter event handlers and clear action', () => {
    expect(shared).toContain("querySelector('[data-date-filter]')");
    expect(shared).toContain("querySelector('[data-date-clear]')");
  });

  it('uses exact recipe names for the recommendation field', () => {
    expect(page).toContain("if (!resepMenuOptions.some(function (menu) { return menu === v.menu; }))");
  });

  it('keeps the history list read-only', () => {
    expect(page).toContain("mount: '#crud-riwayat',\n        store: rekomStore,\n        noun: 'riwayat rekomendasi'");
  });

  it('does not send sample patient or recipe data from the page', () => {
    expect(page).not.toContain('Nasi ayam kukus');
    expect(page).not.toContain('Bubur ayam');
  });

  it('does not mutate logistik menu recipes when recommending a menu', () => {
    expect(page).not.toContain("'/logistik/resep', { method: 'PUT'");
  });

  it('filters out earlier dates but keeps today and future records', () => {
    expect(shared).toContain("String(row[dateKey] || '') >= batasTanggal");
  });

  it('checks date filter before past-date hiding so a chosen date can show historical entries', () => {
    const filterCode = shared.slice(shared.indexOf('// Filter tanggal:'), shared.indexOf('if (options.sort)', shared.indexOf('// Filter tanggal:')));
    expect(filterCode.indexOf('if (instance.dateValue)')).toBeLessThan(filterCode.indexOf('else if (options.hidePast)'));
  });

  it('uses exact menu names from existing recipes and stores recipe composition automatically', () => {
    expect(page).toContain('resepMenuOptions.some(function (menu) { return menu === v.menu; })');
    expect(page).toContain('values.komposisi = recipeComposition(values.menu)');
  });

  it('removes manual status field from historical editor as well', () => {
    expect(page).toContain('readOnly: true');
  });

  it('sends records automatically to kitchen on creation', () => {
    expect(page).toContain("values.status = old ? old.status : 'Dikirim'");
    expect(read('../../../server/src/modules/rekomendasi.ts')).toContain('syncRecommendationSchedule(client, recommendation)');
  });

  it('shows the selected patient in prefilled modal', () => {
    expect(page).toContain('pasien: r.nama');
  });

  it('supports finding historical recommendations by exact date', () => {
    expect(shared).toContain("String(row[dateKey] || '') === instance.dateValue");
  });

  it('shows no expired recommendations by default only on recommendation CRUD', () => {
    expect(page).toContain('hidePast: true');
  });

  it('removes redundant recommendation references block', () => {
    expect(page).not.toContain('r-chips');
  });

  it('prevents empty recipe list from causing a JavaScript exception', () => {
    expect(page).toContain('resepMenuOptions = resepMenuRows.reduce');
    expect(page).toContain('return resepMenuOptions; })');
  });

  it('does not create recommendations from imported demo seeds', () => {
    expect(page).not.toContain('seedRecommendations');
  });

  it('only exposes recommendation action for real patient rows', () => {
    expect(page).toContain("show: function (r) { return !!find(r.nama); }");
  });

  it('will not use recipe composition supplied as arbitrary free text', () => {
    expect(page).toContain('recipeComposition(values.menu)');
  });

  it('verifies selected menu against source recipe option list', () => {
    expect(page).toContain('resepMenuOptions.some(function (menu) { return menu === v.menu; })');
  });

  it('does not put composition or status in the active recommendation modal', () => {
    const fields = page.slice(page.indexOf('var rekomFields = ['), page.indexOf('var rekomCols = ['));
    expect(fields).not.toContain('komposisi');
    expect(fields).not.toContain('status');
  });

  it('preserves old recommendations for filtering rather than deletion', () => {
    expect(shared).toContain('options.hidePast');
    expect(shared).not.toContain('store.remove(row.id)');
  });

  it('serves updated assets without packaging changes', () => {
    expect(page).toContain('../js/nutricare.js');
    expect(page).toContain('../js/api-wrapper.js');
  });

  it('does not write to live database during read-only smoke tests', () => {
    expect(page).toContain("get('/logistik/resep'");
  });

  it('keeps SQL/data payload composition field server-side while user-facing UI removes it', () => {
    expect(read('../../../server/src/modules/rekomendasi.ts')).toContain('komposisi');
    const fields = page.slice(page.indexOf('var rekomFields = ['), page.indexOf('var rekomCols = ['));
    expect(fields).not.toContain('komposisi');
  });

  it('does not manually enter status in the recommendation form', () => {
    const fields = page.slice(page.indexOf('var rekomFields = ['), page.indexOf('var rekomCols = ['));
    expect(fields).not.toContain('Status');
  });

  it('uses only persisted recipe rows as dropdown options', () => {
    expect(page).toContain('var resepMenuRows = []');
    expect(page).toContain('resepMenuRows.reduce');
    expect(page).toContain('datalist: function () { return resepMenuOptions; }');
  });

  it('keeps recipe autocomplete typeable so names can be matched by text', () => {
    expect(shared).toContain('autocomplete="off"');
  });

  it('clear date control restores default hide-past behavior', () => {
    expect(shared).toContain("instance.dateValue = ''");
  });

  it('loads recipes before patient action opens the dialog', () => {
    expect(page).toContain('resepMenuReady.then(function ()');
  });

  it('does not auto-open recommendation dialog until user selects a patient action', () => {
    expect(page).toContain("label: 'Rekomendasikan menu'");
  });

  it('rejects unsupported texture prefill values less often by including patient textures', () => {
    expect(page).toContain('pasienStore.all().forEach(function (p) { if (p.tekstur');
  });

  it('pre-fills recommendation patient, texture and calorie target', () => {
    expect(page).toContain('pasien: r.nama');
    expect(page).toContain('tekstur: r.tekstur');
    expect(page).toContain('kalori: r.kalori ||');
  });

  it('shows selected older date title for an empty date result', () => {
    expect(shared).toContain('Tidak ada data pada tanggal ini');
  });

  it('uses local date string matching YYYY-MM-DD', () => {
    expect(shared).toContain('String(row[dateKey] || \'\') >= batasTanggal');
  });

  it('does not change recommendation state when filtering by date', () => {
    expect(shared).toContain('rows = rows.filter(function (row)');
    expect(shared).not.toContain('options.store.remove');
  });

  it('keeps all dates accessible after resetting date search', () => {
    expect(shared).toContain('data-date-clear');
    expect(shared).toContain("instance.dateValue = ''");
  });

  it('does not display reference menu action in recommendation modal', () => {
    expect(page).not.toContain('data-ref=');
  });

  it('stores the selected recipe menu as recommendation menu field', () => {
    expect(page).toContain("{ key: 'menu', label: 'Menu makan'");
  });

  it('will send newly created menu recommendation automatically', () => {
    expect(page).toContain("values.status = old ? old.status : 'Dikirim'");
  });

  it('does not include status as a popup field', () => {
    const fields = page.slice(page.indexOf('var rekomFields = ['), page.indexOf('var rekomCols = ['));
    expect(fields).not.toContain("key: 'status'");
  });

  it('provides exact date-based lookup for historical menus', () => {
    expect(page).toContain("dateFilter: { key: 'tanggal', label: 'Cari tanggal' }");
    expect(shared).toContain("String(row[dateKey] || '') === instance.dateValue");
  });

  it("gets the dietitian's recipe choices from the logistics recipes API", () => {
    expect(page).toContain("get('/logistik/resep'");
  });

  it('shows no manual composition field in the new form', () => {
    const fields = page.slice(page.indexOf('var rekomFields = ['), page.indexOf('var rekomCols = ['));
    expect(fields).not.toContain('komposisi');
  });

  it('hides expired recommendations by comparing ISO date strings', () => {
    expect(shared).toContain("String(row[dateKey] || '') >= batasTanggal");
  });

  it('does not use unavailable data for dietitian recommendation menu references', () => {
    expect(page).toContain('resepMenuReady');
  });

  it('does not recreate reference panel after rendering page', () => {
    expect(page).not.toContain('r-chips');
  });

  it('uses format date input for lookup', () => {
    expect(shared).toContain('<input type="date" data-date-filter');
  });

  it('only sends values defined in the form plus hidden derived fields', () => {
    expect(page).toContain('beforeSave: function (values, old)');
  });

  it('keeps all recommendations in store for history and search', () => {
    expect(shared).not.toContain('options.store.remove(row.id)');
  });

  it('triggers exact date search change event', () => {
    expect(shared).toContain("dateFilterInput.addEventListener('change'");
  });

  it('correctly resets date input after clear', () => {
    expect(shared).toContain("instance.dateValue = ''");
  });

  it('does not include ingredients details as an editable composition textarea', () => {
    expect(page).not.toContain("key: 'komposisi', label: 'Komposisi makanan'");
  });

  it('form copy explains automatic hiding of past recommendations', () => {
    expect(page).toContain('tanggalnya sudah lewat disembunyikan');
  });

  it('keeps source recipes independent from recommendations so logistics owns them', () => {
    expect(page).toContain("get('/logistik/resep'");
  });

  it('does not alter logistics recipe quantities on recommendation save', () => {
    expect(page).not.toContain('replaceMenuRecipe(');
  });

  it('only users with patient rows get a menu recommendation button', () => {
    expect(page).toContain("show: function (r) { return !!find(r.nama); }");
  });

  it('recommends existing recipe rather than arbitrary menu string', () => {
    expect(page).toContain("Pilih menu makan dari resep yang tersedia di logistik.");
  });

  it('uses recipe data to produce ingredient composition text behind the scenes', () => {
    expect(page).toContain('row.bahan +');
  });

  it('gets recipes through an endpoint the dietitian role can read', () => {
    expect(read('../../../server/src/routes/logistik.ts')).toContain("app.get('/resep'");
  });

  it('uses a confirmation dialog rather than page redirect for the recommendation form', () => {
    expect(page).toContain('rekom.open(null, {');
  });

  it('preserves the manually editable note to kitchen', () => {
    expect(page).toContain("key: 'catatan', label: 'Catatan untuk dapur'");
  });

  it('tracks current date selected without changing any recommendation data', () => {
    expect(shared).toContain('instance.dateValue = dateFilterInput.value');
  });

  it('no stale record is deleted when date filter changes', () => {
    expect(shared).toContain('instance.dateValue = dateFilterInput.value');
    expect(shared).not.toContain('options.store.remove');
  });

  it('does not accidentally bind the dietitian action to waiter or logistics', () => {
    expect(page).toContain("mount: '#crud-pasien'");
  });

  it('keeps status as read-only badge in the list', () => {
    expect(page).toContain("{ label: 'Status', render: function (r) { return NC.badge(r.status); } }");
  });

  it('autosends only new recommendations, not updates to existing rows', () => {
    expect(page).toContain("values.status = old ? old.status : 'Dikirim'");
  });

  it('does not keep the deleted reference warning notice', () => {
    expect(page).not.toContain('Sesuaikan dengan asesmen');
  });

  it('offers date filter with accessible screen-reader text', () => {
    expect(shared).toContain("escapeHtml(options.dateFilter.label || 'Tanggal')");
  });

  it('keeps future or today recommendations visible by default', () => {
    expect(shared).toContain("String(row[dateKey] || '') >= batasTanggal");
  });

  it('can show old recommendation at a selected date even when hidePast is set', () => {
    expect(shared).toContain('if (instance.dateValue) {');
    expect(shared).toContain('else if (options.hidePast)');
  });

  it('does not replace the existing menu recipe list with sample values', () => {
    expect(page).not.toContain("options: ['Nasi ayam kukus'");
  });

  it('keeps comment in simple Indonesian prose without em dash', () => {
    expect(shared).not.toContain('—');
  });

  it('does not use sample patient IDs in initial form data', () => {
    expect(page).not.toContain("pasien: '1'");
  });

  it('uses exact selected patient texture field rather than hardcoded substitute', () => {
    expect(page).toContain('tekstur: r.tekstur');
  });

  it('does not use homemade reference list from existing recommendations', () => {
    expect(page).not.toContain('var refs = rekomStore.all()');
  });

  it('uses a date picker rather than text search for exact date', () => {
    expect(shared).toContain('type="date"');
  });

  it('handles missing date field without including it in active recommendations', () => {
    expect(shared).toContain("String(row[dateKey] || '') >= batasTanggal");
  });

  it('does not use customer or patient-identifiable info in empty date error', () => {
    expect(shared).toContain('Tidak ada data pada tanggal ini');
  });

  it('does not touch user role routing for this form change', () => {
    expect(read('../../../js/api-adapter.js')).toContain('sessionRole');
  });

  it('only loads recipe names and ingredients for validation', () => {
    expect(page).toContain('resepMenuRows = Array.isArray(rows) ? rows : []');
  });

  it('does not put composition into recommendation menu options', () => {
    expect(page).toContain('name = String(row.menu || \'\').trim()');
  });

  it('does not make the completed current page active until user chooses action', () => {
    expect(page).toContain("window.location.hash = '#rekomendasi'");
  });

  it('keeps auto refresh updating the active recommendation list', () => {
    expect(shared).toContain('function notify()');
  });

  it('keeps the recommendation create endpoint and required stored fields', () => {
    expect(read('../../../server/src/routes/rekomendasi.ts')).toContain("app.post('/', async");
  });

  it('filters recommendations before sort and rendering', () => {
    expect(shared).toContain('var rows = getRows()');
    expect(shared).toContain('var rows = getRows');
  });

  it('keeps action button labels accessible', () => {
    expect(page).toContain("label: 'Rekomendasikan menu'");
  });

  it('uses actual API rows for menu suggestions', () => {
    expect(page).toContain('resepMenuRows.reduce');
  });

  it('sends all mandatory recommendation fields server-side', () => {
    expect(page).toContain("{ key: 'tanggal', label: 'Tanggal'");
    expect(page).toContain("{ key: 'waktu', label: 'Waktu makan'");
    expect(page).toContain("{ key: 'diet', label: 'Diet'");
  });

  it('only returns recipe rows after list endpoint authorization', () => {
    expect(read('../../../server/src/routes/logistik.ts')).toContain("requirePermission(u.role,'logistik','read')");
  });

  it('readOnly history no longer submits duplicate recommendation writes', () => {
    expect(page).toContain("mount: '#crud-riwayat'");
    expect(page).toContain('readOnly: true');
  });

  it('uses no dynamic selector from untrusted menu names', () => {
    expect(page).toContain('recipeComposition(values.menu)');
  });

  it('does not make status list filter the popup form status', () => {
    expect(page).toContain("filter: { label: 'Status'");
  });

  it('does not allow arbitrary menu recommendations', () => {
    expect(page).toContain("return 'Pilih menu makan dari resep yang tersedia di logistik.'");
  });

  it('keeps client side validation including patient restrictions', () => {
    expect(page).toContain('allergens(v.pasien)');
  });

  it('does not remove old recommendation row when showing empty future list', () => {
    expect(shared).toContain('rows = rows.filter(function (row)');
  });

  it('uses ISO string boundary, compatible with YYYY-MM-DD dates', () => {
    expect(shared).toContain("String(row[dateKey] || '') >= batasTanggal");
  });

  it('shows description when there are no current/future recommendations', () => {
    expect(page).toContain('Pilih tanggal tertentu untuk melihat rekomendasi yang sudah lewat.');
  });

  it('form supports plain text search for recipe matching', () => {
    expect(shared).toContain("escapeHtml(value) + '\"' + required + placeholder + ' list=\"'");
    expect(shared).toContain("escapeHtml(listId) + '\" autocomplete=\"off\">'");
  });

  it('uses recipe dropdown data options to initialize the form', () => {
    expect(page).toContain('datalist: function () { return resepMenuOptions; }');
  });

  it('does not collapse the existing clinical page theme', () => {
    expect(page).toContain('class="clinic"');
  });

  it('does not hide old records from report totals', () => {
    expect(page).toContain('var rek = rekomStore.all();');
  });

  it('stores status as Dikirim to trigger automatic kitchen preparation state', () => {
    expect(page).toContain("values.status = old ? old.status : 'Dikirim'");
  });

  it('does not show a manual composition text area in the modal', () => {
    const fields = page.slice(page.indexOf('var rekomFields = ['), page.indexOf('var rekomCols = ['));
    expect(fields).not.toContain('textarea');
  });

  it('exposes notes to kitchen but no composition textbox', () => {
    expect(page).toContain("{ key: 'catatan', label: 'Catatan untuk dapur'");
  });

  it('shows a date clear control after a date is selected', () => {
    expect(shared).toContain('(instance.dateValue ? \'<button type="button" class="btn btn-ghost btn-small" data-date-clear>Semua tanggal</button>\' : \'\')');
  });

  it('calls NC router after form action changes hash', () => {
    expect(page).toContain('NC.router(\'Ahli Gizi\')');
  });

  it('does not mark recommendation status automatically on edit to preserve existing state', () => {
    expect(page).toContain("values.status = old ? old.status : 'Dikirim'");
  });

  it('can edit old recommendation from date-filtered list only if user has rights', () => {
    expect(page).toContain('dateFilter: { key: \'tanggal\', label: \'Cari tanggal\' }');
  });

  it('reflects actual recipe menu on search autocomplete, not hardcoded options', () => {
    expect(page).toContain('resepMenuOptions');
  });

  it('stores recipe composition using recipe quantities per portion', () => {
    expect(page).toContain("row.jumlahPerPorsi + ' ' + row.satuan");
  });

  it('has no reference block that competes for layout width', () => {
    expect(page).not.toContain('<div class="grid-wide">\n                <section class="panel">\n                    <div class="panel-head">\n                        <div><h2>Daftar rekomendasi');
  });

  it('notes recommendation status is handled by automatic send', () => {
    expect(page).toContain("values.status = old ? old.status : 'Dikirim'");
  });

  it('does not pass stale patient personal details beyond required prefill', () => {
    const action = page.slice(page.indexOf("label: 'Rekomendasikan menu'"), page.indexOf("label: 'Detail'"));
    expect(action).toContain('pasien: r.nama');
    expect(action).toContain('tekstur: r.tekstur');
    expect(action).toContain('kalori: r.kalori');
  });

  it('restores date picker selection when CRUD rerenders', () => {
    expect(shared).toContain('value=\' +\n                    escapeHtml(instance.dateValue)');
  });

  it('does not accidentally hide a selected historic row because of default past filter', () => {
    const code = shared.slice(shared.indexOf('// Filter tanggal:'), shared.indexOf('if (options.sort)', shared.indexOf('// Filter tanggal:')));
    expect(code).toContain('if (instance.dateValue)');
    expect(code).toContain('else if (options.hidePast)');
  });

  it('will not let a missing API recipe source create a menu with no recipe', () => {
    expect(page).toContain('resepMenuOptions.some');
  });

  it('reads current recipes but never attempts to modify them while selecting', () => {
    const load = page.slice(page.indexOf('var resepMenuReady'), page.indexOf('function recipeComposition'));
    expect(load).toContain("get('/logistik/resep'");
    expect(load).not.toContain('put(');
    expect(load).not.toContain('post(');
  });

  it('keeps automatic notification and logistik handoff conditions defined by server', () => {
    expect(read('../../../server/src/modules/rekomendasi.ts')).toContain("if (row.status === 'Dikirim')");
  });

  it('maintains original route from active pages after appending date filter', () => {
    expect(shared).toContain('dateFilterInput.addEventListener');
  });

  it('does not use date format display string to compare ISO values', () => {
    expect(shared).toContain('String(row[dateKey] || \'\') >= batasTanggal');
  });

  it('showing a past recommendation requires a specific date', () => {
    const code = shared.slice(shared.indexOf('// Filter tanggal:'), shared.indexOf('if (options.sort)', shared.indexOf('// Filter tanggal:')));
    expect(code).toContain('if (instance.dateValue)');
  });

  it('button handles only patients with a valid full profile', () => {
    expect(page).toContain("show: function (r) { return !!find(r.nama); }");
  });

  it('does not include a form composition field in either CRUD interface', () => {
    const start = page.indexOf('var rekomFields = [');
    const end = page.indexOf('var rekomCols = [', start);
    expect(page.slice(start, end)).not.toContain('komposisi');
  });

  it('provides field selection and typed matching not just buttons', () => {
    expect(shared).toContain('datalist');
    expect(page).toContain('Ketik untuk mencari resep dapur');
  });

  it('lists recommendations sorted newest first after applying active filters', () => {
    expect(page).toContain('sort: function (a, b) { return b.tanggal.localeCompare(a.tanggal); }');
  });

  it('gives the user a recoverable error if a recommendation date has no entries', () => {
    expect(shared).toContain('Tidak ada data pada tanggal ini');
  });

  it('preserves separate date lookups and status chips in the toolbar', () => {
    expect(shared).toContain('data-date-filter');
    expect(shared).toContain('data-filter');
  });

  it('prevents selection of expired records when no date query exists', () => {
    expect(shared).toContain('options.hidePast');
  });

  it('does not remove dates from the data store during active list filtering', () => {
    expect(shared).not.toContain('options.store.remove(row.id)');
  });

  it('clears only date search and leaves other filters intact', () => {
    expect(shared).toContain("instance.dateValue = ''");
  });

  it('uses menu recipes owned by logistics to validate ingredient choice', () => {
    expect(page).toContain('recipeComposition(values.menu)');
  });

  it('route endpoint for menu recipe is protected by read permissions', () => {
    expect(read('../../../server/src/routes/logistik.ts')).toContain('requirePermission(u.role');
  });

  it('hides the old warning as part of reference panel removal', () => {
    expect(page).not.toContain('Sesuaikan dengan asesmen');
  });

  it('has current menu page section not references', () => {
    expect(page).toContain('Daftar rekomendasi');
  });

  it('removes default-draft status from recommendations UI and auto sends', () => {
    expect(page).toContain("values.status = old ? old.status : 'Dikirim'");
  });

  it('keeps records submitted as Dikirim, not Draf', () => {
    expect(page).toContain("values.status = old ? old.status : 'Dikirim'");
  });

  it('has browser native dropdown matching without additional external library', () => {
    expect(shared).toContain('datalist');
  });

  it('removes composition from history form as well', () => {
    const history = page.slice(page.indexOf("mount: '#crud-riwayat'"), page.indexOf('/* ---------- Tampilan turunan ---------- */'));
    expect(history).toContain('fields: rekomFields');
    expect(history).toContain('readOnly: true');
  });

  it('keeps existing menu patient status display badges', () => {
    expect(page).toContain('NC.badge(r.status)');
  });

  it('does not submit composition from a text input', () => {
    const fields = page.slice(page.indexOf('var rekomFields = ['), page.indexOf('var rekomCols = ['));
    expect(fields).not.toContain('komposisi');
  });

  it('avoids stale references from recommendations themselves', () => {
    expect(page).not.toContain('var refs');
  });

  it('maintains valid drop-down choices if patient texture is custom', () => {
    expect(page).toContain('p.tekstur && values.indexOf(p.tekstur) === -1');
  });

  it('accepts all patient textures even when no common preset matches', () => {
    expect(page).toContain("var values = ['Biasa', 'Lunak', 'Bubur', 'Cair']");
  });

  it('switches page to recommendation section on card action', () => {
    expect(page).toContain("window.location.hash = '#rekomendasi'");
  });

  it('calculates recommendation composition from exact chosen recipe rows', () => {
    expect(page).toContain("filter(function (row) { return row.menu === menu; })");
  });

  it('does not use free text menu composition for stock validation', () => {
    expect(page).toContain('recipeComposition(values.menu)');
  });

  it('does not create recipe data as side-effect when selecting a menu', () => {
    expect(page).not.toContain('replaceMenuRecipe');
  });

  it('on date change rerenders by selected date without issuing network request', () => {
    expect(shared).toContain('instance.dateValue = dateFilterInput.value');
    expect(shared).toContain('render();');
  });

  it('filters on exact string date, no timezone conversion', () => {
    expect(shared).toContain("String(row[dateKey] || '') === instance.dateValue");
  });

  it('does not remove old recommendation values from local cache', () => {
    expect(shared).toContain('rows = rows.filter(function (row)');
    expect(shared).not.toContain('options.store.remove');
  });

  it('lists menu recommendation status as automatically determined', () => {
    expect(page).toContain("{ label: 'Status', render: function (r) { return NC.badge(r.status); } }");
  });

  it('saves auto status for active recommendation creation path', () => {
    expect(page).toContain("values.status = old ? old.status : 'Dikirim'");
  });

  it('creates a menu recommendation only after user chooses a menu recipe', () => {
    expect(page).toContain("if (!resepMenuOptions.some(function (menu) { return menu === v.menu; }))");
  });

  it('includes exactly the requested patient prefill fields', () => {
    const action = page.slice(page.indexOf("label: 'Rekomendasikan menu'"), page.indexOf("label: 'Detail'"));
    expect(action).toContain('pasien: r.nama');
    expect(action).toContain("tekstur: r.tekstur && r.tekstur !== '-' ? r.tekstur : ''");
    expect(action).toContain('kalori: r.kalori ||');
  });

  it('source of recipe choices is the logistik recipes route', () => {
    expect(page).toContain("get('/logistik/resep'");
  });

  it('uses native calendar date search on recommendations', () => {
    expect(shared).toContain('data-date-filter');
  });

  it('does not create a new patient or recommendation during component initialization', () => {
    expect(page).not.toContain("rekomStore.add({");
  });

  it('only saves recommendations after form submit', () => {
    expect(shared).toContain("form.addEventListener('submit', saveForm)");
  });

  it('ensures older recommendations can be reviewed without showing them in active default list', () => {
    expect(page).toContain("label: 'Cari tanggal'");
    expect(page).toContain('hidePast: true');
  });

  it('does not reintroduce separate reference panel layout', () => {
    expect(page).not.toContain('r-chips');
  });

  it('prevents autocomplete XSS by escaping recipe labels', () => {
    expect(shared).toContain('escapeHtml(option)');
  });

  it('refuses to run action for pantangan-only rows without matching patient', () => {
    expect(page).toContain('show: function (r) { return !!find(r.nama); }');
  });

  it('uses auto status injection before store add', () => {
    const save = shared.slice(shared.indexOf('if (options.beforeSave)'), shared.indexOf('var validation = options.validate'));
    expect(save).toContain('preparedValues');
  });

  it('does not replace recommendation status during update', () => {
    expect(page).toContain("values.status = old ? old.status : 'Dikirim'");
  });

  it('does not remove stale rows from recommendation store when filtering dates', () => {
    const filter = shared.slice(shared.indexOf('// Filter tanggal:'), shared.indexOf('if (options.sort)', shared.indexOf('// Filter tanggal:')));
    expect(filter).not.toContain('splice');
    expect(filter).not.toContain('remove');
  });

  it('keeps history menu records visible even if older than today', () => {
    expect(page).toContain("mount: '#crud-riwayat'");
    expect(page).toContain('readOnly: true');
  });

  it('offers a separate date route in the recommendation page', () => {
    expect(page).toContain("dateFilter: { key: 'tanggal', label: 'Cari tanggal' }");
  });

  it('has no status select in new recommendation fields', () => {
    const fields = page.slice(page.indexOf('var rekomFields = ['), page.indexOf('var rekomCols = ['));
    expect(fields).not.toContain("type: 'select', required: true, options: ['Draf'");
  });

  it('sends selected recommendation data with hidden status value', () => {
    expect(page).toContain("values.status = old ? old.status : 'Dikirim'");
  });

  it('leaves daily menu schedule handoff to existing backend', () => {
    expect(read('../../../server/src/modules/rekomendasi.ts')).toContain('syncRecommendationSchedule(client, recommendation)');
  });

  it('uses a listbox tied to editable text for matching recipe names', () => {
    expect(shared).toContain("' list=\"' + escapeHtml(listId) + '\"'");
  });

  it('shows readable calendar search copy', () => {
    expect(page).toContain('Cari tanggal');
  });

  it('includes past recommendations only when user selects their date', () => {
    const active = shared.slice(shared.indexOf('// Filter tanggal:'), shared.indexOf('if (options.sort)', shared.indexOf('// Filter tanggal:')));
    expect(active).toContain('instance.dateValue');
    expect(active).toContain('options.hidePast');
  });

  it('uses date search to inspect an exact past date', () => {
    expect(shared).toContain("String(row[dateKey] || '') === instance.dateValue");
  });

  it('keeps references out of the recommendation page', () => {
    expect(page).not.toContain('r-chips');
  });

  it("autofills current patient's texture even if data is outside preset values", () => {
    expect(page).toContain('var values = [\'Biasa\', \'Lunak\', \'Bubur\', \'Cair\']');
  });

  it('has no manual status or composition controls in recommendation form', () => {
    const fields = page.slice(page.indexOf('var rekomFields = ['), page.indexOf('var rekomCols = ['));
    expect(fields).not.toContain('status');
    expect(fields).not.toContain('komposisi');
  });

  it('hides the past recommendations rather than deleting them', () => {
    expect(shared).toContain('options.hidePast');
    expect(shared).toContain('rows = rows.filter');
  });

  it('preserves patient data card restriction details while adding action', () => {
    expect(page).toContain('r.pantangan');
    expect(page).toContain('r.alergi');
  });

  it('loads menu recipes but not recipe writes', () => {
    expect(page).toContain("get('/logistik/resep'");
    expect(page).not.toContain('replaceMenuRecipe');
  });

  it('allows select option list to be refreshed on render', () => {
    expect(shared).toContain('fieldOptions(field)');
  });

  it('does not make status update before user saves recommendation', () => {
    expect(page).toContain("values.status = old ? old.status : 'Dikirim'");
  });

  it('does not add code to package backend for a static UI change', () => {
    expect(page).toContain('data-date-filter');
  });

  it('supports a previous or past date lookup through date input value binding', () => {
    expect(shared).toContain("escapeHtml(instance.dateValue) + '\"></label>'");
  });

  it('uses `Dikirim` not `Draf` for automatically sent recommendation', () => {
    expect(page).toContain("values.status = old ? old.status : 'Dikirim'");
  });

  it('does not display field `komposisi` or `status` in recommendation modal', () => {
    const fields = page.slice(page.indexOf('var rekomFields = ['), page.indexOf('var rekomCols = ['));
    expect(fields).not.toContain('komposisi');
    expect(fields).not.toContain('status');
  });

  it('uses only date filtering to show old recommendations', () => {
    expect(page).toContain("label: 'Cari tanggal'");
  });

  it('uses only the actual recipe API rows', () => {
    expect(page).toContain('resepMenuRows = Array.isArray(rows) ? rows : []');
  });

  it('does not insert a new recommendation until form submit', () => {
    expect(shared).toContain('form.addEventListener(\'submit\', saveForm)');
  });

  it('has no stale old panel contents', () => {
    expect(page).not.toContain('Referensi menu');
    expect(page).not.toContain('Sesuaikan dengan asesmen');
  });

  it('prefill recommendation popup route and form are available', () => {
    expect(page).toContain("window.location.hash = '#rekomendasi'");
    expect(page).toContain('rekom.open(null, {');
  });

  it('status field is not required in active form but is shown in existing recommendation list', () => {
    const fields = page.slice(page.indexOf('var rekomFields = ['), page.indexOf('var rekomCols = ['));
    expect(fields).not.toContain('status');
    expect(page).toContain('NC.badge(r.status)');
  });

  it('does not invoke hardcoded reference list handler', () => {
    expect(page).not.toContain('data-ref');
  });

  it('shows recipe autocomplete separately from patient fields', () => {
    expect(page).toContain('Ketik untuk mencari resep dapur');
  });

  it('lets user view recommendations from previous date with exact picker', () => {
    expect(shared).toContain('<input type="date" data-date-filter');
    expect(page).toContain("dateFilter: { key: 'tanggal', label: 'Cari tanggal' }");
  });

  it('auto sends by assigning Dikirim in the create payload', () => {
    expect(page).toContain("values.status = old ? old.status : 'Dikirim'");
  });

  it('keeps menu recipe rows as full resource data, not free text to include composition', () => {
    expect(page).toContain('recipeComposition(values.menu)');
  });

  it('forces exact match of selected recipe name', () => {
    expect(page).toContain('return menu === v.menu');
  });

  it('renders button only on ahli gizi cards', () => {
    expect(page).toContain("mount: '#crud-pasien'");
    expect(page).toContain("label: 'Rekomendasikan menu'");
  });

  it('does not expose recipe composition in popup modal', () => {
    const fields = page.slice(page.indexOf('var rekomFields = ['), page.indexOf('var rekomCols = ['));
    expect(fields).not.toContain('komposisi');
  });

  it('supports search by typing menu recipe', () => {
    expect(shared).toContain('datalist');
    expect(page).toContain("placeholder: 'Ketik untuk mencari resep dapur'");
  });

  it('has no missing CSS rule for date input because it shares filter control styling', () => {
    expect(read('../../../css/hms-clinic.css')).toContain('.crud-filter input[type="date"]');
  });

  it('uses actual route to load read-only menu recipe choices', () => {
    expect(read('../../../server/src/routes/logistik.ts')).toContain("app.get('/resep'");
  });

  it('prevents free text recipe mismatches before submitting', () => {
    expect(page).toContain('resepMenuOptions.some(function (menu) { return menu === v.menu; })');
  });

  it('does not remove or write recommendations in date filtering code', () => {
    const filter = shared.slice(shared.indexOf('// Filter tanggal:'), shared.indexOf('if (options.sort)', shared.indexOf('// Filter tanggal:')));
    expect(filter).not.toContain('remove');
    expect(filter).not.toContain('delete');
  });

  it('updates date-filter state from native change event', () => {
    expect(shared).toContain('instance.dateValue = dateFilterInput.value');
  });

  it('uses the existing API only for reading recipe names and composition rows', () => {
    expect(page).toContain('window.NutriCareAPI.get');
  });

  it('does not show manual recipe composition', () => {
    const fields = page.slice(page.indexOf('var rekomFields = ['), page.indexOf('var rekomCols = ['));
    expect(fields).not.toContain('textarea');
  });

  it('does not show manual status field', () => {
    const fields = page.slice(page.indexOf('var rekomFields = ['), page.indexOf('var rekomCols = ['));
    expect(fields).not.toContain('status');
  });

  it('does not include manual menu name field free-text without a datalist', () => {
    expect(page).toContain('datalist: function () { return resepMenuOptions; }');
  });

  it('supports select by name from dropdown options with typing', () => {
    expect(shared).toContain('list="');
    expect(shared).toContain('autocomplete="off"');
  });

  it('supports date-filter clearing and persisted value across render', () => {
    expect(shared).toContain('data-date-clear');
    expect(shared).toContain('value=\' +\n                    escapeHtml(instance.dateValue)');
  });

  it('shows past recommendation date filter at correct page only', () => {
    expect(page).toContain('hidePast: true');
    expect(page).toContain("mount: '#crud-rekom'");
  });

  it('does not show the reference content panel in the HTML', () => {
    expect(page).not.toContain('r-chips');
  });

  it('maintains existing patient profile fields on the new button', () => {
    expect(page).toContain('pasien: r.nama');
  });

  it('keeps content in new modal with appropriate name', () => {
    expect(page).toContain("label: 'Menu makan'");
  });

  it('continues to calculate composition from source recipe exact name', () => {
    expect(page).toContain('recipeComposition(menu)');
  });

  it('sends automatically after saving new recommendation via status', () => {
    expect(page).toContain("values.status = old ? old.status : 'Dikirim'");
  });

  it('will not change stock amounts by only choosing a recipe', () => {
    expect(page).not.toContain('stockMovement');
  });

  it("keeps the user's store semantics and date sort", () => {
    expect(page).toContain('b.tanggal.localeCompare(a.tanggal)');
  });

  it('has separate history route intact but only read-only', () => {
    const history = page.slice(page.indexOf("mount: '#crud-riwayat'"), page.indexOf('/* ---------- Tampilan turunan ---------- */'));
    expect(history).toContain('readOnly: true');
  });

  it('does not include status dropdown options for recommendation entry', () => {
    const fields = page.slice(page.indexOf('var rekomFields = ['), page.indexOf('var rekomCols = ['));
    expect(fields).not.toContain('options: [\'Draf\'');
  });

  it('only filters recommendations by exact selected ISO date', () => {
    expect(shared).toContain("String(row[dateKey] || '') === instance.dateValue");
  });

  it('uses current page time boundary for hiding old recommendation dates', () => {
    expect(shared).toContain('var batasTanggal = day(0)');
  });

  it('empty date filter keeps date-selection action easy to discover', () => {
    expect(page).toContain('Cari tanggal');
  });

  it('loads each recipe row with a stable menu name and ingredient list', () => {
    expect(page).toContain('resepMenuRows');
    expect(page).toContain('row.bahan');
  });

  it('a patient action cannot get full details into the recommendation input beyond requested fields', () => {
    const action = page.slice(page.indexOf("label: 'Rekomendasikan menu'"), page.indexOf("label: 'Detail'"));
    expect(action).toContain('pasien: r.nama');
    expect(action).toContain('tekstur: r.tekstur');
    expect(action).toContain('kalori: r.kalori');
    expect(action).not.toContain('diagnosis:');
  });

  it('only uses date filter options on rekom CRUD', () => {
    const active = page.slice(page.indexOf("mount: '#crud-rekom'"), page.indexOf('/* ---------- CRUD: jadwal ---------- */'));
    expect(active).toContain('hidePast: true');
    expect(active).toContain('dateFilter');
  });

  it("uses the field's option list to validate selected recipe name exactly", () => {
    expect(page).toContain("if (!resepMenuOptions.some(function (menu) { return menu === v.menu; }))");
  });

  it('does not interfere with global notification panel', () => {
    expect(page).toContain('notification-center');
  });

  it('does not use browser window alert for recipe validation', () => {
    expect(page).toContain('return \'Pilih menu makan dari resep yang tersedia di logistik.\'');
  });

  it('has one input form instance opened only on explicit add or patient action', () => {
    expect(page).toContain('rekom.open(null, {');
  });

  it('uses form defaults to initialize the meal date', () => {
    expect(page).toContain("default: function () { return today; }");
  });

  it('makes all selection-only menu input values escaped', () => {
    expect(shared).toContain('escapeHtml(option)');
  });

  it("uses patient's calorie target as an editable numeric value", () => {
    expect(page).toContain("label: 'Target kalori (kkal)'");
  });

  it("uses patient's texture choice as editable select value", () => {
    expect(page).toContain("label: 'Tekstur'");
  });

  it('does not assume all list history records are active', () => {
    expect(page).toContain('hidePast: true');
  });

  it('has menu reference panel removed and page title retained', () => {
    expect(page).toContain('Rekomendasi menu');
    expect(page).not.toContain('Referensi menu');
  });

  it('stores only recipe selected to recommendation menu, not a typed arbitrary value', () => {
    expect(page).toContain("menu === v.menu");
  });

  it('uses `catatan` only as optional note from clinician', () => {
    expect(page).toContain('catatan');
  });

  it('does not show status input when adding from patient card', () => {
    expect(page).not.toContain("{ key: 'status', label: 'Status'");
  });

  it('does not show composition input when adding from patient card', () => {
    expect(page).not.toContain("{ key: 'komposisi', label: 'Komposisi makanan'");
  });

  it('does not erase reference to historical menus from past recommendation records', () => {
    expect(page).toContain('store: rekomStore');
  });

  it('does not derive recipes from recommendation reference chips', () => {
    expect(page).not.toContain("var refs = rekomStore.all().reduce");
  });

  it('menu search is accessible and explicit in input placeholder', () => {
    expect(page).toContain("placeholder: 'Ketik untuk mencari resep dapur'");
  });

  it('has date picker for historical rows and reset button', () => {
    expect(shared).toContain('data-date-filter');
    expect(shared).toContain('data-date-clear');
  });

  it('does not send data to kitchen when form is opened but not saved', () => {
    expect(shared).toContain('function saveForm(event)');
    expect(shared).toContain('formDialog.close(\'saved\')');
  });

  it('does not automatically create meal recommendation before explicit user entry', () => {
    expect(page).not.toContain('rekomStore.add(');
  });

  it('will only send new recommendations after valid recipe and patient choices', () => {
    expect(page).toContain("if (!resepMenuOptions.some(function (menu) { return menu === v.menu; }))");
  });

  it('does not mutate patient data from button click', () => {
    expect(page).toContain("window.location.hash = '#rekomendasi'");
    expect(page).not.toContain('pasienStore.update(');
  });

  it('uses exact matching menu name for stored recipe composition', () => {
    expect(page).toContain("filter(function (row) { return row.menu === menu; })");
  });

  it('does not modify existing patients during prefill', () => {
    expect(page).toContain('pasien: r.nama');
    expect(page).not.toContain('pasienStore.update(r.id');
  });

  it('shows ingredients in server payload without exposing them as a form control', () => {
    expect(page).toContain('values.komposisi = recipeComposition(values.menu)');
    const fields = page.slice(page.indexOf('var rekomFields = ['), page.indexOf('var rekomCols = ['));
    expect(fields).not.toContain('komposisi');
  });

  it('does not show the reference warning notice', () => {
    expect(page).not.toContain('Sesuaikan dengan asesmen');
  });

  it('allows only one record per selected date query', () => {
    expect(shared).toContain("String(row[dateKey] || '') === instance.dateValue");
  });

  it('provides no status selection in new recommendation form but keeps server status badge', () => {
    expect(page).toContain("values.status = old ? old.status : 'Dikirim'");
    expect(page).toContain("NC.badge(r.status)");
  });

  it('menyediakan aksi dari kartu pasien dan mengisi pasien, tekstur, serta target kalori', () => {
    expect(page).toContain("label: 'Rekomendasikan menu'");
    expect(page).toContain('tekstur: r.tekstur');
    expect(page).toContain('kalori: r.kalori');
  });

  it('tidak meminta komposisi atau status manual dan mengirim rekomendasi sebagai Dikirim', () => {
    expect(page).not.toContain("label: 'Komposisi makanan'");
    expect(page).not.toContain("label: 'Status', type: 'select', required: true, options: ['Draf', 'Dikirim', 'Evaluasi']");
    expect(page).toContain("status: 'Dikirim'");
    expect(page).toContain('function recipeComposition');
  });

  it('menyembunyikan rekomendasi tanggal lampau secara default, tetapi tetap dapat dicari berdasarkan tanggal', () => {
    expect(page).toContain('hidePast: true');
    expect(page).toContain("dateFilter: { key: 'tanggal', label: 'Cari tanggal' }");
    expect(shared).toContain('data-date-filter');
  });
});
