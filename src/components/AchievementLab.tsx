import { useMemo, useState } from 'react'
import {
  ArrowUpRight, Award, BookOpen, CircleCheck, CircleDot, GitPullRequest,
  Heart, MessageCircle, Rocket, ShieldCheck, Snowflake, Star, Timer, Users, Zap, type LucideIcon,
} from 'lucide-react'
import { ACHIEVEMENTS, TRACKABLE_ACHIEVEMENTS, type AchievementDefinition, type AchievementId, type AchievementState } from '../lib/achievements'
import { useAchievementTracker } from '../hooks/useAchievementTracker'
import type { GitHubRepository } from '../types/github'

const ICONS: Record<AchievementId, LucideIcon> = {
  'pull-shark': GitPullRequest,
  'starstruck': Star,
  'galaxy-brain': MessageCircle,
  'pair-extraordinaire': Users,
  'quickdraw': Timer,
  'yolo': Zap,
  'public-sponsor': Heart,
  'arctic-code-vault': Snowflake,
  'mars-2020': Rocket,
}

type AchievementView = 'available' | 'working' | 'earned' | 'historical'

function AchievementCard({
  badge, state, onChange, sampleBest,
}: {
  badge: AchievementDefinition
  state: AchievementState
  onChange: (state: AchievementState) => void
  sampleBest: number
}) {
  const Icon = ICONS[badge.id]
  const historical = badge.category === 'historical'
  const label = historical ? 'Historical · no longer earnable' : badge.requiresCommunity ? 'Community dependent' : 'Developer activity'
  return <article className={`ach4-card ${historical ? 'ach4-card-legacy' : ''}`}>
    <div className="ach4-card-head">
      <div className={`ach4-icon ach4-icon-${badge.id}`}><Icon size={23}/></div>
      <span className="ach4-card-type">{label}</span>
    </div>
    <h3>{badge.name}</h3>
    <p className="ach4-summary">{badge.summary}</p>
    <div className="ach4-rule"><BookOpen size={15}/><span>{badge.criteria}</span></div>
    <div className="ach4-step"><strong>{historical ? 'Availability' : 'Suggested next step'}</strong><p>{badge.nextStep}</p></div>
    {badge.id === 'starstruck' && <div className="ach4-sample"><Star size={14}/><span>Most-starred loaded repo: <strong>{sampleBest}</strong> / 16 for the first community-reported tier. Sample only.</span></div>}
    {badge.caution && <p className="ach4-caution"><ShieldCheck size={14}/>{badge.caution}</p>}
    {!historical && <div className="ach4-status-row">
      <label htmlFor={`achievement-${badge.id}`}>My checklist</label>
      <select id={`achievement-${badge.id}`} value={state} onChange={event => onChange(event.target.value as AchievementState)} aria-label={`Your self-reported status for ${badge.name}`}>
        <option value="planned">Not started</option>
        <option value="working">Working on it</option>
        <option value="earned">I earned this</option>
      </select>
    </div>}
  </article>
}

export function AchievementLab({ username, repositories }: { username: string; repositories: GitHubRepository[] }) {
  const { summary, statusOf, setStatus, storageError } = useAchievementTracker(username)
  const [view, setView] = useState<AchievementView>('available')
  const best = useMemo(() => repositories.reduce((top, repo) => Math.max(top, repo.stargazers_count), 0), [repositories])
  const displayed = useMemo(() => ACHIEVEMENTS.filter(badge => {
    if (view === 'historical') return badge.category === 'historical'
    if (badge.category !== 'obtainable') return false
    return view === 'available' || statusOf(badge.id) === view
  }), [statusOf, view])

  const buttons: { id: AchievementView; title: string; count: number }[] = [
    { id: 'available', title: 'Earnable', count: TRACKABLE_ACHIEVEMENTS.length },
    { id: 'working', title: 'In progress', count: summary.working },
    { id: 'earned', title: 'Self-reported earned', count: summary.earned },
    { id: 'historical', title: 'Historical', count: 2 },
  ]
  return <section className="ach4-section" id="achievements" aria-labelledby="ach4-title">
    <div className="section-title-row ach4-top">
      <div><div className="eyebrow">ACHIEVEMENTS / PERSONAL TRACKER</div><h2 id="ach4-title">Achievement lab</h2><p>Review achievement criteria and maintain a personal checklist.</p></div>
      <a className="ach4-profile-link" href={`https://github.com/${encodeURIComponent(username)}?tab=achievements`} target="_blank" rel="noreferrer">View GitHub badges <ArrowUpRight size={16}/></a>
    </div>
    <div className="ach4-headline">
      <div className="ach4-headline-icon"><Award size={26}/></div>
      <div className="ach4-headline-text"><strong>Track your own progress.</strong><p>RepoVerity cannot award or reliably verify GitHub Achievements. “Earned” below means you manually confirmed it on your GitHub profile.</p></div>
      <div className="ach4-counter"><b>{summary.earned}<span> / {TRACKABLE_ACHIEVEMENTS.length}</span></b><small>Self-reported</small></div>
    </div>
    <div className="ach4-tabs" role="group" aria-label="Achievement filter">{buttons.map(button =>
      <button type="button" key={button.id} className={view===button.id?'ach4-tab-on':''} aria-pressed={view===button.id} onClick={() => setView(button.id)}>{button.title}<span>{button.count}</span></button>
    )}</div>
    {displayed.length ? <div className="ach4-grid">{displayed.map(badge => <AchievementCard key={badge.id} badge={badge} state={statusOf(badge.id)} sampleBest={best} onChange={status => setStatus(badge.id, status)}/>)}</div> :
      <div className="ach4-empty"><CircleDot size={26}/><strong>Nothing in this group yet.</strong><span>Update a badge from the Earnable tab to see it here.</span><button type="button" onClick={() => setView('available')}>Explore earnable badges</button></div>}
    <div className="ach4-footer">
      <span><CircleCheck size={15}/> {summary.working} in progress · {summary.earned} self-reported earned · {summary.planned} not started</span>
      <a href="https://docs.github.com/en/account-and-profile/reference/profile-reference#earning-achievements" target="_blank" rel="noreferrer">GitHub’s official overview <ArrowUpRight size={13}/></a>
    </div>
    {storageError && <p className="ach4-storage" role="status">Browser storage is unavailable. Your checklist changes may not be saved.</p>}
    <p className="ach4-disclaimer"><ShieldCheck size={15}/> Badge thresholds and tiers are community-reported and may change. Historical achievements cannot be newly earned. No automated follows, stars, issues or PRs.</p>
  </section>
}
