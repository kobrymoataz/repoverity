import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const extensions = new Set(['.ts', '.tsx', '.css', '.md', '.html', '.json', '.svg', '.yml', '.yaml', '.mjs'])
const excluded = new Set(['node_modules', '.git', 'dist', 'coverage', '.vite'])
const forbidden = String.fromCodePoint(0x2014)
const violations = []

function scan(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (excluded.has(item.name)) continue
    const absolute = path.join(dir, item.name)
    if (item.isDirectory()) { scan(absolute); continue }
    if (!item.isFile() || !extensions.has(path.extname(item.name))) continue
    const lines = fs.readFileSync(absolute, 'utf8').split(/\r?\n/)
    lines.forEach((line, index) => {
      if (line.includes(forbidden)) {
        violations.push(`${path.relative(root, absolute)}:${index + 1}`)
      }
    })
  }
}

scan(root)
if (violations.length) {
  console.error('Text quality check failed. Replace the forbidden long dash in:')
  for (const location of violations) console.error(`  ${location}`)
  process.exitCode = 1
} else {
  console.log('Text quality check passed. No forbidden long dashes found.')
}
