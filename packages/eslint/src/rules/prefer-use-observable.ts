import type { TSESTree } from "@typescript-eslint/utils";
import { ImportTracker } from "../utils/import-tracker";
import { createRule } from "../utils/create-rule";

type MessageIds = "preferUseObservable";

interface Options {
  importSources: string[];
  replacements: string[];
  allowPatterns: string[];
}

export const preferUseObservable = createRule<[Partial<Options>], MessageIds>({
  name: "prefer-use-observable",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer `useObservable` over React's `useState` for fine-grained reactivity in Legend-State projects.",
    },
    messages: {
      preferUseObservable:
        "`useState` detected. Consider using `useObservable` from `@legendapp/state/react` for fine-grained reactivity.",
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
          allowPatterns: {
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
    const allowPatterns = (userOptions.allowPatterns ?? []).map((p) => new RegExp(p));

    // Build trackFunctions: track `useState` from each importSource
    const trackFunctions: Record<string, string[]> = {};
    for (const src of importSources) {
      trackFunctions[src] = ["useState"];
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

        // Check allowPatterns: if the variable being assigned matches, skip
        // The parent VariableDeclarator may have an array pattern for [state, setter]
        const parent = node.parent;
        if (parent && parent.type === "VariableDeclarator") {
          const id = parent.id;
          if (id.type === "ArrayPattern") {
            // `const [count, setCount] = useState(0)` — check first element name
            const firstElement = id.elements[0];
            if (firstElement && firstElement.type === "Identifier") {
              const varName = firstElement.name;
              if (allowPatterns.some((re) => re.test(varName))) return;
            }
          } else if (id.type === "Identifier") {
            const varName = id.name;
            if (allowPatterns.some((re) => re.test(varName))) return;
          }
        }

        context.report({ node, messageId: "preferUseObservable" });
      },
    };
  },
});
