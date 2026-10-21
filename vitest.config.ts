import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'netlify/functions/**/*.test.mjs'],
    coverage: {
      enabled: false,
    },
  },
});
