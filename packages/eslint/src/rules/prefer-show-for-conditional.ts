import type { TSESTree } from "@typescript-eslint/utils";
import {
  hasAncestor,
  getJsxElementName,
  isDollarSuffixed,
  isObservableGetCall,
} from "../utils/ast-helpers";
import { createRule } from "../utils/create-rule";

type MessageIds = "preferShow";

interface Options {
  showComponents: string[];
  showImportSources: string[];
  requireJsxBranch: boolean;
}

/**
 * Returns true if the condition is an observable-based condition:
 * - `$`-suffixed Identifier (e.g. `isVisible$`)
 * - `.get()` or `.peek()` call on any observable expression,
 *   including chained access (e.g. `todo$.isLoading.get()`)
 */
function isObservableCondition(node: TSESTree.Node): boolean {
  return isDollarSuffixed(node) || isObservableGetCall(node);
}

/**
 * Returns true if the node is a JSX branch (JSXElement or JSXFragment).
 */
function isJsxBranch(node: TSESTree.Node): boolean {
  return node.type === "JSXElement" || node.type === "JSXFragment";
}

export const preferShowForConditional = createRule<[Partial<Options>], MessageIds>({
  name: "prefer-show-for-conditional",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer `<Show>` component over inline && / || / ternary with observable conditions in JSX.",
    },
    messages: {
      preferShow:
        "Observable-based conditional rendering detected. Use `<Show if={observable}>` for fine-grained reactivity instead.",
    },
    schema: [
      {
        type: "object",
        properties: {
          showComponents: {
            type: "array",
            items: { type: "string" },
          },
          showImportSources: {
            type: "array",
            items: { type: "string" },
          },
          requireJsxBranch: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [{}],
  create(context, [userOptions]) {
    const showComponents = userOptions.showComponents ?? ["Show", "Auto"];
    const requireJsxBranch = userOptions.requireJsxBranch ?? true;

    /**
     * Returns true if the node is inside one of the showComponents.
     * Uses the ESLint v9 sourceCode.getAncestors(node) API.
     */
    function isInsideShowComponent(node: TSESTree.Node): boolean {
      const ancestors = context.sourceCode.getAncestors(node);
      return hasAncestor(ancestors, (ancestor) => {
        if (ancestor.type !== "JSXElement") return false;
        const name = getJsxElementName(ancestor.openingElement);
        return name !== null && showComponents.includes(name);
      });
    }

    return {
      JSXExpressionContainer(node: TSESTree.JSXExpressionContainer) {
        const { expression } = node;
        if (expression.type === "JSXEmptyExpression") return;

        // Skip conditionals inside JSX attribute values (e.g. `<Btn disabled={isDisabled$ && cond} />`).
        // These cannot be replaced with <Show> — they're prop values, not rendered children.
        if (node.parent && node.parent.type === "JSXAttribute") return;

        // --- Case 1: LogicalExpression (&&, ||) ---
        if (expression.type === "LogicalExpression") {
          const { operator, left, right } = expression;
          if (operator !== "&&" && operator !== "||") return;

          if (!isObservableCondition(left)) return;
          if (requireJsxBranch && !isJsxBranch(right)) return;
          if (isInsideShowComponent(node)) return;

          context.report({ node, messageId: "preferShow" });
          return;
        }

        // --- Case 2: ConditionalExpression (? :) ---
        if (expression.type === "ConditionalExpression") {
          const { test, consequent, alternate } = expression;

          if (!isObservableCondition(test)) return;
          if (requireJsxBranch && !isJsxBranch(consequent) && !isJsxBranch(alternate)) return;
          if (isInsideShowComponent(node)) return;

          context.report({ node, messageId: "preferShow" });
          return;
        }
      },
    };
  },
});
