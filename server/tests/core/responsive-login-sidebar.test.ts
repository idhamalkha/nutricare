import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const loginCss = readFileSync(new URL('../../../css/style.css', import.meta.url), 'utf8');
const dashboardCss = readFileSync(new URL('../../../css/dashboard.css', import.meta.url), 'utf8');
const logisticsHtml = readFileSync(new URL('../../../pages/logistik.html', import.meta.url), 'utf8');

const loginBlock = loginCss.slice(loginCss.indexOf('LOGIN NUTRICARE'));

describe('login page scaling (single fluid token)', () => {
  it('drives every login size from the --u token', () => {
    expect(loginBlock).toMatch(
      /--u:\s*min\(clamp\(0\.85px,\s*0\.05625vw,\s*1px\),\s*0\.1202vh\)/,
    );
    expect(loginBlock).toMatch(
      /\.login-layout\s*\{[^}]*width:\s*min\(calc\(var\(--u\)\s*\*\s*1200\),\s*100%\)/,
    );
    expect(loginBlock).toMatch(
      /\.login-layout\s*\{[^}]*min-height:\s*min\(calc\(var\(--u\)\s*\*\s*720\),\s*calc\(100vh\s*-\s*calc\(var\(--u\)\s*\*\s*40\)\)\)/,
    );
    expect(loginBlock).toMatch(
      /\.visual-content h1\s*\{[^}]*font-size:\s*clamp\(calc\(var\(--u\)\s*\*\s*28\),\s*3vw,\s*calc\(var\(--u\)\s*\*\s*43\)\)/,
    );
    expect(loginBlock).toMatch(
      /\.food-image > img:first-child\s*\{[^}]*height:\s*calc\(var\(--u\)\s*\*\s*340\)/,
    );
    expect(loginBlock).toMatch(/\.login-button\s*\{[^}]*height:\s*calc\(var\(--u\)\s*\*\s*45\)/);
  });

  it('never falls back to zoom or transform: scale()', () => {
    expect(loginBlock).not.toMatch(/transform:\s*scale\(/);
    expect(loginCss).not.toMatch(/[\s;{]zoom\s*:/);
  });

  it('has no height-triggered breakpoint that shifts proportions', () => {
    expect(loginBlock).not.toMatch(/max-height:\s*820px/);
    const heightQueries = [...loginBlock.matchAll(/@media[^{]*max-height[^{]*\{/g)].map((m) => m[0]);
    expect(heightQueries.length).toBeGreaterThan(0);
    expect(heightQueries.every((q) => /max-width:\s*760px/.test(q))).toBe(true);
  });

  it('keeps tablet and mobile behaviour of the image panel', () => {
    expect(loginBlock).toMatch(
      /@media \(max-width: 760px\)[\s\S]*?\.food-image\s*\{[^}]*display:\s*none/,
    );
    expect(loginBlock).toMatch(
      /@media \(max-width: 760px\) and \(max-height: 700px\)[\s\S]*?\.visual-content\s*,\s*\.visual-footer\s*\{[^}]*display:\s*none/,
    );
    expect(loginBlock).toMatch(
      /\.food-image > img:first-child\s*\{[^}]*object-fit:\s*cover[^}]*object-position/,
    );
    // panel gambar mengikuti tinggi kartu (grid stretch), bukan tinggi tetap
    const visualRule = loginBlock.match(/\.login-visual\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(visualRule).not.toMatch(/(?:^|;)\s*height:/);
    expect(loginBlock).toMatch(/\.login-layout\s*\{[^}]*grid-template-columns:\s*1\.05fr\s+0\.95fr/);
  });
});

describe('responsive sidebar scrolling', () => {
  it('hides sidebar scrollbar chrome while preserving its vertical scroll', () => {
    const sidebar = dashboardCss.match(/\.sidebar\s*\{([^}]+)\}/)?.[1] ?? '';
    expect(sidebar).toMatch(/overflow-y:\s*auto/);
    expect(sidebar).toMatch(/scrollbar-width:\s*none/);
    expect(sidebar).toMatch(/-ms-overflow-style:\s*none/);
    expect(dashboardCss).toMatch(/\.sidebar::-webkit-scrollbar\s*\{[^}]*display:\s*none/);
    expect(logisticsHtml).toMatch(/\.sidebar\s*\{[^}]*overflow-y:\s*auto;[^}]*scrollbar-width:\s*none/);
    expect(logisticsHtml).toMatch(/\.sidebar::-webkit-scrollbar\s*\{[^}]*display:\s*none/);
  });
});
