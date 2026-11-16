import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query, transaction } = vi.hoisted(() => ({ query: vi.fn(), transaction: vi.fn() }));
vi.mock('../../src/db/pool.js', () => ({ pool: { query }, transaction }));
vi.mock('../../src/rules/validations.js', () => ({ validateNoOutOfStock: vi.fn(), validateRecipeStock: vi.fn() }));

import { patchPersiapan } from '../../src/modules/logistik.js';

describe('kitchen preparation status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.mockImplementation((fn: (client: any) => any) => fn({ query: (...args: any[]) => query(...args) }));
  });

  it('rejects statuses outside the kitchen workflow before writing', async () => {
    await expect(patchPersiapan('Sarapan', { status: 'Sudah dikirim' })).rejects.toThrow('Status persiapan tidak valid.');
    await expect(patchPersiapan('Sarapan', { status: 'Proses' })).rejects.toThrow('Status persiapan tidak valid.');
    expect(query).not.toHaveBeenCalled();
  });

  it('uses the Jakarta calendar date when checking sent recommendations for a completed slot', async () => {
    query.mockResolvedValueOnce({ rows: [{ d: new Date(2026, 10, 2) }] })
      .mockResolvedValueOnce({ rows: [{ id:'slot1' }] })
      .mockResolvedValueOnce({ rows: [] });
    await expect(patchPersiapan('Makan malam', { status: 'Selesai' })).rejects.toThrow('Tidak ada rekomendasi terkirim');
    expect(query.mock.calls[2][1]).toEqual(['Makan malam', '2026-11-02']);
  });

  it('refuses to prepare when no sent recommendation exists for the slot', async () => {
    query.mockResolvedValueOnce({ rows: [{ d: '2026-10-31' }] })
      .mockResolvedValueOnce({ rows: [{ id:'slot1' }] })
      .mockResolvedValueOnce({ rows: [] });
    await expect(patchPersiapan('Sarapan', { status: 'Selesai' })).rejects.toThrow('Tidak ada rekomendasi terkirim');
    expect(query).toHaveBeenCalledTimes(3);
  });

  it('refuses consumption when aggregated recipe quantity exceeds available stock', async () => {
    query.mockResolvedValueOnce({ rows: [{ d: '2026-10-31' }] })
      .mockResolvedValueOnce({ rows: [{ id:'slot1' }] })
      .mockResolvedValueOnce({ rows: [{ menu:'Menu telur', porsi:3 }], rowCount:1 })
      .mockResolvedValueOnce({ rows: [], rowCount:0 })
      .mockResolvedValueOnce({ rows: [{ menu:'Menu telur', bahan_id:'b1', bahan:'Telur', jumlah_per_porsi:'0.20', satuan:'kg', stok:'0.50', stok_satuan:'kg', kedaluwarsa:'2099-12-31' }], rowCount:1 });
    await expect(patchPersiapan('Sarapan', { status:'Selesai' })).rejects.toThrow(/Telur.*butuh 0.6 kg.*stok 0.5 kg/i);
    expect(query).toHaveBeenCalledTimes(5);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('UPDATE bahan SET stok=stok-'))).toBe(false);
  });

  it('deducts stock and writes a ledger entry before marking the slot ready', async () => {
    query.mockResolvedValueOnce({ rows: [{ d: '2026-10-31' }] })
      .mockResolvedValueOnce({ rows: [{ id:'slot1' }], rowCount:1 })
      .mockResolvedValueOnce({ rows: [{ menu:'Menu aman', porsi:4 }], rowCount:1 })
      .mockResolvedValueOnce({ rows: [], rowCount:0 })
      .mockResolvedValueOnce({ rows: [{ menu:'Menu aman', bahan_id:'b1', bahan:'Beras', jumlah_per_porsi:'0.10', satuan:'kg', stok:'3.00', stok_satuan:'kg', kedaluwarsa:'2099-12-31' }], rowCount:1 })
      .mockResolvedValueOnce({ rows:[{id:'b1'}], rowCount:1 })
      .mockResolvedValueOnce({ rows:[{id:'s1'}], rowCount:1 })
      .mockResolvedValueOnce({ rows:[{id:'r1'}], rowCount:1 })
      .mockResolvedValueOnce({ rows:[{waktu:'Sarapan',porsi:4,status:'Selesai',progres:100,catatan:''}], rowCount:1 });
    const result = await patchPersiapan('Sarapan', { status:'Selesai' });
    expect(result).toMatchObject({waktu:'Sarapan',status:'Selesai',progres:100});
    expect(query.mock.calls[4][0]).toContain('FOR UPDATE OF b');
    expect(query.mock.calls[5][0]).toContain('UPDATE bahan SET stok=stok-$1');
    expect(query.mock.calls[5][1]).toEqual([0.4,'b1']);
    expect(query.mock.calls[6][0]).toContain("'Keluar'");
    expect(query.mock.calls[7][0]).toContain('INSERT INTO persiapan_bahan_reservasi');
    expect(query.mock.calls[8][0]).toContain("SET status='Selesai',progres=100");
  });
});
