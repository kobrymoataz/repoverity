import { useMemo, useState, type ChangeEvent } from 'react'
import { AlertCircle, ArrowRightLeft, CheckCircle2, Download, FileJson2, ShieldCheck, UploadCloud, X } from 'lucide-react'
import type { AuditReport } from '../lib/scanCore.mjs'
import { COMPARISON_LIMITS, compareEvidenceReports, comparisonOutput, parseEvidenceReport, type EvidenceSnapshot } from '../lib/reportComparison.mjs'

const KIND_LABELS: Record<string, string> = {
  regression: 'Regression', resolved: 'Resolved review', 'new-review': 'New review',
  'evidence-lost': 'Evidence unavailable', 'newly-observed': 'New evidence',
  changed: 'Evidence changed', added: 'Check added', removed: 'Check removed', unchanged: 'Unchanged',
}
const STATE_LABELS: Record<string, string> = { pass: 'Observed', review: 'Review', unknown: 'Unknown', info: 'Info' }

function download(result: ReturnType<typeof compareEvidenceReports>, format: 'json' | 'markdown') {
  const data = comparisonOutput(result, format)
  const blob = new Blob([data], { type: format === 'json' ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `repoverity-${result.repository.replace('/', '-')}-comparison.${format === 'json' ? 'json' : 'md'}`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function AuditComparison({ currentReport }: { currentReport: AuditReport | null }) {
  const [previous, setPrevious] = useState<EvidenceSnapshot | null>(null)
  const [uploadedCurrent, setUploadedCurrent] = useState<EvidenceSnapshot | null>(null)
  const [message, setMessage] = useState('')
  const [showUnchanged, setShowUnchanged] = useState(false)
  const comparison = useMemo(() => {
    const selected = uploadedCurrent ?? currentReport
    if (!previous || !selected) return { data: null as ReturnType<typeof compareEvidenceReports> | null, error: '' }
    try { return { data: compareEvidenceReports(previous, selected), error: '' } }
    catch (reason) { return { data: null, error: reason instanceof Error ? reason.message : 'Unable to compare these reports.' } }
  }, [previous, uploadedCurrent, currentReport])

  async function importReport(event: ChangeEvent<HTMLInputElement>, position: 'previous' | 'current') {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setMessage('')
    try {
      if (file.size > COMPARISON_LIMITS.jsonCharacters) throw Error('Choose a JSON report smaller than 512 KB.')
      const parsed = parseEvidenceReport(await file.text())
      if (position === 'previous') setPrevious(parsed)
      else setUploadedCurrent(parsed)
    } catch (reason) {
      if (position === 'previous') setPrevious(null)
      else setUploadedCurrent(null)
      setMessage(reason instanceof Error ? reason.message : 'This file is not a RepoVerity report.')
    }
  }
  const summary = comparison.data?.summary
  const changes = comparison.data?.changes.filter(change => showUnchanged || change.kind !== 'unchanged') ?? []

  return <section className="rv-dtools-card rv-compare" aria-labelledby="rv-compare-title">
    <div className="rv-dtools-card-top">
      <div><span className="rv-kicker">LOCAL EVIDENCE / COMPARE</span><h3 id="rv-compare-title"><ArrowRightLeft size={20}/> Audit Comparison Studio</h3>
        <p>Find observed changes between two public repository scans. Files stay on this device, with no upload or account required.</p></div>
      <span className="rv-compare-private"><ShieldCheck size={15}/> LOCAL ONLY</span>
    </div>
    <div className="rv-compare-uploads">
      <label className="rv-compare-upload"><span><UploadCloud size={18}/> Baseline report (older)</span>
        <input type="file" accept=".json,application/json" aria-label="Import older RepoVerity JSON report" onChange={(e: ChangeEvent<HTMLInputElement>) => void importReport(e, 'previous')}/>
        <small>{previous ? `${previous.repository.name} / ${previous.recordedAt.slice(0, 10)}` : 'Choose a previously exported RepoVerity JSON report.'}</small>
      </label>
      <label className="rv-compare-upload"><span><FileJson2 size={18}/> Current report (newer)</span>
        <input type="file" accept=".json,application/json" aria-label="Import newer RepoVerity JSON report" onChange={(e: ChangeEvent<HTMLInputElement>) => void importReport(e, 'current')}/>
        <small>{uploadedCurrent ? `${uploadedCurrent.repository.name} / ${uploadedCurrent.recordedAt.slice(0, 10)} (file)` : currentReport ? `${currentReport.repository.name} / latest on-demand scan` : 'Choose a new JSON report or run the audit above.'}</small>
      </label>
    </div>
    <div className="rv-compare-controls">
      {uploadedCurrent && <button type="button" className="rv-outline-button" onClick={() => setUploadedCurrent(null)}>Use latest on-demand scan</button>}
      {(previous || uploadedCurrent) && <button type="button" className="rv-outline-button" onClick={() => { setPrevious(null); setUploadedCurrent(null); setMessage('') }}><X size={15}/> Clear imported reports</button>}
    </div>
    {message && <p className="rv-compare-error" role="alert"><AlertCircle size={15}/>{message}</p>}
    {comparison.error && <p className="rv-compare-error" role="alert"><AlertCircle size={15}/>{comparison.error}</p>}
    {!comparison.data && !comparison.error && <p className="rv-compare-empty" role="status">Import a baseline and either import a newer report or run an audit above. Only matching repositories and chronologically ordered reports can be compared.</p>}
    {comparison.data && <div className="rv-compare-results" aria-label="Audit comparison results">
      <div className="rv-compare-summary-title"><div><strong>{comparison.data.repository}</strong><small>{comparison.data.previousAt.slice(0,10)} to {comparison.data.currentAt.slice(0,10)}</small></div><CheckCircle2 size={19}/></div>
      <div className="rv-compare-stats" role="status">
        <div><strong>{summary?.regression ?? 0}</strong><span>Regressions</span></div>
        <div><strong>{summary?.resolved ?? 0}</strong><span>Resolved</span></div>
        <div><strong>{summary?.new_review ?? 0}</strong><span>New reviews</span></div>
        <div><strong>{summary?.evidence_lost ?? 0}</strong><span>Evidence lost</span></div>
      </div>
      <div className="rv-compare-toolbar"><label><input type="checkbox" checked={showUnchanged} onChange={(e: ChangeEvent<HTMLInputElement>) => setShowUnchanged(e.target.checked)}/> Show unchanged checks</label><div><button type="button" onClick={() => download(comparison.data!, 'markdown')}><Download size={14}/> Markdown</button><button type="button" onClick={() => download(comparison.data!, 'json')}><Download size={14}/> JSON</button></div></div>
      {changes.length ? <ul className="rv-compare-list">{changes.map(change => <li key={change.id}>
        <span className={`rv-compare-kind rv-compare-${change.kind}`}>{KIND_LABELS[change.kind] ?? change.kind}</span>
        <div><strong>{change.title}</strong><small>{change.section}</small><p>{STATE_LABELS[change.beforeStatus ?? ''] ?? 'Not sampled'} to {STATE_LABELS[change.afterStatus ?? ''] ?? 'Not sampled'}</p>
          {change.beforeEvidence !== change.afterEvidence && <p className="rv-compare-evidence">Previous: {change.beforeEvidence || 'Not sampled'}<br/>Current: {change.afterEvidence || 'Not sampled'}</p>}
          {change.recommendation && <p className="rv-compare-next">Next: {change.recommendation}</p>}
        </div>
      </li>)}</ul> : <p className="rv-compare-empty">No changed checks in these reports.</p>}
      <p className="rv-dtools-disclaimer">{comparison.data.disclaimer} Reports are discarded when you leave or reload this page.</p>
    </div>}
  </section>
}
