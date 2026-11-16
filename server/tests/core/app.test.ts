import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';

describe('server auth boundary', () => {
  it('exposes health without credentials', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok' });
    await app.close();
  });

  it('requires auth for other API routes', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/api/pasien' });
    expect(response.statusCode).toBe(401);
    await app.close();
  });
});
