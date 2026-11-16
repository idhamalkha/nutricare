// Endpoint /api/admin tidak boleh terbuka: semua wajib kunci admin.
import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { config } from '../../src/config.js';

const KEY = config.admin.apiKey;

describe('admin endpoints are protected by the admin key', () => {
  it('rejects an anonymous listing of users', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/admin/users' });
    expect([401, 503]).toContain(res.statusCode);
    await app.close();
  });

  it('rejects a wrong admin key', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/users',
      headers: { 'x-nc-admin-key': 'kunci-palsu' },
    });
    expect([403, 503]).toContain(res.statusCode);
    await app.close();
  });

  it('rejects user creation without a key', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/users',
      payload: { email: 'x@example.com', password: 'rahasia123', nama: 'X', role: 'waiter' },
    });
    expect([401, 503]).toContain(res.statusCode);
    await app.close();
  });

  it('rejects deletion without a key', async () => {
    const app = buildApp();
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/admin/users/00000000-0000-0000-0000-000000000000',
    });
    expect([401, 503]).toContain(res.statusCode);
    await app.close();
  });

  it('rejects the seed helper without a key', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'POST', url: '/api/admin/users/seed' });
    expect([401, 503]).toContain(res.statusCode);
    await app.close();
  });

  it('accepts the configured admin key', async () => {
    if (!KEY) return; // tanpa kunci di .env server menjawab 503 (sudah diuji di atas)
    const app = buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/users',
      headers: { 'x-nc-admin-key': KEY },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().users)).toBe(true);
    await app.close();
  });
});
