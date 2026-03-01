import type { TSESLint } from '@typescript-eslint/utils';

// Strict config — superset of recommended; populated after Phase 2+ rules
// Usage in eslint.config.js:
//   import legendPlugin from '@usels/eslint-plugin';
//   export default [legendPlugin.configs.strict];
export const strict: TSESLint.FlatConfig.Config = {
  rules: {
    // Phase 1 rules (error severity):
    // 'use-legend/observable-naming': 'error',
    // 'use-legend/no-observable-in-jsx': 'error',
    // Phase 2+ rules (stricter severity):
    // 'use-legend/hook-return-naming': 'error',
    // 'use-legend/no-deprecated-api': 'error',
  },
};
