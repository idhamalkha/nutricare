import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../../src/db/pool.js';
import { createLaporan, deleteLaporan } from '../../src/modules/perawat.js';

beforeEach(() => { vi.clearAllMocks(); });
vi.mock('../../src/db/pool.js', () => ({ pool: { query: vi.fn() } }));

describe('demo actor normalization for laporan kondisi', () => {
  it('stores a null created_by for a synthetic demo user', async () => {
    const query = vi.mocked(pool.query);
    query
      .mockResolvedValueOnce({ rows: [{ id: 'patient-id' }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ id: 'report-id' }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ id: 'report-id', pasien_nama: 'Ayu', info: 'stabil', tanggal: '2026-10-30', waktu: '08:00:00', status: 'Baru' }], rowCount: 1 } as any);
    await createLaporan({ pasien: 'Ayu', info: 'stabil', tanggal: '2026-10-30', waktu: '08:00' }, 'demo-user');
    expect(query.mock.calls[1][1]?.[5]).toBeNull();
  });

  it('stores a null deleted_by for a synthetic demo user', async () => {
    const query = vi.mocked(pool.query);
    query.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
    await deleteLaporan('report-id', 'demo-user');
    expect(query.mock.calls[0][1]).toEqual([null, 'report-id']);
  });
});
