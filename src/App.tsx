import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BookOpen,
  Check, ChevronDown, CircleDot, Clock3, Code2, Compass, Copy,
  ExternalLink, FileCheck2, Filter, GitFork, Github, Globe2, Layers3,
  MapPin, Menu, Search, ShieldCheck, Sparkles, Star, TrendingUp, Users,
  X, Zap, type LucideIcon,
} from 'lucide-react'
import { useGithubProfile } from './hooks/useGithubProfile'
import { GithubApiError, normalizeUsername } from './lib/github'
import {
  activeWithinDays, calculateInsights, compactNumber, filterRepositories,
  shortDate, type RepositoryFilter, type RepositorySort,
} from './lib/insights'
import type { GitHubRepository, GitHubUser } from './types/github'

const OWNER = 'kobrymoataz'
const REPOSITORY_URL = `https://github.com/${OWNER}/repoverity`

type MetricProps = {
  title: string
  value: string
  note: string
  icon: LucideIcon
  emphasis?: boolean
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <a href="#overview" className={`brand ${compact ? 'brand-compact' : ''}`} aria-label="RepoVerity home">
      <span className="brand-emblem"><ShieldCheck size={22} strokeWidth={2.1} /></span>
      <span className="brand-name">repo<span>verity</span><small>LABS</small></span>
    </a>
  )
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const mainNav = [
    { label: 'Overview', href: '#overview', icon: Layers3 },
    { label: 'Repository explorer', href: '#repositories', icon: Compass },
    { label: 'Portfolio signals', href: '#signals', icon: Activity },
  ]
  return (
    <>
      {open && <button className="mobile-backdrop" onClick={onClose} aria-label="Close menu" />}
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="sidebar-head"><Logo /><button className="sidebar-close icon-button" onClick={onClose} aria-label="Close sidebar"><X size={18}/></button></div>
        <div className="sidebar-menu">
          <div className="nav-group-label">WORKSPACE</div>
          <nav className="side-nav" aria-label="Main navigation">
            {mainNav.map((item, index) => <a key={item.href} href={item.href} className={`side-link ${index === 0 ? 'side-link-current' : ''}`} onClick={onClose}>
              <item.icon size={18} strokeWidth={1.85}/><span>{item.label}</span>{index===0 && <span className="active-pin"/>}
            </a>)}
          </nav>
          <div className="nav-group-label nav-group-separator">PROJECT</div>
          <nav className="side-nav" aria-label="Project navigation">
            <a href="#roadmap" className="side-link" onClick={onClose}><Zap size={18}/><span>Development roadmap</span></a>
            <a href={REPOSITORY_URL} className="side-link" target="_blank" rel="noreferrer" onClick={onClose}><Github size={18}/><span>View source code</span><ArrowUpRight size={14} className="side-link-external"/></a>
          </nav>
        </div>
        <div className="sidebar-bottom">
          <div className="open-source-card">
            <span className="open-source-icon"><Code2 size={19}/></span>
            <strong>Built in the open.</strong>
            <p>Readable code, useful insights and a roadmap shaped by real developers.</p>
            <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">Explore repository <ArrowUpRight size={14}/></a>
          </div>
          <div className="sidebar-foot"><span><span className="mini-online"/> Open-source preview</span><span>v0.2.0</span></div>
        </div>
      </aside>
    </>
  )
}

function Metric({ title, value, note, icon: Icon, emphasis }: MetricProps) {
  return <div className={`metric-card ${emphasis ? 'metric-card-featured' : ''}`}>
    <div className="metric-top"><span>{title}</span><span className="metric-icon"><Icon size={18}/></span></div>
    <div className="metric-number">{value}</div>
    <div className="metric-note">{note}</div>
  </div>
}

function StatSkeleton() {
  return <div className="skeleton-grid" aria-label="Loading profile data">
    {Array.from({ length: 4 }, (_, i) => <div className="metric-card" key={i}><span className="skeleton-line skeleton-sm"/><span className="skeleton-line skeleton-xl"/><span className="skeleton-line skeleton-md"/></div>)}
  </div>
}

function Avatar({ user }: { user: GitHubUser }) {
  return <img className="profile-avatar" src={user.avatar_url} alt={`${user.login}'s GitHub avatar`} loading="lazy" referrerPolicy="no-referrer" />
}

function PublicProfile({ user, loaded, fetchedAt }: { user: GitHubUser; loaded: number; fetchedAt: number }) {
  return <div className="profile-card fade-in">
    <div className="profile-card-left">
      <span className="profile-avatar-frame"><Avatar user={user}/><span className="avatar-tick"><Check size={11} strokeWidth={3}/></span></span>
      <div className="profile-text">
        <div className="profile-title-line"><h2>{user.name || user.login}</h2><span className="public-chip"><Globe2 size={12}/> PUBLIC PROFILE</span></div>
        <a className="profile-handle" href={user.html_url} target="_blank" rel="noreferrer">@{user.login} <ArrowUpRight size={13}/></a>
        <p>{user.bio || 'No public bio added to this GitHub profile yet.'}</p>
        <div className="profile-meta">
          {user.location && <span><MapPin size={13}/>{user.location}</span>}
          <span><Clock3 size={13}/>Joined {shortDate(user.created_at)}</span>
          <span><CircleDot size={13}/>Updated {new Date(fetchedAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
    </div>
    <div className="profile-card-right">
      <span className="coverage-label">REPOSITORY COVERAGE</span>
      <span className="coverage-number">{loaded}<span> / {user.public_repos}</span></span>
      <div className="coverage-bar"><span style={{width: `${Math.min(100, user.public_repos > 0 ? loaded / user.public_repos * 100 : 100)}%`}}/></div>
      <span className="coverage-desc">Most recently updated, up to 100</span>
    </div>
  </div>
}

function LanguagePanel({ languages }: { languages: { name: string; count: number; percent: number }[] }) {
  return <section className="panel panel-language" aria-labelledby="languages-title">
    <div className="panel-heading"><div><div className="eyebrow">CODE LANDSCAPE</div><h3 id="languages-title">Language distribution</h3></div><span className="panel-heading-icon"><Code2 size={18}/></span></div>
    {languages.length ? <div className="language-bars">{languages.map((language, index) => <div className="language-row" key={language.name}>
      <div className="language-name"><span className={`language-dot language-color-${index}`}/><span>{language.name}</span><span className="language-percent">{language.percent}%</span></div>
      <div className="language-track"><span className={`language-fill language-fill-${index}`} style={{width: `${language.percent}%`}}/></div>
    </div>)}</div> : <p className="empty-small">No language metadata in this sample.</p>}
    <div className="panel-foot"><span><CircleDot size={13}/> Based on primary repository language</span><span>TOP 5</span></div>
  </section>
}

function SignalPanel({ signals, total }: { signals: ReturnType<typeof calculateInsights>['signals']; total: number }) {
  return <section className="panel panel-signals" id="signals" aria-labelledby="signals-title">
    <div className="panel-heading"><div><div className="eyebrow">PORTFOLIO HYGIENE</div><h3 id="signals-title">Quality signals</h3></div><span className="panel-heading-icon"><ShieldCheck size={18}/></span></div>
    <div className="signals-list">{signals.map(signal => <div className="signal-row" key={signal.label}>
      <div className="signal-text"><span>{signal.label}<small>{signal.detail}</small></span><strong>{signal.value}%</strong></div>
      <div className="signal-track"><span style={{width: `${signal.value}%`}}/></div>
    </div>)}</div>
    <div className="panel-foot"><span><CircleDot size={13}/> Signals, not a security audit</span><span>{total} REPOS</span></div>
  </section>
}

function RepositoryItem({ repo }: { repo: GitHubRepository }) {
  const updated = shortDate(repo.pushed_at || repo.updated_at)
  const recent = activeWithinDays(repo, 90)
  return <article className="repo-card">
    <div className="repo-top-line"><span className="repo-glyph"><BookOpen size={18}/></span><div className="repo-heading">
      <a href={repo.html_url} target="_blank" rel="noreferrer" className="repo-title">{repo.name}<ArrowUpRight size={16}/></a>
      <div className="repo-flags">{repo.archived && <span className="repo-flag">ARCHIVED</span>}{repo.fork && <span className="repo-flag">FORK</span>}</div>
    </div><a className="repo-open" href={repo.html_url} target="_blank" rel="noreferrer" aria-label={`Open ${repo.name} on GitHub`}><ExternalLink size={16}/></a></div>
    <p className="repo-description">{repo.description || 'No description provided yet for this repository.'}</p>
    <div className="repo-tags">{repo.topics.slice(0, 3).map(tag => <span key={tag}>{tag}</span>)}</div>
    <div className="repo-bottom">
      <div className="repo-stats"><span><Star size={14}/>{compactNumber(repo.stargazers_count)}</span><span><GitFork size={14}/>{compactNumber(repo.forks_count)}</span>{repo.language && <span className="repo-language"><i/>{repo.language}</span>}</div>
      <span className="repo-updated">{recent && <i/>}{updated}</span>
    </div>
  </article>
}

function Roadmap() {
  const features = [
    { icon: TrendingUp, title: 'Growth tracking', detail: 'Monitor daily follower and star changes after tracking begins.', status: 'V0.3' },
    { icon: FileCheck2, title: 'Achievement guide', detail: 'Explore official achievements and their documented criteria.', status: 'V0.4' },
    { icon: Sparkles, title: 'Repository advisor', detail: 'Actionable suggestions for making public projects easier to discover.', status: 'V0.5' },
  ]
  return <section id="roadmap" className="roadmap-section">
    <div className="section-title-row"><div><div className="eyebrow">WHAT'S NEXT</div><h2>Built openly. Improved deliberately.</h2><p>We're starting with truthful public data, then adding useful capabilities one release at a time.</p></div><span className="planned-badge"><CircleDot size={13}/> ROADMAP</span></div>
    <div className="roadmap-grid">{features.map(({icon: Icon,title,detail,status}) => <article className="roadmap-card" key={title}>
      <div className="roadmap-card-head"><span className="roadmap-icon"><Icon size={19}/></span><span className="roadmap-version">{status}</span></div>
      <h3>{title}</h3><p>{detail}</p><div className="roadmap-bottom"><span className="planned-dot"/> PLANNED <ArrowDownRight size={16}/></div>
    </article>)}</div>
  </section>
}

function LoadingContent() {
  return <><div className="loading-identity"><span className="skeleton-avatar"/><div><span className="skeleton-line skeleton-lg"/><span className="skeleton-line skeleton-md"/></div></div><StatSkeleton/><div className="loading-panels"><div/><div/></div></>
}

function App() {
  const { username, snapshot, status, error, analyze, retry } = useGithubProfile()
  const [draftUsername, setDraftUsername] = useState(username)
  const [validationMessage, setValidationMessage] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<RepositoryFilter>('all')
  const [sort, setSort] = useState<RepositorySort>('stars')
  const [visibleCount, setVisibleCount] = useState(6)
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const insights = useMemo(() => snapshot && calculateInsights(snapshot.repositories), [snapshot])
  const filteredRepositories = useMemo(() => snapshot ? filterRepositories(snapshot.repositories, query, filter, sort) : [], [snapshot, query, filter, sort])

  useEffect(() => { setVisibleCount(6) }, [query, filter, sort, snapshot])

  function doAnalyze(next: string) {
    try {
      const validName = normalizeUsername(next)
      setDraftUsername(validName)
      setValidationMessage(null)
      setQuery('')
      setFilter('all')
      analyze(validName)
    } catch (reason) {
      setValidationMessage(reason instanceof GithubApiError ? reason.message : 'Enter a valid GitHub username.')
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    doAnalyze(draftUsername)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const total = snapshot?.repositories.length ?? 0

  return <div className="app-shell" id="overview">
    <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)}/>
    <div className="main-area">
      <header className="app-topbar">
        <button className="topbar-menu icon-button" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={22}/></button>
        <div className="breadcrumb"><span>WORKSPACE</span><ArrowRight size={13}/><strong>Developer intelligence</strong></div>
        <div className="topbar-actions"><span className="beta-status"><span/> ALL SYSTEMS OPEN</span><a href={REPOSITORY_URL} target="_blank" rel="noreferrer" className="top-source-link"><Github size={16}/> Source code <ArrowUpRight size={14}/></a></div>
      </header>

      <main className="content">
        <div className="hero">
          <div className="hero-grid" aria-hidden="true"/><div className="hero-orb hero-orb-one" aria-hidden="true"/><div className="hero-orb hero-orb-two" aria-hidden="true"/>
          <div className="hero-copy">
            <div className="hero-kicker"><span className="pulsing-dot"/> INTRODUCING REPOVERITY <span> / </span> V0.2</div>
            <h1>Make your GitHub<br/><span>presence count.</span></h1>
            <p>Understand the work behind any public GitHub profile. Explore repositories, spot meaningful patterns, and build a portfolio worth following.</p>
            <div className="hero-tags"><span><Check size={14}/> Public data only</span><span><Check size={14}/> No account required</span><span><Check size={14}/> No follower bots</span></div>
          </div>
          <div className="lookup-box">
            <div className="lookup-header"><span><Search size={17}/> PROFILE LOOKUP</span><span className="lookup-version">01 / 01</span></div>
            <form onSubmit={onSubmit} noValidate>
              <label htmlFor="username-input">GitHub username or profile link</label>
              <div className="lookup-input-wrap"><Github size={19}/><input id="username-input" value={draftUsername} onChange={event => {setDraftUsername(event.target.value);setValidationMessage(null)}} autoComplete="off" spellCheck={false} placeholder="e.g. kobrymoataz" aria-describedby={validationMessage ? 'username-error' : undefined} aria-invalid={Boolean(validationMessage)}/></div>
              {validationMessage && <span className="lookup-error" id="username-error">{validationMessage}</span>}
              <button className="primary-button" type="submit" disabled={status==='loading'}>{status === 'loading' ? 'Analyzing profile...' : 'Analyze profile'}<ArrowRight size={17}/></button>
            </form>
            <div className="lookup-foot">OR TRY <button type="button" onClick={()=>doAnalyze('torvalds')}>torvalds <ArrowUpRight size={12}/></button><button type="button" onClick={()=>doAnalyze('gaearon')}>gaearon <ArrowUpRight size={12}/></button></div>
          </div>
        </div>

        <div className="dashboard-status"><div className="eyebrow">LIVE PROFILE SNAPSHOT</div><div className="dashboard-status-right"><span className="status-text"><span className="tiny-green-dot"/>{status==='loading' ? 'FETCHING PUBLIC DATA' : status==='error' ? 'REQUEST FAILED' : 'DATA RECEIVED'}</span><button type="button" onClick={copyLink} className="share-link"><span>{copied ? 'Copied' : 'Share report'}</span>{copied ? <Check size={14}/> : <Copy size={14}/>}</button></div></div>

        {status==='loading' && <LoadingContent/>}
        {status==='error' && <div className="error-panel" role="alert"><span className="error-icon"><ShieldCheck size={25}/></span><div><h2>We couldn't load this profile.</h2><p>{error}</p><p className="error-hint">RepoVerity reads GitHub's public API. Unauthenticated requests are limited and may temporarily be unavailable.</p><button className="secondary-button" type="button" onClick={retry}>Try again <ArrowRight size={16}/></button></div></div>}
        {status==='success' && snapshot && insights && <div className="fade-in">
          <PublicProfile user={snapshot.user} loaded={total} fetchedAt={snapshot.fetchedAt}/>
          <div className="metrics-grid" aria-label="GitHub profile statistics">
            <Metric title="FOLLOWERS" value={compactNumber(snapshot.user.followers)} note="People following this account" icon={Users} emphasis/>
            <Metric title="PUBLIC REPOSITORIES" value={compactNumber(snapshot.user.public_repos)} note="Public count reported by GitHub" icon={BookOpen}/>
            <Metric title="STARS IN SAMPLE" value={compactNumber(insights.stars)} note={`From ${total} loaded repositories`} icon={Star}/>
            <Metric title="FORKS IN SAMPLE" value={compactNumber(insights.forks)} note={`From ${total} loaded repositories`} icon={GitFork}/>
          </div>
          <div className="insights-grid"><LanguagePanel languages={insights.languages}/><SignalPanel signals={insights.signals} total={total}/></div>
          <section className="repositories-section" id="repositories">
            <div className="section-title-row section-heading-repos"><div><div className="eyebrow">THE WORK BEHIND THE PROFILE</div><h2>Repository explorer</h2><p>Search, compare and open public repositories from this account.</p></div><a className="view-github-link" href={`${snapshot.user.html_url}?tab=repositories`} target="_blank" rel="noreferrer">View on GitHub <ArrowUpRight size={15}/></a></div>
            <div className="repo-toolbar"><div className="repo-filters" role="group" aria-label="Repository filter">{([['all','All repositories'],['starred','With stars'],['active','Active 90d']] as const).map(([key,label]) => <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)} className={filter===key?'filter-active':''}>{label}</button>)}</div><div className="repo-tools"><label className="repo-search"><Search size={16}/><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search repositories" aria-label="Search repositories"/></label><label className="sort-select-wrap"><Filter size={14}/><select aria-label="Sort repositories" value={sort} onChange={event => setSort(event.target.value as RepositorySort)}><option value="stars">Most stars</option><option value="recent">Recently pushed</option><option value="forks">Most forks</option></select><ChevronDown size={13}/></label></div></div>
            <div className="repo-result-caption">SHOWING {Math.min(visibleCount, filteredRepositories.length)} OF {filteredRepositories.length} MATCHING REPOSITORIES</div>
            {filteredRepositories.length ? <div className="repo-grid">{filteredRepositories.slice(0,visibleCount).map(repo => <RepositoryItem key={repo.id} repo={repo}/>)}</div> : <div className="repo-empty"><Search size={23}/><h3>No repositories match.</h3><p>Try a different search or filter.</p><button type="button" onClick={()=>{setQuery('');setFilter('all')}}>Clear filters <ArrowRight size={15}/></button></div>}
            {visibleCount < filteredRepositories.length && <button type="button" className="load-more" onClick={()=>setVisibleCount(n=>n+6)}>Load more repositories <ArrowRight size={16}/></button>}
            {snapshot.user.public_repos > total && <div className="sampling-note"><CircleDot size={15}/> V0.2 inspects the 100 most recently updated public repositories. Counts labeled “in sample” do not represent every repository.</div>}
          </section>
        </div>}

        <Roadmap/>
        <footer className="site-footer"><span className="footer-brand"><span className="tiny-green-dot"/> REPOVERITY <span>© {new Date().getFullYear()}</span></span><span>Public data. Clear signals. No manufactured engagement.</span><a href={REPOSITORY_URL} target="_blank" rel="noreferrer">Crafted by @{OWNER} <ArrowUpRight size={13}/></a></footer>
      </main>
    </div>
  </div>
}

export default App
