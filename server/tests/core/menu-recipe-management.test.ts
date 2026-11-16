import { beforeEach, describe, expect, it, vi } from 'vitest';
const { query, transaction } = vi.hoisted(() => ({ query: vi.fn(), transaction: vi.fn() }));
vi.mock('../../src/db/pool.js', () => ({ pool: { query }, transaction }));
import { deleteMenuRecipe, replaceMenuRecipe } from '../../src/modules/logistik.js';

it('deletes a recipe by menu using a parameterized query', async () => {
  query.mockResolvedValue({ rows: [{ id: 'r1' }, { id: 'r2' }], rowCount: 2 });
  await expect(deleteMenuRecipe('Nasi ayam')).resolves.toEqual({ menu: 'Nasi ayam', deleted: 2 });
  expect(query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM menu_resep_bahan'), ['Nasi ayam']);
});

test('rejects an empty recipe menu without querying the database', async () => {
  vi.clearAllMocks();
  await expect(deleteMenuRecipe('  ')).rejects.toThrow(/nama menu wajib/i);
  expect(query).not.toHaveBeenCalled();
});

describe('menu recipe management', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it('replaces recipe lines transactionally and uses the stock unit', async () => {
    const client = { query: vi.fn() };
    transaction.mockImplementation(async (work: (c: any) => Promise<any>) => work(client));
    client.query.mockImplementation(async (sql: string) => sql.includes('SELECT id,nama,satuan')
      ? { rows: [{ id: 'b1', nama: 'Beras', satuan: 'kg' }] }
      : sql.includes('INSERT INTO menu_resep_bahan')
        ? { rows: [{ id: 'r1', menu: 'Nasi ayam', bahan: 'Beras', jumlah_per_porsi: '0.08', satuan: 'kg' }] }
        : { rows: [], rowCount: 1 });
    const rows = await replaceMenuRecipe('Nasi ayam', [{ bahanId: 'b1', jumlahPerPorsi: 0.08 }]);
    expect(client.query.mock.calls[0][0]).toContain('FOR SHARE');
    expect(client.query.mock.calls[1][0]).toContain('DELETE FROM menu_resep_bahan');
    expect(client.query.mock.calls[2][1]).toEqual(['Nasi ayam', 'b1', 0.08, 'kg']);
    expect(rows).toEqual([{ id: 'r1', menu: 'Nasi ayam', bahanId: 'b1', bahan: 'Beras', jumlahPerPorsi: 0.08, satuan: 'kg' }]);
  });
  it('rejects duplicate ingredients before starting a transaction', async () => {
    await expect(replaceMenuRecipe('Nasi ayam', [
      { bahanId: 'b1', jumlahPerPorsi: 0.08 }, { bahanId: 'b1', jumlahPerPorsi: 0.1 },
    ])).rejects.toThrow(/bahan tidak boleh berulang/i);
    expect(transaction).not.toHaveBeenCalled();
  });
});
