import { beforeEach, describe, expect, it, vi } from 'vitest';
const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../src/db/pool.js', () => ({ pool: { query }, transaction: vi.fn() }));
import { validateRecipeStock } from '../../src/rules/validations.js';

describe('quantitative menu recipe stock validation', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it('blocks kitchen readiness when recipe quantities exceed stock for all portions', async () => {
    query.mockResolvedValueOnce({ rows: [{ bahan: 'Beras', jumlah_per_porsi: '0.08', satuan: 'kg', stok: '1', stok_satuan: 'kg', kedaluwarsa: '2027-12-31' }] });
    await expect(validateRecipeStock('Nasi ayam', 13)).rejects.toThrow(/Beras.*butuh 1.04 kg.*stok 1 kg/i);
  });
  it('blocks a menu with no configured recipe', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await expect(validateRecipeStock('Menu tanpa resep', 2)).rejects.toThrow(/Resep menu.*belum dikonfigurasi/i);
  });
  it('allows a recipe when every ingredient covers the requested portions', async () => {
    query.mockResolvedValueOnce({ rows: [{ bahan: 'Beras', jumlah_per_porsi: '0.08', satuan: 'kg', stok: '2', stok_satuan: 'kg', kedaluwarsa: '2027-12-31' }] });
    await expect(validateRecipeStock('Nasi ayam', 13)).resolves.toBeUndefined();
  });
});
