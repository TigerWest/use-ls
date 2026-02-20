#!/usr/bin/env tsx
import chokidar from 'chokidar'
import * as path from 'path'
import { spawn } from 'child_process'

const ASTRO_ROOT = process.cwd()
const PACKAGES_ROOT = path.join(ASTRO_ROOT, '..', '..')

const watchPatterns = [
  path.join(PACKAGES_ROOT, 'packages', 'utils', 'src', '**/*.{md,mdx}'),
  path.join(PACKAGES_ROOT, 'packages', 'utils', 'src', '**/demo.tsx'),
  path.join(PACKAGES_ROOT, 'packages', 'integrations', 'src', '**/*.{md,mdx}'),
  path.join(PACKAGES_ROOT, 'packages', 'integrations', 'src', '**/demo.tsx'),
]

const ignorePatterns = [
  path.join(PACKAGES_ROOT, 'packages', '*', 'src', '**', '__tests__', '**'),
  path.join(PACKAGES_ROOT, 'packages', '*', 'src', '**', '__mocks__', '**'),
  'node_modules'
]

let debounceTimer: NodeJS.Timeout | null = null
const DEBOUNCE_MS = 500

function runCollectDocs(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('\n📝 Running collect-docs...')

    const child = spawn('tsx', ['scripts/collect-docs.ts'], {
      cwd: ASTRO_ROOT,
      stdio: 'inherit'
    })

    child.on('close', (code) => {
      if (code === 0) {
        console.log('✅ collect-docs completed successfully')
        resolve()
      } else {
        console.error(`❌ collect-docs failed with exit code ${code}`)
        reject(new Error(`collect-docs exited with code ${code}`))
      }
    })

    child.on('error', (err) => {
      console.error('❌ Error running collect-docs:', err)
      reject(err)
    })
  })
}

function debounceCollectDocs(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }

  debounceTimer = setTimeout(async () => {
    try {
      await runCollectDocs()
    } catch (err) {
      console.error('Failed to run collect-docs:', err)
    }
  }, DEBOUNCE_MS)
}

async function main(): Promise<void> {
  console.log('👀 Watching documentation files...')
  console.log(`   Patterns: ${watchPatterns.map(p => path.relative(PACKAGES_ROOT, p)).join(', ')}`)
  console.log(`   Debounce: ${DEBOUNCE_MS}ms\n`)

  const watcher = chokidar.watch(watchPatterns, {
    ignored: ignorePatterns,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 100
    }
  })

  watcher
    .on('add', (filePath) => {
      console.log(`📝 File added: ${path.relative(PACKAGES_ROOT, filePath)}`)
      debounceCollectDocs()
    })
    .on('change', (filePath) => {
      console.log(`📝 File changed: ${path.relative(PACKAGES_ROOT, filePath)}`)
      debounceCollectDocs()
    })
    .on('unlink', (filePath) => {
      console.log(`📝 File removed: ${path.relative(PACKAGES_ROOT, filePath)}`)
      debounceCollectDocs()
    })
    .on('error', (error) => {
      console.error(`❌ Watcher error: ${error}`)
      process.exit(1)
    })

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Stopping watcher...')
    watcher.close()
    process.exit(0)
  })
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
