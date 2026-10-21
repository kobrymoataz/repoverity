import { existsSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'

const dist = resolve(process.argv[2] ?? 'dist')
const base = process.argv[3] ?? '/repoverity/'
const failures = []
const check = (condition, message) => { if (!condition) failures.push(message) }
const indexPath = join(dist, 'index.html')
check(existsSync(indexPath), 'Missing dist/index.html')
if (existsSync(indexPath)) {
  const html = readFileSync(indexPath, 'utf8')
  check(!html.includes('/src/main.tsx'), 'Uncompiled Vite development entry found in production HTML')
  check(html.includes('<div id="root"></div>'), 'Missing React root element')
  const links = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1])
  const assets = links.filter(link => link.startsWith(base))
  check(assets.some(link => /\/assets\/.*\.js$/.test(link)), 'No compiled JavaScript entry under the Pages base path')
  check(assets.some(link => /\/assets\/.*\.css$/.test(link)), 'No compiled CSS under the Pages base path')
  for (const link of assets) {
    const localPath = join(dist, link.slice(base.length))
    check(existsSync(localPath), `Missing asset referenced by index.html: ${link}`)
  }
  check(!links.some(link => link.startsWith('/assets/')), 'Absolute /assets URL would fail on project Pages')
}
if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`)
  process.exit(1)
}
console.log(`PASS: GitHub Pages production HTML and assets found under ${base}`)
