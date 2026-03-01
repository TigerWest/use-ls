import type { TSESTree } from "@typescript-eslint/utils";
import { ImportTracker } from "../utils/import-tracker";
import { createRule } from "../utils/create-rule";

type MessageIds = "preferUseObserve";

interface Options {
  importSources: string[];
  replacements: string[];
  includeLayoutEffect: boolean;
  allowlist: string[];
}

export const preferUseObserve = createRule<[Partial<Options>], MessageIds>({
  name: "prefer-use-observe",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer `useObserve` or `useObserveEffect` over `useEffect`. Use Legend-State reactive hooks for all side effects.",
    },
    messages: {
      preferUseObserve:
        "Avoid `useEffect` — use `useObserve` or `useObserveEffect` for automatic dependency tracking and fine-grained reactivity.",
    },
    schema: [
      {
        type: "object",
        properties: {
          importSources: {
            type: "array",
            items: { type: "string" },
          },
          replacements: {
            type: "array",
            items: { type: "string" },
          },
          includeLayoutEffect: { type: "boolean" },
          allowlist: {
            type: "array",
            items: { type: "string" },
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [{}],
  create(context, [userOptions]) {
    const importSources = userOptions.importSources ?? ["react"];
    const includeLayoutEffect = userOptions.includeLayoutEffect ?? false;

    // Build tracked hooks list
    const hooksToTrack = ["useEffect"];
    if (includeLayoutEffect) hooksToTrack.push("useLayoutEffect");

    const trackFunctions: Record<string, string[]> = {};
    for (const src of importSources) {
      trackFunctions[src] = hooksToTrack;
    }

    const tracker = new ImportTracker(trackFunctions);

    return {
      ImportDeclaration(node: TSESTree.ImportDeclaration) {
        tracker.processImport(node);
      },

      CallExpression(node: TSESTree.CallExpression) {
        if (node.callee.type !== "Identifier") return;
        const calleeName = node.callee.name;

        if (!tracker.isTracked(calleeName)) return;

        // The first argument should be the callback
        const callback = node.arguments[0];
        if (!callback) return;

        context.report({ node, messageId: "preferUseObserve" });
      },
    };
  },
});
