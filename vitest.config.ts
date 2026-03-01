import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Anchor root to this file's directory so vitest always runs from main/,
  // even if invoked from a parent directory.
  root: fileURLToPath(new URL('.', import.meta.url)),

  test: {
    // Global test APIs (describe, it, expect, etc.)
    globals: true,

    // Projects: each package defines its own environment/include/exclude
    projects: [
      'packages/babel/vitest.config.ts',
      'packages/core/vitest.config.ts',
      'packages/eslint/vitest.config.ts',
      'packages/integrations/vitest.config.ts',
    ],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['packages/*/src/**/*.ts'],
      exclude: [
        'node_modules',
        'dist',
        'build',
        '**/*.d.ts',
        '**/*.config.ts',
        '**/index.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
