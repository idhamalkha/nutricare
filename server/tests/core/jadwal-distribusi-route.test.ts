import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app.js';
import * as scheduleModule from '../../src/modules/jadwal.js';

afterEach(() => { vi.restoreAllMocks(); });

describe('distribution patient route', () => {
  it('serves only the minimal patient projection to a waiter', async () => {
    vi.spyOn(scheduleModule, 'getDistributionPatients').mockResolvedValue([
      { nama: 'Ayu', ruangan: 'Melati 1' },
    ]);
    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/jadwal/pasien-distribusi',
      headers: { 'x-nc-role': 'waiter' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([{ nama: 'Ayu', ruangan: 'Melati 1' }]);
    await app.close();
  });

  it('denies full patient data to a waiter', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/pasien',
      headers: { 'x-nc-role': 'waiter' },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });
});
