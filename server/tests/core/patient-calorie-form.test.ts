import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const perawat = read('../../../js/perawat.js');
const patientController = perawat.slice(perawat.indexOf('function patientFormIntro'), perawat.indexOf('function restrictionFor'));
const formulaSource = perawat.slice(perawat.indexOf('function estimateDailyCalories'), perawat.indexOf('function bindPatientForm'));
const ahliGizi = read('../../../pages/ahli-gizi.html');
const shared = read('../../../js/nutricare.js');

describe('perhitungan kalori pada formulir pasien dan rekomendasi', () => {
  it('menghitung kebutuhan kalori pasien dewasa dengan rumus Mifflin-St Jeor dan faktor aktivitas', () => {
    expect(perawat).toContain('function estimateDailyCalories');
    expect(formulaSource).toContain('10 * weight + 6.25 * height - 5 * age');
    expect(perawat).toContain('activityFactor');
    expect(perawat).toContain('return Math.round(bmr * activityFactor);');
  });

  it('menghasilkan estimasi Mifflin-St Jeor dan menolak input belum lengkap atau usia anak', () => {
    const estimate = new Function(`${formulaSource}; return estimateDailyCalories;`)();
    expect(estimate(30, 70, 175, 'Laki-laki', 1.2)).toBe(1979);
    expect(estimate(30, 70, 175, 'Perempuan', 1.2)).toBe(1779);
    expect(estimate(17, 70, 175, 'Laki-laki', 1.2)).toBeNull();
    expect(estimate(30, 70, 175, '', 1.2)).toBeNull();
  });

  it('mengunci kalori dewasa dan memperbaruinya saat data antropometri, seks, atau aktivitas berubah', () => {
    expect(patientController).toContain('[ageInput, weightInput, heightInput, sexInput, activityInput].forEach(function (input)');
    expect(patientController).toContain('calorieInput.readOnly = true');
    expect(perawat).toContain("readOnly: true, min: 500, max: 5000");
  });

  it('mengarahkan pasien di bawah 18 tahun ke penetapan kalori ahli gizi', () => {
    expect(patientController).toContain('Perlu ditetapkan ahli gizi');
    expect(patientController).toContain("if (Number(ageInput.value) < 18 && ageInput.value !== '')");
    expect(perawat).toContain('tidak dihitung dengan rumus dewasa. Minta ahli gizi menetapkan kebutuhan kalori sebelum pasien didaftarkan.');
  });

  it('menggunakan level aktivitas yang disetujui untuk pasien dewasa', () => {
    expect(perawat).toContain("{ value: '1.2', label: 'Sangat ringan (1,2)' }");
    expect(perawat).toContain("{ value: '1.375', label: 'Ringan (1,375)' }");
    expect(perawat).toContain("{ value: '1.55', label: 'Sedang (1,55)' }");
    expect(perawat).toContain("{ value: '1.725', label: 'Berat (1,725)' }");
    expect(perawat).toContain("{ value: '1.9', label: 'Sangat berat (1,9)' }");
  });

  it('mengunci kalori rekomendasi dan mengambil nilainya dari menu paket terpilih', () => {
    const fieldsStart = ahliGizi.indexOf('var rekomFields = [');
    const fieldsEnd = ahliGizi.indexOf('var rekomCols = [', fieldsStart);
    const fields = ahliGizi.slice(fieldsStart, fieldsEnd);
    expect(fields).toContain("key: 'kalori'");
    expect(fields).toContain('readOnly: true');
    expect(ahliGizi).toContain("kaloriInput.readOnly = true");
    expect(ahliGizi).toContain('menuPaketKaloriMap[menuSel.value]');
  });

  it('renderer bersama menghormati properti readOnly pada field formulir', () => {
    expect(shared).toContain("var readOnly = field.readOnly ? ' readonly' : '';");
    expect(shared).toContain("+ required + readOnly + min + max + placeholder");
  });
});
