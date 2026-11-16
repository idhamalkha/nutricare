import { beforeEach, describe, expect, it, vi } from 'vitest';

const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      admin: { signOut },
    },
  }),
}));

import { buildApp } from '../../src/app.js';

describe('logout revokes the authenticated session', () => {
  beforeEach(() => signOut.mockReset().mockResolvedValue({ error: null }));

  it('revokes only the bearer session and returns no response body', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        authorization: 'Bearer unit-test-session-token',
        'x-nc-role': 'waiter',
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(signOut).toHaveBeenCalledWith('unit-test-session-token', 'local');
    await app.close();
  });
});
