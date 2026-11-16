import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    // Tes memakai mode demo (header X-NC-Role) agar tidak bergantung pada
    // kredensial Supabase dan tetap sama di mesin mana pun, termasuk saat
    // .env sudah di-set AUTH_MODE=strict untuk produksi.
    env: {
      AUTH_MODE: 'demo',
    },
  },
});
