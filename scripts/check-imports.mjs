#!/usr/bin/env node
/**
 * Import-boundary check (CI). Enforces the rules in src/IMPORT_RULES.md:
 *
 *   1. A page module (src/pages/<A>/…) must NOT import from another page module
 *      (src/pages/<B>/…) — neither via the `@/pages/B` alias nor a relative path.
 *      Modules talk through shared code (src/lib, src/components, src/hooks,
 *      src/contexts, src/store), never sideways.
 *   2. Shared/foundation code (src/lib/**) must NOT import from pages or stores
 *      (it stays UI- and feature-agnostic so any module can reuse it).
 *
 * Circular dependencies are checked separately by `madge --circular`.
 * Exits non-zero (failing CI) when a violation is found.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, dirname } from 'node:path'

const ROOT = resolve(process.cwd(), 'src')
const violations = []

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

// First path segment under src/pages/ — the "module" a file belongs to.
function pageModuleOf(absFile) {
  const rel = relative(ROOT, absFile)
  if (!rel.startsWith('pages' + '/') && !rel.startsWith('pages\\')) return null
  const seg = rel.split(/[\\/]/)[1] // e.g. "Payroll" or "Login.tsx"
  return seg.replace(/\.(ts|tsx)$/, '')
}

const importRe = /import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g

for (const file of walk(ROOT)) {
  const src = readFileSync(file, 'utf8')
  const fromModule = pageModuleOf(file)
  const isLib = relative(ROOT, file).replace(/\\/g, '/').startsWith('lib/')
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

    // Rule 1: page → other page
    if (fromModule && target.startsWith('pages/')) {
      const toModule = target.split('/')[1]
      if (toModule && toModule !== fromModule) {
        violations.push(`${relative(ROOT, file)} imports from another page module: ${spec}`)
      }
    }

    // Rule 2: lib → pages or stores
    if (isLib && (target.startsWith('pages/') || target.startsWith('store/'))) {
      violations.push(`${relative(ROOT, file)} (shared lib) imports a feature layer: ${spec}`)
    }
  }
}

if (violations.length > 0) {
  console.error('❌ Import boundary violations:\n' + violations.map((v) => '  - ' + v).join('\n'))
  process.exit(1)
}
console.log('✅ Import boundaries OK (no cross-module or lib→feature imports).')
