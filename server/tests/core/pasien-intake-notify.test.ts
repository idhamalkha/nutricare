import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query, clientQuery, release, sendPushToRole } = vi.hoisted(() => ({
  query: vi.fn(), clientQuery: vi.fn(), release: vi.fn(), sendPushToRole: vi.fn(),
}));

vi.mock('../../src/db/pool.js', () => ({
  pool: { query },
  transaction: async (work: (client: any) => Promise<any>) => {
    const client = { query: clientQuery, release };
    await clientQuery('BEGIN');
    try { const result = await work(client); await clientQuery('COMMIT'); return result; }
    catch (error) { await clientQuery('ROLLBACK'); throw error; }
    finally { release(); }
  },
}));
vi.mock('../../src/rules/validations.js', () => ({ validateRMUnique: vi.fn() }));
vi.mock('../../src/routes/push.js', () => ({ sendPushToRole }));

import { createPatientIntake, readmitPasien } from '../../src/modules/pasien.js';

const pasien = {
  id: 'p1', nama: 'Pasien A', rm: 'RM-1', ruangan: '101', diagnosis: 'Diabetes',
  usia: 50, bb: 60, tb: 160, kalori: 1800, tekstur: 'Biasa', status: 'Aktif',
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('notifikasi pasien dari alur intake', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('mengirim notifikasi ke perawat dan ahli gizi setelah pasien baru tersimpan', async () => {
    clientQuery
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [pasien] })
      .mockResolvedValueOnce({ rows: [{ id: 'r1', pasien_id: 'p1', alergi: 'Udang', pantangan: 'Pedas', catatan: '' }] });

    await createPatientIntake({
      nama: 'Pasien A', rm: 'RM-1', ruangan: '101', diagnosis: 'Diabetes', usia: 50,
      bb: 60, tb: 160, kalori: 1800, tekstur: 'Biasa', alergi: 'Udang', pantangan: 'Pedas',
    });
    await flush();

    expect(sendPushToRole).toHaveBeenCalledTimes(1);
    const [roles, title, body, options] = sendPushToRole.mock.calls[0];
    expect(roles).toEqual(['perawat', 'ahli-gizi']);
    expect(title).toBe('Pasien baru ditambahkan');
    expect(body).toContain('Pasien A');
    expect(options.detail.kind).toBe('pasien');
    const labels = options.detail.fields.map((field: any) => field.label);
    expect(labels).toContain('Nama');
    expect(labels).toContain('Target kalori');
    expect(options.roleLinks['ahli-gizi']).toBe('/pages/ahli-gizi.html#pasien');
  });

  it('tidak mengirim notifikasi bila penyimpanan pasien gagal', async () => {
    clientQuery
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [pasien] })
      .mockRejectedValueOnce(new Error('restriction failed'));

    await expect(createPatientIntake({
      nama: 'Pasien A', rm: 'RM-1', ruangan: '101', diagnosis: 'x', usia: 50,
      bb: 60, tb: 160, kalori: 1800, tekstur: 'Biasa', alergi: 'Udang', pantangan: 'Pedas',
    })).rejects.toThrow('restriction failed');
    await flush();

    expect(sendPushToRole).not.toHaveBeenCalled();
  });

  it('mengirim notifikasi saat pasien lama masuk kembali', async () => {
    clientQuery
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [pasien] })
      .mockResolvedValueOnce({ rows: [pasien] })
      .mockResolvedValueOnce({ rows: [] });

    await readmitPasien('p1', { ruangan: '202' });
    await flush();

    expect(sendPushToRole).toHaveBeenCalledTimes(1);
    expect(sendPushToRole.mock.calls[0][1]).toBe('Pasien lama masuk kembali');
  });
});
