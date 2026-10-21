import { lazy, Suspense, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import {
  Activity, AlertCircle, ArrowRight, ArrowUpRight, Award, BookOpen, Check,
  Clock3, Code2, Compass, Copy, Database, ExternalLink,
  FileCheck2, GitBranch, GitFork, Github, Globe2, LayoutGrid,
  MapPin, Menu, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Star, TrendingUp,
  Users, X, type LucideIcon,
} from 'lucide-react'
import { useGithubProfile } from './hooks/useGithubProfile'
import { useGrowthHistory } from './hooks/useGrowthHistory'
import { useMotionPreference } from './hooks/useMotionPreference'
import { OverviewReveal } from './components/OverviewReveal'
import { CommandPalette } from './components/CommandPalette'
import { MOTION_TIMING } from './lib/motionPreferences'
import { GithubApiError, normalizeUsername } from './lib/github'
import {
  calculateInsights, compactNumber, shortDate,
} from './lib/insights'
import { workspaceFromHash, workspaceHref, type WorkspaceId } from './lib/navigation'
import type { GitHubRepository, GitHubSnapshot } from './types/github'

const RepositoryExplorer = lazy(() => import('./components/RepositoryExplorer').then(m => ({ default: m.RepositoryExplorer })))
const DeveloperAnalytics = lazy(() => import('./components/DeveloperAnalytics').then(m => ({ default: m.DeveloperAnalytics })))
const GrowthAnalytics = lazy(() => import('./components/GrowthAnalytics').then(m => ({ default: m.GrowthAnalytics })))
const AchievementLab = lazy(() => import('./components/AchievementLab').then(m => ({ default: m.AchievementLab })))
const ContributionFinder = lazy(() => import('./components/ContributionFinder').then(m => ({ default: m.ContributionFinder })))
const RepositoryAdvisor = lazy(() => import('./components/RepositoryAdvisor').then(m => ({ default: m.RepositoryAdvisor })))
const DataPortability = lazy(() => import('./components/DataPortability').then(m => ({ default: m.DataPortability })))

const REPOSITORY_URL = 'https://github.com/kobrymoataz/repoverity'

type NavItem = { id: WorkspaceId; label: string; icon: LucideIcon }
const navigation: { label: string; items: NavItem[] }[] = [
  { label: 'WORKSPACE', items: [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'repositories', label: 'Repositories', icon: BookOpen },
    { id: 'analytics', label: 'Analytics Pro', icon: Activity },
    { id: 'growth', label: 'Growth history', icon: TrendingUp },
  ] },
  { label: 'DEVELOPER TOOLS', items: [
    { id: 'advisor', label: 'Repository advisor', icon: FileCheck2 },
    { id: 'contributions', label: 'Find contributions', icon: Compass },
    { id: 'achievements', label: 'Achievements', icon: Award },
  ] },
  { label: 'PROJECT', items: [
    { id: 'privacy', label: 'Data & privacy', icon: Database },
    { id: 'about', label: 'About RepoVerity', icon: ShieldCheck },
  ] },
]

const viewTitles: Record<WorkspaceId, { title: string; subtitle: string; category: string }> = {
  overview: { title: 'Overview', subtitle: 'Public GitHub data, organized for a closer look.', category: 'WORKSPACE' },
  repositories: { title: 'Repositories', subtitle: 'Explore public repositories with pagination, comparison and saved views.', category: 'EXPLORE' },
  analytics: { title: 'Analytics Pro', subtitle: 'Compare profiles, explore public activity and understand repository signals.', category: 'ANALYZE' },
  growth: { title: 'Growth history', subtitle: 'Follow changes in recorded observations, not estimated history.', category: 'TRACK' },
  advisor: { title: 'Repository advisor', subtitle: 'Review public metadata and check repository files on demand.', category: 'IMPROVE' },
  contributions: { title: 'Find contributions', subtitle: 'Discover open issues that welcome contributors.', category: 'CONTRIBUTE' },
  achievements: { title: 'Achievements', subtitle: 'Track GitHub achievement criteria and your own progress.', category: 'LEARN' },
  privacy: { title: 'Data & privacy', subtitle: 'Export, restore and manage records stored on this device.', category: 'CONTROL' },
  about: { title: 'About RepoVerity', subtitle: 'A clear view of what the project measures and what it cannot.', category: 'PROJECT' },
}

function Brand() {
  return <a className="rv-brand" href={workspaceHref('overview')} aria-label="RepoVerity home">
    <span className="rv-brand-icon"><GitBranch size={19} strokeWidth={2.15}/></span>
    <span className="rv-brand-name">repoverity<span className="rv-brand-version">/ 1.4</span></span>
  </a>
}

function Sidebar({ active, open, close, username, reduced }: { active: WorkspaceId; open: boolean; close: () => void; username: string; reduced: boolean }) {
  return <>
    <AnimatePresence>
      {open && <motion.button type="button" key="navigation-scrim" className="rv-scrim"
        aria-label="Close navigation" onClick={close}
        initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: reduced ? 0 : MOTION_TIMING.exit }}/>} 
    </AnimatePresence>
    <aside className={`rv-sidebar ${open ? 'rv-sidebar-open' : ''}`} aria-label="Primary navigation">
      <div className="rv-sidebar-top"><Brand/><button type="button" className="rv-nav-close" onClick={close} aria-label="Close menu"><X size={18}/></button></div>
      <div className="rv-sidebar-scroll">
        <div className="rv-project-switch"><span className="rv-switch-symbol"><Github size={18}/></span><span className="rv-switch-text"><strong>Public workspace</strong><small>GitHub analysis</small></span><span className="rv-switch-status" title="Public API"/></div>
        {navigation.map(group => <div className="rv-navigation-group" key={group.label}>
          <div className="rv-navigation-label">{group.label}</div>
          <nav aria-label={group.label} className="rv-nav-list">
            {group.items.map(item => <motion.a href={workspaceHref(item.id)} key={item.id} onClick={close}
              whileHover={reduced ? undefined : { x: 2 }} whileTap={reduced ? undefined : { scale: 0.99 }}
              transition={{ duration: reduced ? 0 : MOTION_TIMING.hover }}
              className={`rv-nav-link ${active === item.id ? 'rv-nav-active' : ''}`} aria-current={active === item.id ? 'page' : undefined}>
              <item.icon size={17} strokeWidth={1.85}/><span>{item.label}</span>
              {active === item.id && <motion.span layoutId="rv-active-navigation" className="rv-nav-indicator"
                aria-hidden="true" transition={{ type: 'spring', stiffness: 550, damping: 44 }}/>} 
            </motion.a>)}
          </nav>
        </div>)}
      </div>
      <div className="rv-sidebar-bottom">
        <div className="rv-connected"><span className="rv-connected-dot"/><span>Viewing public GitHub data</span></div>
        <div className="rv-sidebar-user"><span className="rv-user-glyph">@</span><span className="rv-sidebar-user-text"><strong>{username}</strong><small>Current account</small></span></div>
        <a className="rv-sidebar-source" href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer"><Github size={15}/> View source code <ArrowUpRight size={14}/></a>
      </div>
    </aside>
  </>
}

function SectionIntro({ view, action }: { view: WorkspaceId; action?: ReactNode }) {
  const text = viewTitles[view]
  return <div className="rv-page-heading">
    <div><span className="rv-eyebrow">{text.category} <span>/</span> REPOVERITY</span><h1>{text.title}</h1><p>{text.subtitle}</p></div>
    {action && <div className="rv-heading-action">{action}</div>}
  </div>
}

function AccountSearch({ value, setValue, onSubmit, error, busy, inputRef }: {
  value: string; setValue: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  error: string | null; busy: boolean; inputRef: RefObject<HTMLInputElement | null>;
}) {
  return <form className="rv-account-form" onSubmit={onSubmit} noValidate role="search" aria-label="Look up a GitHub account">
    <label htmlFor="rv-username-input" className="rv-search-label">GITHUB PROFILE</label>
    <div className="rv-account-search-row">
      <div className="rv-account-input-wrap"><Github size={18}/><input ref={inputRef} id="rv-username-input" type="text" value={value} onChange={event => setValue(event.target.value)}
        autoComplete="off" spellCheck={false} placeholder="Username or github.com/username" aria-invalid={Boolean(error)} aria-describedby={error ? 'rv-search-error' : undefined}/><kbd>/</kbd></div>
      <button className="rv-primary-button" type="submit" disabled={busy}>{busy ? 'Loading' : 'Analyze'}<ArrowRight size={16}/></button>
    </div>
    {error && <p id="rv-search-error" className="rv-search-error" role="alert">{error}</p>}
  </form>
}

function ProfileCard({ snapshot }: { snapshot: GitHubSnapshot }) {
  const user = snapshot.user
  return <section className="rv-profile-card" aria-label="Public GitHub profile">
    <div className="rv-profile-identity">
      <img className="rv-avatar" src={user.avatar_url} loading="lazy" alt={`${user.login} avatar`} referrerPolicy="no-referrer"/>
      <div className="rv-profile-copy"><span className="rv-kicker">PUBLIC PROFILE</span>
        <div className="rv-profile-name-row"><h2>{user.name || user.login}</h2><a href={user.html_url} target="_blank" rel="noopener noreferrer" aria-label="Open GitHub profile"><ArrowUpRight size={17}/></a></div>
        <div className="rv-handle">@{user.login}</div>
        <p>{user.bio || 'No public biography available for this account.'}</p>
        <div className="rv-profile-meta">{user.location && <span><MapPin size={14}/>{user.location}</span>}<span><Clock3 size={14}/>Joined {shortDate(user.created_at)}</span></div>
      </div>
    </div>
    <div className="rv-profile-coverage"><span className="rv-coverage-label">REPOSITORIES ANALYZED</span><div><strong>{snapshot.repositories.length}</strong><span> / {user.public_repos}</span></div>
      <div className="rv-coverage-track"><span style={{width:`${Math.min(100,user.public_repos ? snapshot.repositories.length / user.public_repos * 100 : 100)}%`}}/></div>
      <p>Recently updated public repositories, up to 100.</p>
    </div>
  </section>
}

function Metric({ label, value, hint, icon: Icon }: { label: string; value: string; hint: string; icon: LucideIcon }) {
  return <div className="rv-metric"><div className="rv-metric-heading"><span>{label}</span><Icon size={17}/></div><strong>{value}</strong><p>{hint}</p></div>
}

function Metrics({ snapshot, insights }: { snapshot: GitHubSnapshot; insights: NonNullable<ReturnType<typeof calculateInsights>> }) {
  return <div className="rv-metrics" aria-label="GitHub account statistics">
    <Metric icon={Users} label="FOLLOWERS" value={compactNumber(snapshot.user.followers)} hint="GitHub public count"/>
    <Metric icon={BookOpen} label="PUBLIC REPOS" value={compactNumber(snapshot.user.public_repos)} hint="Reported by GitHub"/>
    <Metric icon={Star} label="SAMPLED STARS" value={compactNumber(insights.stars)} hint={`Across ${snapshot.repositories.length} loaded repos`}/>
    <Metric icon={GitFork} label="SAMPLED FORKS" value={compactNumber(insights.forks)} hint={`Across ${snapshot.repositories.length} loaded repos`}/>
  </div>
}

function LanguageDistribution({ insights }: { insights: ReturnType<typeof calculateInsights> }) {
  return <section className="rv-panel"><div className="rv-panel-header"><div><span className="rv-kicker">TECHNOLOGIES</span><h2>Languages</h2></div><Code2 size={19}/></div>
    <div className="rv-language-items">{insights.languages.length ? insights.languages.map((lang, i) => <div className="rv-language-item" key={lang.name}>
      <div className="rv-language-label"><span><i className={`rv-language-dot rv-language-dot-${i}`}/>{lang.name}</span><strong>{lang.percent}%</strong></div>
      <div className="rv-language-track"><div className={`rv-language-fill rv-language-fill-${i}`} style={{width:`${lang.percent}%`}}/></div>
    </div>) : <p className="rv-empty-inline">No primary language information in this sample.</p>}</div>
    <p className="rv-panel-note">Based on the primary language of each sampled repository.</p></section>
}

function MetadataCoverage({ insights }: { insights: ReturnType<typeof calculateInsights> }) {
  return <section className="rv-panel"><div className="rv-panel-header"><div><span className="rv-kicker">PUBLISHING PRACTICES</span><h2>Metadata coverage</h2></div><FileCheck2 size={19}/></div>
    <div className="rv-signal-list">{insights.signals.map(signal => <div className="rv-signal-item" key={signal.label}>
      <div><span>{signal.label}</span><strong>{signal.value}%</strong></div>
      <div className="rv-language-track"><span style={{width:`${signal.value}%`}}/></div>
    </div>)}</div>
    <p className="rv-panel-note">Simple metadata checks, not a security assessment.</p></section>
}

function RepositoryTable({ repositories, condensed=false }: { repositories: GitHubRepository[]; condensed?: boolean }) {
  return <div className="rv-table-scroll"><table className="rv-repository-table">
    <thead><tr><th scope="col">Repository</th><th scope="col">Language</th><th scope="col">Stars</th><th scope="col">Forks</th><th scope="col">Last push</th><th scope="col"><span className="rv-visually-hidden">Open</span></th></tr></thead>
    <tbody>{repositories.map(repo => <tr key={repo.id}>
      <td><a href={repo.html_url} className="rv-table-repo" target="_blank" rel="noopener noreferrer"><span className="rv-repo-symbol"><BookOpen size={15}/></span><span><strong>{repo.name}</strong><small>{repo.description || 'No repository description'}</small></span></a></td>
      <td><span className="rv-language-cell">{repo.language ? <i/> : null}{repo.language || 'Unspecified'}</span></td>
      <td><span className="rv-num-cell"><Star size={14}/>{compactNumber(repo.stargazers_count)}</span></td>
      <td><span className="rv-num-cell"><GitFork size={14}/>{compactNumber(repo.forks_count)}</span></td>
      <td><span className="rv-date-cell">{shortDate(repo.pushed_at || repo.updated_at)}</span></td>
      <td><a className="rv-row-open" href={repo.html_url} target="_blank" rel="noopener noreferrer" aria-label={`View ${repo.name} on GitHub`}><ArrowUpRight size={16}/></a></td>
    </tr>)}</tbody>
  </table>{repositories.length===0 && <div className="rv-table-empty"><Search size={23}/><strong>No matching repositories</strong><p>Change the search term or filter.</p></div>}
  {!condensed && repositories.length > 0 && <p className="rv-table-note">The table includes owned public repositories returned by GitHub.</p>}
  </div>
}

function AsyncFallback({ title }: { title: string }) {
  return <div className="rv-async-fallback" role="status"><span className="rv-loader"/>Loading {title.toLowerCase()}...</div>
}

function LoadingProfile() {
  return <div className="rv-loading-profile" role="status" aria-live="polite"><span className="rv-loader"/><div><strong>Retrieving public profile</strong><p>Requesting current information from GitHub.</p></div></div>
}

function ErrorProfile({ message, retry }: { message: string | null; retry: () => void }) {
  return <section className="rv-error-panel" role="alert"><AlertCircle size={22}/><div><h2>Profile unavailable</h2><p>{message || 'GitHub could not return this account.'}</p><p>Unauthenticated GitHub requests have rate limits. You can try again later.</p><button className="rv-outline-button" type="button" onClick={retry}><RefreshCw size={15}/> Retry request</button></div></section>
}

function AboutView() {
  const links = [
    { label: 'Source code', url: REPOSITORY_URL, icon: Github },
    { label: 'Architecture', url: `${REPOSITORY_URL}/blob/main/docs/ARCHITECTURE.md`, icon: GitBranch },
    { label: 'Contribute', url: `${REPOSITORY_URL}/blob/main/CONTRIBUTING.md`, icon: BookOpen },
    { label: 'Privacy policy', url: `${REPOSITORY_URL}/blob/main/docs/PRIVACY.md`, icon: ShieldCheck },
  ]
  return <div className="rv-about-grid"><section className="rv-panel rv-about-leading"><div className="rv-about-mark"><GitBranch size={27}/></div><h2>Public information, shown with its limits.</h2><p>RepoVerity helps developers inspect public GitHub profiles, discover contributions, follow their own measured growth and improve repository documentation. The application is open source and does not require a GitHub account login.</p><div className="rv-about-facts"><span>React + TypeScript</span><span>GitHub REST API</span><span>Local-first tracking</span><span>MIT license</span></div></section>
    <section className="rv-panel"><div className="rv-panel-header"><h2>Project resources</h2><ExternalLink size={17}/></div><div className="rv-resource-links">{links.map(link=><a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer"><link.icon size={18}/><span>{link.label}</span><ArrowUpRight size={16}/></a>)}</div></section>
    <section className="rv-panel rv-about-limit"><span className="rv-kicker">DATA METHODOLOGY</span><h2>Read the numbers correctly</h2><p>Stars and forks summarize a sample of up to 100 recently updated public repositories. Growth graphs contain observations from days when tracking was enabled and this browser visited the page. Achievement progress is entered by the user. File presence checks are not vulnerability scans.</p></section>
  </div>
}

function App() {
  const { username, snapshot, status, error, analyze, retry } = useGithubProfile()
  const growth = useGrowthHistory(snapshot, status === 'success')
  const animation = useMotionPreference()
  const [active, setActive] = useState<WorkspaceId>(()=>workspaceFromHash(window.location.hash))
  const [menuOpen, setMenuOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [draftUsername, setDraftUsername] = useState(username)
  const [validationMessage, setValidationMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const insights = useMemo(() => snapshot ? calculateInsights(snapshot.repositories) : null, [snapshot])

  useEffect(() => {
    function syncView() {
      setActive(workspaceFromHash(window.location.hash))
      window.scrollTo({top:0,behavior:'auto'})
    }
    window.addEventListener('hashchange', syncView)
    return () => window.removeEventListener('hashchange', syncView)
  }, [])
  useEffect(() => {
    function shortcuts(event: KeyboardEvent) {
      const element = event.target as HTMLElement | null
      const editing = element?.matches('input,textarea,select,[contenteditable="true"]')
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen(previous => !previous)
        return
      }
      if (event.key === '/' && !editing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
      if (event.key === 'Escape') { setMenuOpen(false); setCommandOpen(false) }
    }
    window.addEventListener('keydown', shortcuts)
    return () => window.removeEventListener('keydown', shortcuts)
  }, [])

  function doAnalyze(raw: string) {
    try {
      const clean = normalizeUsername(raw)
      setDraftUsername(clean)
      setValidationMessage(null)
      analyze(clean)
      if (active !== 'overview') window.location.hash = workspaceHref('overview')
    } catch (reason) {
      setValidationMessage(reason instanceof GithubApiError ? reason.message : 'Enter a valid GitHub username.')
      searchInputRef.current?.focus()
    }
  }
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    doAnalyze(draftUsername)
  }
  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(()=>setCopied(false), 1800)
    } catch {setCopied(false)}
  }
  const isLoaded = status === 'success' && snapshot && insights
  const title = viewTitles[active]

  return <MotionConfig reducedMotion={animation.reduceMotion ? "always" : "user"}><div className="rv-app">
    <a className="rv-skip" href="#main-content" onClick={event=>{event.preventDefault();document.getElementById('main-content')?.focus()}}>Skip to content</a>
    <Sidebar active={active} open={menuOpen} close={()=>setMenuOpen(false)} username={username} reduced={animation.reduceMotion}/>
    <CommandPalette open={commandOpen} close={()=>setCommandOpen(false)} reduced={animation.reduceMotion}
      navigate={id => { window.location.hash = workspaceHref(id); setCommandOpen(false) }}/>
    <div className="rv-main-column">
      <header className="rv-topbar">
        <div className="rv-topbar-left"><button type="button" className="rv-mobile-menu" aria-label="Open menu" onClick={()=>setMenuOpen(true)}><Menu size={20}/></button>
          <span className="rv-topbar-home">Workspace</span><span className="rv-topbar-separator">/</span><span className="rv-topbar-current">{title.title}</span>
        </div>
        <div className="rv-topbar-right">
          <button className="rv-command-trigger" type="button" aria-label="Quick switch workspaces" title="Open quick switch (Command K or Control K)"
            onClick={()=>setCommandOpen(true)}><Search size={16}/><span>Quick switch</span><kbd>⌘ K</kbd></button>
          <button type="button" className="rv-motion-control" onClick={animation.toggle}
            disabled={animation.systemReduced}
            aria-pressed={animation.reduceMotion}
            aria-label={animation.systemReduced ? 'Animations reduced by system preference' : animation.reduceMotion ? 'Enable interface animations' : 'Reduce interface animations'}
            title={animation.storageError ? 'Preference could not be saved on this device' : animation.systemReduced ? 'System reduced-motion setting is active' : animation.reduceMotion ? 'Enable animations' : 'Reduce animations'}>
            <SlidersHorizontal size={15}/><span>{animation.reduceMotion ? 'Motion reduced' : 'Motion on'}</span>
          </button><span className="rv-topbar-public"><span className="rv-live-indicator"/>Public API</span>
          {isLoaded && <button type="button" className="rv-topbar-icon" onClick={retry} aria-label="Refresh account data" title="Refresh account data"><RefreshCw size={16}/></button>}
          <a className="rv-topbar-github" href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer" aria-label="Open RepoVerity source code"><Github size={17}/><span>GitHub</span><ArrowUpRight size={14}/></a>
        </div>
      </header>
      <main className="rv-content" id="main-content" tabIndex={-1}>
        <AnimatePresence mode="wait" initial={false}>
        <motion.div key={active} className="rv-motion-page"
          initial={animation.reduceMotion ? false : { opacity: 0, y: 9 }}
          animate={{ opacity: 1, y: 0 }}
          exit={animation.reduceMotion ? { opacity: 1 } : { opacity: 0, y: -5 }}
          transition={{ duration: animation.reduceMotion ? 0 : MOTION_TIMING.navigate, ease: 'easeOut' }}>
        <SectionIntro view={active} action={isLoaded ? <button type="button" className="rv-outline-button" onClick={copyShareLink}>{copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? 'Link copied' : 'Share view'}</button> : undefined}/>
        <div className="rv-top-search"><AccountSearch value={draftUsername} setValue={value=>{setDraftUsername(value);setValidationMessage(null)}} onSubmit={onSubmit} error={validationMessage} busy={status==='loading'} inputRef={searchInputRef}/><div className="rv-top-search-footer"><span>Public GitHub accounts only. No authorization required.</span><span>Press <kbd>/</kbd> to focus search</span></div></div>

        {active !== 'privacy' && active !== 'about' && active !== 'contributions' && status === 'loading' && <LoadingProfile/>}
        {active !== 'privacy' && active !== 'about' && active !== 'contributions' && status === 'error' && <ErrorProfile message={error} retry={retry}/>}

        {active === 'overview' && isLoaded && <OverviewReveal key={`overview-${snapshot.user.id}`} reduced={animation.reduceMotion}>
          <div className="rv-view rv-overview-view">
          <ProfileCard snapshot={snapshot}/>
          <Metrics snapshot={snapshot} insights={insights}/>
          <div className="rv-section-top"><div><span className="rv-kicker">PORTFOLIO</span><h2>Project signals</h2></div><a className="rv-text-link" href={workspaceHref('analytics')}>Explore insights <ArrowRight size={16}/></a></div>
          <div className="rv-insights-grid"><LanguageDistribution insights={insights}/><MetadataCoverage insights={insights}/></div>
          <div className="rv-section-top"><div><span className="rv-kicker">RECENTLY UPDATED</span><h2>Public repositories</h2></div><a className="rv-text-link" href={workspaceHref('repositories')}>All repositories <ArrowRight size={16}/></a></div>
          <section className="rv-table-panel"><RepositoryTable repositories={[...snapshot.repositories].sort((a,b)=>Date.parse(b.pushed_at||b.updated_at)-Date.parse(a.pushed_at||a.updated_at)).slice(0,6)} condensed/></section>
          <div className="rv-footnote"><Globe2 size={15}/>This account has {snapshot.user.public_repos} public repositories. Stars and forks reflect only the sample displayed here.</div>
          </div>
        </OverviewReveal>}

        {active === 'repositories' && isLoaded && <div className="rv-view">
          <Suspense fallback={<AsyncFallback title="Repository explorer"/>}>
            <RepositoryExplorer key={`${snapshot.user.login}-${snapshot.fetchedAt}`} snapshot={snapshot} reducedMotion={animation.reduceMotion}/>
          </Suspense>
        </div>}

        {active === 'analytics' && isLoaded && <div className="rv-view rv-feature-page">
          <Suspense fallback={<AsyncFallback title="Developer analytics"/>}>
            <DeveloperAnalytics key={`${snapshot.user.id}-${snapshot.fetchedAt}`} snapshot={snapshot} reducedMotion={animation.reduceMotion}/>
          </Suspense>
        </div>}

        {active === 'growth' && isLoaded && <div className="rv-view rv-feature-page rv-growth-page"><Suspense fallback={<AsyncFallback title="Growth history"/>}>
          <GrowthAnalytics username={snapshot.user.login} currentFollowers={snapshot.user.followers} currentSampleStars={insights.stars} profile={growth.profile} enabled={growth.enabled} storageError={growth.storageError} limitReached={growth.limitReached} onToggle={growth.toggleTracking} onGoal={growth.updateGoal} onRefresh={retry} onClear={growth.clearHistory} reducedMotion={animation.reduceMotion}/>
        </Suspense></div>}

        {active === 'achievements' && isLoaded && <div className="rv-view rv-feature-page"><Suspense fallback={<AsyncFallback title="Achievements"/>}><AchievementLab username={snapshot.user.login} repositories={snapshot.repositories}/></Suspense></div>}
        {active === 'advisor' && isLoaded && <div className="rv-view rv-feature-page"><Suspense fallback={<AsyncFallback title="Repository advisor"/>}><RepositoryAdvisor username={snapshot.user.login} repositories={snapshot.repositories}/></Suspense></div>}
        {active === 'contributions' && <div className="rv-view rv-feature-page"><Suspense fallback={<AsyncFallback title="Contribution finder"/>}><ContributionFinder/></Suspense></div>}
        {active === 'privacy' && <div className="rv-view rv-feature-page"><Suspense fallback={<AsyncFallback title="Data management"/>}><DataPortability/></Suspense></div>}
        {active === 'about' && <div className="rv-view"><AboutView/></div>}

        </motion.div></AnimatePresence>
        <footer className="rv-footer"><span><GitBranch size={15}/>RepoVerity <span className="rv-footer-version">v1.4</span></span><span>Public data, clear methodology, open source.</span><a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">MIT licensed <ArrowUpRight size={14}/></a></footer>
      </main>
    </div>
  </div></MotionConfig>
}

export default App
