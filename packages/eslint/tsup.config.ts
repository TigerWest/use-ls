import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  external: ['eslint', '@typescript-eslint/utils'],
  clean: true,
  sourcemap: true,
});
