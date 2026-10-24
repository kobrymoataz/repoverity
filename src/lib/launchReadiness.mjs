/* Read-only launch checks. Never interpret a failed network request as a passed or failed deployment. */
export const LAUNCH_VERSION = '2.0.0'
export const STORAGE_KEY = 'repoverity.launch-readiness.v2'
export const RELEASE_TASKS = Object.freeze([
  { id: 'pages', category: 'Delivery', title: 'Open the deployed GitHub Pages site', detail: 'Check the live page, navigation and CSS after the merge.' },
  { id: 'mobile', category: 'Experience', title: 'Test a narrow mobile viewport', detail: 'Inspect horizontal scrolling, navigation, tap targets and keyboard focus.' },
  { id: 'motion', category: 'Experience', title: 'Check reduced-motion behavior', detail: 'Verify that animations respect the operating system preference.' },
  { id: 'report', category: 'Evidence', title: 'Validate an exported public report', detail: 'Open and inspect JSON, CSV, Markdown and print-friendly HTML.' },
  { id: 'action', category: 'Integrations', title: 'Run the GitHub Action in a second repository', detail: 'Verify permissions, output files and the published release tag.' },
  { id: 'cloud', category: 'Cloud (optional)', title: 'Verify Cloudflare OAuth and D1 manually', detail: 'Only if the optional Worker has been deployed; confirm login, logout, account deletion and migrations.' },
  { id: 'audit', category: 'Operations', title: 'Review security and dependency audit findings', detail: 'Examine npm audit output and any unresolved advisories before release.' },
  { id: 'release', category: 'Delivery', title: 'Review CI, tagged release and rollback steps', detail: 'Verify GitHub Actions passes on main, release notes are accurate and rollback is documented.' },
])

export function normalizeChecklist(raw) {
  if (!raw || typeof raw !== 'object' || raw.version !== LAUNCH_VERSION || !raw.checked || typeof raw.checked !== 'object') return {}
  const result = {}
  for (const task of RELEASE_TASKS) if (raw.checked[task.id] === true) result[task.id] = true
  return result
}
export function summarizeLaunch(findings, checked) {
  const counts = { pass: 0, review: 0, unknown: 0 }
  for (const finding of findings) if (Object.hasOwn(counts, finding.status)) counts[finding.status] += 1
  const completed = RELEASE_TASKS.filter(task => checked[task.id] === true).length
  return { ...counts, manualCompleted: completed, manualTotal: RELEASE_TASKS.length,
    ready: counts.review === 0 && counts.unknown === 0 && completed === RELEASE_TASKS.length && findings.length > 0 }
}
function finding(id, title, status, evidence, url) {
  return { id, title, status, evidence: String(evidence).slice(0, 200), ...(url ? { url } : {}) }
}

export async function collectLaunchEvidence({ fetcher = fetch, signal, secureContext = false, localPreview = false, appRoot = false } = {}) {
  const findings = [
    finding('document', 'App shell is mounted', appRoot ? 'pass' : 'review', appRoot ? 'A main landmark is present in this document.' : 'Main landmark was not found in the browser document.'),
    finding('transport', 'Browser transport', secureContext ? 'pass' : 'unknown', secureContext ? 'Current page uses HTTPS.' : localPreview ? 'Local development preview. Verify HTTPS in production.' : 'This page does not report HTTPS; verify on the public site.'),
  ]
  const root = 'https://api.github.com/repos/kobrymoataz/repoverity'
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  async function request(url) {
    const response = await fetcher(url, { method: 'GET', credentials: 'omit', headers, signal })
    if (!response || typeof response.ok !== 'boolean') throw Error('Unexpected response')
    if (response.status === 403 || response.status === 429) throw Error('GitHub API limit or access restriction')
    if (!response.ok) throw Error(`GitHub returned HTTP ${response.status}`)
    return response.json()
  }
  try {
    const data = await request(root)
    if (!data || typeof data !== 'object' || typeof data.full_name !== 'string' || typeof data.private !== 'boolean') throw Error('Repository metadata incomplete')
    const expected = data.full_name.toLowerCase() === 'kobrymoataz/repoverity'
    if (!expected) throw Error('Repository identity did not match')
    findings.push(finding('repository', 'Public source repository', data.private ? 'review' : 'pass', data.private ? 'GitHub marks the project private.' : 'GitHub reports a public repository.', 'https://github.com/kobrymoataz/repoverity'))
    findings.push(finding('archived', 'Repository maintenance', data.archived === true ? 'review' : data.archived === false ? 'pass' : 'unknown', data.archived === true ? 'GitHub marks the repository archived.' : data.archived === false ? 'Repository is not archived.' : 'Archive flag was not provided.'))
  } catch (err) {
    if (signal?.aborted) throw err
    findings.push(finding('repository', 'Public source repository', 'unknown', 'GitHub metadata was unavailable. Check the public repository manually.'))
    findings.push(finding('archived', 'Repository maintenance', 'unknown', 'No verified archive status was returned.'))
  }
  try {
    const data = await request(`${root}/actions/runs?branch=main&per_page=1`)
    if (!data || !Array.isArray(data.workflow_runs)) throw Error('Workflow data incomplete')
    const run = data.workflow_runs[0]
    if (!run) findings.push(finding('ci', 'Latest main workflow run', 'unknown', 'No workflow run returned by GitHub.'))
    else {
      const success = run.status === 'completed' && run.conclusion === 'success'
      const failed = run.status === 'completed' && ['failure','timed_out','cancelled','action_required'].includes(run.conclusion)
      findings.push(finding('ci', 'Latest main workflow run', success ? 'pass' : failed ? 'review' : 'unknown', success ? 'Latest sampled main workflow completed successfully.' : failed ? 'The latest sampled main workflow did not succeed.' : 'The latest sampled run is incomplete or has no conclusion.', 'https://github.com/kobrymoataz/repoverity/actions'))
    }
  } catch (err) {
    if (signal?.aborted) throw err
    findings.push(finding('ci', 'Latest main workflow run', 'unknown', 'GitHub Actions data could not be verified.'))
  }
  return findings
}
export function buildLaunchExport(findings, checked, timestamp = new Date().toISOString()) {
  const safeFindings = findings.map(({id,title,status,evidence,url}) => ({id,title,status,evidence,url:url || null}))
  const completed = RELEASE_TASKS.filter(t => checked[t.id]).map(t => t.id)
  return JSON.stringify({ schema: 1, product: 'RepoVerity', version: LAUNCH_VERSION, generatedAt: timestamp,
    disclaimer: 'These public signals and user-confirmed checkboxes are not security certification, uptime monitoring, or verified cloud deployment evidence.',
    checks: safeFindings, manualConfirmationIds: completed, summary: summarizeLaunch(safeFindings, checked) }, null, 2)+'\n'
}
