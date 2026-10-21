import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUpRight, BookOpen, CheckCircle2, CircleAlert, CircleHelp, ClipboardCopy,
  Download, ExternalLink, FileCheck2, Filter, GitBranch, Info, LoaderCircle,
  RefreshCw, Search, ShieldCheck,
} from 'lucide-react'
import type { GitHubRepository } from '../types/github'
import { buildAuditReport, auditAsMarkdown, type AuditFinding, type AuditReport, type FindingStatus } from '../lib/auditPro'
import { fetchAuditEvidence } from '../lib/auditProApi'

const RepositoryAdvisor = lazy(() => import('./RepositoryAdvisor').then(module => ({ default: module.RepositoryAdvisor })))

type Scope = 'audit' | 'advisor'
type FindingFilter = 'all' | FindingStatus

interface Props {
  repositories: GitHubRepository[]
  username: string
}

const FILTERS: { id: FindingFilter; label: string }[] = [
  { id: 'all', label: 'All findings' },
  { id: 'review', label: 'Review' },
  { id: 'unknown', label: 'Unknown' },
  { id: 'observed', label: 'Observed' },
  { id: 'informational', label: 'Information' },
]

const STATUS_LABELS: Record<FindingStatus, string> = {
  observed: 'Observed', review: 'Review', unknown: 'Unknown', informational: 'Information',
}

function AuditFindingRow({ finding }: { finding: AuditFinding }) {
  const Icon = finding.status === 'observed' ? CheckCircle2 : finding.status === 'review' ? CircleAlert : CircleHelp
  return <article className={`ra15-finding ra15-finding-${finding.status}`}>
    <span className="ra15-finding-symbol"><Icon size={19} aria-hidden="true"/></span>
    <div className="ra15-finding-body">
      <div className="ra15-finding-heading">
        <h4>{finding.title}</h4>
        <span className={`ra15-state ra15-state-${finding.status}`}>{STATUS_LABELS[finding.status]}</span>
      </div>
      <p>{finding.detail}</p>
      <p className="ra15-finding-guidance"><strong>Next step:</strong> {finding.recommendation}</p>
      <a href={finding.sourceUrl} target="_blank" rel="noopener noreferrer">Inspect public evidence <ArrowUpRight size={13}/></a>
    </div>
  </article>
}

function downloadReport(name: string, report: AuditReport, format: 'md' | 'json') {
  const file = format === 'md' ? auditAsMarkdown(report) : JSON.stringify(report, null, 2) + '\n'
  const contentType = format === 'md' ? 'text/markdown;charset=utf-8' : 'application/json;charset=utf-8'
  const url = URL.createObjectURL(new Blob([file], { type: contentType }))
  const link = document.createElement('a')
  link.href = url
  link.download = `repoverity-audit-${name.replace(/[^a-zA-Z0-9._-]+/g, '-')}-${new Date(report.inspectedAt).toISOString().slice(0, 10)}.${format}`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

export function RepositoryAuditPro({ repositories, username }: Props) {
  const [scope, setScope] = useState<Scope>('audit')
  const eligible = useMemo(() => [...repositories].sort((a, b) => a.name.localeCompare(b.name)), [repositories])
  const [selected, setSelected] = useState(() => eligible.find(item => !item.archived && !item.fork)?.full_name || eligible[0]?.full_name || '')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [report, setReport] = useState<AuditReport | null>(null)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [filter, setFilter] = useState<FindingFilter>('all')
  const request = useRef<AbortController | null>(null)

  const current = eligible.find(repo => repo.full_name === selected)
  const matches = eligible.filter(repo => (`${repo.full_name} ${repo.description || ''}`.toLowerCase()).includes(query.toLowerCase())).slice(0, 100)
  const visible = report?.findings.filter(item => filter === 'all' || item.status === filter) ?? []

  useEffect(() => () => request.current?.abort(), [])

  function choose(name: string) {
    request.current?.abort()
    request.current = null
    setSelected(name)
    setReport(null)
    setError('')
    setFeedback('')
    setStatus('idle')
    setFilter('all')
  }

  async function runAudit() {
    if (!current || status === 'loading') return
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setStatus('loading')
    setError('')
    setFeedback('')
    try {
      const evidence = await fetchAuditEvidence(current, controller.signal, { refresh: Boolean(report) })
      if (controller.signal.aborted) return
      setReport(buildAuditReport(current, evidence))
      setStatus('success')
    } catch (reason) {
      if (controller.signal.aborted) return
      setStatus('error')
      setReport(null)
      setError(reason instanceof Error ? reason.message : 'Could not inspect this repository.')
    }
  }

  async function copy() {
    if (!report) return
    try {
      await navigator.clipboard.writeText(auditAsMarkdown(report))
      setFeedback('Evidence report copied to clipboard.')
    } catch { setFeedback('Clipboard unavailable. Use the Markdown download instead.') }
  }

  return <section className="ra15-root" aria-labelledby="ra15-title">
    <div className="ra15-heading">
      <div><span className="ra15-eyebrow"><GitBranch size={14}/> REPOVERITY / AUDIT WORKSPACE</span>
        <h2 id="ra15-title">Repository review</h2>
        <p>Public GitHub evidence, documented limitations and concrete next steps. No generated security scores.</p>
      </div>
      <span className="ra15-readonly"><ShieldCheck size={15}/> READ ONLY</span>
    </div>
    <nav className="ra15-tabs" aria-label="Repository review sections">
      <button type="button" className={scope === 'audit' ? 'ra15-tab-active' : ''} aria-pressed={scope === 'audit'} onClick={() => setScope('audit')}><FileCheck2 size={16}/> Evidence audit</button>
      <button type="button" className={scope === 'advisor' ? 'ra15-tab-active' : ''} aria-pressed={scope === 'advisor'} onClick={() => setScope('advisor')}><BookOpen size={16}/> Metadata advisor</button>
    </nav>

    {scope === 'advisor' ? <Suspense fallback={<div className="ra15-wait" role="status">Loading metadata advisor...</div>}>
      <RepositoryAdvisor repositories={repositories} username={username}/>
    </Suspense> : <div className="ra15-workbench">
      <div className="ra15-toolbar">
        <div className="ra15-toolbar-title"><span>01 / TARGET REPOSITORY</span><h3>Select a public project</h3></div>
        <div className="ra15-toolbar-controls">
          <label className="ra15-search"><Search size={17}/><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Filter repositories" aria-label="Filter repositories"/></label>
          <label className="ra15-select"><span className="ra15-visually-hidden">Repository</span><select aria-label="Repository to audit" value={selected} onChange={event => choose(event.target.value)}>
            {matches.length === 0 && <option value={selected}>{current?.name || 'No matches'}</option>}
            {matches.length > 0 && !matches.some(repo => repo.full_name === selected) && current && <option value={selected}>{current.name} (selected)</option>}
            {matches.map(repo => <option value={repo.full_name} key={repo.id}>{repo.name}{repo.archived ? ' (archived)' : repo.fork ? ' (fork)' : ''}</option>)}
          </select></label>
          <button className="ra15-run" disabled={!current || status === 'loading'} onClick={() => void runAudit()} type="button">
            {status === 'loading' ? <LoaderCircle size={17} className="ra15-spin"/> : report ? <RefreshCw size={17}/> : <Search size={17}/>}
            {status === 'loading' ? 'Inspecting...' : report ? 'Recheck evidence' : 'Run public audit'}
          </button>
        </div>
        <p className="ra15-request-note">On request only. Up to 5 public GitHub API requests. No sign-in, scanning of private code or background collection. Selectable repositories are limited to the loaded profile sample.</p>
      </div>

      {status === 'idle' && <div className="ra15-empty">
        <FileCheck2 size={27}/><h3>Evidence before conclusions</h3>
        <p>Choose a repository and start an inspection to review README guidance, community files, GitHub Actions, and an optional dependency manifest.</p>
        <span>We do not search the codebase for vulnerabilities or generate a security rating.</span>
      </div>}
      {status === 'loading' && <div className="ra15-empty ra15-loading" role="status" aria-live="polite"><LoaderCircle size={25} className="ra15-spin"/><h3>Reading public GitHub evidence</h3><p>Checking independent endpoints. A failed request will be labeled unknown rather than missing.</p></div>}
      {status === 'error' && <div className="ra15-error" role="alert"><CircleAlert size={20}/><p>{error}</p></div>}

      {report && status === 'success' && <div className="ra15-results">
        <div className="ra15-results-top">
          <div><span className="ra15-eyebrow">02 / EVIDENCE SUMMARY</span><h3>{report.repository}</h3><p>Inspected {new Date(report.inspectedAt).toLocaleString()}. A category is a finding count, not a quality or security score.</p></div>
          <div className="ra15-exports">
            <button type="button" onClick={() => void copy()}><ClipboardCopy size={15}/> Copy</button>
            <button type="button" onClick={() => downloadReport(report.repository, report, 'md')}><Download size={15}/> Markdown</button>
            <button type="button" onClick={() => downloadReport(report.repository, report, 'json')}><Download size={15}/> JSON</button>
          </div>
        </div>
        <div className="ra15-summary" aria-label="Evidence findings summary">
          <div><span className="ra15-summary-dot ra15-dot-pass"/><strong>{report.summary.observed}</strong><span>Observed</span></div>
          <div><span className="ra15-summary-dot ra15-dot-review"/><strong>{report.summary.review}</strong><span>Review</span></div>
          <div><span className="ra15-summary-dot ra15-dot-unknown"/><strong>{report.summary.unknown}</strong><span>Unknown</span></div>
          <div><span className="ra15-summary-dot ra15-dot-info"/><strong>{report.summary.informational}</strong><span>Information</span></div>
        </div>
        <div className="ra15-list-heading"><div><span className="ra15-eyebrow">03 / FINDINGS & NEXT STEPS</span><h3>Traceable observations</h3></div><Filter size={18}/></div>
        <div className="ra15-filters" role="group" aria-label="Filter findings">
          {FILTERS.map(item => <button type="button" key={item.id} aria-pressed={filter === item.id}
            className={filter === item.id ? 'ra15-filter-active' : ''} onClick={() => setFilter(item.id)}>{item.label}</button>)}
        </div>
        {visible.length ? <div className="ra15-finding-list">{visible.map(finding => <AuditFindingRow finding={finding} key={finding.id}/>)}</div>
          : <p className="ra15-no-findings">No findings in this category for the available evidence.</p>}
        <div className="ra15-footer-note"><Info size={17}/><p>{report.methodology} A missing heading does not prove missing instructions. GitHub Actions data may cover different branches. Unknown means the API did not provide usable evidence.</p></div>
        <a className="ra15-github-link" href={current?.html_url} target="_blank" rel="noopener noreferrer">Open repository on GitHub <ExternalLink size={15}/></a>
        {feedback && <p className="ra15-feedback" role="status">{feedback}</p>}
      </div>}
    </div>}
  </section>
}
