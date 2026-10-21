import { useId, useState, type ChangeEvent } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, CheckCircle2, Database, FileJson2, Info, ShieldCheck, Trash2 } from 'lucide-react'
import {
  buildLocalBackup, clearLocalData, localBackupSummary, MAX_BACKUP_BYTES,
  parseLocalBackup, restoreLocalBackup, type LocalBackup,
} from '../lib/portability'

function saveJson(filename: string, value: LocalBackup) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2) + '\n'], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

export function DataPortability() {
  const fileId = useId()
  const [pending, setPending] = useState<LocalBackup | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)

  function exportData() {
    try {
      const backup = buildLocalBackup(window.localStorage)
      const filename = `repoverity-backup-${new Date().toISOString().slice(0, 10)}.json`
      saveJson(filename, backup)
      setError(false)
      setMessage('Backup downloaded. Keep the JSON file in a safe place.')
    } catch {
      setError(true)
      setMessage('Local browser data could not be read or exported.')
    }
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setPending(null)
    setMessage('')
    setBusy(true)
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('File is too large. Maximum: 2.5 MB.')
      const backup = parseLocalBackup(await file.text())
      setPending(backup)
      setError(false)
      setMessage('Backup verified locally. Review the summary before replacing saved data.')
    } catch (reason) {
      setError(true)
      setMessage(reason instanceof Error ? reason.message : 'Could not read that file.')
    } finally { setBusy(false) }
  }

  function confirmImport() {
    if (!pending) return
    if (!window.confirm('Replace existing RepoVerity growth history and achievement checklist on this browser? This cannot be undone unless you export a backup first.')) return
    try {
      restoreLocalBackup(window.localStorage, pending)
      window.location.reload() // Rehydrate both existing React storage hooks from the restored data.
    } catch (reason) {
      setError(true)
      setMessage(reason instanceof Error ? reason.message : 'Import failed.')
    }
  }

  function confirmDelete() {
    if (!window.confirm('Delete ALL RepoVerity tracking history and self-reported achievement checklists in this browser?')) return
    try {
      clearLocalData(window.localStorage)
      window.location.reload()
    } catch {
      setError(true)
      setMessage('Browser storage could not be cleared. Nothing was confirmed as deleted.')
    }
  }

  const summary = pending ? localBackupSummary(pending) : null
  return <section id="privacy" className="port-section" aria-labelledby="port-title">
    <div className="section-title-row port-heading">
      <div>
        <div className="eyebrow">YOUR DATA, YOUR CONTROL</div>
        <h2 id="port-title">Privacy & portability</h2>
        <p>Move your observed growth history and manual achievement checklist between browsers. Everything stays on your device unless you choose to export it.</p>
      </div>
      <span className="port-kicker"><ShieldCheck size={15}/> LOCAL-FIRST</span>
    </div>
    <div className="port-grid">
      <div className="port-card">
        <span className="port-card-icon"><ArrowDownToLine size={20}/></span>
        <h3>Export your history</h3>
        <p>Download a versioned JSON copy of all locally saved growth observations, follower goals and self-reported badge progress.</p>
        <button type="button" className="port-primary" onClick={exportData}><FileJson2 size={16}/> Export JSON backup</button>
      </div>
      <div className="port-card">
        <span className="port-card-icon"><ArrowUpFromLine size={20}/></span>
        <h3>Restore on another device</h3>
        <p>Validate a RepoVerity backup before applying it. Existing local tracking data is never overwritten without your confirmation.</p>
        <label htmlFor={fileId} className="port-upload"><ArrowUpFromLine size={16}/> Choose JSON backup
          <input id={fileId} className="port-file-input" type="file" accept=".json,application/json" onChange={chooseFile} disabled={busy}/>
        </label>
        {busy && <span className="port-processing" role="status">Reading file...</span>}
      </div>
      <div className="port-card port-card-delete">
        <span className="port-card-icon"><Database size={20}/></span>
        <h3>Delete local records</h3>
        <p>Remove RepoVerity growth history and achievement checklists in this browser only. This does not affect GitHub itself.</p>
        <button type="button" className="port-danger" onClick={confirmDelete}><Trash2 size={16}/> Delete local data</button>
      </div>
    </div>
    {summary && <div className="port-preview" aria-labelledby="port-review-title">
      <div className="port-preview-head"><CheckCircle2 size={19}/><div><h3 id="port-review-title">Review your backup</h3><p>Exported {pending?.exportedAt.slice(0, 10)}. Your current local records will be replaced.</p></div></div>
      <div className="port-preview-stats">
        <span><strong>{summary.profiles}</strong> tracked profiles</span>
        <span><strong>{summary.observations}</strong> real observations</span>
        <span><strong>{summary.achievements}</strong> badge checklists</span>
        <span><strong>{summary.selfReportedBadges}</strong> self-reported earned</span>
      </div>
      <div className="port-actions"><button type="button" className="port-primary" onClick={confirmImport}><ArrowUpFromLine size={16}/> Replace my saved data</button><button type="button" className="port-cancel" onClick={()=>{setPending(null);setMessage('')}}>Cancel</button></div>
    </div>}
    <div className="port-note"><Info size={16}/><span>No API tokens, GitHub credentials or server-side tracking. Imported files are parsed locally. Your browser is responsible for storing the data.</span></div>
    {message && <p className={`port-message ${error?'port-message-error':''}`} role="status" aria-live="polite">{message}</p>}
  </section>
}
