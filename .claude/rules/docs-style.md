---
paths:
  - "packages/utils/src/**/*.{md,mdx}"
  - "packages/integrations/src/**/*.{md,mdx}"
  - "packages/docs/**/*.{md,mdx}"
---

# API Documentation Rule

Documentation files are located next to the source code (VueUse style).
When `collect-docs.ts` is run, they are automatically generated in `packages/docs/src/content/docs/`.
Never write API docs directly in `packages/docs/src/content/docs`.

Documentation is written in English.

## File Location

```
packages/
  utils/src/{category}/{functionName}/index.md
  integrations/src/{libraryName}/{hookName}/index.md
```

Examples:

- `packages/utils/src/function/get/index.md`
- `packages/integrations/src/tanstack-query/useQuery/index.md`

## Frontmatter (Required/Optional)

```yaml
---
title: get # Required: function/hook name
category: Observable Utilities # Optional: for sidebar group display
---
```

Prohibited field: `order` (not used)

## Body Structure

````markdown
First paragraph: feature description (start immediately without h1 title)

## Demo

The demo is working code that is imported and used in mdx.
If there is a demonstrable example, write a demo.tsx and import it to enable interaction.

## Usage

You may include multiple code examples and descriptions based on the code.

```typescript
// Actual usage example code
```
````

If there are many usage patterns, you may add supplementary descriptions using ### (h3).

```

## Auto-Generated Sections (Do Not Write)

`collect-docs.ts` adds these automatically — do not write them manually:

- `## Type Declarations` — extracted from `.d.ts` via TypeScript Compiler API (comments & imports removed)
- `## Source` — GitHub link
- `## Contributors` — extracted from git log
- `## Changelog` — extracted from git log

## Prohibited

- Do not write `# Title` h1 heading (Starlight automatically displays the frontmatter title)
- Do not write `## Signature` section (replaced by Type Declarations)
- Do not use `## Examples` → use `## Usage` instead
- Do not use `order` frontmatter field

## Demo Files (Optional)

If there is an interactive demo, add a `.tsx` file:
packages/
  utils/src/{category}/{functionName}/demo.tsx
  integrations/src/{libraryName}/{hookName}/demo.tsx
```

````

If a demo file exists, `collect-docs.ts` automatically generates it as `.mdx` and imports the Demo component.

## Running collect-docs

```bash
cd packages/docs
pnpm tsx scripts/collect-docs.ts
````

After modifying documentation, you must run this, or it will be reflected automatically in `pnpm dev` (watch mode).
