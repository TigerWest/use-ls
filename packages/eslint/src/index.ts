import type { TSESLint } from '@typescript-eslint/utils';
import { rules } from './rules';
import { recommended } from './configs/recommended';
import { strict } from './configs/strict';

type Plugin = {
  meta: { name: string; version: string };
  rules: typeof rules;
  configs: {
    recommended: TSESLint.FlatConfig.Config;
    strict: TSESLint.FlatConfig.Config;
  };
};

const plugin: Plugin = {
  meta: {
    name: '@usels/eslint-plugin',
    version: '0.0.0',
  },
  rules,
  configs: {
    recommended,
    strict,
  },
};

// Inject plugin reference into configs so users only need:
//   export default [legendPlugin.configs.recommended]
// (avoids circular reference at type level by assigning post-creation)
Object.assign(plugin.configs.recommended, {
  ...recommended,
  plugins: { 'use-legend': plugin },
});
Object.assign(plugin.configs.strict, {
  ...strict,
  plugins: { 'use-legend': plugin },
});

export default plugin;
export { rules };
