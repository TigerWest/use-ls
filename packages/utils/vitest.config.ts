import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test files to include
    include: ['src/**/*.spec.ts'],

    // Test environment
    environment: 'node',

    // Global test APIs
    globals: true,

    // Coverage configuration specific to utils package
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/index.ts'],
    },
  },
});
