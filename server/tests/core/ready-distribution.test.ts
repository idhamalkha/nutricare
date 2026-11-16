import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../src/db/pool.js', () => ({ pool: { query }, transaction: vi.fn() }));

import { getReadyDistribution } from '../../src/modules/jadwal.js';

describe('ready distribution projection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns only kitchen-ready, undelivered menu and room fields', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'j1', pasien_nama: 'Pasien A', ruangan: '101', menu: 'Sup', waktu: 'Sarapan', jam: '06:00', status: 'Menunggu' }] });
    const result = await getReadyDistribution();
    expect(query.mock.calls[0][0]).toContain("d.status = 'Selesai'");
    expect(query.mock.calls[0][0]).toContain("j.status <> 'Terkirim'");
    expect(query.mock.calls[0][0]).toContain("r.status = 'Dikirim'");
    expect(query.mock.calls[0][0]).toContain('r.tanggal = (now() AT TIME ZONE \'Asia/Jakarta\')::date');
    expect(query.mock.calls[0][0]).toContain('r.menu = j.menu');
    expect(result).toEqual([{ id: 'j1', pasien: 'Pasien A', ruangan: '101', menu: 'Sup', waktu: 'Sarapan', jam: '06:00', status: 'Menunggu' }]);
    expect(result[0]).not.toHaveProperty('diagnosis');
    expect(result[0]).not.toHaveProperty('diet');
  });

  it('does not mark delivery unless the kitchen-preparation slot is complete', async () => {
    query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const { markDelivered } = await import('../../src/modules/jadwal.js');
    await expect(markDelivered('j-not-ready')).rejects.toThrow('Jadwal belum siap dari dapur atau tidak ditemukan.');
    expect(query.mock.calls[0][0]).toContain("d.status = 'Selesai'");
    expect(query.mock.calls[0][0]).toContain("SET status = 'Terkirim'");
  });
});
