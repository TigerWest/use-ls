import { ESLintUtils } from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/utils";
import { ImportTracker } from "../utils/import-tracker";

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/your-org/usels/blob/main/packages/eslint/docs/rules/${name}.md`
);

type MessageIds =
  | "noEnableShorthand"
  | "noEnableReactTracking"
  | "noEnableReactUse"
  | "noEnableReactComponents"
  | "noEnableReactNativeComponents";

interface Options {
  forbidApis: string[];
  allowList: string[];
}

// Map from API name -> config source path
const API_SOURCES: Record<string, string> = {
  enable$GetSet: "@legendapp/state/config/enable$GetSet",
  enable_PeekAssign: "@legendapp/state/config/enable_PeekAssign",
  enableReactTracking: "@legendapp/state/config/enableReactTracking",
  enableReactUse: "@legendapp/state/config/enableReactUse",
  enableReactComponents: "@legendapp/state/config/enableReactComponents",
  enableReactNativeComponents: "@legendapp/state/config/enableReactNativeComponents",
};

// Map from API importedName -> messageId
const API_MESSAGE_IDS: Record<string, MessageIds> = {
  enable$GetSet: "noEnableShorthand",
  enable_PeekAssign: "noEnableShorthand",
  enableReactTracking: "noEnableReactTracking",
  enableReactUse: "noEnableReactUse",
  enableReactComponents: "noEnableReactComponents",
  enableReactNativeComponents: "noEnableReactNativeComponents",
};

const DEFAULT_FORBID_APIS = Object.keys(API_SOURCES);

export const noEnableApi = createRule<[Partial<Options>], MessageIds>({
  name: "no-enable-api",
  meta: {
    type: "suggestion",
    docs: {
      description: "Warn against using Legend-State global enable* configuration APIs.",
    },
    messages: {
      noEnableShorthand:
        "Use explicit `.get()` / `.set()` instead. Shorthand accessors conflict with the `$` suffix naming convention.",
      noEnableReactTracking:
        "enableReactTracking adds global React tracking. Prefer fine-grained components (`<Show>`, `<Memo>`) or Babel/Vite plugin.",
      noEnableReactUse:
        "`.use()` added globally may trigger whole-component re-renders. Use `useSelector()` explicitly instead.",
      noEnableReactComponents:
        "enableReactComponents registers `<Reactive.*>` globally. Consider importing only what you need from `@legendapp/state/react`.",
      noEnableReactNativeComponents:
        "enableReactNativeComponents registers `<Reactive.*>` globally. Consider importing only what you need.",
    },
    schema: [
      {
        type: "object",
        properties: {
          forbidApis: {
            type: "array",
            items: { type: "string" },
          },
          allowList: {
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
    const forbidApis = userOptions.forbidApis ?? DEFAULT_FORBID_APIS;
    const allowList = userOptions.allowList ?? [];

    // Build effective list
    const effectiveForbid = forbidApis.filter((api) => !allowList.includes(api));

    // Build trackFunctions config from effective APIs
    const trackFunctions: Record<string, string[]> = {};
    for (const apiName of effectiveForbid) {
      const source = API_SOURCES[apiName];
      if (source) {
        trackFunctions[source] = [apiName];
      }
    }

    const tracker = new ImportTracker(trackFunctions);

    return {
      ImportDeclaration(node: TSESTree.ImportDeclaration) {
        tracker.processImport(node);
      },

      CallExpression(node: TSESTree.CallExpression) {
        // Only check simple Identifier callees
        if (node.callee.type !== "Identifier") return;
        const calleeName = node.callee.name;

        if (!tracker.isTracked(calleeName)) return;

        // Get the original imported name to find the right message
        const binding = tracker.getBinding(calleeName);
        if (!binding) return;

        const messageId = API_MESSAGE_IDS[binding.importedName];
        if (!messageId) return;

        context.report({
          node,
          messageId,
        });
      },
    };
  },
});
