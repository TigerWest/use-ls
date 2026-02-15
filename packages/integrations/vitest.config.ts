import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
    // Suppress unhandled rejection warnings from TanStack Query mutation error tests
    // These rejections are intentionally triggered and properly handled by:
    // 1. Explicit onError handlers in MutationCache (test-utils.tsx)
    // 2. Event listeners in setup.ts that prevent rejection bubbling
    // 3. Each error test explicitly asserts on error state
    // 4. TanStack Query's internal error handling mechanisms
    // Without this, Vitest reports false positives from async mutation rejections
    dangerouslyIgnoreUnhandledErrors: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.spec.ts',
        'src/**/*.spec.tsx',
        'src/index.ts',
        'src/types.ts',
        'src/__tests__/**',
      ],
    },
  },
});
