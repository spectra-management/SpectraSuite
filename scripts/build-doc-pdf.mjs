#!/usr/bin/env node
/**
 * Build a presentable PDF from DOCUMENTATION.md.
 *
 * Renders the Markdown (including Mermaid diagrams) in Playwright's Chromium and prints to
 * PDF with a branded cover page, styled headings/tables, and page numbers.
 *
 *   node scripts/build-doc-pdf.mjs        ->  Spectra-Suite-Documentation.pdf
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { marked } from 'marked'
import { chromium } from '@playwright/test'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MD = readFileSync(resolve(ROOT, 'DOCUMENTATION.md'), 'utf8')
const OUT = resolve(ROOT, 'Spectra-Suite-Documentation.pdf')
const mermaidJs = readFileSync(resolve(ROOT, 'node_modules/mermaid/dist/mermaid.min.js'), 'utf8')

const decode = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&amp;/g, '&')

// Markdown -> HTML, then turn ```mermaid fences into <pre class="mermaid"> with raw text.
let body = marked.parse(MD, { mangle: false, headerIds: true })
body = body.replace(
  /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
  (_, code) => `<div class="mermaid">${decode(code)}</div>`,
)

const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

const html = `<!doctype html><html><head><meta charset="utf-8">
<style>
  :root { --emerald:#059669; --ink:#0f172a; --muted:#475569; --line:#e2e8f0; --bg:#f8fafc; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, Arial, sans-serif;
    color: var(--ink); font-size: 12px; line-height: 1.6; margin: 0; }
  .cover { height: 100vh; display: flex; flex-direction: column; justify-content: center;
    page-break-after: always; padding: 0 12mm;
    background: linear-gradient(160deg, #064e3b 0%, #065f46 45%, #059669 100%); color: #ecfdf5; }
  .cover .badge { width: 64px; height: 64px; border-radius: 16px; background: rgba(255,255,255,.12);
    display: flex; align-items: center; justify-content: center; font-size: 30px; margin-bottom: 28px; }
  .cover h1 { font-size: 40px; line-height: 1.1; margin: 0 0 10px; font-weight: 800; color: #fff; }
  .cover h2 { font-size: 18px; font-weight: 500; margin: 0 0 28px; color: #d1fae5; border: 0; }
  .cover .meta { font-size: 12px; color: #a7f3d0; }
  .cover .rule { width: 72px; height: 4px; background: #34d399; border-radius: 4px; margin: 0 0 24px; }
  main { padding: 0 14mm; }
  h1, h2, h3 { color: var(--ink); line-height: 1.25; }
  h2 { font-size: 20px; margin-top: 26px; padding-bottom: 6px; border-bottom: 2px solid var(--emerald);
    page-break-before: always; page-break-after: avoid; }
  main > h2:first-of-type { page-break-before: avoid; }
  h3 { font-size: 15px; margin-top: 18px; color: #065f46; page-break-after: avoid; }
  h4 { font-size: 13px; margin-top: 14px; }
  p, li { color: #1e293b; }
  a { color: var(--emerald); text-decoration: none; }
  code { font-family: "SF Mono", ui-monospace, Menlo, Consolas, monospace; font-size: 11px;
    background: #eef2f6; padding: 1px 5px; border-radius: 4px; color: #0f172a; }
  pre { background: #0f172a; color: #e2e8f0; padding: 12px 14px; border-radius: 8px; overflow: hidden;
    page-break-inside: avoid; }
  pre code { background: transparent; color: inherit; padding: 0; font-size: 10.5px; line-height: 1.5; white-space: pre-wrap; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 11px; page-break-inside: avoid; }
  th, td { border: 1px solid var(--line); padding: 6px 9px; text-align: left; vertical-align: top; }
  th { background: #ecfdf5; color: #065f46; font-weight: 700; }
  tr:nth-child(even) td { background: #f8fafc; }
  blockquote { border-left: 4px solid var(--emerald); background: #f0fdf4; margin: 12px 0;
    padding: 8px 14px; color: #334155; border-radius: 0 6px 6px 0; }
  hr { border: 0; border-top: 1px solid var(--line); margin: 22px 0; }
  .mermaid { text-align: center; margin: 16px 0; page-break-inside: avoid; }
  .mermaid svg { max-width: 100%; height: auto; }
  ul, ol { padding-left: 20px; }
</style></head>
<body>
  <section class="cover">
    <div class="badge">📘</div>
    <div class="rule"></div>
    <h1>Spectra Suite</h1>
    <h2>System Documentation — Design, Architecture &amp; Data Model</h2>
    <div class="meta">White-label payroll · HR · billing platform &nbsp;•&nbsp; ${today}</div>
  </section>
  <main>${body}</main>
  <script>${mermaidJs}</script>
</body></html>`

const browser = await chromium.launch()
const page = await browser.newPage()
await page.setContent(html, { waitUntil: 'load' })
// Render all Mermaid diagrams and wait until SVGs are present.
await page.evaluate(async () => {
  // eslint-disable-next-line no-undef
  window.mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose' })
  // eslint-disable-next-line no-undef
  await window.mermaid.run({ querySelector: '.mermaid' })
})
await page.waitForFunction(() => document.querySelectorAll('.mermaid svg').length > 0)

// Optional visual check (VERIFY=1): screenshot the cover + each rendered diagram.
if (process.env.VERIFY) {
  const dir = process.env.VERIFY_DIR || ROOT
  await page.locator('.cover').screenshot({ path: resolve(dir, 'verify-cover.png') })
  const diagrams = page.locator('.mermaid')
  const n = await diagrams.count()
  for (let i = 0; i < n; i++) await diagrams.nth(i).screenshot({ path: resolve(dir, `verify-diagram-${i + 1}.png`) })
  console.log('VERIFY screenshots written:', n + 1)
}

await page.pdf({
  path: OUT,
  format: 'Letter',
  printBackground: true,
  margin: { top: '14mm', bottom: '16mm', left: '0', right: '0' },
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate:
    '<div style="width:100%;font-size:8px;color:#94a3b8;padding:0 14mm;display:flex;justify-content:space-between;">' +
    '<span>Spectra Suite — System Documentation</span>' +
    '<span class="pageNumber"></span> / <span class="totalPages"></span></div>',
})
await browser.close()
console.log('PDF written to', OUT)
