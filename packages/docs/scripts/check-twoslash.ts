#!/usr/bin/env tsx
/**
 * Detects TwoSlash errors across all source markdown files in batch.
 *
 * Usage:
 *   pnpm twoslash:check          (from monorepo root)
 *   tsx scripts/check-twoslash   (from packages/docs)
 *
 * Note: Build packages first so @las/* types are available.
 *   pnpm --filter @las/utils build
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { twoslasher } from "twoslash";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = path.resolve(__dirname, "..");
const MONO_ROOT = path.resolve(DOCS_ROOT, "../..");

// Same compiler options as astro.config.mjs
const COMPILER_OPTIONS = {
  lib: ["dom", "dom.iterable", "esnext"],
  jsx: 4, // react-jsx
  jsxImportSource: "react",
  moduleResolution: 100, // bundler
  module: 99, // esnext
  target: 99, // esnext
  strictNullChecks: true,
  noImplicitAny: false,
  baseUrl: DOCS_ROOT,
} as const;

const TWOSLASH_BLOCK_RE = /```tsx twoslash\n([\s\S]*?)```/g;

function findMdFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findMdFiles(fullPath));
    } else if (entry.name.endsWith(".md")) {
      results.push(fullPath);
    }
  }
  return results;
}

const SOURCE_DIRS = [
  path.join(MONO_ROOT, "packages/utils/src"),
  path.join(MONO_ROOT, "packages/integrations/src"),
];

let totalChecked = 0;
let totalErrors = 0;

for (const dir of SOURCE_DIRS) {
  for (const file of findMdFiles(dir)) {
    const content = fs.readFileSync(file, "utf-8");
    const relPath = path.relative(MONO_ROOT, file);

    TWOSLASH_BLOCK_RE.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = TWOSLASH_BLOCK_RE.exec(content)) !== null) {
      const code = match[1];

      // Skip blocks that suppress all errors
      if (/^\/\/ @noErrors\b/m.test(code)) continue;

      totalChecked++;

      try {
        const result = twoslasher(code, "tsx", {
          compilerOptions: COMPILER_OPTIONS,
        });

        if (result.errors.length > 0) {
          for (const err of result.errors) {
            console.error(
              `❌  ${relPath}  line ${err.line ?? "?"}  TS${err.code}  ${err.text}`,
            );
            totalErrors++;
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`❌  ${relPath}  [twoslash threw]  ${msg}`);
        totalErrors++;
      }
    }
  }
}

console.log(`\nChecked ${totalChecked} block(s) across source markdown files.`);

if (totalErrors > 0) {
  console.error(`\n${totalErrors} error(s) found.`);
  process.exit(1);
} else {
  console.log("✅  No TwoSlash errors found.");
}
