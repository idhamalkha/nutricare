import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query, connect, clientQuery, release } = vi.hoisted(() => ({
  query: vi.fn(), connect: vi.fn(), clientQuery: vi.fn(), release: vi.fn(),
}));
vi.mock('../../src/db/pool.js', () => ({
  pool: { query, connect },
  transaction: async (work: (client: any) => Promise<any>) => {
    const client = { query: clientQuery, release };
    await clientQuery('BEGIN');
    try { const result = await work(client); await clientQuery('COMMIT'); return result; }
    catch (error) { await clientQuery('ROLLBACK'); throw error; }
    finally { release(); }
  },
}));
vi.mock('../../src/rules/validations.js', () => ({ validateRMUnique: vi.fn() }));

import { createPatientIntake } from '../../src/modules/pasien.js';

describe('atomic patient intake', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates patient and food restrictions within the same transaction', async () => {
    clientQuery
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 'p1', nama: 'Pasien A', rm: 'RM-1', ruangan: '101', diagnosis: 'Diabetes', usia: 50, bb: 60, tb: 160, kalori: 1800, tekstur: 'Biasa', status: 'Aktif' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'r1', pasien_id: 'p1', alergi: 'Udang', pantangan: 'Makanan pedas', catatan: '' }] });
    
    const result = await createPatientIntake({
      nama: 'Pasien A', rm: 'RM-1', ruangan: '101', diagnosis: 'Diabetes', usia: 50,
      bb: 60, tb: 160, kalori: 1800, tekstur: 'Biasa', alergi: 'Udang', pantangan: 'Makanan pedas',
    });
    expect(result.patient.id).toBe('p1');
    expect(result.restrictions[0].pasien).toBe('Pasien A');
    expect(clientQuery.mock.calls.map(([sql]) => sql.trim().split(' ')[0])).toEqual(['BEGIN', 'INSERT', 'INSERT', 'COMMIT']);
    expect(clientQuery.mock.calls[2][1]).toEqual(['p1', 'Udang', 'Makanan pedas', '']);
  });

  it('rolls back the patient insert if restriction insertion fails', async () => {
    clientQuery
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 'p1', nama: 'Pasien A' }] })
      .mockRejectedValueOnce(new Error('restriction failed'));
    await expect(createPatientIntake({
      nama: 'Pasien A', rm: 'RM-1', ruangan: '101', diagnosis: 'x', usia: 50,
      bb: 60, tb: 160, kalori: 1800, tekstur: 'Biasa', alergi: 'Udang', pantangan: 'Pedas',
    })).rejects.toThrow('restriction failed');
    expect(clientQuery.mock.calls.map(([sql]) => sql.trim().split(' ')[0])).toEqual(['BEGIN', 'INSERT', 'INSERT', 'ROLLBACK']);
  });
});
