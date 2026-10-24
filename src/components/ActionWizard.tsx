import { useMemo, useState, type ChangeEvent } from 'react'
import { AlertCircle, CheckCircle2, ClipboardCopy, Download, ShieldCheck, Workflow } from 'lucide-react'
import { createActionWorkflow, normalizeActionRepository, STABLE_ACTION_REF, UPCOMING_ACTION_REF, type ActionWorkflowTrigger } from '../lib/actionWorkflow.mjs'

export function ActionWizard({ defaultRepository }: { defaultRepository: string }) {
  const [repoMode, setRepoMode] = useState<'current' | 'specific'>('current')
  const [repoText, setRepoText] = useState(normalizeActionRepository(defaultRepository) === 'current' ? '' : (normalizeActionRepository(defaultRepository) ?? ''))
  const [reference, setReference] = useState<string>(STABLE_ACTION_REF)
  const [sha, setSha] = useState('')
  const [trigger, setTrigger] = useState<ActionWorkflowTrigger>('manual')
  const [includeRuns, setIncludeRuns] = useState(false)
  const [strict, setStrict] = useState(false)
  const [artifact, setArtifact] = useState(false)
  const [feedback, setFeedback] = useState('')
  const { yaml, issue } = useMemo(() => {
    try {
      return { yaml: createActionWorkflow({
        repository: repoMode === 'current' ? 'current' : repoText,
        ref: reference === 'sha' ? sha : reference,
        trigger,
        includeRuns,
        failOnReview: strict,
        uploadArtifact: artifact,
      }), issue: '' }
    } catch (reason) {
      return { yaml: '', issue: reason instanceof Error ? reason.message : 'Invalid workflow settings.' }
    }
  }, [repoMode, repoText, reference, sha, trigger, includeRuns, strict, artifact])

  async function copyWorkflow() {
    if (!yaml) return
    try { await navigator.clipboard.writeText(yaml); setFeedback('Workflow YAML copied.') }
    catch { setFeedback('Clipboard unavailable. Select the YAML below to copy it.') }
  }
  function downloadWorkflow() {
    if (!yaml) return
    const url = URL.createObjectURL(new Blob([yaml], { type: 'text/yaml;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'repoverity-audit.yml'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setFeedback('Workflow downloaded. Review it before committing to .github/workflows/.')
  }

  return <section className="rv-dtools-card rv-action-wizard" aria-labelledby="rv-action-wizard-title">
    <div className="rv-dtools-card-top">
      <div><span className="rv-kicker">INTEGRATION 03 / V2.1</span><h3 id="rv-action-wizard-title"><Workflow size={20}/> GitHub Action workflow builder</h3><p>Prepare an optional read-only audit workflow. Nothing is installed or pushed to GitHub.</p></div>
      <ShieldCheck size={22}/>
    </div>
    <div className="rv-action-controls">
      <label>Repository to inspect
        <select value={repoMode} onChange={event => {setRepoMode(event.target.value as 'current' | 'specific');setFeedback('')}}>
          <option value="current">Repository running this workflow</option>
          <option value="specific">Another public repository</option>
        </select>
      </label>
      {repoMode === 'specific' && <label>Public owner/repository
        <input value={repoText} onChange={(event: ChangeEvent<HTMLInputElement>) => {setRepoText(event.target.value);setFeedback('')}} placeholder="owner/repository" spellCheck={false} aria-invalid={!normalizeActionRepository(repoText)}/>
      </label>}
      <label>Action version
        <select value={reference} onChange={event => {setReference(event.target.value);setFeedback('')}}>
          <option value={STABLE_ACTION_REF}>v1.9.0 (published)</option>
          <option value={UPCOMING_ACTION_REF}>v2.1.0 (only after tag release)</option>
          <option value="sha">Pinned 40-character commit SHA</option>
        </select>
      </label>
      {reference === 'sha' && <label>Full reviewed commit SHA
        <input value={sha} onChange={(event: ChangeEvent<HTMLInputElement>) => {setSha(event.target.value);setFeedback('')}} placeholder="40 hexadecimal characters" autoComplete="off" spellCheck={false} aria-invalid={sha.length > 0 && !/^[a-f0-9]{40}$/i.test(sha)}/>
      </label>}
      <label>Workflow trigger
        <select value={trigger} onChange={event => {setTrigger(event.target.value as ActionWorkflowTrigger);setFeedback('')}}>
          <option value="manual">Manual only (recommended)</option>
          <option value="main-push">Manual and pushes to main</option>
        </select>
      </label>
      <div className="rv-action-toggles">
        <label><input type="checkbox" checked={includeRuns} onChange={event => {setIncludeRuns(event.target.checked);setFeedback('')}}/> Sample recent Actions runs</label>
        <label><input type="checkbox" checked={strict} onChange={event => {setStrict(event.target.checked);setFeedback('')}}/> Fail on review findings (opt-in)</label>
        <label><input type="checkbox" checked={artifact} onChange={event => {setArtifact(event.target.checked);setFeedback('')}}/> Preserve report as a workflow artifact</label>
      </div>
    </div>
    {reference === UPCOMING_ACTION_REF && <p className="rv-action-warning" role="status"><AlertCircle size={15}/> This version reference will not resolve until the v2.1.0 tag is published. Use v1.9.0 in the meantime.</p>}
    {issue && <p role="alert" className="rv-dtools-error"><AlertCircle size={16}/>{issue}</p>}
    <div className="rv-action-buttons">
      <button type="button" className="rv-outline-button" disabled={!yaml} onClick={() => void copyWorkflow()}><ClipboardCopy size={16}/> Copy workflow</button>
      <button type="button" className="rv-primary-button" disabled={!yaml} onClick={downloadWorkflow}><Download size={16}/> Download YAML</button>
    </div>
    {feedback && <p className="rv-action-feedback" role="status"><CheckCircle2 size={15}/>{feedback}</p>}
    <div className="rv-dtools-code rv-dtools-code-block rv-action-preview"><pre aria-label="Generated GitHub Actions workflow">{yaml || '# Correct the settings above to generate a workflow.'}</pre></div>
    <p className="rv-dtools-hint">Default is advisory with contents: read. Enabling run sampling adds actions: read. Add the reviewed YAML to <code>.github/workflows/repoverity-audit.yml</code> in the target repository. This checks maintenance evidence, not vulnerabilities or compliance.</p>
  </section>
}
