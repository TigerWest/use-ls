import { ESLintUtils } from '@typescript-eslint/utils';
import type { TSESTree } from '@typescript-eslint/utils';
import { ImportTracker } from '../utils/import-tracker';
import type { TrackFunctionsConfig } from '../utils/import-tracker';

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/your-org/usels/blob/main/packages/eslint/docs/rules/${name}.md`,
);

type MessageIds = 'missingDollarSuffix';

interface Options {
  trackFunctions: TrackFunctionsConfig;
  allowPattern: string | null;
}

const defaultTrackFunctions: TrackFunctionsConfig = {
  '@legendapp/state': ['observable', 'computed'],
  '@legendapp/state/react': ['useObservable', 'useObservableState'],
  '@usels/core': [],
};

export const observableNaming = createRule<[Options], MessageIds>({
  name: 'observable-naming',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require variables holding observables to end with `$`.',
    },
    messages: {
      missingDollarSuffix:
        "Variable '{{name}}' holds an observable but does not end with '$'. Rename it to '{{name}}$'.",
    },
    schema: [
      {
        type: 'object',
        properties: {
          trackFunctions: {
            type: 'object',
            additionalProperties: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          allowPattern: {
            oneOf: [{ type: 'string' }, { type: 'null' }],
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [
    {
      trackFunctions: defaultTrackFunctions,
      allowPattern: null,
    },
  ],
  create(context, [options]) {
    const tracker = new ImportTracker(options.trackFunctions);
    const allowRegex = options.allowPattern ? new RegExp(options.allowPattern) : null;

    return {
      ImportDeclaration(node: TSESTree.ImportDeclaration) {
        tracker.processImport(node);
      },

      VariableDeclarator(node: TSESTree.VariableDeclarator) {
        // Only check Identifier patterns (skip destructuring)
        if (node.id.type !== 'Identifier') return;

        // Must have an initializer that is a CallExpression
        if (!node.init || node.init.type !== 'CallExpression') return;

        const call = node.init;

        // The callee must be a simple Identifier (direct function call)
        if (call.callee.type !== 'Identifier') return;

        const calleeName = call.callee.name;

        // Check if this function is a tracked import
        if (!tracker.isTracked(calleeName)) return;

        // Skip for...of loop variables: check parent chain
        // VariableDeclarator → VariableDeclaration → ForOfStatement.left
        const varDecl = node.parent; // VariableDeclaration
        const forOfCandidate = varDecl?.parent;
        if (
          forOfCandidate &&
          forOfCandidate.type === 'ForOfStatement' &&
          forOfCandidate.left === varDecl
        ) {
          return;
        }

        const varName = node.id.name;

        // Check allowPattern
        if (allowRegex && allowRegex.test(varName)) return;

        // Check for $ suffix
        if (!varName.endsWith('$')) {
          context.report({
            node: node.id,
            messageId: 'missingDollarSuffix',
            data: { name: varName },
          });
        }
      },
    };
  },
});
