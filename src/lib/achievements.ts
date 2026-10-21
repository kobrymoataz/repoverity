/**
 * An educational guide only. GitHub awards Achievements, not RepoVerity.
 * Thresholds are community-documented and subject to change.
 */
export type AchievementId =
  | 'pull-shark' | 'quickdraw' | 'yolo' | 'pair-extraordinaire'
  | 'galaxy-brain' | 'starstruck' | 'public-sponsor'
  | 'arctic-code-vault' | 'mars-2020'

export type AchievementState = 'planned' | 'working' | 'earned'
export type AchievementCategory = 'obtainable' | 'historical'

export interface AchievementDefinition {
  id: AchievementId
  name: string
  category: AchievementCategory
  summary: string
  criteria: string
  nextStep: string
  levels: readonly number[]
  requiresCommunity: boolean
  caution?: string
}

/** Only the broadly available seven badges are offered for tracking. */
export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  {
    id: 'pull-shark', name: 'Pull Shark', category: 'obtainable',
    summary: 'Have your pull requests merged into projects.',
    criteria: 'Community-reported levels: 2 / 16 / 128 / 1,024 merged PRs.',
    nextStep: 'Propose a meaningful, reviewed improvement and merge it after checks pass.',
    levels: [2, 16, 128, 1024], requiresCommunity: false,
    caution: 'Merged PR counts shown elsewhere may not equal GitHub award eligibility.',
  },
  {
    id: 'starstruck', name: 'Starstruck', category: 'obtainable',
    summary: 'Create a project that other developers find valuable.',
    criteria: 'Community-reported levels: 16 / 128 / 512 / 4,096 stars on a repository.',
    nextStep: 'Publish useful functionality, documentation, and a reproducible live demo.',
    levels: [16, 128, 512, 4096], requiresCommunity: true,
    caution: 'Stars are awarded by other people. There is no legitimate automatic shortcut.',
  },
  {
    id: 'galaxy-brain', name: 'Galaxy Brain', category: 'obtainable',
    summary: 'Help other developers in GitHub Discussions.',
    criteria: 'Community-reported levels: 2 / 8 / 16 / 32 accepted answers.',
    nextStep: 'Answer an unanswered technical discussion with a clear, tested solution.',
    levels: [2, 8, 16, 32], requiresCommunity: true,
  },
  {
    id: 'pair-extraordinaire', name: 'Pair Extraordinaire', category: 'obtainable',
    summary: 'Work with a real collaborator on a merged pull request.',
    criteria: 'Community-reported levels: 1 / 10 / 24 / 48 co-authored merged PRs.',
    nextStep: 'Pair-program with a contributor and attribute the shared work properly.',
    levels: [1, 10, 24, 48], requiresCommunity: true,
    caution: 'Co-authorship should represent genuine shared work.',
  },
  {
    id: 'quickdraw', name: 'Quickdraw', category: 'obtainable',
    summary: 'Resolve a newly opened issue or pull request quickly.',
    criteria: 'Community-reported: close an issue or PR within five minutes.',
    nextStep: 'Use normal issue triage; close duplicate or invalid reports when appropriate.',
    levels: [1], requiresCommunity: false,
    caution: 'Avoid manufacturing issues solely to trigger the badge.',
  },
  {
    id: 'yolo', name: 'YOLO', category: 'obtainable',
    summary: 'Merge your own PR without a formal review.',
    criteria: 'Community-reported: merge a PR without an approving code review.',
    nextStep: 'Keep review requirements where they matter; this badge is optional.',
    levels: [1], requiresCommunity: false,
    caution: 'Do not compromise required security or code review policies for a badge.',
  },
  {
    id: 'public-sponsor', name: 'Public Sponsor', category: 'obtainable',
    summary: 'Support open-source maintainers financially.',
    criteria: 'Publicly sponsor an eligible developer or organization via GitHub Sponsors.',
    nextStep: 'Sponsor a maintainer whose work you value, if it suits your budget.',
    levels: [1], requiresCommunity: true,
    caution: 'Involves payment; sponsoring is optional and should never be pressured.',
  },
  {
    id: 'arctic-code-vault', name: 'Arctic Code Vault', category: 'historical',
    summary: 'Historical GitHub Archive Program recognition.',
    criteria: 'Associated with repositories included in GitHub’s 2020 archival snapshot.',
    nextStep: 'No longer possible to earn retroactively.',
    levels: [], requiresCommunity: false,
  },
  {
    id: 'mars-2020', name: 'Mars 2020 Contributor', category: 'historical',
    summary: 'Recognition linked to code used in the Mars 2020 mission.',
    criteria: 'Awarded for qualifying contributions associated with the mission.',
    nextStep: 'Not a normal earnable GitHub achievement today.',
    levels: [], requiresCommunity: false,
  },
] as const

export const TRACKABLE_ACHIEVEMENTS = ACHIEVEMENTS.filter(a => a.category === 'obtainable')
export const ACHIEVEMENT_STORAGE_KEY = 'repoverity:achievements:v1'
export const MAX_ACHIEVEMENT_PROFILES = 25
const LOGIN = /^(?!-)[a-zA-Z0-9-]{1,39}(?<!-)$/
const ACTIVE_IDS = new Set<string>(TRACKABLE_ACHIEVEMENTS.map(a => a.id))

export interface TrackerEntry {
  status: AchievementState
  updatedAt: number
}
export interface AchievementTracker {
  version: 1
  profiles: Record<string, Record<string, TrackerEntry>>
}
export const emptyAchievementTracker = (): AchievementTracker => ({ version: 1, profiles: {} })

function validEntry(value: unknown): value is TrackerEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const data = value as Partial<TrackerEntry>
  return (data.status === 'planned' || data.status === 'working' || data.status === 'earned')
    && typeof data.updatedAt === 'number' && Number.isSafeInteger(data.updatedAt)
    && data.updatedAt >= Date.UTC(2008, 0, 1) && data.updatedAt <= 8_640_000_000_000_000
}

/** Treat browser storage as untrusted, bounded input. */
export function parseAchievementTracker(raw: string | null): AchievementTracker {
  if (!raw || raw.length > 100_000) return emptyAchievementTracker()
  try {
    const data: unknown = JSON.parse(raw)
    if (!data || typeof data !== 'object' || Array.isArray(data)) return emptyAchievementTracker()
    const stored = data as Partial<AchievementTracker>
    if (stored.version !== 1 || !stored.profiles || typeof stored.profiles !== 'object' || Array.isArray(stored.profiles)) return emptyAchievementTracker()
    const profiles: AchievementTracker['profiles'] = {}
    for (const [login, items] of Object.entries(stored.profiles).slice(0, MAX_ACHIEVEMENT_PROFILES)) {
      if (!LOGIN.test(login) || !items || typeof items !== 'object' || Array.isArray(items)) continue
      const entries: Record<string, TrackerEntry> = {}
      for (const [badge, entry] of Object.entries(items)) {
        if (ACTIVE_IDS.has(badge) && validEntry(entry)) entries[badge] = entry
      }
      profiles[login.toLowerCase()] = entries
    }
    return { version: 1, profiles }
  } catch {
    return emptyAchievementTracker()
  }
}

export function getAchievementState(tracker: AchievementTracker, username: string, id: AchievementId): AchievementState {
  return tracker.profiles[username.toLowerCase()]?.[id]?.status ?? 'planned'
}

export function updateAchievementState(
  tracker: AchievementTracker, username: string, id: AchievementId,
  status: AchievementState, now = Date.now(),
): AchievementTracker {
  if (!LOGIN.test(username) || !ACTIVE_IDS.has(id) || !['planned', 'working', 'earned'].includes(status)) return tracker
  if (!Number.isSafeInteger(now) || now < Date.UTC(2008, 0, 1)) return tracker
  const key = username.toLowerCase()
  const exists = Object.prototype.hasOwnProperty.call(tracker.profiles, key)
  if (!exists && Object.keys(tracker.profiles).length >= MAX_ACHIEVEMENT_PROFILES) return tracker
  const entries = tracker.profiles[key] ?? {}
  if ((entries[id]?.status ?? 'planned') === status) return tracker
  const updated = { ...entries }
  if (status === 'planned') delete updated[id]
  else updated[id] = { status, updatedAt: now }
  const profiles = { ...tracker.profiles }
  if (Object.keys(updated).length === 0) delete profiles[key]
  else profiles[key] = updated
  return { version: 1, profiles }
}

export function achievementSummary(tracker: AchievementTracker, username: string) {
  const statusCounts = { earned: 0, working: 0, planned: 0 }
  for (const badge of TRACKABLE_ACHIEVEMENTS) statusCounts[getAchievementState(tracker, username, badge.id)]++
  return statusCounts
}
