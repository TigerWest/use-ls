# Documentation Scripts

This directory contains scripts for managing documentation in the Astro-based documentation site.

## Overview

The documentation system automatically collects Markdown files from the source packages (`@usels/core` and `@usels/integrations`) and copies them to the Astro content directory. This ensures that documentation stays close to the code while being easily accessible in the documentation site.

## Scripts

### `collect-docs.ts`

Scans the source packages for Markdown files and copies them to the Astro content directory.

**Features:**
- Scans `packages/core/src` and `packages/integrations/src` for `.md` files
- Validates frontmatter (requires `title` field)
- Detects duplicate target paths
- Preserves `index.md` files during cleanup
- Copies files to `src/content/docs/{utils,integrations}/`

**Usage:**
```bash
pnpm collect-docs
```

**Frontmatter Requirements:**
```yaml
---
title: Required - The page title
description: Optional - Page description
order: Optional - Sort order (lower numbers appear first)
category: Optional - Category for grouping
---
```

### `watch-docs.ts`

Watches source packages for changes to Markdown files and automatically runs `collect-docs.ts` when changes are detected.

**Features:**
- Watches `packages/core/src/**/*.md` and `packages/integrations/src/**/*.md`
- Ignores `__tests__` and `__mocks__` directories
- Debounces updates (500ms delay)
- Graceful shutdown on SIGINT (Ctrl+C)

**Usage:**
```bash
# Included in docs:dev command
pnpm docs:dev
```

## Directory Structure

```
packages/astro/
├── scripts/
│   ├── collect-docs.ts    # Documentation collection script
│   ├── watch-docs.ts      # File watcher script
│   └── README.md          # This file
├── src/
│   └── content/
│       └── docs/
│           ├── utils/
│           │   ├── index.md       # Manual overview page
│           │   └── *.md           # Generated from source
│           └── integrations/
│               ├── index.md       # Manual overview page
│               └── *.md           # Generated from source
└── astro.config.mjs       # Astro configuration with autogenerate sidebar

Source packages:
packages/core/src/         # Source documentation files
packages/integrations/src/  # Source documentation files
```

## Development Workflow

1. **Start development server with watch mode:**
   ```bash
   pnpm docs:dev
   ```
   This runs both the watcher and Astro dev server concurrently.

2. **Make changes to source documentation:**
   - Edit `.md` files in `packages/core/src/` or `packages/integrations/src/`
   - The watcher detects changes and automatically copies them to Astro
   - Astro's dev server hot-reloads the changes

3. **Manual collection (if needed):**
   ```bash
   pnpm collect-docs
   ```

## Sidebar Configuration

The sidebar uses Starlight's `autogenerate` feature:

```javascript
sidebar: [
  {
    label: 'Utils',
    autogenerate: { directory: 'utils' },
  },
  {
    label: 'Integrations',
    autogenerate: { directory: 'integrations' },
  },
]
```

Starlight automatically generates navigation from the `src/content/docs/` directory structure.

## Git Workflow

Generated documentation files (except `index.md`) are gitignored:

```gitignore
# generated documentation (except index.md files)
src/content/docs/utils/*.md
!src/content/docs/utils/index.md
src/content/docs/integrations/*.md
!src/content/docs/integrations/index.md
```

This ensures:
- Only source documentation files are committed to git
- Manual index pages are preserved
- Generated files are recreated during build/dev

## Build Process

The build process automatically collects documentation:

```bash
pnpm docs:build
```

This runs:
1. `tsx scripts/collect-docs.ts` - Collects documentation
2. `astro build` - Builds the Astro site

## Key Differences from VitePress Setup

- **No sidebar generation code**: Uses Starlight's built-in `autogenerate`
- **No config updates**: Sidebar configuration is static in `astro.config.mjs`
- **Simpler structure**: Leverages Starlight's conventions
- **Content collections**: Uses Astro's type-safe content collections

## Troubleshooting

**Documentation not appearing:**
- Check that source `.md` files have required `title` frontmatter
- Run `pnpm collect-docs` manually to see any validation errors
- Verify files are copied to `src/content/docs/{utils,integrations}/`

**Watcher not detecting changes:**
- Ensure you're running `pnpm docs:dev` (not just `pnpm dev`)
- Check that file paths match the watch patterns in `watch-docs.ts`
- Look for error messages in the console

**Build failures:**
- Ensure all documentation files have valid frontmatter
- Check for duplicate filenames across packages
- Run `pnpm collect-docs` to validate before building
