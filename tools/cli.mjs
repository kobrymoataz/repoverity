#!/usr/bin/env node
import { writeFile } from 'node:fs/promises'
import { EXTENSIONS, REPORT_VERSION, reportOutput, scanRepository } from '../src/lib/scanCore.mjs'

const USAGE = `RepoVerity ${REPORT_VERSION} | Public GitHub evidence scanner

Usage:
  node tools/cli.mjs scan owner/repo [options]

Options:
  --format json|markdown|csv|html   Report format (default: markdown)
  --output FILE                     Write to a file instead of stdout
  --include-runs                    Inspect up to 10 recent GitHub Actions runs
  --fail-on-review                  Exit with code 2 if review findings exist
  --help                            Show help
  --version                         Show version

Use GITHUB_TOKEN for a higher GitHub API allowance. Tokens are never printed.
HTML reports can be opened and printed to PDF using your browser.
No repository writes, source-code security scans, or historical backfills.
`

export async function runCli(args = [], options = {}) {
  const env = options.env ?? process.env
  const out = options.stdout ?? (text => process.stdout.write(text))
  const err = options.stderr ?? (text => process.stderr.write(text))
  const save = options.writeFile ?? writeFile
  if (args.length === 0 || args[0] === '--help' || args[0] === 'help') { out(USAGE); return 0 }
  if (args[0] === '--version') { out(`${REPORT_VERSION}\n`); return 0 }
  if (args[0] !== 'scan' || !args[1] || args[1].startsWith('--')) { err('Specify: scan owner/repo\n'); return 1 }
  const slug = args[1]
  let format = 'markdown', output = '', includeRuns = false, failOnReview = false
  for (let i = 2; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--format' && i + 1 < args.length) format = args[++i]
    else if (arg === '--output' && i + 1 < args.length) output = args[++i]
    else if (arg === '--include-runs') includeRuns = true
    else if (arg === '--fail-on-review') failOnReview = true
    else { err(`Unknown or incomplete option: ${arg}\n`); return 1 }
  }
  if (!Object.hasOwn(EXTENSIONS, format)) { err('Format must be json, markdown, csv, or html.\n'); return 1 }
  try {
    const report = await scanRepository(slug, { fetcher: options.fetcher, token: env.GITHUB_TOKEN ?? '', includeRuns, now: options.now })
    const content = reportOutput(report, format)
    if (output) {
      await save(output, content, 'utf8')
      err(`Saved ${format} report to ${output}. ${report.summary.review} review items, ${report.summary.unknown} unknown.\n`)
    } else out(content)
    return failOnReview && report.summary.review > 0 ? 2 : 0
  } catch (error) {
    err(`RepoVerity: ${error instanceof Error ? error.message : 'Scan failed.'}\n`)
    return 1
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exitCode = await runCli(process.argv.slice(2))
}
