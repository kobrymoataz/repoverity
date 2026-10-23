import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeRepository, scanRepository, reportOutput } from '../../src/lib/scanCore.mjs'
import { runCli } from '../cli.mjs'

const repo = {
  full_name: 'octocat/demo', default_branch: 'main', private: false,
  visibility: 'public', html_url: 'https://github.com/octocat/demo',
  owner: { login: 'octocat' }, description: 'Demo project',
  license: { spdx_id: 'MIT' }, archived: false,
  stargazers_count: 2, forks_count: 1,
}
const community = { files: {
  readme: { path: 'README.md', html_url: 'https://github.com/octocat/demo/blob/main/README.md' },
  contributing: null, code_of_conduct: null, security: null, issue_template: null,
} }
const workflows = { total_count: 1, workflows: [{ state: 'active' }] }
const runs = { workflow_runs: [{ status: 'completed', conclusion: 'success' }] }
function fixture(overrides = {}) {
  const seen = []
  const fetcher = async (url, init) => {
    seen.push({ url, init })
    const suffix = new URL(url).pathname
    const item = suffix.endsWith('/community/profile') ? overrides.community ?? community
      : suffix.endsWith('/actions/workflows') ? overrides.workflows ?? workflows
      : suffix.endsWith('/actions/runs') ? overrides.runs ?? runs
      : overrides.repository ?? repo
    if (item instanceof Error) throw item
    if (item && typeof item === 'object' && 'status' in item && 'error' in item)
      return { status: item.status, ok: false, json: async () => ({ message: item.error }) }
    return { status: 200, ok: true, json: async () => item }
  }
  return { fetcher, seen }
}

test('validates slugs against traversal and foreign URL origins', () => {
  assert.equal(normalizeRepository('HTTPS://GITHUB.COM/OctoCat/Demo/'), 'octocat/demo')
  for (const s of ['../../etc/passwd','evil.com/path','https://attacker.com/octocat/demo', 'x/..', 'x/y?token=secret', '', 'x//y']) assert.equal(normalizeRepository(s), null, s)
})
test('reads only GitHub API and samples three requests by default', async () => {
  const f = fixture()
  const report = await scanRepository('octocat/demo', { fetcher: f.fetcher, now: '2026-10-23T00:00:00.000Z' })
  assert.equal(report.repository.name, 'octocat/demo')
  assert.equal(report.recordedAt, '2026-10-23T00:00:00.000Z')
  assert.equal(report.requestCount, 3)
  assert.equal(f.seen.length, 3)
  assert.ok(f.seen.every(({ url }) => url.startsWith('https://api.github.com/')))
  assert.equal(report.checks.find(x => x.id === 'ci-workflows').status, 'pass')
})
test('adds a bounded, factual latest Actions run when requested', async () => {
  const f = fixture()
  const report = await scanRepository('octocat/demo', { fetcher: f.fetcher, includeRuns: true })
  assert.equal(f.seen.length, 4)
  assert.equal(report.checks.find(x => x.id === 'ci-recent-run').status, 'pass')
})
test('missing optional API evidence is unknown, not a false missing-file judgment', async () => {
  const f = fixture({ community: { status: 403, error: 'rate limited' }, workflows: { status: 429, error: 'wait' } })
  const report = await scanRepository('octocat/demo', { fetcher: f.fetcher })
  assert.equal(report.checks.find(x => x.id === 'community-readme').status, 'unknown')
  assert.equal(report.checks.find(x => x.id === 'ci-workflows').status, 'unknown')
})
test('malformed public metadata does not create invented report', async () => {
  const f = fixture({ repository: { hello: true } })
  await assert.rejects(scanRepository('octocat/demo', { fetcher: f.fetcher }), /incomplete/)
})
test('private repository metadata is rejected before secondary API requests', async () => {
  const f = fixture({ repository: { ...repo, private: true } })
  await assert.rejects(scanRepository('octocat/demo', { fetcher: f.fetcher }), /Only public/)
  assert.equal(f.seen.length, 1)
})
test('remote failures are never mislabeled as 0 issues or security failures', async () => {
  const f = fixture({ community: new Error('network') })
  const report = await scanRepository('octocat/demo', { fetcher: f.fetcher })
  assert.equal(report.summary.unknown, 5)
})
test('Markdown, CSV and HTML sanitize untrusted repository text', async () => {
  const f = fixture({ repository: { ...repo, description: '<script>alert(1)</script>' } })
  const report = await scanRepository('octocat/demo', { fetcher: f.fetcher })
  assert.ok(reportOutput(report, 'html').includes('Content-Security-Policy'))
  assert.ok(!reportOutput(report, 'html').includes('<script>'))
  assert.ok(reportOutput(report, 'markdown').includes('octocat/demo'))
  const csv = reportOutput(report, 'csv')
  assert.ok(csv.includes('"repository","area"'))
  assert.ok(csv.endsWith('\r\n'))
})
test('CLI writes a report and supports gating after producing output', async () => {
  const f = fixture(), saves = []
  const code = await runCli(['scan','octocat/demo','--format','json','--output','report.json','--fail-on-review'],
    { fetcher: f.fetcher, writeFile: async (...args) => saves.push(args), stderr: () => {}, env: {} })
  assert.equal(code, 2)
  assert.equal(saves.length, 1)
  assert.equal(JSON.parse(saves[0][1]).repository.name, 'octocat/demo')
})
test('CLI rejects unknown flags before making network requests', async () => {
  const f = fixture()
  const code = await runCli(['scan','octocat/demo','--silence-errors'], { fetcher: f.fetcher, stderr: () => {} })
  assert.equal(code, 1)
  assert.equal(f.seen.length, 0)
})
test('CSV export protects spreadsheet cells that begin with a formula', async () => {
  const f = fixture()
  const report = await scanRepository('octocat/demo', { fetcher: f.fetcher })
  const changed = structuredClone(report)
  changed.checks[0].evidence = '=HYPERLINK("https://malicious.invalid")'
  const csv = reportOutput(changed, 'csv')
  assert.ok(csv.includes("'="))
  assert.ok(csv.includes('""https://malicious.invalid""'))
})
test('incomplete community profile leaves unreported keys unknown', async () => {
  const f = fixture({ community: { files: {} } })
  const report = await scanRepository('octocat/demo', { fetcher: f.fetcher })
  for (const row of report.checks.filter(x => x.id.startsWith('community-'))) assert.equal(row.status, 'unknown')
})
test('CLI respects explicit no-gate and reports a GitHub 404 as error', async () => {
  const f = fixture({ repository: { status: 404, error: 'missing' } })
  let text = ''
  const exit = await runCli(['scan', 'octocat/demo'], { fetcher: f.fetcher, stderr: value => text += value })
  assert.equal(exit, 1)
  assert.match(text, /not available/)
})
