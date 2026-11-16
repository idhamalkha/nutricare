import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query, signInWithPassword } = vi.hoisted(() => ({
  query: vi.fn(),
  signInWithPassword: vi.fn(),
}));

vi.mock('../../src/db/pool.js', () => ({ pool: { query } }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { signInWithPassword } }),
}));

import { login } from '../../src/auth/index.js';

describe('login email mapping', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('accepts an email username and authenticates against the profile linked Auth email', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'user-uuid', role: 'perawat', nama: 'Perawat', username: 'nurse', email: 'nurse@hospital.example' }] });
    signInWithPassword.mockResolvedValueOnce({ data: { session: { access_token: 'test-token' } }, error: null });

    const result = await login({ username: 'nurse@hospital.example', password: 'not-a-real-password' });

    expect(query.mock.calls[0][1]).toEqual(['nurse@hospital.example']);
    expect(query.mock.calls[0][0]).toContain('auth.users');
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'nurse@hospital.example', password: 'not-a-real-password' });
    expect(result.user.email).toBe('nurse@hospital.example');
  });
});
