import { describe, expect, it } from 'vitest';
import { serializeRekomendasi } from '../../src/serializers/index.js';

describe('serialisasi rekomendasi untuk cetak dapur', () => {
  it('menyertakan ruangan pasien dalam data rekomendasi', () => {
    const result = serializeRekomendasi({
      id: 42,
      tanggal: '2026-11-06',
      pasien_nama: 'Pasien QA',
      ruangan: 'Anggrek 02',
      waktu: 'Sarapan',
      tekstur: 'Lunak',
      kalori: 500,
      diet: 'Diet Normal',
      menu: 'Bubur ayam',
      komposisi: 'Beras 100 g',
      catatan: 'Tanpa sambal',
      status: 'Dikirim',
    });

    expect(result).toMatchObject({
      id: '42',
      tanggal: '2026-11-06',
      pasien: 'Pasien QA',
      ruangan: 'Anggrek 02',
      waktu: 'Sarapan',
      tekstur: 'Lunak',
      kalori: 500,
      diet: 'Diet Normal',
      menu: 'Bubur ayam',
      komposisi: 'Beras 100 g',
      catatan: 'Tanpa sambal',
      status: 'Dikirim',
    });
  });
});
