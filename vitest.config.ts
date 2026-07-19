import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/prepare/**/*.test.ts'],
    exclude: ['tests/site/**', 'node_modules/**'],
    passWithNoTests: true,
  },
});
