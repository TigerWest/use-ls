import type { TSESTree } from '@typescript-eslint/utils';

/**
 * Maps import source → list of exported names to track.
 * An empty array means "track all named imports from this source".
 *
 * Example:
 * ```ts
 * {
 *   '@legendapp/state': ['observable', 'computed'],
 *   '@legendapp/state/react': ['useObservable', 'useObservableState'],
 *   '@usels/core': [],  // all named imports
 * }
 * ```
 */
export type TrackFunctionsConfig = Record<string, string[]>;

export interface ImportBinding {
  /** The local name used in the file (may differ from importedName via aliasing) */
  localName: string;
  /** The exported name from the source module */
  importedName: string;
  /** The import source (e.g. '@legendapp/state/react') */
  source: string;
}

/**
 * Tracks named imports from configured packages across a single file.
 *
 * Usage inside an ESLint rule:
 * ```ts
 * const tracker = new ImportTracker(options.trackFunctions);
 * return {
 *   ImportDeclaration(node) { tracker.processImport(node); },
 *   VariableDeclarator(node) { /* use tracker.isTracked() *\/ },
 * };
 * ```
 */
export class ImportTracker {
  private bindings = new Map<string, ImportBinding>();

  constructor(private readonly trackFunctions: TrackFunctionsConfig) {}

  /**
   * Process an ImportDeclaration AST node and record relevant bindings.
   * Call this in the `ImportDeclaration` visitor.
   */
  processImport(node: TSESTree.ImportDeclaration): void {
    const source = String(node.source.value);
    const trackedNames = this.trackFunctions[source];

    // Not a tracked source
    if (trackedNames === undefined) return;

    for (const specifier of node.specifiers) {
      if (specifier.type !== 'ImportSpecifier') continue;

      const importedName =
        specifier.imported.type === 'Identifier'
          ? specifier.imported.name
          : specifier.imported.value;

      const localName = specifier.local.name;

      // Empty array = track ALL named imports from this source
      if (trackedNames.length === 0 || trackedNames.includes(importedName)) {
        this.bindings.set(localName, { localName, importedName, source });
      }
    }
  }

  /**
   * Returns true if `localName` refers to a tracked import binding.
   */
  isTracked(localName: string): boolean {
    return this.bindings.has(localName);
  }

  /**
   * Returns the binding info for a local name, or undefined if not tracked.
   */
  getBinding(localName: string): ImportBinding | undefined {
    return this.bindings.get(localName);
  }

  /**
   * Returns the set of all local names that are tracked imports.
   */
  getTrackedLocalNames(): Set<string> {
    return new Set(this.bindings.keys());
  }

  /**
   * Reset all bindings. Call between files if reusing the tracker instance.
   */
  clear(): void {
    this.bindings.clear();
  }
}
