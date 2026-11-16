import { describe, expect, it, vi } from 'vitest';
import { pool } from '../../src/db/pool.js';
import { getDistributionPatients } from '../../src/modules/jadwal.js';

vi.mock('../../src/db/pool.js', () => ({ pool: { query: vi.fn() } }));

describe('distribution patient projection', () => {
  it('returns only patient name and room for active records', async () => {
    const query = vi.mocked(pool.query);
    query.mockResolvedValueOnce({ rows: [{ nama: 'Ayu', ruangan: 'Melati 1' }] } as any);
    await expect(getDistributionPatients()).resolves.toEqual([{ nama: 'Ayu', ruangan: 'Melati 1' }]);
    expect(query.mock.calls[0][0]).toContain('SELECT nama, ruangan');
    expect(query.mock.calls[0][0]).toContain('deleted_at IS NULL');
  });
});
