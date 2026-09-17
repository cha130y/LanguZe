import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Resolves path aliases declared in tsconfig.json (for example, ones added by `nest g library`).
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
  },
});
