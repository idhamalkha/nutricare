import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';

describe('login route public boundary', () => {
  it('login page never submits credentials in the URL and posts through the auth API', async () => {
    const app = buildApp();
    const page = await app.inject({ method: 'GET', url: '/' });
    const loginScript = await app.inject({ method: 'GET', url: '/js/login.js' });
    const adapter = await app.inject({ method: 'GET', url: '/js/api-adapter.js' });
    expect(page.body).toMatch(/<form[^>]*method="post"/i);
    expect(page.body).not.toMatch(/<select[^>]*id="role"/i);
    expect(page.body).not.toContain('Masuk sebagai');
    expect(loginScript.body).not.toContain('form.elements.role');
    expect(page.body).toContain('js/login.js');
    expect(loginScript.body).toContain("fetch('/api/auth/login'");
    expect(loginScript.body).toContain("sessionStorage.setItem('nutricare-token'");
    expect(adapter.body).toContain("Authorization', 'Bearer ' + token");
    const core = await app.inject({ method: 'GET', url: '/js/nutricare.js' });
    expect(core.body).toContain("closest('a.logout')");
    expect(core.body).toContain("fetch('/api/auth/logout'");
    expect(core.body).toContain("Authorization: 'Bearer ' + token");
    expect(core.body).toContain("sessionStorage.removeItem('nutricare-token')");
    await app.close();
  });

  it('does not require a demo role header before checking credentials', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'missing-user-e2e', password: 'invalid-test-password' },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().message).not.toContain('Header X-NC-Role');
    await app.close();
  });
});
