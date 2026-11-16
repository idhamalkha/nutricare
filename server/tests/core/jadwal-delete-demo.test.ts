import { describe, expect, it, vi } from 'vitest';
import { pool } from '../../src/db/pool.js';
import { deleteJadwal } from '../../src/modules/jadwal.js';

vi.mock('../../src/db/pool.js', () => ({ pool: { query: vi.fn() } }));

describe('deleteJadwal demo actor', () => {
  it('passes null instead of synthetic demo id to UUID audit column', async () => {
    const query = vi.mocked(pool.query);
    query.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
    await deleteJadwal('00000000-0000-4000-8000-000000000001', 'demo-user');
    expect(query.mock.calls[0][1]).toEqual([null, '00000000-0000-4000-8000-000000000001']);
  });
});
