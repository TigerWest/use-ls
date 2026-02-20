#!/usr/bin/env tsx
import * as fs from 'fs/promises'
import * as path from 'path'
import { execSync } from 'child_process'
import matter from 'gray-matter'
import * as ts from 'typescript'

interface Contributor {
  name: string
  email: string
}

interface ChangelogEntry {
  hash: string
  date: string
  message: string
  author: string
}

interface DocMetadata {
  title: string
  description?: string
  order?: number
  category?: string
  package?: string
  sourceFile?: string
  lastChanged?: string
  contributors?: Contributor[]
}

interface DocFile {
  sourcePath: string
  targetPath: string
  relativePath: string
  metadata: DocMetadata
  package: 'utils' | 'integrations'
  filename: string
}

const ASTRO_ROOT = process.cwd()
const PACKAGES_ROOT = path.join(ASTRO_ROOT, '..', '..')

// --- Git helpers ---

function getGitLastChanged(filePath: string): string | null {
  try {
    const result = execSync(`git log -1 --format="%aI" -- "${filePath}"`, {
      cwd: PACKAGES_ROOT,
      encoding: 'utf-8',
    }).trim()
    return result || null
  } catch {
    return null
  }
}

function getGitContributors(filePath: string): Contributor[] {
  try {
    const output = execSync(`git log --follow --format="%an|%ae" -- "${filePath}"`, {
      cwd: PACKAGES_ROOT,
      encoding: 'utf-8',
    }).trim()
    if (!output) return []
    const seen = new Set<string>()
    return output.split('\n')
      .map(line => {
        const [name, email] = line.split('|')
        return { name: name?.trim() ?? '', email: email?.trim() ?? '' }
      })
      .filter(c => c.email && !seen.has(c.email) && seen.add(c.email))
  } catch {
    return []
  }
}

function getGitChangelog(filePath: string, limit = 10): ChangelogEntry[] {
  try {
    const output = execSync(
      `git log --follow --format="%H|%aI|%s|%an" -${limit} -- "${filePath}"`,
      { cwd: PACKAGES_ROOT, encoding: 'utf-8' }
    ).trim()
    if (!output) return []
    return output.split('\n').map(line => {
      const [hash, date, message, author] = line.split('|')
      return {
        hash: hash?.slice(0, 7) ?? '',
        date: date ?? '',
        message: message ?? '',
        author: author ?? '',
      }
    })
  } catch {
    return []
  }
}

// --- TypeScript type extraction ---

function extractTypeDeclarations(sourceFilePath: string): string {
  try {
    let declarationContent = ''

    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      declaration: true,
      emitDeclarationOnly: true,
      skipLibCheck: true,
    }

    const host = ts.createCompilerHost(compilerOptions)
    host.writeFile = (fileName, content) => {
      if (fileName.endsWith('.d.ts')) declarationContent = content
    }

    const program = ts.createProgram([sourceFilePath], compilerOptions, host)
    program.emit()

    return declarationContent
      .replace(/\/\*\*[\s\S]*?\*\//g, '')  // remove JSDoc blocks
      .replace(/\/\/[^\n]*/g, '')           // remove single-line comments
      .split('\n')
      .filter(line => !line.startsWith('/// ') && !line.trim().startsWith('import ') && line.trim() !== 'export {};' && line.trim() !== '')
      .join('\n')
      .trim()
  } catch {
    return ''
  }
}

// --- Markdown body builder ---

function buildAutoSections(meta: {
  typeDeclarations: string
  sourceFile: string
  packageName: string
  contributors: Contributor[]
  changelog: ChangelogEntry[]
}): string {
  const sections: string[] = []

  if (meta.typeDeclarations) {
    sections.push(`## Type Declarations\n\n\`\`\`typescript\n${meta.typeDeclarations}\n\`\`\``)
  }

  if (meta.sourceFile) {
    const githubUrl = `https://github.com/your-org/legendapp-state-utils/blob/main/${meta.sourceFile}`
    sections.push(`## Source\n\n[View on GitHub](${githubUrl})`)
  }

  if (meta.contributors.length > 0) {
    const list = meta.contributors.map(c => `- ${c.name}`).join('\n')
    sections.push(`## Contributors\n\n${list}`)
  }

  if (meta.changelog.length > 0) {
    const list = meta.changelog
      .map(e => `- \`${e.hash}\` ${e.date.slice(0, 10)} — ${e.message} (${e.author})`)
      .join('\n')
    sections.push(`## Changelog\n\n${list}`)
  }

  return sections.join('\n\n')
}

// --- File scanner ---

async function findMarkdownFiles(dir: string): Promise<string[]> {
  const files: string[] = []

  async function walk(currentPath: string): Promise<void> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name)

      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === '__mocks__' || entry.name === 'node_modules') {
          continue
        }
        await walk(fullPath)
      } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))) {
        files.push(fullPath)
      }
    }
  }

  await walk(dir)
  return files
}

async function scanSourceFiles(): Promise<DocFile[]> {
  console.log('📂 Scanning for markdown files...')

  const utilsDir = path.join(PACKAGES_ROOT, 'packages', 'utils', 'src')
  const integrationsDir = path.join(PACKAGES_ROOT, 'packages', 'integrations', 'src')

  const utilsFiles = await findMarkdownFiles(utilsDir)
  const integrationsFiles = await findMarkdownFiles(integrationsDir)

  const allFiles = [...utilsFiles, ...integrationsFiles]
  console.log(`   Found ${allFiles.length} markdown file(s)`)

  const docFiles: DocFile[] = []
  const errors: string[] = []

  for (const sourcePath of allFiles) {
    const content = await fs.readFile(sourcePath, 'utf-8')
    const { data } = matter(content)

    if (!data.title) {
      errors.push(`Missing 'title' in frontmatter: ${sourcePath}`)
      continue
    }

    const relativeToPackages = path.relative(PACKAGES_ROOT, sourcePath)
    const parts = relativeToPackages.split(path.sep)
    const packageName = parts[1] as 'utils' | 'integrations'

    // parts[3] is the category subdirectory for both packages:
    // utils:        ['packages','utils','src','function','get','index.md']        → parts[3] = 'function'
    // integrations: ['packages','integrations','src','tanstack-query','useQuery.md'] → parts[3] = 'tanstack-query'
    const libSubDir = parts[3]

    const ext = path.extname(sourcePath)
    const filename = path.basename(sourcePath, ext)
    // Handle index.md → use parent directory name
    const slug = filename === 'index' ? path.basename(path.dirname(sourcePath)) : filename

    const targetPath = libSubDir
      ? path.join(ASTRO_ROOT, 'src', 'content', 'docs', packageName, libSubDir, `${slug}.md`)
      : path.join(ASTRO_ROOT, 'src', 'content', 'docs', packageName, `${slug}.md`)
    const relativePath = libSubDir
      ? `/${packageName}/${libSubDir}/${slug}`
      : `/${packageName}/${slug}`

    docFiles.push({
      sourcePath,
      targetPath,
      relativePath,
      metadata: data as DocMetadata,
      package: packageName,
      filename: slug,
    })
  }

  if (errors.length > 0) {
    console.error('\n❌ Validation errors:')
    errors.forEach(err => console.error(`   ${err}`))
    process.exit(1)
  }

  // Check for duplicate target paths
  const targetPaths = new Map<string, string>()
  const duplicates: string[] = []

  for (const doc of docFiles) {
    const existing = targetPaths.get(doc.targetPath)
    if (existing) {
      duplicates.push(
        `Duplicate target: ${doc.targetPath}\n  Source 1: ${existing}\n  Source 2: ${doc.sourcePath}`
      )
    } else {
      targetPaths.set(doc.targetPath, doc.sourcePath)
    }
  }

  if (duplicates.length > 0) {
    console.error('\n❌ Duplicate target paths:')
    duplicates.forEach(dup => console.error(`   ${dup}`))
    process.exit(1)
  }

  return docFiles
}

// --- Clean generated files ---

async function cleanGeneratedFiles(packageName: string): Promise<void> {
  const targetDir = path.join(ASTRO_ROOT, 'src', 'content', 'docs', packageName)

  try {
    const files = await fs.readdir(targetDir)
    for (const file of files) {
      if (file !== 'index.md') {
        const filePath = path.join(targetDir, file)
        await fs.rm(filePath, { force: true, recursive: true })
      }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err
    }
  }
}

// --- Transform and write doc files ---

async function transformAndWriteDocFiles(docFiles: DocFile[]): Promise<void> {
  console.log('\n📝 Transforming and writing documentation files...')

  await cleanGeneratedFiles('utils')
  await cleanGeneratedFiles('integrations')

  let written = 0

  for (const doc of docFiles) {
    const sourceContent = await fs.readFile(doc.sourcePath, 'utf-8')
    const { data: frontmatter, content: body } = matter(sourceContent)

    // --- Git metadata ---
    const lastChanged = getGitLastChanged(doc.sourcePath)
    const contributors = getGitContributors(doc.sourcePath)
    const changelog = getGitChangelog(doc.sourcePath)

    // --- TypeScript type extraction ---
    const dir = path.dirname(doc.sourcePath)
    const basename = doc.filename
    const possibleTsFiles = [
      path.join(dir, `${basename}.ts`),
      path.join(dir, `${basename}.tsx`),
      path.join(dir, 'index.ts'),
      path.join(dir, 'index.tsx'),
    ]

    let typeDeclarations = ''
    for (const tsFile of possibleTsFiles) {
      try {
        await fs.access(tsFile)
        typeDeclarations = extractTypeDeclarations(tsFile)
        break
      } catch {
        // file doesn't exist, try next
      }
    }

    // --- Relative source file path ---
    const sourceFile = path.relative(PACKAGES_ROOT, doc.sourcePath)

    // --- Build enhanced frontmatter ---
    const enhancedFrontmatter: Record<string, unknown> = {
      ...frontmatter,
      package: doc.package,
      sourceFile,
    }
    if (lastChanged) enhancedFrontmatter.lastChanged = lastChanged
    if (contributors.length > 0) enhancedFrontmatter.contributors = contributors

    // Remove deprecated fields
    delete enhancedFrontmatter.order

    // --- Build auto sections ---
    const autoSections = buildAutoSections({
      typeDeclarations,
      sourceFile,
      packageName: doc.package,
      contributors,
      changelog,
    })

    // --- Check for demo file (co-located with source) ---
    const demoPath = path.join(path.dirname(doc.sourcePath), 'demo.tsx')
    let hasDemo = false
    try {
      await fs.access(demoPath)
      hasDemo = true
    } catch {
      hasDemo = false
    }

    // --- Determine output extension ---
    const targetExt = hasDemo ? '.mdx' : '.md'
    const targetPath = doc.targetPath.replace(/\.md$/, targetExt)

    // --- Build final content ---
    const frontmatterLines: string[] = []
    for (const [k, v] of Object.entries(enhancedFrontmatter)) {
      if (Array.isArray(v)) {
        frontmatterLines.push(`${k}:`)
        for (const item of v) {
          if (typeof item === 'object' && item !== null) {
            const entries = Object.entries(item as Record<string, string>)
            frontmatterLines.push(`  - ${entries[0][0]}: ${entries[0][1]}`)
            for (const [ik, iv] of entries.slice(1)) {
              frontmatterLines.push(`    ${ik}: ${iv}`)
            }
          } else {
            frontmatterLines.push(`  - ${item}`)
          }
        }
      } else if (typeof v === 'string') {
        frontmatterLines.push(`${k}: ${v}`)
      } else {
        frontmatterLines.push(`${k}: ${JSON.stringify(v)}`)
      }
    }

    let finalContent = `---\n${frontmatterLines.join('\n')}\n---\n`

    if (hasDemo) {
      const packageSrcDir = path.join(PACKAGES_ROOT, 'packages', doc.package, 'src')
      const demoRelPath = path.relative(packageSrcDir, path.dirname(demoPath)).split(path.sep).join('/')
      const demoImportPath = `@demos/${doc.package}/${demoRelPath}/demo`
      finalContent += `\nimport Demo from '${demoImportPath}'\n`
    }

    let processedBody = body.trim()
    if (hasDemo) {
      // Inject <Demo client:load /> into the ## Demo section in the source body
      const sections = processedBody.split(/(?=^## )/m)
      const demoIdx = sections.findIndex(s => /^## Demo/.test(s))
      if (demoIdx !== -1) {
        sections[demoIdx] = '## Demo\n\n<Demo client:load />\n\n'
      }
      processedBody = sections.join('')
    }

    finalContent += `\n${processedBody}\n`

    if (autoSections) {
      finalContent += `\n\n${autoSections}\n`
    }

    // Ensure target directory exists
    await fs.mkdir(path.dirname(targetPath), { recursive: true })
    await fs.writeFile(targetPath, finalContent, 'utf-8')

    console.log(`   ✅ ${doc.relativePath}${hasDemo ? ' (mdx+demo)' : ''}`)
    written++
  }

  console.log(`   Written ${written} file(s)`)
}

// --- Main ---

async function main(): Promise<void> {
  console.log('🚀 Collecting documentation files...\n')

  try {
    const docFiles = await scanSourceFiles()
    await transformAndWriteDocFiles(docFiles)

    console.log('\n✨ Documentation collection complete!\n')
  } catch (error) {
    console.error('\n❌ Error:', error)
    process.exit(1)
  }
}

main()
