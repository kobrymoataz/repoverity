import { appendFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { reportMarkdown, reportOutput, scanRepository } from '../src/lib/scanCore.mjs'

export async function runAction(env = process.env, options = {}) {
  const append = options.appendFile ?? appendFile
  const write = options.writeFile ?? writeFile
  const repo = env.INPUT_REPOSITORY?.trim() || env.GITHUB_REPOSITORY
  const includeRuns = env.INPUT_INCLUDE_RUNS === 'true'
  const failOnReview = env.INPUT_FAIL_ON_REVIEW === 'true'
  const workspace = path.resolve(env.GITHUB_WORKSPACE || process.cwd())
  const desired = env.INPUT_OUTPUT_PATH?.trim() || 'repoverity-report.json'
  const outputPath = path.resolve(workspace, desired)
  const relative = path.relative(workspace, outputPath)
  if (!repo || relative.startsWith('..') || path.isAbsolute(relative) || relative === '') {
    throw new Error('Repository or report destination is invalid. Output must stay in GITHUB_WORKSPACE.')
  }
  const report = await scanRepository(repo, { token: env.INPUT_GITHUB_TOKEN || '', includeRuns, fetcher: options.fetcher, now: options.now })
  if (!options.writeFile) await mkdir(path.dirname(outputPath), { recursive: true })
  await write(outputPath, reportOutput(report, 'json'), 'utf8')
  if (env.GITHUB_STEP_SUMMARY) await append(env.GITHUB_STEP_SUMMARY, reportMarkdown(report), 'utf8')
  if (env.GITHUB_OUTPUT) {
    const o = `review_count=${report.summary.review}\nunknown_count=${report.summary.unknown}\nreport_path=${outputPath}\n`
    await append(env.GITHUB_OUTPUT, o, 'utf8')
  }
  return failOnReview && report.summary.review > 0 ? 2 : 0
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try { process.exitCode = await runAction() }
  catch (error) { console.error('RepoVerity action:', error instanceof Error ? error.message : 'Execution failed.'); process.exitCode = 1 }
}
