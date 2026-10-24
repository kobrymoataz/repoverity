import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowUpRight, CheckCircle2, ClipboardCheck, Download, Github, LoaderCircle, RefreshCw, ShieldCheck, XCircle } from 'lucide-react'
import { buildLaunchExport, collectLaunchEvidence, LAUNCH_VERSION, normalizeChecklist, RELEASE_TASKS, STORAGE_KEY, summarizeLaunch, type LaunchFinding } from '../lib/launchReadiness.mjs'

function getStoredChecklist(): Record<string, boolean> {
  try { return normalizeChecklist(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null')) } catch { return {} }
}
const stateText = { pass: 'Observed', review: 'Review', unknown: 'Unknown' }
const stateIcon = { pass: CheckCircle2, review: AlertCircle, unknown: XCircle }

export function LaunchReadiness() {
  const [checked, setChecked] = useState<Record<string, boolean>>(getStoredChecklist)
  const [findings, setFindings] = useState<LaunchFinding[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [storageError, setStorageError] = useState(false)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  const summary = summarizeLaunch(findings ?? [], checked)
  const groups = [...new Set(RELEASE_TASKS.map(task => task.category))]

  function toggle(id: string) {
    const updated = { ...checked, [id]: !checked[id] }
    setChecked(updated)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: LAUNCH_VERSION, checked: updated }))
      setStorageError(false)
    } catch { setStorageError(true) }
  }
  async function runDiagnostics() {
    controller.current?.abort()
    const ctrl = new AbortController()
    controller.current = ctrl
    setBusy(true); setMessage(''); setFindings(null)
    const timeout = window.setTimeout(() => ctrl.abort(), 12000)
    try {
      const results = await collectLaunchEvidence({
        signal: ctrl.signal,
        secureContext: window.location.protocol === 'https:',
        localPreview: ['localhost', '127.0.0.1'].includes(window.location.hostname),
        appRoot: Boolean(document.querySelector('main#main-content')),
      })
      if (!ctrl.signal.aborted) setFindings(results)
    } catch {
      if (controller.current === ctrl) setMessage(ctrl.signal.aborted ? 'The request timed out. No passed status has been assumed.' : 'The check could not complete. Verify the public pages manually.')
    } finally { window.clearTimeout(timeout); if (controller.current === ctrl) setBusy(false) }
  }
  function exportChecks() {
    if (!findings) return
    const content = buildLaunchExport(findings, checked)
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = 'repoverity-v2-launch-readiness.json'
    document.body.appendChild(a); a.click(); a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <div className="rv-launch">
    <header className="rv-launch-hero">
      <div><span className="rv-kicker">RELEASE OPERATIONS / V2.0</span><h2>A clearer path to launch.</h2><p>Read public release signals and record the checks only you can confirm. Nothing is published, changed, or sent to RepoVerity.</p></div>
      <span className="rv-launch-readonly"><ShieldCheck size={15}/> READ ONLY</span>
    </header>
    <section className="rv-launch-summary" aria-label="Release overview">
      <div><span>AUTOMATED OBSERVATIONS</span><strong>{findings ? `${summary.pass} of ${findings.length}` : 'Not run'}</strong><small>GitHub public data and current page</small></div>
      <div><span>NEEDS REVIEW</span><strong>{findings ? summary.review : 'Unknown'}</strong><small>Reported findings, not security vulnerabilities</small></div>
      <div><span>MANUAL SIGN-OFF</span><strong>{summary.manualCompleted} / {summary.manualTotal}</strong><small>Stored only in this browser</small></div>
    </section>
    <section className="rv-launch-panel" aria-labelledby="rv-launch-diagnostics-title">
      <div className="rv-launch-panel-heading"><div><span className="rv-kicker">AUTOMATED EVIDENCE</span><h3 id="rv-launch-diagnostics-title">Production preflight</h3><p>Limited public checks, no authentication and no claims about private cloud infrastructure.</p></div><Github size={22}/></div>
      <div className="rv-launch-actions"><button className="rv-primary-button" type="button" onClick={()=>void runDiagnostics()} disabled={busy}>{busy ? <><LoaderCircle size={16} className="rv-launch-spin"/> Checking</> : <><RefreshCw size={16}/> Run public checks</>}</button><button className="rv-outline-button" type="button" disabled={!findings || busy} onClick={exportChecks}><Download size={16}/> Export results</button></div>
      {busy && <p role="status" className="rv-launch-message"><LoaderCircle size={16} className="rv-launch-spin"/> Requesting public GitHub evidence...</p>}
      {message && <p role="alert" className="rv-launch-message rv-launch-warning"><AlertCircle size={16}/>{message}</p>}
      {!findings && !busy && <p className="rv-launch-empty">No automatic check has run. A missing response will be marked unknown rather than failed or passed.</p>}
      {findings && <ul className="rv-launch-findings">{findings.map(item => { const Icon = stateIcon[item.status]; return <li key={item.id}><span className={`rv-launch-status ${item.status}`}><Icon size={15}/>{stateText[item.status]}</span><div><strong>{item.title}</strong><p>{item.evidence}</p></div>{item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`Open evidence: ${item.title}`}><ArrowUpRight size={17}/></a>}</li> })}</ul>}
    </section>
    <section className="rv-launch-panel" aria-labelledby="rv-launch-manual-title">
      <div className="rv-launch-panel-heading"><div><span className="rv-kicker">MANUAL SIGN-OFF</span><h3 id="rv-launch-manual-title">Release checklist</h3><p>Only tick a task after personally verifying it. These checks do not run themselves.</p></div><ClipboardCheck size={22}/></div>
      {storageError && <p role="status" className="rv-launch-message rv-launch-warning">Your browser did not allow saving this checklist. It may reset after a reload.</p>}
      {groups.map(group => <div key={group} className="rv-launch-group"><h4>{group}</h4><ul>{RELEASE_TASKS.filter(task => task.category === group).map(task => <li key={task.id}><label><input type="checkbox" checked={Boolean(checked[task.id])} onChange={()=>toggle(task.id)}/><span><strong>{task.title}</strong><small>{task.detail}</small></span></label></li>)}</ul></div>)}
    </section>
    <footer className="rv-launch-footer"><ShieldCheck size={17}/><p><strong>No automatic certification.</strong> Passing these checks cannot prove uptime, privacy compliance, application security, or readiness of a separate Cloudflare deployment. A release still requires human review. <a href="https://github.com/kobrymoataz/repoverity/blob/main/docs/LAUNCH_V2_0.md" target="_blank" rel="noopener noreferrer">Launch guide <ArrowUpRight size={14}/></a></p></footer>
  </div>
}
