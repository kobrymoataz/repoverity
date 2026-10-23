/**
 * RepoVerity 1.9, shared read-only scan core.
 * Pure output formatters and bounded public GitHub REST collection.
 */
export const REPORT_VERSION = '1.9.0'
export const REPORT_LIMITS = Object.freeze({ requests: 4, workflows: 50, runs: 10, timeoutMs: 12000 })

export class ScanError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'ScanError'
    this.status = status
  }
}

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null
const field = value => typeof value === 'string' ? value.slice(0, 500) : ''
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0
const check = (id, section, title, status, evidence, recommendation, url) => ({
  id, section, title, status, evidence: field(evidence), recommendation: field(recommendation),
  url: /^https:\/\/github\.com\//.test(url ?? '') ? url : null,
})

export function normalizeRepository(value) {
  if (typeof value !== 'string' || value.length > 240) return null
  const name = value.trim().replace(/^https:\/\/github\.com\//i, '').replace(/\/$/, '')
  const parts = name.split('/')
  if (parts.length !== 2) return null
  const [owner, repo] = parts
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(owner) || !/^[a-z\d_.-]{1,100}$/i.test(repo) || repo === '.' || repo === '..') return null
  return `${owner.toLowerCase()}/${repo.toLowerCase()}`
}

function abortable(parent, timeoutMs) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  const onAbort = () => ctrl.abort()
  if (parent?.aborted) ctrl.abort()
  else parent?.addEventListener('abort', onAbort, { once: true })
  return { signal: ctrl.signal, dispose: () => { clearTimeout(timer); parent?.removeEventListener('abort', onAbort) } }
}

async function githubJson(path, { fetcher, token, signal, timeoutMs }) {
  const timer = abortable(signal, timeoutMs)
  try {
    const headers = { 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
    if (token) headers.Authorization = `Bearer ${token}`
    const response = await fetcher(`https://api.github.com${path}`, { headers, signal: timer.signal })
    if (!response || typeof response.ok !== 'boolean' || !Number.isInteger(response.status)) throw new ScanError('GitHub response was malformed.', 502)
    if (!response.ok) {
      const message = response.status === 401 ? 'GitHub authorization failed.'
        : response.status === 403 || response.status === 429 ? 'GitHub access is limited or rate limited.'
        : response.status === 404 ? 'GitHub resource is not available.'
        : `GitHub returned HTTP ${response.status}.`
      throw new ScanError(message, response.status)
    }
    const parsed = await response.json()
    const data = object(parsed)
    if (!data) throw new ScanError('GitHub response had an unexpected structure.', 502)
    return data
  } catch (error) {
    if (signal?.aborted) throw new ScanError('The scan was cancelled.')
    if (error instanceof ScanError) throw error
    throw new ScanError(timer.signal.aborted ? 'GitHub request timed out.' : 'Unable to reach GitHub.')
  } finally { timer.dispose() }
}

function fileSignal(files, key, title, area, repoUrl, guidance) {
  if (!files || !Object.hasOwn(files, key)) return check(`community-${key}`, area, title, 'unknown', 'GitHub did not provide this field.', 'Retry when community profile data is available.', repoUrl)
  const value = files[key]
  return value && object(value)
    ? check(`community-${key}`, area, title, 'pass', `GitHub reports ${field(value.path || value.name || key)}.`, '', field(value.html_url) || repoUrl)
    : check(`community-${key}`, area, title, 'review', 'No recognized file was reported by GitHub.', guidance, repoUrl)
}

function summarize(items) {
  return { pass: items.filter(x => x.status === 'pass').length, review: items.filter(x => x.status === 'review').length,
    unknown: items.filter(x => x.status === 'unknown').length, info: items.filter(x => x.status === 'info').length }
}

/**
 * The only outgoing network host is api.github.com. Optional checks are never
 * represented as missing or failed when GitHub cannot provide the evidence.
 */
export async function scanRepository(input, options = {}) {
  const name = normalizeRepository(input)
  if (!name) throw new ScanError('Use a public GitHub owner/repository name.', 400)
  const fetcher = options.fetcher ?? fetch
  const token = options.token || ''
  const signal = options.signal
  const timeoutMs = Math.min(Math.max(Number(options.timeoutMs) || REPORT_LIMITS.timeoutMs, 2000), 30000)
  const config = { fetcher, token, signal, timeoutMs }
  const slug = name.split('/').map(encodeURIComponent).join('/')
  const repoUrl = `https://github.com/${name}`
  const metadata = await githubJson(`/repos/${slug}`, config)
  if (metadata.private === true || metadata.visibility === 'private') throw new ScanError('Only public repositories are supported.', 403)
  if (typeof metadata.full_name !== 'string' || typeof metadata.default_branch !== 'string' ||
    !object(metadata.owner) || typeof metadata.html_url !== 'string') throw new ScanError('GitHub repository metadata is incomplete.', 502)
  const requests = [
    githubJson(`/repos/${slug}/community/profile`, config),
    githubJson(`/repos/${slug}/actions/workflows?per_page=${REPORT_LIMITS.workflows}&page=1`, config),
  ]
  if (options.includeRuns) requests.push(githubJson(`/repos/${slug}/actions/runs?per_page=${REPORT_LIMITS.runs}&page=1`, config))
  const settled = await Promise.allSettled(requests)
  if (signal?.aborted) throw new ScanError('The scan was cancelled.')
  const value = index => settled[index]?.status === 'fulfilled' ? settled[index].value : null
  const unavailable = index => settled[index]?.status === 'rejected'
    ? field(settled[index].reason?.message) || 'Request failed.' : 'GitHub did not return enough evidence.'
  const files = object(value(0)?.files)
  const workflows = value(1)
  const runs = value(2)
  const records = []

  records.push(check('repository-description', 'Discoverability', 'Project description',
    field(metadata.description).trim() ? 'pass' : 'review',
    field(metadata.description).trim() ? 'Repository description is set.' : 'Repository description is absent.',
    field(metadata.description).trim() ? '' : 'Add a concise description in repository settings.', repoUrl))
  records.push(check('repository-license', 'Governance', 'License metadata',
    object(metadata.license) ? 'pass' : 'review',
    object(metadata.license) ? `GitHub reports ${field(metadata.license.spdx_id || metadata.license.name || 'a license')}.` : 'No recognized license is reported.',
    object(metadata.license) ? '' : 'Choose and publish a license that fits the project.', repoUrl))
  records.push(check('repository-archived', 'Maintenance', 'Repository state',
    metadata.archived === true ? 'info' : metadata.archived === false ? 'pass' : 'unknown',
    metadata.archived === true ? 'GitHub marks this repository as archived.' : metadata.archived === false ? 'Repository is not archived.' : 'Archive state was not provided.',
    '', repoUrl))

  const community = [
    ['readme', 'README', 'Documentation', 'Add a README describing purpose, setup, and usage.'],
    ['contributing', 'Contribution guidance', 'Community', 'Add clear contribution guidelines.'],
    ['code_of_conduct', 'Code of conduct', 'Community', 'Consider adopting a community code of conduct.'],
    ['security', 'Security policy', 'Governance', 'Explain how to report security issues privately.'],
    ['issue_template', 'Issue template', 'Community', 'Add an issue template to improve report quality.'],
  ]
  for (const [key, title, section, guidance] of community) {
    if (!files) records.push(check(`community-${key}`, section, title, 'unknown', unavailable(0), 'Retry when GitHub community profile data is available.', repoUrl))
    else records.push(fileSignal(files, key, title, section, repoUrl, guidance))
  }
  if (!workflows || !Array.isArray(workflows.workflows) || !Number.isSafeInteger(workflows.total_count)) {
    records.push(check('ci-workflows', 'Automation', 'GitHub Actions workflows', 'unknown', unavailable(1), 'Verify workflow configuration directly on GitHub.', `${repoUrl}/actions`))
  } else {
    const activeCount = workflows.workflows.filter(x => object(x) && x.state === 'active').length
    const isActive = activeCount > 0
    records.push(check('ci-workflows', 'Automation', 'GitHub Actions workflows', isActive ? 'pass' : 'review',
      `${workflows.total_count} workflows reported; ${activeCount} active in the first ${REPORT_LIMITS.workflows} returned.`,
      isActive ? '' : 'Review whether an automated CI workflow would benefit this repository.', `${repoUrl}/actions`))
  }
  if (options.includeRuns) {
    if (!runs || !Array.isArray(runs.workflow_runs)) {
      records.push(check('ci-recent-run', 'Automation', 'Latest workflow result', 'unknown', unavailable(2), 'Review recent runs on GitHub.', `${repoUrl}/actions`))
    } else {
      const latest = runs.workflow_runs[0]
      const outcome = latest && object(latest) ? latest.conclusion : null
      const status = !latest ? 'unknown' : latest.status !== 'completed' ? 'info' : outcome === 'success' ? 'pass' : 'review'
      records.push(check('ci-recent-run', 'Automation', 'Latest workflow result', status,
        !latest ? 'No recent workflow runs in the sampled page.' : `Most recent sampled run: ${field(latest.status)} / ${field(outcome || 'pending')}.`,
        status === 'review' ? 'Inspect the latest failed or cancelled run.' : '', `${repoUrl}/actions`))
    }
  }
  const repository = { name, url: repoUrl, description: field(metadata.description), defaultBranch: field(metadata.default_branch),
    stars: count(metadata.stargazers_count), forks: count(metadata.forks_count), archived: metadata.archived === true }
  return { schemaVersion: 1, toolVersion: REPORT_VERSION, recordedAt: new Date(options.now ?? Date.now()).toISOString(),
    repository, requestCount: options.includeRuns ? 4 : 3, sampleLimits: { workflows: REPORT_LIMITS.workflows, runs: options.includeRuns ? REPORT_LIMITS.runs : 0 },
    summary: summarize(records), checks: records,
    disclaimer: 'Public evidence review only. It does not scan source code for vulnerabilities, verify CI security, or establish compliance.' }
}

const escapeHtml = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
const md = value => String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[\\|`*\[\]<>]/g, ch => ({'\\':'\\\\','|':'\\|','`':'\\`','*':'\\*','[':'\\[',']':'\\]','<':'&lt;','>':'&gt;'}[ch]))
const csvCell = value => {
  let text = String(value ?? '').replace(/[\r\n\t\0-\x1f\x7f]/g, ' ')
  if (/^\s*[=+@-]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

export function reportMarkdown(report) {
  const lines = [
    `# RepoVerity evidence report: ${md(report.repository.name)}`,
    '', `Generated: ${md(report.recordedAt)}`, `Repository: ${md(report.repository.url)}`,
    `Coverage: ${report.requestCount} GitHub API requests; ${report.checks.length} checks`,
    '', `Checks: ${report.summary.pass} observed, ${report.summary.review} review, ${report.summary.unknown} unknown, ${report.summary.info} informational`,
    '', '| Area | Check | Status | Evidence | Next step |', '| --- | --- | --- | --- | --- |',
    ...report.checks.map(row => `| ${md(row.section)} | ${md(row.title)} | ${md(row.status)} | ${md(row.evidence)} | ${md(row.recommendation || 'None')} |`),
    '', md(report.disclaimer), '',
  ]
  return lines.join('\n')
}
export function reportCsv(report) {
  const rows = [['repository', 'area', 'check_id', 'check', 'status', 'evidence', 'next_step', 'source_url'], ...report.checks.map(row => [
    report.repository.name, row.section, row.id, row.title, row.status, row.evidence, row.recommendation, row.url || '',
  ])]
  return `${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}\r\n`
}
export function reportHtml(report) {
  const s = report.summary
  const tr = report.checks.map(x => `<tr><td>${escapeHtml(x.section)}</td><td><strong>${escapeHtml(x.title)}</strong></td><td class="${escapeHtml(x.status)}">${escapeHtml(x.status)}</td><td>${escapeHtml(x.evidence)}</td><td>${escapeHtml(x.recommendation || 'No action specified.')}</td></tr>`).join('\n')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>RepoVerity: ${escapeHtml(report.repository.name)}</title><style>
  :root{font-family:ui-sans-serif,system-ui,sans-serif;color:#1a2636;background:#fff}body{margin:0 auto;padding:42px 26px;max-width:1040px}h1{font-size:28px;margin-bottom:8px}p{line-height:1.55}small{color:#596a7c}.stats{display:flex;gap:13px;flex-wrap:wrap;margin:28px 0}.stats span{border:1px solid #cbd5e1;border-radius:9px;padding:13px 18px;font-weight:700}.stats strong{display:block;font-size:25px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;vertical-align:top;border-bottom:1px solid #d9e0e8;padding:12px 10px;overflow-wrap:anywhere}th{background:#edf2f6}.review{color:#a14520;font-weight:700}.pass{color:#16643b;font-weight:700}.unknown{color:#536a82;font-weight:700}.info{color:#46578e;font-weight:700}footer{padding-top:25px;color:#536479;font-size:12px}@media print{body{padding:0}thead{display:table-header-group}tr{break-inside:avoid}@page{size:A4;margin:14mm}}
  </style></head><body><small>REPOVERITY / DEVELOPER TOOLS</small><h1>Repository evidence report</h1><p><strong>${escapeHtml(report.repository.name)}</strong><br><small>${escapeHtml(report.recordedAt)} | ${report.requestCount} GitHub API requests</small></p><div class="stats"><span><strong>${s.pass}</strong>Observed</span><span><strong>${s.review}</strong>Review</span><span><strong>${s.unknown}</strong>Unknown</span><span><strong>${s.info}</strong>Informational</span></div><table><thead><tr><th>Area</th><th>Check</th><th>State</th><th>Evidence</th><th>Recommended action</th></tr></thead><tbody>${tr}</tbody></table><footer>${escapeHtml(report.disclaimer)}<br>To save as PDF, open this HTML report and use Print / Save as PDF.</footer></body></html>`
}
export function reportOutput(report, format) {
  if (format === 'json') return `${JSON.stringify(report, null, 2)}\n`
  if (format === 'markdown') return reportMarkdown(report)
  if (format === 'csv') return reportCsv(report)
  if (format === 'html') return reportHtml(report)
  throw new ScanError('Unsupported format: use json, markdown, csv, or html.', 400)
}
export const EXTENSIONS = Object.freeze({ json: 'json', markdown: 'md', csv: 'csv', html: 'html' })
