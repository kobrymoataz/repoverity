#!/usr/bin/env node
/** Compare two saved public RepoVerity JSON reports without network requests. */
import { readFileSync, statSync, writeFileSync, lstatSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { COMPARISON_LIMITS, compareEvidenceReports, comparisonOutput } from '../src/lib/reportComparison.mjs'

const help = `RepoVerity offline report comparison
Usage: node tools/compare.mjs BASELINE.json CURRENT.json [--format json|markdown] [--output FILE] [--fail-on-regressions]
Inputs must be RepoVerity schemaVersion 1 JSON reports, in chronological order.
Default is read-only, advisory Markdown to stdout. Reports are never uploaded.`
function args(input) {
  if (input.includes('--help') || input.includes('-h')) return { help: true }
  let format = 'markdown', output = null, strict = false
  const paths = []
  for (let i = 0; i < input.length; i++) {
    const key = input[i]
    if (key === '--format') {
      format = input[++i]
      if (!['json', 'markdown'].includes(format)) throw Error('Use --format json or markdown.')
    } else if (key === '--output') {
      output = input[++i]
      if (typeof output !== 'string' || !output.trim()) throw Error('Missing --output filename.')
    } else if (key === '--fail-on-regressions') strict = true
    else if (typeof key === 'string' && key.startsWith('-')) throw Error(`Unknown option: ${key}`)
    else paths.push(key)
  }
  if (paths.length !== 2 || paths.some(x => !x)) throw Error('Provide exactly two JSON files: BASELINE.json CURRENT.json.')
  return { paths, format, output, strict }
}
function readReport(filename) {
  const path = resolve(filename)
  const stats = statSync(path)
  if (!stats.isFile() || stats.size > COMPARISON_LIMITS.jsonCharacters) throw Error('Report must be a regular file of at most 512 KB.')
  return readFileSync(path, 'utf8')
}
function safeOutputPath(name) {
  if (isAbsolute(name)) throw Error('Output must be relative to the current directory.')
  const full = resolve(process.cwd(), name)
  const rel = relative(process.cwd(), full)
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`)) throw Error('Output must be inside the current directory.')
  const segments = rel.split(sep)
  if (segments.some(x => x === '..' || x === '')) throw Error('Invalid output path.')
  let parent = process.cwd()
  for (const part of segments.slice(0, -1)) {
    parent = resolve(parent, part)
    if (lstatSync(parent).isSymbolicLink()) throw Error('Output cannot traverse a symlink directory.')
  }
  return full
}
function main() {
  try {
    const opts = args(process.argv.slice(2))
    if (opts.help) { process.stdout.write(`${help}\n`); return }
    const result = compareEvidenceReports(readReport(opts.paths[0]), readReport(opts.paths[1]))
    const rendered = comparisonOutput(result, opts.format)
    if (opts.output) {
      writeFileSync(safeOutputPath(opts.output), rendered, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
      console.error(`Report saved: ${opts.output}`)
    } else process.stdout.write(rendered)
    if (opts.strict && result.summary.regression > 0) {
      console.error(`Review required: ${result.summary.regression} observed regression(s).`)
      process.exitCode = 2
    }
  } catch (error) {
    console.error(`RepoVerity compare: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
main()
