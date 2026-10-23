/** Public issue and PR metadata are not a substitute for a complete project history. */
export type MaintainerKind = 'issue' | 'pull'
export type TriageStage = 'inbox' | 'next' | 'waiting' | 'done'
export type MaintainerIssue = {
  kind: MaintainerKind
  number: number
  title: string
  url: string
  author: string
  updated_at: string
  created_at: string
  comments: number
  labels: string[]
  assignees: string[]
  draft: boolean
}
export type MaintainerContributor = { login: string; url: string; avatar_url: string; contributions: number }
export type MaintainerQueueRecord = {
  repo: string
  kind: MaintainerKind
  number: number
  stage: TriageStage
  note: string
  updated_at: number
}
export const TRIAGE_STAGES: ReadonlyArray<{ id: TriageStage; label: string }> = [
  { id: 'inbox', label: 'Inbox' }, { id: 'next', label: 'Next' },
  { id: 'waiting', label: 'Waiting' }, { id: 'done', label: 'Done' },
]
export const QUEUE_LIMIT = 150
const REPO_PART = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]{0,98}[a-zA-Z0-9_])?$/
const USER_PART = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/
export function normalizeRepository(input: string): string | null {
  if (typeof input !== 'string') return null
  const clean = input.trim().replace(/^https:\/\/github\.com\//i, '').replace(/\/$/, '')
  const parts = clean.split('/')
  if (parts.length !== 2 || !USER_PART.test(parts[0]) || !REPO_PART.test(parts[1]) ||
    parts[1] === '.' || parts[1] === '..' || parts[0].includes('--')) return null
  return `${parts[0].toLowerCase()}/${parts[1].toLowerCase()}`
}
export function validQueueRecord(input: unknown): input is MaintainerQueueRecord {
  if (!input || typeof input !== 'object') return false
  const x = input as Partial<MaintainerQueueRecord>
  return typeof x.repo === 'string' && normalizeRepository(x.repo) === x.repo &&
    (x.kind === 'issue' || x.kind === 'pull') && Number.isSafeInteger(x.number) &&
    (x.number ?? 0) > 0 && (x.number ?? 0) <= 999999999 &&
    TRIAGE_STAGES.some(stage => stage.id === x.stage) && typeof x.note === 'string' &&
    x.note.length <= 600 && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(x.note) &&
    Number.isSafeInteger(x.updated_at) && (x.updated_at ?? -1) >= 0
}
export function queueKey(record: Pick<MaintainerQueueRecord, 'repo' | 'kind' | 'number'>): string {
  return `${record.repo}:${record.kind}:${record.number}`
}
export function filterMaintainerItems(items: MaintainerIssue[], opts: {
  query?: string; label?: string; mode?: 'all' | 'unassigned' | 'stale'; now?: number
}): MaintainerIssue[] {
  const query = (opts.query ?? '').trim().toLowerCase().slice(0, 120)
  const mode = opts.mode ?? 'all'
  const now = opts.now ?? Date.now()
  const staleBefore = now - (30 * 86400000)
  return items.filter(item => {
    if (query && !query.split(/\s+/).every(term => `${item.title} #${item.number} ${item.author} ${item.labels.join(' ')}`.toLowerCase().includes(term))) return false
    if (opts.label && !item.labels.includes(opts.label)) return false
    if (mode === 'unassigned' && item.assignees.length > 0) return false
    if (mode === 'stale' && !(Date.parse(item.updated_at) < staleBefore)) return false
    return true
  })
}
export function activityDays(updated: string, now = Date.now()): number | null {
  const then = Date.parse(updated)
  if (!Number.isFinite(then) || then > now) return null
  return Math.floor((now - then) / 86400000)
}
export function queueCsv(records: MaintainerQueueRecord[]): string {
  const csv = (value: unknown): string => {
    let text = String(value).replace(/\r\n?/g, '\n')
    // Prevent Excel and spreadsheet formula evaluation, even with leading spaces.
    if (/^\s*[=+@\-\t]/.test(text)) text = `'${text}`
    return `"${text.replace(/"/g, '""')}"`
  }
  return ['repository,kind,number,stage,note,updated_at_utc', ...records.map(x => [
    x.repo, x.kind, x.number, x.stage, x.note, new Date(x.updated_at * 1000).toISOString(),
  ].map(csv).join(','))].join('\r\n') + '\r\n'
}
const STORE = 'repoverity:maintainer-queue:v1'
export function readLocalQueue(storage: Pick<Storage, 'getItem'>): MaintainerQueueRecord[] {
  try {
    const raw = storage.getItem(STORE)
    if (!raw || raw.length > 180000) return []
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) return []
    return value.filter(validQueueRecord).slice(0, QUEUE_LIMIT)
  } catch { return [] }
}
export function saveLocalQueue(storage: Pick<Storage, 'setItem'>, records: MaintainerQueueRecord[]): void {
  if (records.length > QUEUE_LIMIT || records.some(x => !validQueueRecord(x))) {
    throw new Error('Invalid or over-limit local worklist.')
  }
  storage.setItem(STORE, JSON.stringify(records))
}
export function upsertLocalQueue(records: MaintainerQueueRecord[], item: MaintainerQueueRecord): MaintainerQueueRecord[] {
  if (!validQueueRecord(item)) throw new Error('Invalid triage item.')
  const next = records.filter(x => queueKey(x) !== queueKey(item))
  if (next.length >= QUEUE_LIMIT) throw new Error('Your personal worklist is full.')
  return [item, ...next]
}
