import { useId, useMemo, useState } from 'react'
import {
  Activity, ArrowDownRight, ArrowUpRight, CalendarDays, Check,
  Download, HardDrive, Pause, Play, RefreshCw, ShieldCheck,
  Star, Target, Trash2, TrendingUp, Users,
} from 'lucide-react'
import { compactNumber } from '../lib/insights'
import {
  compareGrowth, growthCsv, selectGrowthRange, type GrowthMetric,
  type GrowthPoint, type GrowthProfile, type GrowthRange,
} from '../lib/growth'

const GOALS = [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 1000000]
const formatDate = (timestamp: number) => new Intl.DateTimeFormat('en', {
  timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric',
}).format(timestamp)

function GrowthChart({ points, metric }: { points: GrowthPoint[]; metric: GrowthMetric }) {
  const gradientId = useId().replace(/:/g, '')
  if (points.length < 2) return null

  const width = 850, height = 268
  const pad = { top: 22, right: 20, bottom: 44, left: 53 }
  const drawWidth = width - pad.left - pad.right
  const drawHeight = height - pad.top - pad.bottom
  const values = points.map(point => point[metric])
  const low = Math.min(...values), high = Math.max(...values)
  const extra = Math.max(1, Math.ceil(Math.max(1, high - low) * .18))
  const floor = Math.max(0, low - extra)
  const ceil = high + extra
  const range = Math.max(1, ceil - floor)
  const timeSpan = Math.max(1, points[points.length - 1].at - points[0].at)
  const coords = points.map(point => ({
    point,
    x: pad.left + (point.at - points[0].at) / timeSpan * drawWidth,
    y: pad.top + (ceil - point[metric]) / range * drawHeight,
  }))
  const line = coords.map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const area = `${line} L${coords.at(-1)!.x.toFixed(2)},${(height - pad.bottom).toFixed(2)} L${pad.left},${(height - pad.bottom).toFixed(2)} Z`
  const caption = metric === 'followers' ? 'followers' : 'sampled repository stars'
  const ticks = [0, .25, .5, .75, 1]

  return <div className="growth-chart-wrap">
    <svg viewBox={`0 0 ${width} ${height}`} className="growth-chart" role="img" aria-label={`Observed ${caption} chart: ${formatDate(points[0].at)} to ${formatDate(points[points.length-1].at)}, ${points.length} daily observations`}>
      <title>Measured {caption} from actual GitHub API snapshots</title>
      <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8da9d4" stopOpacity=".22"/><stop offset="100%" stopColor="#8da9d4" stopOpacity="0"/></linearGradient></defs>
      {ticks.map((tick, i) => {
        const y = pad.top + tick * drawHeight
        const label = ceil - tick * range
        return <g key={i}>
          <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#374353" strokeDasharray="3 7" strokeOpacity={.8}/>
          <text x={pad.left-13} y={y+4} textAnchor="end" className="growth-axis-label">{compactNumber(Math.round(label))}</text>
        </g>
      })}
      <path d={area} fill={`url(#${gradientId})`}/>
      <path d={line} fill="none" stroke="#a7bddd" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
      {coords.length <= 35 && coords.map(({ x, y, point }) => <circle key={point.at} cx={x} cy={y} r="4.5" stroke="#111820" strokeWidth="2.5" fill="#c3d3e9"><title>{`${formatDate(point.at)}: ${point[metric].toLocaleString('en')} ${caption}`}</title></circle>)}
      <text x={pad.left} y={height-10} className="growth-axis-label">{formatDate(points[0].at)}</text>
      <text x={width-pad.right} y={height-10} textAnchor="end" className="growth-axis-label">{formatDate(points[points.length-1].at)}</text>
    </svg>
    <div className="growth-chart-caption"><span><span className="growth-legend-dot"/> Measured API snapshots</span><span>{points.length} distinct UTC dates</span></div>
  </div>
}

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="growth-delta growth-delta-empty">Not enough history</span>
  return <span className={`growth-delta ${value < 0 ? 'growth-negative' : 'growth-positive'}`}>
    {value < 0 ? <ArrowDownRight size={15}/> : <ArrowUpRight size={15}/>} {value > 0 ? '+' : ''}{value.toLocaleString('en')}
    <span className="growth-delta-label"> observed</span>
  </span>
}

function exportCsv(username: string, points: GrowthPoint[]) {
  if (!points.length) return
  const blob = new Blob(['\uFEFF', growthCsv(username, points)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `repoverity-growth-${username.toLowerCase()}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

interface GrowthAnalyticsProps {
  username: string
  currentFollowers: number
  currentSampleStars: number
  profile: GrowthProfile
  enabled: boolean
  storageError: boolean
  limitReached: boolean
  onToggle: () => void
  onGoal: (value: number) => void
  onRefresh: () => void
  onClear: () => void
}

export function GrowthAnalytics({
  username, currentFollowers, currentSampleStars, profile, enabled,
  storageError, limitReached, onToggle, onGoal, onRefresh, onClear,
}: GrowthAnalyticsProps) {
  const [range, setRange] = useState<GrowthRange>('all')
  const [metric, setMetric] = useState<GrowthMetric>('followers')
  const points = useMemo(() => selectGrowthRange(profile.points, range), [profile.points, range])
  const comparison = useMemo(() => compareGrowth(points), [points])
  const latest = profile.points.at(-1)
  const progress = Math.min(100, Math.max(0, currentFollowers / profile.goal * 100))
  const supportedGoal = GOALS.includes(profile.goal)

  function deleteHistory() {
    if (window.confirm(`Delete all locally saved growth snapshots for @${username}? This cannot be undone.`)) onClear()
  }

  return <section className="growth-section" id="growth" aria-labelledby="growth-title">
    <div className="growth-section-heading">
      <div>
        <div className="eyebrow">VERSION 0.3 / GROWTH INTELLIGENCE</div>
        <h2 id="growth-title">Track what actually changes.</h2>
        <p>A truthful timeline for followers and repository stars, starting the day you enable tracking.</p>
      </div>
      <span className="growth-local-pill"><HardDrive size={14}/> BROWSER-LOCAL</span>
    </div>

    <div className="growth-layout">
      <div className="growth-main-card">
        <div className="growth-toolbar">
          <div className="growth-toolbar-caption"><span className="growth-online-dot"/> OBSERVED GROWTH <span> / </span> @{username}</div>
          <div className="growth-actions">
            <button type="button" onClick={onToggle} disabled={limitReached} className={`growth-action-button ${enabled ? '' : 'growth-action-accent'}`}>
              {enabled ? <Pause size={15}/> : <Play size={15}/>} {enabled ? 'Pause tracking' : profile.points.length ? 'Resume tracking' : 'Start tracking'}
            </button>
            <button type="button" onClick={onRefresh} className="growth-action-button growth-action-outline" title="Refresh public API data"><RefreshCw size={15}/> Refresh</button>
            <button type="button" onClick={() => exportCsv(username, profile.points)} disabled={!profile.points.length} className="growth-action-button growth-action-outline"><Download size={15}/> CSV</button>
          </div>
        </div>
        <div className="growth-summary">
          <div className="growth-stat"><div className="growth-stat-label"><Users size={14}/> FOLLOWERS</div><strong>{compactNumber(currentFollowers)}</strong><Delta value={comparison?.followerDelta ?? null}/></div>
          <div className="growth-stat"><div className="growth-stat-label"><Star size={14}/> STARS IN SAMPLE</div><strong>{compactNumber(currentSampleStars)}</strong><Delta value={comparison?.sampleStarDelta ?? null}/></div>
          <div className="growth-stat"><div className="growth-stat-label"><CalendarDays size={14}/> CHECKPOINTS</div><strong>{profile.points.length.toLocaleString('en')}</strong><span className="growth-stat-subtitle">{latest ? `Last: ${formatDate(latest.at)} UTC` : 'No history saved yet'}</span></div>
        </div>
        <div className="growth-chart-head">
          <div className="growth-chart-tabs" role="group" aria-label="Growth chart metric">
            <button type="button" className={metric === 'followers' ? 'selected' : ''} aria-pressed={metric === 'followers'} onClick={() => setMetric('followers')}><Users size={14}/> Followers</button>
            <button type="button" className={metric === 'sampleStars' ? 'selected' : ''} aria-pressed={metric === 'sampleStars'} onClick={() => setMetric('sampleStars')}><Star size={14}/> Stars in sample</button>
          </div>
          <div className="growth-range-tabs" role="group" aria-label="Growth chart time range">
            {([['7d','7D'],['30d','30D'],['all','ALL']] as const).map(([value,label]) => <button type="button" key={value} aria-pressed={range===value} className={range===value ? 'selected' : ''} onClick={()=>setRange(value)}>{label}</button>)}
          </div>
        </div>
        {points.length >= 2 ? <GrowthChart points={points} metric={metric}/> : <div className="growth-empty">
          <span className="growth-empty-icon"><TrendingUp size={28}/></span>
          <h3>{!profile.points.length ? 'Your first checkpoint starts here.' : 'One checkpoint, no invented trend.'}</h3>
          <p>{!profile.points.length
            ? 'Enable tracking to save the current public profile snapshot. Come back on a later UTC day to see a real change.'
            : 'A trend requires observations from two different days. Refreshing on the same day updates that day, not the number of checkpoints.'}</p>
          {!enabled && !limitReached && <button type="button" className="growth-empty-cta" onClick={onToggle}><Play size={15}/> Start tracking</button>}
          {profile.points.length > 1 && <button type="button" className="growth-empty-cta" onClick={()=>setRange('all')}>View all observations</button>}
        </div>}
        <div className="growth-bottom-note"><ShieldCheck size={15}/> No historical backfill or manufactured engagement. Data is saved only when the public profile is opened while tracking is enabled; nothing runs in the background.</div>
      </div>

      <div className="growth-side-column">
        <div className="growth-goal-card">
          <div className="growth-side-kicker"><Target size={15}/> FOLLOWER MILESTONE</div>
          <h3>Your next milestone</h3>
          <div className="growth-goal-select-wrap"><label htmlFor="growth-goal-select">Target followers</label><select id="growth-goal-select" value={profile.goal} onChange={event => onGoal(Number(event.target.value))}>
            {!supportedGoal && <option value={profile.goal}>{profile.goal.toLocaleString('en')}</option>}
            {GOALS.map(goal => <option key={goal} value={goal}>{goal.toLocaleString('en')}</option>)}
          </select></div>
          <div className="growth-progress-meta"><strong>{currentFollowers.toLocaleString('en')}</strong><span> / {profile.goal.toLocaleString('en')}</span><span className="growth-progress-percent">{progress.toFixed(0)}%</span></div>
          <div className="growth-progress-track" role="progressbar" aria-label="Follower milestone progress" aria-valuenow={Math.min(profile.goal,currentFollowers)} aria-valuemin={0} aria-valuemax={profile.goal}><span style={{width:`${progress}%`}}/></div>
          <p>{currentFollowers >= profile.goal ? 'Milestone reached. Choose a new target to keep measuring.' : `${(profile.goal-currentFollowers).toLocaleString('en')} more followers to this milestone.`}</p>
        </div>

        <div className="growth-privacy-card">
          <div className="growth-side-kicker"><HardDrive size={15}/> YOUR DATA, YOUR DEVICE</div>
          <h3>{enabled ? 'Tracking enabled' : profile.points.length ? 'Tracking paused' : 'Not tracking yet'}</h3>
          <p>Stored in this browser only, separately for each GitHub username. A different device or cleared browser storage will not have this history.</p>
          {storageError && <p role="alert" className="growth-storage-error">Your browser blocked local storage. Export your current observations before leaving; they may not persist.</p>}
          {limitReached && <p role="alert" className="growth-storage-error">This browser already tracks 25 profiles. Clear one profile's history to start tracking a new one.</p>}
          <div className="growth-storage-stats"><span><Activity size={13}/> {profile.points.length} daily snapshots</span><span><Check size={13}/> No server account</span></div>
          <button type="button" className="growth-clear" onClick={deleteHistory} disabled={!profile.points.length}><Trash2 size={14}/> Clear this profile's history</button>
        </div>
      </div>
    </div>
    <div className="growth-footnote">Star measurements include only the up to 100 recently updated public repositories returned by the API. A change in that sample can affect the star line without reflecting new stars across the entire account. The chart and CSV use real UTC timestamps.</div>
  </section>
}
