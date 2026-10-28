/**
 * Offline, bounded and conservative comparison of RepoVerity public evidence reports.
 * The report schema is unchanged. Never interpret lost/unknown evidence as improvement.
 */
import { normalizeRepository } from './scanCore.mjs'

export const COMPARISON_LIMITS = Object.freeze({ jsonCharacters: 512_000, checks: 150, field: 500 })
const STATES = Object.freeze(['pass', 'review', 'unknown', 'info'])
const KINDS = Object.freeze(['regression', 'resolved', 'new-review', 'evidence-lost', 'newly-observed', 'changed', 'added', 'removed', 'unchanged'])
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const text = (value, max = COMPARISON_LIMITS.field) => typeof value === 'string' ? value.slice(0, max) : ''
const requiredText = (value, key, max = COMPARISON_LIMITS.field) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw Error(`Invalid report: ${key} must be a nonempty string of at most ${max} characters.`)
  return value
}
const counts = checks => Object.fromEntries(STATES.map(status => [status, checks.filter(c => c.status === status).length]))

export function parseEvidenceReport(input) {
  let source = input
  if (typeof input === 'string') {
    if (input.length > COMPARISON_LIMITS.jsonCharacters) throw Error('Report exceeds the 512 KB text limit.')
    try { source = JSON.parse(input) } catch { throw Error('Report is not valid JSON.') }
  }
  if (!isObject(source) || source.schemaVersion !== 1) throw Error('Unsupported RepoVerity report schema. Expected schemaVersion 1.')
  if (!isObject(source.repository)) throw Error('Report repository metadata is missing.')
  const name = normalizeRepository(source.repository.name)
  if (!name) throw Error('Report repository name is invalid.')
  const date = requiredText(source.recordedAt, 'recordedAt', 50)
  const timestamp = Date.parse(date)
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== date) throw Error('Report recordedAt must be a valid UTC ISO timestamp.')
  if (!Array.isArray(source.checks) || source.checks.length === 0 || source.checks.length > COMPARISON_LIMITS.checks) throw Error('Report checks are missing or exceed the 150-check limit.')
  const ids = new Set()
  const checks = source.checks.map((raw, index) => {
    if (!isObject(raw)) throw Error(`Invalid check at position ${index + 1}.`)
    const id = requiredText(raw.id, 'check.id', 100)
    if (!/^[a-z][a-z\d_-]*$/i.test(id)) throw Error(`Invalid check identifier at position ${index + 1}.`)
    if (ids.has(id)) throw Error(`Duplicate check identifier: ${id}.`)
    ids.add(id)
    if (!STATES.includes(raw.status)) throw Error(`Invalid status for ${id}.`)
    const title = requiredText(raw.title, 'check.title', 160)
    const section = requiredText(raw.section, 'check.section', 100)
    for (const key of ['evidence', 'recommendation']) {
      if (raw[key] !== undefined && (typeof raw[key] !== 'string' || raw[key].length > COMPARISON_LIMITS.field)) throw Error(`Invalid ${key} in check ${id}.`)
    }
    return { id, title, section, status: raw.status, evidence: text(raw.evidence), recommendation: text(raw.recommendation) }
  })
  if (!isObject(source.summary)) throw Error('Report summary is missing.')
  const computed = counts(checks)
  for (const status of STATES) {
    if (source.summary[status] !== computed[status]) throw Error(`Report summary does not match ${status} findings.`)
  }
  return Object.freeze({ schemaVersion: 1, repository: { name }, recordedAt: date, toolVersion: text(source.toolVersion, 50), summary: computed, checks })
}

function category(before, after) {
  if (!before) return after.status === 'review' ? 'new-review' : 'added'
  if (!after) return 'removed'
  if (before.status === after.status) {
    return before.evidence !== after.evidence || before.recommendation !== after.recommendation ? 'changed' : 'unchanged'
  }
  if (before.status === 'pass' && after.status === 'review') return 'regression'
  if (before.status === 'review' && after.status === 'pass') return 'resolved'
  if (after.status === 'unknown' || (['pass', 'review'].includes(before.status) && after.status === 'info')) return 'evidence-lost'
  if (after.status === 'review') return 'new-review'
  if (after.status === 'pass') return 'newly-observed'
  return 'changed'
}

export function compareEvidenceReports(previousInput, currentInput) {
  const previous = parseEvidenceReport(previousInput)
  const current = parseEvidenceReport(currentInput)
  if (previous.repository.name !== current.repository.name) throw Error('Reports must refer to the same public GitHub repository.')
  if (Date.parse(current.recordedAt) <= Date.parse(previous.recordedAt)) throw Error('The current report must have a later recordedAt timestamp than the baseline.')
  const previousMap = new Map(previous.checks.map(x => [x.id, x]))
  const currentMap = new Map(current.checks.map(x => [x.id, x]))
  const ids = [...new Set([...previous.checks.map(x => x.id), ...current.checks.map(x => x.id)])]
  const changes = ids.map(id => {
    const before = previousMap.get(id) ?? null
    const after = currentMap.get(id) ?? null
    return { id, section: after?.section ?? before.section, title: after?.title ?? before.title,
      kind: category(before, after), beforeStatus: before?.status ?? null, afterStatus: after?.status ?? null,
      beforeEvidence: before?.evidence ?? '', afterEvidence: after?.evidence ?? '',
      recommendation: after?.recommendation ?? '' }
  })
  const summary = Object.fromEntries(KINDS.map(kind => [kind.replaceAll('-', '_'), changes.filter(x => x.kind === kind).length]))
  return {
    schemaVersion: 1, kind: 'repoverity-evidence-comparison', repository: previous.repository.name,
    previousAt: previous.recordedAt, currentAt: current.recordedAt,
    previousSummary: previous.summary, currentSummary: current.summary,
    summary, changes,
    disclaimer: 'Only compared recorded public evidence. Unknown, removed or unavailable checks are not improvements. This is not a code security scan or compliance finding.',
  }
}

const escapeMd = value => String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[\\|`*\[\]<>]/g, char => ({'\\':'\\\\','|':'\\|','`':'\\`','*':'\\*','[':'\\[',']':'\\]','<':'&lt;','>':'&gt;'}[char]))
export function comparisonMarkdown(result) {
  const s = result.summary
  const lines = [
    `# RepoVerity comparison: ${escapeMd(result.repository)}`,
    '', `Baseline: ${escapeMd(result.previousAt)}`, `Current: ${escapeMd(result.currentAt)}`,
    '', `Regressions: ${s.regression} | Resolved reviews: ${s.resolved} | New reviews: ${s.new_review} | Lost evidence: ${s.evidence_lost}`,
    '', '| Check | Previous | Current | Interpretation | Recommendation |', '| --- | --- | --- | --- | --- |',
    ...result.changes.filter(change => change.kind !== 'unchanged').map(row =>
      `| ${escapeMd(row.title)} | ${escapeMd(row.beforeStatus ?? 'Not sampled')} | ${escapeMd(row.afterStatus ?? 'Not sampled')} | ${escapeMd(row.kind)} | ${escapeMd(row.recommendation || 'Review source evidence.')} |`),
    '', escapeMd(result.disclaimer), '',
  ]
  return lines.join('\n')
}
export function comparisonOutput(result, format) {
  if (format === 'json') return `${JSON.stringify(result, null, 2)}\n`
  if (format === 'markdown') return comparisonMarkdown(result)
  throw Error('Supported comparison export formats are json and markdown.')
}
