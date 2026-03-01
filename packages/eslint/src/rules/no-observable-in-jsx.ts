import { ESLintUtils } from '@typescript-eslint/utils';
import type { TSESTree } from '@typescript-eslint/utils';
import { isObservableExpression, getJsxElementName } from '../utils/ast-helpers';

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/your-org/usels/blob/main/packages/eslint/docs/rules/${name}.md`,
);

type AllowedProps = Record<string, string[]>;

interface Options {
  allowedJsxComponents: string[];
  allowedProps: AllowedProps;
  /** Props that are always allowed on ANY element/component (e.g. React's `ref`). */
  allowedGlobalProps: string[];
}

type MessageIds = 'observableInJsx';

/**
 * Renders a human-readable name for an observable node.
 * e.g. `count$` → `'count$'`, `user$.name` → `'user$.name'`
 */
function getObservableName(node: TSESTree.Node): string {
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'MemberExpression') {
    const obj = getObservableName(node.object);
    if (node.computed) return `${obj}[...]`;
    if (node.property.type === 'Identifier') return `${obj}.${node.property.name}`;
    return obj;
  }
  return '(observable)';
}

export const noObservableInJsx = createRule<[Partial<Options>], MessageIds>({
  name: 'no-observable-in-jsx',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow using observables directly in JSX expressions without calling .get()',
    },
    messages: {
      observableInJsx:
        "Observable '{{name}}' is used directly in JSX. Call '.get()' to read its value, e.g., '{{name}}.get()'.",
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowedJsxComponents: {
            type: 'array',
            items: { type: 'string' },
          },
          allowedProps: {
            type: 'object',
            additionalProperties: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          allowedGlobalProps: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [{}],
  create(context, [userOptions]) {
    const allowedJsxComponents: string[] = userOptions.allowedJsxComponents ?? [
      'Show',
      'For',
      'Switch',
      'Memo',
      'Computed',
    ];
    const allowedProps: AllowedProps = userOptions.allowedProps ?? {
      Show: ['if', 'ifReady', 'else'],
      For: ['each'],
      Switch: ['value'],
    };
    // `ref` is always valid: React accepts observable refs from useRef$
    const allowedGlobalProps: string[] = userOptions.allowedGlobalProps ?? ['ref'];

    return {
      JSXExpressionContainer(node: TSESTree.JSXExpressionContainer) {
        const { expression } = node;

        // Skip empty expressions ({}) and spread elements
        if (
          expression.type === 'JSXEmptyExpression'
        ) {
          return;
        }

        // Only flag nodes that look like observables
        if (!isObservableExpression(expression)) {
          return;
        }

        const parent = node.parent;

        // Case 1: expression container is a JSX attribute value
        // e.g. <Show if={isLoading$}>
        if (parent && parent.type === 'JSXAttribute') {
          const attrNode = parent as TSESTree.JSXAttribute;
          const attrName =
            attrNode.name.type === 'JSXIdentifier' ? attrNode.name.name : null;

          // The opening element is the parent of the attribute
          const openingElement = attrNode.parent as TSESTree.JSXOpeningElement;
          const componentName = getJsxElementName(openingElement);

          // Globally allowed props (e.g. React's `ref` for observable refs)
          if (attrName && allowedGlobalProps.includes(attrName)) {
            return;
          }

          if (
            attrName &&
            componentName &&
            allowedProps[componentName]?.includes(attrName)
          ) {
            return; // allowed prop
          }

          // Not an allowed prop — report
          context.report({
            node,
            messageId: 'observableInJsx',
            data: { name: getObservableName(expression) },
          });
          return;
        }

        // Case 2: expression container is a child of a JSXElement
        // e.g. <Show>{obs$}</Show>
        if (parent && parent.type === 'JSXElement') {
          const jsxElement = parent as TSESTree.JSXElement;
          const componentName = getJsxElementName(jsxElement.openingElement);

          if (componentName && allowedJsxComponents.includes(componentName)) {
            return; // child of an allowed component
          }
        }

        // All other cases: report
        context.report({
          node,
          messageId: 'observableInJsx',
          data: { name: getObservableName(expression) },
        });
      },
    };
  },
});
