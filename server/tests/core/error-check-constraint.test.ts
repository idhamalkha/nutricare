import { describe, it, expect } from 'vitest';
import { formatError } from '../../src/http/errors.js';

// Pesan galat check constraint harus menyebut kolom dan nilai yang diizinkan,
// supaya pengguna tahu apa yang harus diperbaiki (bukan pesan generik).
function checkError(constraint: string) {
  const err: any = new Error('new row violates check constraint');
  err.code = '23514';
  err.constraint = constraint;
  return formatError(err);
}

describe('formatError - check constraint', () => {
  it('menerjemahkan aturan status pasien', () => {
    const hasil = checkError('pasien_status_check');
    expect(hasil.statusCode).toBe(422);
    expect(hasil.body.code).toBe('VALIDATION');
    expect(hasil.body.message).toContain('Status pasien');
    expect(hasil.body.message).toContain('Aktif');
    expect((hasil.body as any).field).toBe('status');
  });

  it('menerjemahkan batas kalori pasien', () => {
    const hasil = checkError('pasien_kalori_check');
    expect(hasil.body.message).toContain('500');
    expect(hasil.body.message).toContain('5000');
    expect((hasil.body as any).field).toBe('kalori');
  });

  it('menerjemahkan tekstur makanan', () => {
    const hasil = checkError('rekomendasi_menu_tekstur_check');
    expect(hasil.body.message).toContain('Bubur');
    expect((hasil.body as any).field).toBe('tekstur');
  });

  it('tetap memberi pesan umum untuk aturan yang belum dikenal', () => {
    const hasil = checkError('aturan_baru_yang_belum_dipetakan');
    expect(hasil.statusCode).toBe(422);
    expect(hasil.body.message).toBe('Nilai tidak diizinkan untuk kolom ini.');
    expect((hasil.body as any).field).toBeUndefined();
  });

  it('tidak membocorkan pesan mentah PostgreSQL', () => {
    const err: any = new Error('new row for relation "pasien" violates check constraint "pasien_status_check"');
    err.code = '23514';
    err.constraint = 'pasien_status_check';
    const hasil = formatError(err);
    expect(hasil.body.message).not.toContain('relation');
    expect(hasil.body.message).not.toContain('violates');
  });
});
