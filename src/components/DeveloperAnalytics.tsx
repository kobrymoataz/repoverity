import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import {
  Activity, ArrowRight, ArrowUpRight, BarChart3, CalendarDays, Check,
  Download, ExternalLink, GitFork, GitPullRequest, Info, RefreshCw,
  Search, Star, Users,
} from 'lucide-react'
import { getCachedSnapshot, normalizeUsername } from '../lib/github'
import { getPublicActivity, ACTIVITY_PAGE_LIMITS } from '../lib/developerActivityApi'
import {
  portfolioAnalytics, portfolioAnalyticsCsv, publishedReleaseIntervalDays,
  type PortfolioAnalytics, type PublicActivitySample,
} from '../lib/developerAnalytics'
import type { GitHubRepository, GitHubSnapshot } from '../types/github'

type AnalyticsTab = 'portfolio' | 'compare' | 'activity'
const TABS: { id: AnalyticsTab; label: string }[] = [
  { id: 'portfolio', label: 'Portfolio overview' },
  { id: 'compare', label: 'Compare profiles' },
  { id: 'activity', label: 'Repository activity' },
]

function format(value: number): string { return value.toLocaleString('en-US') }
function dateLabel(value: string): string {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date unavailable'
}
function DownloadPortfolio({ data }: { data: PortfolioAnalytics }) {
  const [downloaded, setDownloaded] = useState(false)
  function download() {
    const blob = new Blob([portfolioAnalyticsCsv(data)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `repoverity-portfolio-${data.login.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setDownloaded(true)
  }
  return <button type="button" className="rv14-outline" onClick={download}>
    {downloaded ? <Check size={15}/> : <Download size={15}/>} {downloaded ? 'CSV exported' : 'Export portfolio CSV'}
  </button>
}

function MetricCell({ label, value, helper }: { label: string; value: number | null; helper: string }) {
  return <div className="rv14-stat">
    <span className="rv14-label">{label}</span>
    <strong>{value === null ? 'N/A' : format(value)}</strong>
    <small>{helper}</small>
  </div>
}

function PortfolioView({ snapshot, reducedMotion }: { snapshot: GitHubSnapshot; reducedMotion: boolean }) {
  const data = useMemo(() => portfolioAnalytics(snapshot), [snapshot])
  const maximum = Math.max(1, ...data.buckets.map(x => x.count))
  const languageMax = Math.max(1, ...data.languages.map(x => x.count))
  return <div className="rv14-stack">
    <div className="rv14-section-header"><div>
      <span className="rv14-overline">PUBLIC PROFILE / OBSERVATION</span><h2>Portfolio intelligence</h2>
      <p>Account totals are separated from the loaded repository sample.</p>
    </div><DownloadPortfolio data={data}/></div>
    <div className="rv14-stat-grid">
      <MetricCell label="Followers" value={data.followers} helper="Full GitHub account count"/>
      <MetricCell label="Public repositories" value={data.publicRepositories} helper="GitHub reported account total"/>
      <MetricCell label="Sample stars" value={data.starsInSample} helper={`Across ${data.sampleSize} loaded repositories`}/>
      <MetricCell label="Active in 90 days" value={data.active90} helper="Last push among loaded repositories"/>
    </div>
    <div className="rv14-grid-two">
      <section className="rv14-panel" aria-labelledby="rv14-chart-title">
        <div className="rv14-panel-head"><div><span className="rv14-overline">LATEST PUSH DATE</span>
          <h3 id="rv14-chart-title">Repository activity distribution</h3></div><BarChart3 size={18}/></div>
        <p className="rv14-panel-description">Number of loaded repositories whose most recent push falls in each UTC month. These are not commit counts.</p>
        <div className="rv14-bar-chart" role="list" aria-label="Last push distribution by month">
          {data.buckets.map(item => <div className="rv14-bar-cell" key={item.key} role="listitem"
            aria-label={`${item.label}: ${item.count} repositories`}>
            <span className="rv14-bar-number">{item.count}</span>
            <div className="rv14-bar-track"><motion.div className="rv14-bar-fill"
              initial={reducedMotion ? false : { height: '0%' }}
              animate={{ height: `${100 * item.count / maximum}%` }}
              transition={{ duration: reducedMotion ? 0 : 0.45, ease: 'easeOut' }}/></div>
            <span className="rv14-bar-month">{item.label}</span>
          </div>)}
        </div>
        <div className="rv14-panel-foot">{data.sampleSize} repositories loaded. Earliest activity and full commit history are not inferred.</div>
      </section>
      <section className="rv14-panel" aria-labelledby="rv14-language-title">
        <div className="rv14-panel-head"><div><span className="rv14-overline">DISCOVERY</span><h3 id="rv14-language-title">Primary languages</h3></div><Activity size={18}/></div>
        <p className="rv14-panel-description">Based on the primary language metadata of loaded public repositories.</p>
        {data.languages.length ? <div className="rv14-languages">{data.languages.map(language => <div className="rv14-language" key={language.name}>
          <div className="rv14-language-row"><span>{language.name}</span><strong>{language.count} repos</strong></div>
          <div className="rv14-language-track"><div style={{ width: `${language.count / languageMax * 100}%` }}/></div>
        </div>)}</div> : <p className="rv14-empty">No primary language metadata is available in this sample.</p>}
        <div className="rv14-panel-foot">{data.originalRepositories} source projects. {data.archivedRepositories} archived.</div>
      </section>
    </div>
    <div className="rv14-grid-two">
      <section className="rv14-panel" aria-labelledby="rv14-engagement-title">
        <div className="rv14-panel-head"><div><span className="rv14-overline">ENGAGEMENT</span><h3 id="rv14-engagement-title">Selected sample signals</h3></div><Star size={18}/></div>
        <div className="rv14-key-row"><span>Stars in sample</span><strong>{format(data.starsInSample)}</strong></div>
        <div className="rv14-key-row"><span>Forks in sample</span><strong>{format(data.forksInSample)}</strong></div>
        <div className="rv14-key-row"><span>Recent pushes in 30 days</span><strong>{format(data.active30)}</strong></div>
        <div className="rv14-key-row"><span>Repository sample coverage</span><strong>{data.coveragePercent}%</strong></div>
        <div className="rv14-panel-foot">Sampling reflects recently updated owned public repositories, not all GitHub activity.</div>
      </section>
      <section className="rv14-panel" aria-labelledby="rv14-top-title">
        <div className="rv14-panel-head"><div><span className="rv14-overline">SOURCE REPOSITORIES</span><h3 id="rv14-top-title">Most starred in sample</h3></div><Star size={18}/></div>
        {data.mostStarred.length ? <div className="rv14-projects">{data.mostStarred.map(repo =>
          <a key={repo.id} href={repo.html_url} target="_blank" rel="noopener noreferrer" className="rv14-project-link">
            <span><strong>{repo.name}</strong><small>{repo.language || 'Unspecified language'}</small></span>
            <span><Star size={13}/>{format(repo.stargazers_count)}<ArrowUpRight size={13}/></span>
          </a>)}</div> : <p className="rv14-empty">No source repositories in the loaded sample.</p>}
      </section>
    </div>
    <div className="rv14-note"><Info size={17}/><p>One bar represents a repository's latest known push date. It cannot show the number of commits per month. For actual commit history, use GitHub's repository activity pages.</p></div>
  </div>
}

function ProfileComparison({ snapshot }: { snapshot: GitHubSnapshot }) {
  const primary = useMemo(() => portfolioAnalytics(snapshot), [snapshot])
  const [draft, setDraft] = useState('')
  const [secondary, setSecondary] = useState<GitHubSnapshot | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  async function compare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    let login: string
    try { login = normalizeUsername(draft) } catch { setMessage('Enter a valid GitHub username or profile URL.'); return }
    if (login.toLowerCase() === snapshot.user.login.toLowerCase()) {
      setMessage('Choose a different public profile for comparison.')
      return
    }
    controller.current?.abort()
    const request = new AbortController()
    controller.current = request
    setBusy(true); setMessage(null); setSecondary(null)
    try {
      const next = await getCachedSnapshot(login, request.signal)
      if (!request.signal.aborted) setSecondary(next)
    } catch (error) {
      if (!request.signal.aborted) setMessage(error instanceof Error ? error.message : 'Could not retrieve this public profile.')
    } finally { if (!request.signal.aborted) setBusy(false) }
  }
  const second = useMemo(() => secondary ? portfolioAnalytics(secondary) : null, [secondary])
  const rows: { label: string; key: keyof PortfolioAnalytics; scope: string }[] = [
    { label: 'Followers', key: 'followers', scope: 'Full account' },
    { label: 'Following', key: 'following', scope: 'Full account' },
    { label: 'Public repositories', key: 'publicRepositories', scope: 'Full account' },
    { label: 'Loaded repositories', key: 'sampleSize', scope: 'Sample' },
    { label: 'Stars', key: 'starsInSample', scope: 'Sample only' },
    { label: 'Forks', key: 'forksInSample', scope: 'Sample only' },
    { label: 'Active in last 90 days', key: 'active90', scope: 'Sample only' },
  ]
  return <div className="rv14-stack">
    <div className="rv14-section-header"><div><span className="rv14-overline">PROFILE COMPARISON</span>
      <h2>Compare two public profiles</h2><p>Inspect public account counts and clearly labeled repository samples side by side.</p></div></div>
    <form className="rv14-compare-form" onSubmit={compare} role="search" aria-label="Compare another public GitHub profile">
      <label htmlFor="rv14-compare-name">SECOND GITHUB ACCOUNT</label>
      <div><Search size={17}/><input id="rv14-compare-name" type="text" value={draft} onChange={e => setDraft(e.target.value)}
        placeholder="GitHub username" autoComplete="off" spellCheck={false} maxLength={180}/>
        <button type="submit" disabled={busy}>{busy ? 'Loading...' : 'Compare'}<ArrowRight size={15}/></button></div>
    </form>
    {message && <div className="rv14-error" role="alert">{message}</div>}
    {secondary && second ? <div className="rv14-panel rv14-comparison">
      <div className="rv14-compare-heading"><span>Metric</span>
        <a href={snapshot.user.html_url} target="_blank" rel="noopener noreferrer">@{primary.login}<ExternalLink size={13}/></a>
        <a href={secondary.user.html_url} target="_blank" rel="noopener noreferrer">@{second.login}<ExternalLink size={13}/></a></div>
      {rows.map(row => <div className="rv14-compare-row" key={row.key}>
        <div><strong>{row.label}</strong><small>{row.scope}</small></div>
        <span>{format(primary[row.key] as number)}</span><span>{format(second[row.key] as number)}</span>
      </div>)}
      <div className="rv14-panel-foot">Stars, forks and activity apply to different samples. Values are not normalized scores or whole-account totals.</div>
    </div> : <div className="rv14-placeholder"><Users size={27}/><strong>Compare when you are ready</strong>
      <p>The second profile is fetched only after you select Compare. Each lookup uses GitHub's public API.</p></div>}
  </div>
}

function ActivityList({ title, kind, values, error }: { title: string; kind: 'releases' | 'issues' | 'pulls'; values: PublicActivitySample['releases'] | PublicActivitySample['issues'] | PublicActivitySample['pulls']; error?: string }) {
  return <section className="rv14-panel rv14-activity-card">
    <div className="rv14-panel-head"><h3>{title}</h3><span className="rv14-small-note">Max {ACTIVITY_PAGE_LIMITS[kind]} returned</span></div>
    {error ? <p className="rv14-error" role="status">{error}</p> : values ? <>
      <p className="rv14-activity-count">{values.length} entries in this API response</p>
      {values.length === 0 ? <p className="rv14-empty">No entries returned in the requested sample.</p> : <div className="rv14-entry-list">
        {values.slice(0, 5).map(item => <a key={item.html_url} href={item.html_url} target="_blank" rel="noopener noreferrer">
          <strong>{'tag_name' in item ? item.tag_name : `#${item.number} ${item.title}`}</strong>
          <span>{'published_at' in item ? dateLabel(item.published_at) : dateLabel(item.updated_at)}<ArrowUpRight size={14}/></span>
        </a>)}
      </div>}
    </> : <p className="rv14-empty">No data loaded.</p>}
  </section>
}

function RepositoryActivity({ snapshot }: { snapshot: GitHubSnapshot }) {
  const repositories = useMemo(() => [...snapshot.repositories]
    .filter(repo => !repo.archived).sort((a, b) => a.name.localeCompare(b.name)), [snapshot])
  const [selected, setSelected] = useState(() => repositories.find(repo => !repo.fork)?.full_name || repositories[0]?.full_name || '')
  const [sample, setSample] = useState<PublicActivitySample | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  const repo: GitHubRepository | undefined = repositories.find(value => value.full_name === selected)
  async function inspect(forceRefresh = false) {
    if (!repo) return
    controller.current?.abort()
    const request = new AbortController()
    controller.current = request
    setBusy(true); setError(null); setSample(null)
    try {
      const report = await getPublicActivity(repo.full_name, request.signal, forceRefresh)
      if (!request.signal.aborted) setSample(report)
    } catch (problem) {
      if (!request.signal.aborted) setError(problem instanceof Error ? problem.message : 'GitHub activity could not be loaded.')
    } finally { if (!request.signal.aborted) setBusy(false) }
  }
  function changeRepository(value: string) {
    controller.current?.abort(); setBusy(false); setError(null); setSample(null); setSelected(value)
  }
  const interval = sample?.releases ? publishedReleaseIntervalDays(sample.releases) : null
  return <div className="rv14-stack">
    <div className="rv14-section-header"><div><span className="rv14-overline">PUBLIC REPOSITORY ACTIVITY</span>
      <h2>Inspect contributor and release signals</h2>
      <p>Read-only, on-demand requests for a selected public repository.</p></div></div>
    <div className="rv14-activity-controls">
      <label htmlFor="rv14-repository-select">SELECT REPOSITORY</label>
      <div><select id="rv14-repository-select" value={selected} onChange={e => changeRepository(e.target.value)}>
        {repositories.map(repository => <option key={repository.id} value={repository.full_name}>{repository.name}</option>)}
      </select>
      <button type="button" disabled={!repo || busy} onClick={() => void inspect(Boolean(sample))}>
        <RefreshCw size={16}/>{busy ? 'Retrieving data...' : sample ? 'Refresh activity' : 'Inspect activity'}
      </button></div>
    </div>
    {!repo && <div className="rv14-placeholder">No eligible public repositories in the loaded sample.</div>}
    {repo && <div className="rv14-repo-context"><div><strong>{repo.full_name}</strong>
      <p>{repo.description || 'No public description provided.'}</p></div>
      <a href={repo.html_url} target="_blank" rel="noopener noreferrer">Open on GitHub<ArrowUpRight size={15}/></a></div>}
    {error && <div className="rv14-error" role="alert">{error}</div>}
    {busy && <p className="rv14-status" role="status">Fetching up to four independent public API responses. Partial failures will be shown.</p>}
    {!sample && !busy && <div className="rv14-placeholder"><GitPullRequest size={29}/>
      <strong>Activity inspection is optional</strong><p>Select Inspect activity to fetch contributors, releases, issues and pull requests. Nothing is stored on a server.</p></div>}
    {sample && <>
      <div className="rv14-stat-grid rv14-stat-grid-activity">
        <MetricCell label="Contributor sample" value={sample.contributors?.length ?? null}
          helper={sample.contributors ? `First ${ACTIVITY_PAGE_LIMITS.contributors} returned` : 'Unavailable, see details'}/>
        <MetricCell label="Release sample" value={sample.releases?.length ?? null}
          helper={sample.releases ? `First ${ACTIVITY_PAGE_LIMITS.releases} returned` : 'Unavailable, see details'}/>
        <MetricCell label="Issue sample" value={sample.issues?.length ?? null}
          helper={sample.issues ? 'Non-PR issues in latest 30 entries' : 'Unavailable, see details'}/>
        <MetricCell label="PR sample" value={sample.pulls?.length ?? null}
          helper={sample.pulls ? 'Latest 30 PRs by update' : 'Unavailable, see details'}/>
      </div>
      <div className="rv14-grid-two">
        <section className="rv14-panel"><div className="rv14-panel-head"><h3>Contributor sample</h3><Users size={18}/></div>
          {sample.failures.contributors ? <p className="rv14-error" role="status">{sample.failures.contributors}</p>
            : sample.contributors?.length ? <div className="rv14-entry-list">{sample.contributors.slice(0, 6).map(person =>
              <a key={person.html_url} href={person.html_url} target="_blank" rel="noopener noreferrer">
                <strong>@{person.login}</strong><span>{format(person.contributions)} commits<ArrowUpRight size={14}/></span>
              </a>)}</div> : <p className="rv14-empty">No contributors returned.</p>}
          <div className="rv14-panel-foot">GitHub's contributor endpoint reports commit contributions, not a person's entire account activity.</div>
        </section>
        <section className="rv14-panel"><div className="rv14-panel-head"><h3>Release cadence</h3><CalendarDays size={18}/></div>
          {sample.failures.releases ? <p className="rv14-error" role="status">{sample.failures.releases}</p> : <>
            <div className="rv14-release-value">{interval === null ? 'Not enough data' : `${interval} days`}</div>
            <p className="rv14-panel-description">Median interval between published stable release dates in the returned release sample.</p>
            <div className="rv14-panel-foot">Drafts and prereleases are excluded from the median.</div>
          </>}
        </section>
      </div>
      <div className="rv14-grid-three">
        <ActivityList title="Recent releases" kind="releases" values={sample.releases} error={sample.failures.releases}/>
        <ActivityList title="Recent issues" kind="issues" values={sample.issues} error={sample.failures.issues}/>
        <ActivityList title="Recent pull requests" kind="pulls" values={sample.pulls} error={sample.failures.pulls}/>
      </div>
      <div className="rv14-note"><Info size={17}/><p>These are the first API pages, not lifetime totals. Issues exclude PR entries where GitHub identifies them. A failed request is shown as unavailable rather than zero. Sample refreshed at {new Date(sample.inspectedAt).toLocaleTimeString()}.</p></div>
    </>}
  </div>
}

export function DeveloperAnalytics({ snapshot, reducedMotion }: { snapshot: GitHubSnapshot; reducedMotion: boolean }) {
  const [active, setActive] = useState<AnalyticsTab>('portfolio')
  return <section className="rv14" aria-label="Developer Analytics Pro">
    <div className="rv14-banner"><div><span className="rv14-overline">ANALYTICS / V1.4</span>
      <h2>Developer intelligence</h2><p>Grounded in public GitHub data, with transparent sample coverage and deliberate API use.</p></div>
      <span className="rv14-banner-mark"><BarChart3 size={23}/></span>
    </div>
    <div className="rv14-tabs" role="tablist" aria-label="Developer analytics views">
      {TABS.map(tab => <button key={tab.id} type="button" role="tab" id={`rv14-tab-${tab.id}`}
        aria-controls={`rv14-panel-${tab.id}`} aria-selected={active === tab.id}
        className={active === tab.id ? 'rv14-tab-selected' : ''} onClick={() => setActive(tab.id)}>{tab.label}</button>)}
    </div>
    <motion.div key={active} className="rv14-tab-content" role="tabpanel" id={`rv14-panel-${active}`}
      aria-labelledby={`rv14-tab-${active}`}
      initial={reducedMotion ? false : { opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.23 }}>
      {active === 'portfolio' && <PortfolioView snapshot={snapshot} reducedMotion={reducedMotion}/>}
      {active === 'compare' && <ProfileComparison snapshot={snapshot}/>}
      {active === 'activity' && <RepositoryActivity snapshot={snapshot}/>}
    </motion.div>
    <div className="rv14-footer-note"><GitFork size={15}/> No GitHub login, no tokens, no automated engagement. Additional API calls run only after interaction.</div>
  </section>
}
