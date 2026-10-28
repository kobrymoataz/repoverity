import { ActionWizard } from './ActionWizard'
import { AuditComparison } from './AuditComparison'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { AlertCircle, ArrowRight, ArrowUpRight, CheckCircle2, ClipboardCopy, Code2, Download, FileText, Github, LoaderCircle, RefreshCw, ShieldCheck, Terminal, Workflow, X } from 'lucide-react'
import { normalizeRepository, reportOutput, scanRepository, type AuditReport } from '../lib/scanCore.mjs'

type ExportFormat = 'json' | 'markdown' | 'csv' | 'html'
const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n)
const statusLabel = { pass: 'Observed', review: 'Review', unknown: 'Unknown', info: 'Information' }

function exportFile(report: AuditReport, format: ExportFormat) {
  const extensions = { json: 'json', markdown: 'md', csv: 'csv', html: 'html' }
  const content = reportOutput(report, format)
  const mime = format === 'json' ? 'application/json' : format === 'csv' ? 'text/csv' : format === 'html' ? 'text/html' : 'text/markdown'
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const link = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = link
  anchor.download = `repoverity-${report.repository.name.replace('/', '-')}-audit.${extensions[format]}`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(link), 1000)
}

const yaml = `# Uses the published RepoVerity v1.9.0 Action tag.
name: RepoVerity evidence audit
on:
  workflow_dispatch:
permissions:
  contents: read
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - name: Run RepoVerity
        uses: kobrymoataz/repoverity@v1.9.0
        with:
          repository: \${{ github.repository }}
          github_token: \${{ github.token }}
          fail_on_review: 'false'`

export function DeveloperTools({ defaultRepository }: { defaultRepository: string }) {
  const [draft, setDraft] = useState(normalizeRepository(defaultRepository) ?? 'kobrymoataz/repoverity')
  const [runs, setRuns] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [report, setReport] = useState<AuditReport | null>(null)
  const [copied, setCopied] = useState<'cli' | 'action' | null>(null)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  const name = normalizeRepository(draft)
  const cliText = `node tools/cli.mjs scan ${name ?? 'owner/repo'} --format markdown --output audit.md${runs ? ' --include-runs' : ''}`

  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name) { setError('Enter a valid public owner/repository.'); setReport(null); return }
    controller.current?.abort()
    const ctrl = new AbortController()
    controller.current = ctrl
    setBusy(true); setError(''); setReport(null)
    try {
      const result = await scanRepository(name, { signal: ctrl.signal, includeRuns: runs })
      if (!ctrl.signal.aborted) setReport(result)
    } catch (reason) {
      if (!ctrl.signal.aborted) setError(reason instanceof Error ? reason.message : 'Repository check failed.')
    } finally { if (!ctrl.signal.aborted) setBusy(false) }
  }
  async function copy(kind: 'cli' | 'action') {
    const content = kind === 'cli' ? cliText : yaml
    try {
      await navigator.clipboard.writeText(content)
      setCopied(kind); setError('')
    } catch { setError('Clipboard access was denied. Select and copy the snippet manually.') }
  }
  return <div className="rv-dtools">
    <header className="rv-dtools-hero">
      <div className="rv-dtools-hero-title"><span className="rv-dtools-icon"><Terminal size={23}/></span><div><span className="rv-kicker">DEVELOPER WORKBENCH / V2.1</span><h2>One report. Three workflows.</h2><p>Scan public evidence in RepoVerity, from Terminal, or in GitHub Actions. The same checks and export formats power all three.</p></div></div>
      <span className="rv-dtools-readonly"><ShieldCheck size={15}/> READ ONLY</span>
    </header>
    <section className="rv-dtools-card" aria-label="Public repository evidence audit">
      <div className="rv-dtools-card-top"><div><h3>Repository evidence report</h3><p>Three GitHub REST requests by default; four when recent workflow runs are included. No repository changes.</p></div><Github size={21}/></div>
      <form className="rv-dtools-form" onSubmit={run}>
        <label htmlFor="rv-dtools-repo">PUBLIC GITHUB REPOSITORY</label>
        <div className="rv-dtools-form-row"><input id="rv-dtools-repo" value={draft} onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)} spellCheck={false} placeholder="owner/repository" autoComplete="off" aria-invalid={Boolean(draft.trim()) && !name} disabled={busy}/><button className="rv-primary-button" type="submit" disabled={busy || !name}>{busy ? <><LoaderCircle size={16} className="rv-dtools-spinner"/> Checking</> : <><RefreshCw size={16}/> Run audit</>}</button></div>
        <label className="rv-dtools-optional"><input type="checkbox" checked={runs} onChange={(e: ChangeEvent<HTMLInputElement>) => setRuns(e.target.checked)} disabled={busy}/> Include the latest 10 workflow runs (one additional request)</label>
      </form>
      {busy && <div role="status" className="rv-dtools-notice"><LoaderCircle size={18} className="rv-dtools-spinner"/> Requesting public evidence from GitHub...</div>}
      {error && <div role="alert" className="rv-dtools-error"><AlertCircle size={16}/>{error}</div>}
      {!report && !busy && !error && <div className="rv-dtools-placeholder"><Code2 size={21}/><div><strong>Generate a verifiable report</strong><p>Evidence is requested on demand. Missing API responses are marked unknown, not failed.</p></div></div>}
      {report && <section aria-label="Audit result" className="rv-dtools-results">
        <div className="rv-dtools-result-heading"><div><span className="rv-kicker">PUBLIC EVIDENCE / {report.recordedAt.slice(0, 10)}</span><h3>{report.repository.name}</h3><p>{fmt(report.requestCount)} bounded API requests · {fmt(report.checks.length)} checks · No artificial rating</p></div><a href={report.repository.url} target="_blank" rel="noopener noreferrer">View repository <ArrowUpRight size={15}/></a></div>
        <div className="rv-dtools-metrics"><div><strong>{report.summary.pass}</strong><span>Observed</span></div><div><strong>{report.summary.review}</strong><span>Review</span></div><div><strong>{report.summary.unknown}</strong><span>Unknown</span></div><div><strong>{report.summary.info}</strong><span>Informational</span></div></div>
        <ul className="rv-dtools-checks">{report.checks.map(item => <li key={item.id} className="rv-dtools-check"><span className={`rv-dtools-state ${item.status}`}>{item.status === 'pass' ? <CheckCircle2 size={14}/> : item.status === 'review' ? <AlertCircle size={14}/> : <X size={14}/>}{statusLabel[item.status]}</span><div><strong>{item.title}</strong><small>{item.section}</small><p>{item.evidence}</p>{item.recommendation && <p className="rv-dtools-recommendation">Next: {item.recommendation}</p>}</div>{item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`Evidence for ${item.title}`}><ArrowUpRight size={16}/></a>}</li>)}</ul>
        <div className="rv-dtools-export"><strong><Download size={16}/> Export the exact observed report</strong><div>{([['markdown','Markdown'],['json','JSON'],['csv','CSV'],['html','HTML / PDF'] ] as [ExportFormat,string][]).map(([format,label]) => <button type="button" key={format} onClick={() => exportFile(report, format)}>{label}<Download size={13}/></button>)}</div></div>
        <p className="rv-dtools-disclaimer">{report.disclaimer} HTML can be opened in a browser and printed to PDF.</p>
      </section>}
    </section>
    <div className="rv-dtools-integrations">
      <section className="rv-dtools-card"><div className="rv-dtools-card-top"><div><span className="rv-kicker">INTEGRATION 01</span><h3><Terminal size={19}/> RepoVerity CLI</h3><p>Run the same checks locally with Node.js 22 or newer. Exports Markdown, JSON, CSV and HTML.</p></div></div><div className="rv-dtools-code"><code>{cliText}</code><button type="button" aria-label="Copy CLI command" onClick={() => void copy('cli')}><ClipboardCopy size={16}/></button></div><p className="rv-dtools-hint">Use <code>--fail-on-review</code> to opt into an exit code of 2 when review findings exist.</p>{copied==='cli' && <span className="rv-dtools-copied">Command copied.</span>}</section>
      <section className="rv-dtools-card"><div className="rv-dtools-card-top"><div><span className="rv-kicker">INTEGRATION 02</span><h3><Workflow size={19}/> GitHub Actions</h3><p>Advisory by default. Produces a JSON artifact-ready file and a workflow job summary.</p></div></div><div className="rv-dtools-code rv-dtools-code-block"><pre>{yaml}</pre><button type="button" aria-label="Copy GitHub Action workflow" onClick={() => void copy('action')}><ClipboardCopy size={16}/></button></div><p className="rv-dtools-hint">The v1.9.0 tag is published. Grant contents: read; use the builder below for custom options.</p>{copied==='action' && <span className="rv-dtools-copied">Workflow copied.</span>}</section>
    </div>
    <AuditComparison currentReport={report}/>
    <ActionWizard defaultRepository={defaultRepository}/>
    <footer className="rv-dtools-footer"><FileText size={15}/> Reports summarize public GitHub metadata and recognized files. They cannot establish project security, compliance, or overall software quality. <a href="https://github.com/kobrymoataz/repoverity" target="_blank" rel="noopener noreferrer">Open source <ArrowRight size={14}/></a></footer>
  </div>
}
