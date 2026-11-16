import { describe, expect, it, vi } from 'vitest';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../src/db/pool.js', () => ({ pool: { query }, transaction: vi.fn() }));
vi.mock('../../src/db/resolvers.js', () => ({ resolvePasienByName: vi.fn() }));
vi.mock('../../src/rules/validations.js', () => ({ validateRekomendasi: vi.fn() }));
import { syncRecommendationSchedule } from '../../src/modules/rekomendasi.js';

describe('recommendation-to-schedule handoff', () => {
  it('creates a patient meal schedule only when recommendation is sent', async () => {
    const db = { query: vi.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ id: 'j1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) };
    expect(await syncRecommendationSchedule(db, { status: 'Draf', pasien_id: 'p1', waktu: 'Sarapan', menu: 'Bubur' })).toBeNull();
    expect(db.query).not.toHaveBeenCalled();
    await syncRecommendationSchedule(db, { status: 'Dikirim', tanggal: '2026-10-31', pasien_id: 'p1', waktu: 'Sarapan', menu: 'Bubur' });
    expect(db.query.mock.calls[0][0]).toContain("status='Selesai'");
    expect(db.query.mock.calls[0][1]).toEqual(['2026-10-31', 'Sarapan']);
    expect(db.query.mock.calls[1][0]).toContain('INSERT INTO jadwal_makan');
    expect(db.query.mock.calls[1][0]).toContain('ON CONFLICT (pasien_id,waktu) WHERE deleted_at IS NULL');
    expect(db.query.mock.calls[1][1]).toEqual(['p1', 'Sarapan', 'Bubur', '06:00']);
    expect(db.query.mock.calls[2][0]).toContain("SET status='Menunggu'");
    expect(db.query.mock.calls[2][0]).toContain('progres=0');
    expect(db.query.mock.calls[2][0]).toContain("status='Selesai'");
    expect(db.query.mock.calls[2][0]).toContain("AT TIME ZONE 'Asia/Jakarta'");
    expect(db.query.mock.calls[2][1]).toEqual(['Sarapan']);
  });

  it('blocks schedule changes after kitchen stock has been consumed', async () => {
    const db = { query: vi.fn().mockResolvedValueOnce({ rows:[{id:'p1'}], rowCount:1 }) };
    await expect(syncRecommendationSchedule(db, { status:'Dikirim', tanggal:'2026-10-31', pasien_id:'p1', waktu:'Sarapan', menu:'Menu baru' })).rejects.toMatchObject({statusCode:409});
    expect(db.query).toHaveBeenCalledTimes(1);
  });
});
