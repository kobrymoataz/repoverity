import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'
import { gzipSync } from 'node:zlib'

export function inspectReleaseBuild(root, base = '/repoverity/') {
  const issues = []
  const indexPath = join(root, 'index.html')
  if (!existsSync(indexPath)) return { issues: ['dist/index.html is missing'], stats: {} }
  if (!/^\/[a-z0-9_-]+\/$/.test(base)) issues.push('Invalid expected project Pages base')
  const html = readFileSync(indexPath, 'utf8')
  const hrefs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1])
  const jsEntry = hrefs.find(path => path.startsWith(`${base}assets/`) && /\/index-[\w-]+\.js$/.test(path))
  const cssEntry = hrefs.find(path => path.startsWith(`${base}assets/`) && /\/index-[\w-]+\.css$/.test(path))
  if (!jsEntry) issues.push('Missing compiled JavaScript entry')
  if (!cssEntry) issues.push('Missing compiled stylesheet')
  const stats = {}
  for (const [name, link, limit] of [['JavaScript', jsEntry, 210 * 1024], ['CSS', cssEntry, 44 * 1024]]) {
    if (!link) continue
    const file = join(root, link.slice(base.length))
    if (!existsSync(file)) { issues.push(`Missing ${name} entry asset`); continue }
    const bytes = gzipSync(readFileSync(file), { level: 9 }).byteLength
    stats[name] = { gzipBytes: bytes, limitBytes: limit }
    if (bytes > limit) issues.push(`${name} entry exceeds gzip budget (${bytes} > ${limit})`)
  }
  for (const item of ['.dev.vars', '.env', '.env.local', '.git', 'wrangler.json', 'wrangler.jsonc']) {
    if (existsSync(join(root, item))) issues.push(`Sensitive or private build artifact: ${item}`)
  }
  if (!html.includes('name="description"')) issues.push('Production description is missing')
  if (!html.includes('rel="canonical"')) issues.push('Canonical link is missing')
  if (!html.includes('name="referrer"')) issues.push('Referrer policy is missing')
  if (html.includes('/src/main.tsx')) issues.push('Development entry leaked into compiled HTML')
  return { issues, stats }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const root = resolve(process.argv[2] ?? 'dist')
  const { issues, stats } = inspectReleaseBuild(root, process.argv[3] ?? '/repoverity/')
  for (const [label, v] of Object.entries(stats)) console.log(`${label} entry: ${Math.round(v.gzipBytes / 1024)} KiB gzip (budget: ${Math.round(v.limitBytes / 1024)} KiB)`)
  if (issues.length) { for (const issue of issues) console.error(`FAIL: ${issue}`); process.exitCode = 1 }
  else console.log('PASS: Production entry budgets and artifact safety checks')
}
