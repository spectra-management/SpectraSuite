#!/usr/bin/env node
/**
 * Import-boundary check (CI). Enforces the rules in src/IMPORT_RULES.md for the
 * modular architecture (src/modules/*, src/shared/*, src/suite/*):
 *
 *   1. A module (src/modules/<A>/…) must NOT import from another module
 *      (src/modules/<B>/…) — neither via the `@/modules/B` alias nor a relative
 *      path. Modules talk through the shared layer (src/shared/**), never sideways.
 *   2. The shared layer (src/shared/**) must NOT import from a feature: not from
 *      a module (src/modules/**) nor from the suite shell (src/suite/**). Shared
 *      code stays feature-agnostic so any module can reuse it.
 *   3. Foundation lib (src/shared/lib/**) must NOT import from feature state
 *      (src/shared/store/**) — it stays UI- and state-agnostic.
 *
 * The composition root (src/App.tsx, src/main.tsx) is exempt: it wires modules,
 * suite and shared together by design.
 *
 * Circular dependencies are checked separately by `madge --circular`.
 * Exits non-zero (failing CI) when a violation is found.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, dirname } from 'node:path'

const ROOT = resolve(process.cwd(), 'src')
const violations = []

// Composition root files that may legitimately wire all layers together.
const COMPOSITION_ROOT = new Set(['App.tsx', 'main.tsx'])

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...walk(p))
    else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\.(ts|tsx)$/.test(entry)) out.push(p)
  }
  return out
}

const norm = (absFile) => relative(ROOT, absFile).replace(/\\/g, '/')

// First path segment under src/modules/ — the module a file belongs to.
function moduleOf(relPath) {
  if (!relPath.startsWith('modules/')) return null
  return relPath.split('/')[1] || null
}

const importRe = /import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g

for (const file of walk(ROOT)) {
  const relFile = norm(file)
  if (COMPOSITION_ROOT.has(relFile)) continue

  const src = readFileSync(file, 'utf8')
  const fromModule = moduleOf(relFile)
  const isShared = relFile.startsWith('shared/')
  const isSharedLib = relFile.startsWith('shared/lib/')

  let m
  while ((m = importRe.exec(src)) !== null) {
    const spec = m[1]

    // Resolve the import to a src-relative module path, if it points inside src.
    let target = null
    if (spec.startsWith('@/')) target = spec.slice(2)
    else if (spec.startsWith('.')) {
      const abs = resolve(dirname(file), spec)
      if (abs.startsWith(ROOT)) target = relative(ROOT, abs).replace(/\\/g, '/')
    }
    if (!target) continue // external package or non-src import

    // Rule 1: module → another module
    if (fromModule && target.startsWith('modules/')) {
      const toModule = target.split('/')[1]
      if (toModule && toModule !== fromModule) {
        violations.push(`${relFile} imports from another module: ${spec}`)
      }
    }

    // Rule 2: shared → feature (module or suite)
    if (isShared && (target.startsWith('modules/') || target.startsWith('suite/'))) {
      violations.push(`${relFile} (shared layer) imports a feature: ${spec}`)
    }

    // Rule 3: foundation lib → feature state
    if (isSharedLib && target.startsWith('shared/store/')) {
      violations.push(`${relFile} (foundation lib) imports feature state: ${spec}`)
    }
  }
}

if (violations.length > 0) {
  console.error('❌ Import boundary violations:\n' + violations.map((v) => '  - ' + v).join('\n'))
  process.exit(1)
}
console.log('✅ Import boundaries OK (no cross-module or shared→feature imports).')
