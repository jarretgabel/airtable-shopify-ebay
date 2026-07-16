import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    include: ['tests/unit/src/**/*.test.ts', 'tests/unit/src/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
      '@shared': new URL('./aws/src/shared', import.meta.url).pathname,
    },
  },
});
