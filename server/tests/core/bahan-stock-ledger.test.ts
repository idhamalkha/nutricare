import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../src/db/pool.js', () => ({ pool: { query } }));

import { createBahan, updateBahan } from '../../src/modules/bahan.js';

describe('stock ledger boundary for bahan CRUD', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('rejects stock supplied while creating a material', async () => {
    await expect(createBahan({ nama: 'Beras', stok: 25 }))
      .rejects.toThrow('Perubahan stok wajib melalui transaksi stok.');
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects direct stock updates without writing to bahan', async () => {
    await expect(updateBahan('b-1', { stok: 40 }))
      .rejects.toThrow('Perubahan stok wajib melalui transaksi stok.');
    expect(query).not.toHaveBeenCalled();
  });
});
