import type { TSESTree } from '@typescript-eslint/utils';

/**
 * Returns true if the node is an Identifier whose name ends with `$`.
 */
export function isDollarSuffixed(node: TSESTree.Node): node is TSESTree.Identifier {
  return node.type === 'Identifier' && node.name.endsWith('$');
}

/**
 * Returns true if the node is a CallExpression of the form `expr.get()` or `expr.peek()`
 * where the object is a `$`-suffixed identifier or member expression.
 */
export function isObservableGetCall(node: TSESTree.Node): node is TSESTree.CallExpression {
  if (node.type !== 'CallExpression') return false;
  if (node.arguments.length !== 0) return false;
  const { callee } = node;
  if (callee.type !== 'MemberExpression') return false;
  const { property } = callee;
  if (property.type !== 'Identifier') return false;
  if (property.name !== 'get' && property.name !== 'peek') return false;
  return isObservableExpression(callee.object);
}

/**
 * Returns true if the node looks like an observable:
 * - `$`-suffixed Identifier (e.g. `count$`)
 * - MemberExpression whose root object is `$`-suffixed (e.g. `user$.name`)
 */
export function isObservableExpression(node: TSESTree.Node): boolean {
  if (node.type === 'Identifier') return node.name.endsWith('$');
  if (node.type === 'MemberExpression') return isObservableExpression(node.object);
  return false;
}

/**
 * Walks ancestor nodes and returns true if any matches the predicate.
 * Pass the `ancestors` array from `sourceCode.getAncestors(node)` (ESLint v9).
 */
export function hasAncestor(
  ancestors: TSESTree.Node[],
  predicate: (node: TSESTree.Node) => boolean,
): boolean {
  return ancestors.some(predicate);
}

/**
 * Returns the name of a JSX element (e.g. `Show`, `For`, `Memo`).
 * Returns null for complex member expressions or spread children.
 */
export function getJsxElementName(
  openingElement: TSESTree.JSXOpeningElement,
): string | null {
  const { name } = openingElement;
  if (name.type === 'JSXIdentifier') return name.name;
  if (name.type === 'JSXMemberExpression') {
    // e.g. <Foo.Bar> → 'Bar'
    return name.property.name;
  }
  return null;
}
