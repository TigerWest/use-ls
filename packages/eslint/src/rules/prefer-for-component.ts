import type { TSESTree } from "@typescript-eslint/utils";
import { hasAncestor, getJsxElementName } from "../utils/ast-helpers";
import { createRule } from "../utils/create-rule";

type MessageIds = "preferFor";

interface Options {
  forComponents: string[];
  forImportSources: string[];
  requireKeyProp: boolean;
}

/**
 * Returns true if node is a `$`-suffixed Identifier.
 */
function isDollarIdentifier(node: TSESTree.Node): boolean {
  return node.type === "Identifier" && node.name.endsWith("$");
}

/**
 * Returns true if node is `$xxx.get()` or `$xxx.peek()`.
 */
function isDollarGetCall(node: TSESTree.Node): boolean {
  if (node.type !== "CallExpression") return false;
  if (node.arguments.length !== 0) return false;
  const { callee } = node;
  if (callee.type !== "MemberExpression") return false;
  if (callee.property.type !== "Identifier") return false;
  if (callee.property.name !== "get" && callee.property.name !== "peek") return false;
  return isDollarIdentifier(callee.object);
}

/**
 * Returns true if the node is an observable `.map()` call:
 * - `items$.map(...)` (direct observable)
 * - `items$.get().map(...)` (get result)
 */
function isObservableMapCall(node: TSESTree.CallExpression): boolean {
  const { callee } = node;
  if (callee.type !== "MemberExpression") return false;
  if (callee.property.type !== "Identifier") return false;
  if (callee.property.name !== "map") return false;

  const obj = callee.object;
  return isDollarIdentifier(obj) || isDollarGetCall(obj);
}

/**
 * Returns true if a JSX element has a `key` prop.
 */
function hasKeyProp(jsxElement: TSESTree.JSXElement): boolean {
  return jsxElement.openingElement.attributes.some((attr) => {
    if (attr.type !== "JSXAttribute") return false;
    return attr.name.type === "JSXIdentifier" && attr.name.name === "key";
  });
}

/**
 * Returns true if the node is a JSXElement with a key prop (inline arrow return).
 * Handles: `(item) => <li key={...}>` (implicit return)
 */
function mapCallbackReturnsKeyedJsx(node: TSESTree.CallExpression): boolean {
  if (node.arguments.length === 0) return false;
  const callback = node.arguments[0];

  // Only handle arrow functions (v1 scope)
  if (callback.type !== "ArrowFunctionExpression") return false;

  // Implicit return: `(item) => <li key={...} />`
  const body = callback.body;
  if (body.type !== "JSXElement" && body.type !== "JSXFragment") return false;

  // Must be a JSXElement (fragments don't have key on themselves)
  if (body.type === "JSXElement") {
    return hasKeyProp(body);
  }

  // JSXFragment root — check first child for key (edge case, uncommon)
  return false;
}

export const preferForComponent = createRule<[Partial<Options>], MessageIds>({
  name: "prefer-for-component",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer `<For>` component over `.map()` on observable arrays in JSX for fine-grained reactivity.",
    },
    messages: {
      preferFor:
        "Use `<For each={observable}>` instead of `.map()` on observable arrays for fine-grained reactivity.",
    },
    schema: [
      {
        type: "object",
        properties: {
          forComponents: {
            type: "array",
            items: { type: "string" },
          },
          forImportSources: {
            type: "array",
            items: { type: "string" },
          },
          requireKeyProp: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [{}],
  create(context, [userOptions]) {
    const forComponents = userOptions.forComponents ?? ["For"];
    const requireKeyProp = userOptions.requireKeyProp ?? true;

    /**
     * Returns true if the node is already inside a <For> component.
     */
    function isInsideForComponent(node: TSESTree.Node): boolean {
      const ancestors = context.sourceCode.getAncestors(node);
      return hasAncestor(ancestors, (ancestor) => {
        if (ancestor.type !== "JSXElement") return false;
        const name = getJsxElementName(ancestor.openingElement);
        return name !== null && forComponents.includes(name);
      });
    }

    return {
      JSXExpressionContainer(node: TSESTree.JSXExpressionContainer) {
        const { expression } = node;
        if (expression.type === "JSXEmptyExpression") return;
        if (expression.type !== "CallExpression") return;

        if (!isObservableMapCall(expression)) return;

        // Check if key prop requirement is met
        if (requireKeyProp && !mapCallbackReturnsKeyedJsx(expression)) return;

        // Don't warn if already inside <For>
        if (isInsideForComponent(node)) return;

        context.report({ node, messageId: "preferFor" });
      },
    };
  },
});
