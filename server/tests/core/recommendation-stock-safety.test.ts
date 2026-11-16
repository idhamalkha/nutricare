import { describe, expect, it, vi } from 'vitest';
const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../src/db/pool.js', () => ({ pool: { query } }));
import { validateNoOutOfStock } from '../../src/rules/validations.js';

describe('recommendation ingredient inventory safety', () => {
  it('rejects a named ingredient that is expired as well as one that is depleted', async () => {
    query.mockResolvedValueOnce({ rows: [
      { nama: 'Kacang', stok: '12', minimum: '2', kedaluwarsa: '2000-01-01' },
    ] });
    await expect(validateNoOutOfStock('Menu kacang', '')).rejects.toThrow(/kedaluwarsa/i);
  });
});
