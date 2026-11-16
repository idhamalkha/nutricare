import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const menuPage = read('../../../pages/dapur.html');
const menuController = read('../../../js/dapur.js');
const recommendationsPage = read('../../../pages/ahli-gizi.html');
const recommendationModule = read('../../src/modules/rekomendasi.ts');
const logisticsModule = read('../../src/modules/logistik.ts');
const seed = read('../../seeds/master-menu.mjs');

const tableFields = (source: string, table: string) => {
  const start = source.indexOf(`var ${table}Fields = [`);
  const end = source.indexOf(`var ${table}Cols = [`, start);
  return source.slice(start, end);
};

const recommendationFields = tableFields(recommendationsPage, 'rekom');
const menuPackageFixture = seed.slice(seed.indexOf('export const PAKET = ['), seed.indexOf('/* ------------------------------------------------------------------------- */', seed.indexOf('export const PAKET = [')));

describe('diet dan tekstur sebagai atribut menu paket', () => {
  it('menampilkan status pengiriman sebagai proses hingga persiapan siap', () => {
    const preparationRenderer = menuController.slice(menuController.indexOf('function renderPersiapan'), menuController.indexOf('function renderJadwalMasak'));
    expect(preparationRenderer).toContain("return item.status === 'Dikirim'");
    expect(preparationRenderer).toContain("const isReady = prep && /selesai/i.test(prep.status)");
    expect(preparationRenderer).toContain("isReady ? badge('Sudah siap') : badge('Dalam proses')");
    const detailRenderer = menuController.slice(menuController.indexOf('function openPesananModal'), menuController.indexOf('function closePesananModal'));
    expect(detailRenderer).toContain("rows.push(['Status', badge(displayStatus)])");
    expect(detailRenderer).not.toContain("badge(item.status)");
    expect(detailRenderer).toContain("const displayStatus = isDone ? 'Sudah siap' : 'Dalam proses'");
    expect(menuController).toContain("button.dataset.prepStatus");
    expect(menuController).toContain("patchReq('/api/logistik/persiapan/' + encodeURIComponent(waktu)");
    expect(menuController).toContain("data-prep-status=\"Selesai\"");
  });

  it('menyediakan pilihan diet dan tekstur di form menu paket', () => {
    expect(menuPage).toContain('id="menu-diet-input"');
    expect(menuPage).toContain('id="menu-tekstur-input"');
    expect(menuPage).toContain('<th>DIET</th>');
    expect(menuPage).toContain('<th>TEKSTUR</th>');
    expect(menuController).toContain("esc(m.diet || '-') + '</td>'");
    expect(menuController).toContain("esc(m.tekstur || '-') + '</td>'");
    expect(menuPage).toContain('colspan="6"');
    expect(menuController).toContain("const diet = document.getElementById('menu-diet-input').value;");
    expect(menuController).toContain("const tekstur = document.getElementById('menu-tekstur-input').value;");
    expect(menuController).toContain("post('/api/logistik/menu', { nama, deskripsi, diet, tekstur, resepList })");
    expect(menuController).toContain("patchReq('/api/logistik/menu/' + _menuEditId, { nama, deskripsi, diet, tekstur, resepList })");
  });

  it('mengembalikan diet dan tekstur dalam daftar menu paket', () => {
    const listFunction = logisticsModule.slice(logisticsModule.indexOf('export async function listMenuPaket'), logisticsModule.indexOf('export async function createMenuPaket'));
    expect(listFunction).toContain('mp.diet');
    expect(listFunction).toContain('mp.tekstur');
    expect(listFunction).toContain('diet: x.diet');
    expect(listFunction).toContain('tekstur: x.tekstur');
    expect(listFunction).toContain('GROUP BY mp.id, mp.nama, mp.deskripsi, mp.diet, mp.tekstur');
  });

  it('menyediakan nilai menu untuk sinkronisasi async di form rekomendasi', () => {
    expect(recommendationsPage).toContain('menuPaketDietMap[m.nama] = m.diet');
    expect(recommendationsPage).toContain('menuPaketTeksturMap[m.nama] = m.tekstur');
    expect(recommendationsPage).toContain('menuPaketKaloriMap[m.nama] = Number(m.totalKalori) || 0');
    expect(recommendationsPage).toContain('menuPaketReady.then(syncMenuAttributes)');
  });

  it('mengunci diet, tekstur, dan kalori pada atribut menu terpilih', () => {
    const binder = recommendationsPage.slice(recommendationsPage.indexOf('function bindMenuPaketAutoFill'), recommendationsPage.indexOf('var rekomFields = ['));
    expect(binder).toContain('dietInput.readOnly = true');
    expect(binder).toContain('teksturInput.readOnly = true');
    expect(binder).toContain('menuPaketDietMap[menu]');
    expect(binder).toContain('menuPaketTeksturMap[menu]');
    expect(binder).toContain('menuPaketKaloriMap[menu]');
  });

  it('menjadikan atribut rekomendasi readonly, bukan select manual', () => {
    expect(recommendationFields).toContain("{ key: 'diet', label: 'Diet', type: 'text', required: true, readOnly: true");
    expect(recommendationFields).toContain("{ key: 'tekstur', label: 'Tekstur', type: 'text', required: true, readOnly: true");
    expect(recommendationFields).not.toContain("key: 'diet', label: 'Diet', type: 'select'");
    expect(recommendationFields).not.toContain("key: 'tekstur', label: 'Tekstur', type: 'select'");
  });

  it('menyimpan dan memvalidasi atribut menu pada create dan update backend', () => {
    const createFunction = logisticsModule.slice(logisticsModule.indexOf('export async function createMenuPaket'), logisticsModule.indexOf('export async function updateMenuPaket'));
    const updateFunction = logisticsModule.slice(logisticsModule.indexOf('export async function updateMenuPaket'), logisticsModule.indexOf('export async function deleteMenuPaket'));
    expect(createFunction).toContain("const diet = String(d.diet || '').trim()");
    expect(createFunction).toContain("const tekstur = String(d.tekstur || '').trim()");
    expect(createFunction).toContain('INSERT INTO menu_paket(nama,deskripsi,diet,tekstur)');
    expect(updateFunction).toContain('diet=$3,tekstur=$4');
    expect(updateFunction).toContain("const diet = String(d.diet || '').trim()");
    expect(updateFunction).toContain("const tekstur = String(d.tekstur || '').trim()");
    expect(updateFunction).toContain('RETURNING id,nama,deskripsi,diet,tekstur');
    expect(updateFunction).toContain('diet,');
    expect(updateFunction).toContain('tekstur,');
  });

  it('memetakan menu yang dikenal secara eksplisit, tidak menebak dari nama', () => {
    const migration = read('../../../supabase/migrations/20261116000011_menu_package_diet_texture.sql');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS diet');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS tekstur');
    expect(migration).toContain('UPDATE menu_paket');
    expect(migration).toContain("DEFAULT 'Diet Normal'");
    expect(migration).toContain("DEFAULT 'Biasa'");
    expect(migration).toContain('COALESCE(diet,');
    expect(migration).not.toContain('FROM (VALUES');
    expect(migration).not.toContain('lower(nama) LIKE');
    expect(migration).not.toContain('UPDATE rekomendasi_menu');
    expect(menuPackageFixture).toContain('Bubur Pagi Rumah Sakit');
    expect(menuPackageFixture).toContain('Sehat Sempurna');
  });

  it('menurunkan diet, tekstur, dan kalori server-side dari menu', () => {
    const createFunction = recommendationModule.slice(recommendationModule.indexOf('export async function createRekomendasi'), recommendationModule.indexOf('export async function updateRekomendasi'));
    const updateFunction = recommendationModule.slice(recommendationModule.indexOf('export async function updateRekomendasi'), recommendationModule.indexOf('export async function deleteRekomendasi'));
    expect(createFunction).toContain('resolveMenuPackageAttributes(data.menu)');
    expect(createFunction).toContain('data.diet = menuAttributes.diet');
    expect(createFunction).toContain('data.tekstur = menuAttributes.tekstur');
    expect(createFunction).toContain('data.kalori = menuAttributes.kalori');
    expect(updateFunction).toContain('resolveMenuPackageAttributes(data.menu)');
    expect(updateFunction).toContain('data.diet = finalMenuAttributes.diet');
    expect(updateFunction).toContain('data.tekstur = finalMenuAttributes.tekstur');
    expect(updateFunction).toContain('data.kalori = finalMenuAttributes.kalori');
    expect(updateFunction).toContain('data.diet !== undefined');
    expect(updateFunction).toContain('data.tekstur !== undefined');
    expect(updateFunction).toContain('data.kalori !== undefined');
  });

  it('menimpa nilai klien pada create dan update rekomendasi', () => {
    const createFunction = recommendationModule.slice(recommendationModule.indexOf('export async function createRekomendasi'), recommendationModule.indexOf('export async function updateRekomendasi'));
    const updateFunction = recommendationModule.slice(recommendationModule.indexOf('export async function updateRekomendasi'), recommendationModule.indexOf('export async function deleteRekomendasi'));
    expect(createFunction).toContain('data.diet = menuAttributes.diet');
    expect(createFunction).toContain('data.tekstur = menuAttributes.tekstur');
    expect(createFunction).toContain('data.kalori = menuAttributes.kalori');
    expect(updateFunction).toContain('data.diet = finalMenuAttributes.diet');
    expect(updateFunction).toContain('data.tekstur = finalMenuAttributes.tekstur');
    expect(updateFunction).toContain('data.kalori = finalMenuAttributes.kalori');
  });

  it('tidak memperbarui rekomendasi historis secara retroaktif', () => {
    expect(recommendationModule).not.toContain('UPDATE rekomendasi_menu SET diet');
  });

  it('migration tidak mengubah snapshot rekomendasi historis', () => {
    const migration = read('../../../supabase/migrations/20261116000011_menu_package_diet_texture.sql');
    expect(migration).not.toContain('UPDATE rekomendasi_menu');
  });
});
