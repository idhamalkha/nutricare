import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query, clientQuery, release } = vi.hoisted(() => ({
  query: vi.fn(), clientQuery: vi.fn(), release: vi.fn(),
}));
vi.mock('../../src/db/pool.js', () => ({
  pool: { query },
  transaction: async (work: (client: any) => Promise<any>) => {
    const client = { query: clientQuery, release };
    await clientQuery('BEGIN');
    try { const result = await work(client); await clientQuery('COMMIT'); return result; }
    catch (error) { await clientQuery('ROLLBACK'); throw error; }
    finally { release(); }
  },
}));
vi.mock('../../src/rules/validations.js', () => ({ validateRMUnique: vi.fn() }));

import { getDischargedPasien, readmitPasien } from '../../src/modules/pasien.js';

const pasienLama = {
  id: 'p-lama', nama: 'Pasien Lama', rm: 'RM-9', ruangan: '101', diagnosis: 'Diabetes',
  usia: 50, bb: 60, tb: 160, kalori: 1800, tekstur: 'Biasa', status: 'Pulang',
  deleted_at: '2026-10-01T00:00:00.000Z',
};

describe('pasien pulang dan masuk kembali', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('mengembalikan riwayat pasien yang sudah pulang beserta tanggal pulangnya', async () => {
    query.mockResolvedValueOnce({ rows: [pasienLama] });
    const rows = await getDischargedPasien();
    expect(rows).toHaveLength(1);
    expect(rows[0].nama).toBe('Pasien Lama');
    expect(rows[0].pulang_pada).toBe('2026-10-01T00:00:00.000Z');
    expect(String(query.mock.calls[0][0])).toContain('deleted_at IS NOT NULL');
  });

  it('memulihkan pasien lama dengan status Aktif dan menjaga catatan alergi', async () => {
    clientQuery
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [pasienLama] }) // SELECT ... FOR UPDATE
      .mockResolvedValueOnce({ rows: [{ ...pasienLama, ruangan: '202', status: 'Aktif', deleted_at: null }] }) // UPDATE pasien
      .mockResolvedValueOnce({ rows: [] }); // UPDATE pantangan_alergi

    const result = await readmitPasien('p-lama', { ruangan: '202', diagnosis: 'Diabetes tipe 2' });

    expect(result.status).toBe('Aktif');
    expect(result.ruangan).toBe('202');
    const updatePasienCall = clientQuery.mock.calls[2];
    expect(String(updatePasienCall[0])).toContain("status = 'Aktif'");
    expect(String(updatePasienCall[0])).toContain('deleted_at = NULL');
    expect(updatePasienCall[1][3]).toBe('202');
    expect(String(clientQuery.mock.calls[3][0])).toContain('pantangan_alergi');
    expect(clientQuery.mock.calls.map(([sql]) => String(sql).trim().split(' ')[0]))
      .toEqual(['BEGIN', 'SELECT', 'UPDATE', 'UPDATE', 'COMMIT']);
  });

  it('menolak masuk kembali bila pasien lama tidak ditemukan', async () => {
    clientQuery
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [] }); // SELECT ... FOR UPDATE

    await expect(readmitPasien('p-hilang', { ruangan: '202' }))
      .rejects.toThrow('Pasien lama tidak ditemukan');
  });
});
