// Test: Status bahan (BR-4, sumber kebenaran tunggal)
import { describe, it, expect } from 'vitest';
import { bahanStatus } from '../../src/rules/bahan-status.js';

describe('bahanStatus', () => {
  const today = new Date('2026-10-30');
  
  it('harus return Kedaluwarsa jika kedaluwarsa < hari ini', () => {
    const result = bahanStatus({
      kedaluwarsa: '2026-10-29',
      stok: 100,
      minimum: 50,
    });
    expect(result).toBe('Kedaluwarsa');
  });
  
  it('harus return Habis jika stok <= 0', () => {
    const result = bahanStatus({
      kedaluwarsa: '2026-12-31',
      stok: 0,
      minimum: 50,
    });
    expect(result).toBe('Habis');
  });
  
  it('harus return Periksa jika kedaluwarsa <= hari ini + 7', () => {
    const result = bahanStatus({
      kedaluwarsa: '2026-11-05', // 6 hari dari today
      stok: 100,
      minimum: 50,
    });
    expect(result).toBe('Periksa');
  });
  
  it('harus return Menipis jika stok <= minimum', () => {
    const result = bahanStatus({
      kedaluwarsa: '2026-12-31',
      stok: 40,
      minimum: 50,
    });
    expect(result).toBe('Menipis');
  });
  
  it('harus return Aman jika semua kondisi normal', () => {
    const result = bahanStatus({
      kedaluwarsa: '2026-12-31',
      stok: 100,
      minimum: 50,
    });
    expect(result).toBe('Aman');
  });
  
  it('prioritas Kedaluwarsa > Habis', () => {
    const result = bahanStatus({
      kedaluwarsa: '2026-10-29',
      stok: 0,
      minimum: 50,
    });
    expect(result).toBe('Kedaluwarsa');
  });
  
  it('prioritas Habis > Periksa', () => {
    const result = bahanStatus({
      kedaluwarsa: '2026-11-05',
      stok: 0,
      minimum: 50,
    });
    expect(result).toBe('Habis');
  });
  
  it('prioritas Periksa > Menipis', () => {
    const result = bahanStatus({
      kedaluwarsa: '2026-11-05',
      stok: 40,
      minimum: 50,
    });
    expect(result).toBe('Periksa');
  });
  
  it('edge case: kedaluwarsa tepat hari ini + 7', () => {
    const result = bahanStatus({
      kedaluwarsa: '2026-11-06', // tepat 7 hari
      stok: 100,
      minimum: 50,
    });
    expect(result).toBe('Periksa');
  });
  
  it('edge case: stok = minimum', () => {
    const result = bahanStatus({
      kedaluwarsa: '2026-12-31',
      stok: 50,
      minimum: 50,
    });
    expect(result).toBe('Menipis');
  });
});
