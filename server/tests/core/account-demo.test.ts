import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';

describe('demo account identity', () => {
  it.each([
    ['ahli-gizi', 'Ahli Gizi'],
    ['perawat', 'Perawat'],
    ['waiter', 'Waiter'],
    ['logistik', 'Petugas Logistik'],
  ])('returns the active %s identity from /api/me', async (role, nama) => {
    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { 'x-nc-role': role },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: 'demo-user', role, nama });
    await app.close();
  });
});
