import { describe, expect, it, vi } from 'vitest';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../src/db/pool.js', () => ({ pool: { query }, transaction: vi.fn() }));
import { getPersiapan } from '../../src/modules/logistik.js';

describe('kitchen portions follow sent recommendations for the requested day', () => {
  it('counts sent recommendations directly, without requiring a pre-existing meal schedule', async () => {
    query.mockResolvedValueOnce({
      rows: [{ waktu: 'Sarapan', porsi: 2, status: 'Menunggu', progres: 0, catatan: null }],
    });

    const result = await getPersiapan();

    const [sql, params] = query.mock.calls[0];
    // Hanya rekomendasi berstatus Dikirim pada tanggal yang diminta yang dihitung.
    expect(sql).toContain("r.status = 'Dikirim'");
    expect(sql).toContain('r.tanggal = (SELECT day FROM d)');
    expect(sql).toContain('count(DISTINCT r.id)::int AS n');
    expect(sql).not.toContain('LEFT JOIN jadwal_makan');
    expect(sql).toContain('INSERT INTO persiapan_dapur');
    // Porsi lama diperbarui (bukan diduplikasi).
    expect(sql).toContain('ON CONFLICT (tanggal, waktu) DO UPDATE SET porsi = EXCLUDED.porsi');
    // Satu round-trip: tanggal (null = hari ini) dan daftar slot dikirim sebagai parameter.
    expect(params[0]).toBeNull();
    expect(params[1]).toEqual(['Sarapan', 'Makan siang', 'Makan malam', 'Snack']);
    expect(result).toEqual([{ waktu: 'Sarapan', porsi: 2, status: 'Menunggu', progres: 0, catatan: null }]);
  });
});
