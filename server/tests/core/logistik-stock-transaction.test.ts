import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query, transaction } = vi.hoisted(() => ({
  query: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('../../src/db/pool.js', () => ({
  pool: { query },
  transaction,
}));

import { createStok } from '../../src/modules/logistik.js';

describe('stock mutation transaction boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.mockImplementation(async (callback: (client: { query: typeof query }) => unknown) =>
      callback({ query }));
  });

  it('updates stock and writes its movement in one transaction', async () => {
    query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'b-1', nama: 'Beras', stok: 12, satuan: 'kg' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'b-1' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'm-1', tanggal: new Date('2026-10-31T00:00:00Z') }] });

    const result = await createStok({ bahan: 'Beras', jenis: 'Masuk', jumlah: 5 }, 'user-1');

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[1][0]).toContain('UPDATE bahan SET stok=stok+$1');
    expect(query.mock.calls[1][1]).toEqual([5, 'b-1']);
    expect(query.mock.calls[2][0]).toContain('INSERT INTO stok_transaksi');
    expect(query.mock.calls[2][1]).toEqual(['b-1', 'Masuk', 5, 'kg', '', 'user-1']);
    expect(result.bahan).toBe('Beras');
  });

  it('does not write a movement when stock would become negative', async () => {
    query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'b-1', nama: 'Beras', stok: 3, satuan: 'kg' }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await expect(createStok({ bahan: 'Beras', jenis: 'Keluar', jumlah: 5 }, 'user-1'))
      .rejects.toThrow('Stok beras tidak mencukupi.');

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledTimes(2);
  });
});
