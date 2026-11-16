import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('dashboard auto refresh', () => {
  it('refreshes current API stores and rerenders without page reload', () => {
    const core = read('../../../js/nutricare.js');
    const refresh = read('../../../js/auto-refresh.js');
    expect(core).toContain('refreshAll: refreshAll');
    expect(core).toContain("if (!route) return;");
    expect(core).toContain("request('GET', route)");
    expect(refresh).toContain('window.NC.refreshAll()');
    expect(refresh).not.toContain('window.location.reload()');
  });

  it('connects logistics data hydration to the shared refresh event', () => {
    const logistics = read('../../../js/logistik.js');
    expect(logistics).toContain("addEventListener('nutricare:refresh'");
    expect(logistics).toContain('hydrate);');
  });
});
