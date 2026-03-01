import type { TSESLint } from '@typescript-eslint/utils';
import { observableNaming } from './observable-naming';
import { noObservableInJsx } from './no-observable-in-jsx';

export const rules: Record<string, TSESLint.RuleModule<string, unknown[]>> = {
  'observable-naming': observableNaming,
  'no-observable-in-jsx': noObservableInJsx,
};
