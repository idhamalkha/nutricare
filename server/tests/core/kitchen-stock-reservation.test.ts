import { describe, expect, it, vi } from 'vitest';
import { reserveKitchenStock } from '../../src/modules/logistik.js';

describe('atomic kitchen stock reservation', () => {
  it('deducts total menu requirements and writes a single ledger-linked reservation', async () => {
    const c = { query: vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ bahan_id:'b1', bahan:'Beras', jumlah_per_porsi:'0.08', satuan:'kg', stok:'1.00', stok_satuan:'kg', kedaluwarsa:'2099-12-31' }] })
      .mockResolvedValueOnce({ rowCount:1, rows:[{ id:'b1' }] })
      .mockResolvedValueOnce({ rowCount:1, rows:[{ id:'s1' }] })
      .mockResolvedValueOnce({ rowCount:1, rows:[{ id:'r1' }] }) };
    await reserveKitchenStock(c, '2026-10-31', 'Sarapan', [{ menu:'Nasi', porsi:12 }]);
    expect(c.query.mock.calls[2][0]).toContain('UPDATE bahan SET stok=stok-$1');
    expect(c.query.mock.calls[2][1]).toEqual([0.96, 'b1']);
    expect(c.query.mock.calls[3][0]).toContain("'Keluar'");
    expect(c.query.mock.calls[4][0]).toContain('INSERT INTO persiapan_bahan_reservasi');
  });
  it('rejects zero recipe quantities before changing stock or writing a ledger', async () => {
    const c = { query: vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ bahan_id:'b1', bahan:'Beras', jumlah_per_porsi:'0', satuan:'kg', stok:'1.00', stok_satuan:'kg', kedaluwarsa:'2099-12-31' }] }) };
    await expect(reserveKitchenStock(c, '2026-10-31', 'Sarapan', [{ menu:'Nasi', porsi:12 }])).rejects.toThrow(/jumlah resep.*Beras.*lebih dari 0/i);
    expect(c.query).toHaveBeenCalledTimes(2);
  });

  it('refuses insufficient stock before changing stock or ledger', async () => {
    const c = { query: vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ bahan_id:'b1', bahan:'Beras', jumlah_per_porsi:'0.08', satuan:'kg', stok:'0.50', stok_satuan:'kg', kedaluwarsa:'2099-12-31' }] }) };
    await expect(reserveKitchenStock(c, '2026-10-31', 'Sarapan', [{ menu:'Nasi', porsi:12 }])).rejects.toThrow(/Beras.*butuh 0.96 kg.*stok 0.5 kg/i);
    expect(c.query).toHaveBeenCalledTimes(2);
  });
  it('does not reserve or ledger twice when the same slot is already reserved', async () => {
    const c = { query: vi.fn().mockResolvedValueOnce({ rows:[{ menu:'Nasi', bahan_id:'b1', jumlah:'0.96' }] }) };
    await reserveKitchenStock(c, '2026-10-31', 'Sarapan', [{ menu:'Nasi', porsi:12 }]);
    expect(c.query).toHaveBeenCalledTimes(1);
  });
});
