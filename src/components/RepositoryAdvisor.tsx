import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, ArrowRight, ArrowUpRight, BookOpen, Check, CheckCircle2, ChevronRight,
  CircleAlert, CircleDot, ClipboardCopy, Download, FileCheck2,
  GitBranch, Globe2, Info, Layers3, LoaderCircle, RefreshCw, Search, ShieldCheck,
  Sparkles, Star, Target, type LucideIcon,
} from 'lucide-react'
import type { GitHubRepository } from '../types/github'
import { adviceAsMarkdown, analyzePortfolio, type RepositoryAction } from '../lib/advisor'
import {
  inspectRepository, inspectionRecommendations, type RepositoryInspection,
} from '../lib/repositoryAudit'

interface AdvisorProps {
  repositories: GitHubRepository[]
  username: string
}

type InspectionState = 'idle' | 'loading' | 'success' | 'error'

const CATEGORY_ICONS: Record<RepositoryAction['category'], LucideIcon> = {
  Documentation: BookOpen,
  Discoverability: Target,
  Maintenance: Activity,
  Governance: ShieldCheck,
}

const DATE_OPTIONS: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }

function MetricCard({ label, value, sub, icon: Icon }: { label: string; value: string; sub: string; icon: LucideIcon }) {
  return <div className="adv5-kpi">
    <div className="adv5-kpi-top"><span>{label}</span><Icon size={17}/></div>
    <strong>{value}</strong><small>{sub}</small>
  </div>
}

function ScoreRing({ score }: { score: number | null }) {
  const safe = score ?? 0
  return <div className="adv5-ring" role="img" aria-label={score === null ? 'Metadata not assessed' : `Metadata coverage ${score} percent`}>
    <svg width="116" height="116" viewBox="0 0 116 116" aria-hidden="true">
      <circle cx="58" cy="58" r="45" stroke="#263d48" fill="none" strokeWidth="9"/>
      <circle cx="58" cy="58" r="45" stroke="#75e5c3" fill="none" strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${Math.PI * 90}`} strokeDashoffset={`${Math.PI * 90 * (1 - safe / 100)}`} transform="rotate(-90 58 58)"/>
    </svg>
    <div><strong>{score === null ? 'N/A' : `${score}%`}</strong><span>METADATA</span></div>
  </div>
}

function Recommendation({ action, i }: { action: RepositoryAction; i: number }) {
  const Icon = CATEGORY_ICONS[action.category]
  return <li className="adv5-action">
    <div className="adv5-action-order">{String(i + 1).padStart(2, '0')}</div>
    <div className="adv5-action-body">
      <div className="adv5-action-meta"><span><Icon size={13}/>{action.category}</span><span className={`adv5-priority adv5-priority-${action.priority}`}>{action.priority} priority</span></div>
      <h4>{action.title}</h4><p>{action.detail}</p><div className="adv5-next"><ArrowRight size={13}/>{action.nextStep}</div>
    </div>
  </li>
}

export function RepositoryAdvisor({ repositories, username }: AdvisorProps) {
  const summary = useMemo(() => analyzePortfolio(repositories), [repositories])
  const [selected, setSelected] = useState('')
  const [search, setSearch] = useState('')
  const [onlyNeeds, setOnlyNeeds] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [inspection, setInspection] = useState<RepositoryInspection | null>(null)
  const [inspectionState, setInspectionState] = useState<InspectionState>('idle')
  const [inspectionError, setInspectionError] = useState('')
  const [feedback, setFeedback] = useState('')
  const controller = useRef<AbortController | null>(null)

  const active = summary.ranked.find(item => item.repo.full_name === selected) ?? summary.ranked[0]
  const activeName = active?.repo.full_name ?? ''
  const filtered = useMemo(() => summary.ranked.filter(item => {
    if (onlyNeeds && item.advice.actions.length === 0) return false
    return item.repo.name.toLowerCase().includes(search.trim().toLowerCase())
      || item.repo.description?.toLowerCase().includes(search.trim().toLowerCase())
  }), [summary, onlyNeeds, search])
  const displayed = showAll ? filtered : filtered.slice(0, 9)
  const scanned = inspection?.repository.toLowerCase() === activeName.toLowerCase() ? inspection : null
  const suggestions = useMemo(() => {
    if (!active) return []
    const ranking: Record<RepositoryAction['priority'], number> = { high: 0, medium: 1, low: 2 }
    return [...active.advice.actions, ...(scanned ? inspectionRecommendations(scanned) : [])]
      .sort((a, b) => ranking[a.priority] - ranking[b.priority])
  }, [active, scanned])

  useEffect(() => {
    controller.current?.abort()
    setInspection(null)
    setInspectionState('idle')
    setInspectionError('')
    setFeedback('')
    return () => controller.current?.abort()
  }, [activeName])

  async function runInspection(refresh = false) {
    if (!active) return
    controller.current?.abort()
    const request = new AbortController()
    controller.current = request
    setInspectionState('loading')
    setInspectionError('')
    try {
      const response = await inspectRepository(active.repo.full_name, request.signal, { refresh })
      if (!request.signal.aborted) {
        setInspection(response)
        setInspectionState('success')
      }
    } catch (reason) {
      if (request.signal.aborted) return
      setInspection(null)
      setInspectionState('error')
      setInspectionError(reason instanceof Error ? reason.message : 'Could not inspect this repository.')
    }
  }

  const plan = active ? adviceAsMarkdown(active.repo, active.advice, scanned ? inspectionRecommendations(scanned) : []) : ''

  async function copyPlan() {
    if (!plan) return
    try {
      await navigator.clipboard.writeText(plan)
      setFeedback('Copied a Markdown improvement plan.')
    } catch {
      setFeedback('Clipboard unavailable. Use Download plan instead.')
    }
  }

  function downloadPlan() {
    if (!active) return
    const blob = new Blob([plan], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `repoverity-advice-${active.repo.name.replace(/[^a-zA-Z0-9_-]/g, '-')}.md`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setFeedback('Plan downloaded as a Markdown file.')
  }

  const observed = scanned?.evidence.filter(item => item.present).length ?? 0
  const from = scanned ? new Date(scanned.inspectedAt).toLocaleDateString('en', DATE_OPTIONS) : ''

  return <section className="adv5-section" id="advisor" aria-labelledby="adv5-title">
    <div className="adv5-heading">
      <div><div className="eyebrow">REPOVERITY / RELEASE 0.5</div><h2 id="adv5-title">Repository advisor <Sparkles size={25}/></h2>
        <p>Know what to improve next. Every suggestion points to public metadata or an explicitly requested file-presence check.</p></div>
      <span className="adv5-label"><CircleDot size={13}/> TRANSPARENT SIGNALS</span>
    </div>

    <div className="adv5-hero">
      <div className="adv5-hero-copy"><span className="adv5-hero-kicker"><Layers3 size={14}/> PORTFOLIO REVIEW</span>
        <h3>From public data to<br/><em>clear next steps.</em></h3>
        <p>No fabricated scores, no automated stars, no fake vulnerability findings. This advisor turns simple GitHub signals into a prioritized improvement checklist.</p>
        <div className="adv5-hero-tags"><span><Check size={13}/> Read-only</span><span><Check size={13}/> No token</span><span><Check size={13}/> Explainable</span></div>
      </div>
      <div className="adv5-kpi-grid">
        <MetricCard icon={GitBranch} label="REPOS ASSESSED" value={String(summary.assessed)} sub={`Of ${summary.totalSampled} sampled · ${summary.excluded} excluded`}/>
        <MetricCard icon={Target} label="METADATA COVERAGE" value={summary.meanMetadataCoverage === null ? '—' : `${summary.meanMetadataCoverage}%`} sub="Average of four visible checks"/>
        <MetricCard icon={FileCheck2} label="OPPORTUNITIES" value={String(summary.improvementCandidates)} sub="Repos with suggested improvements"/>
        <MetricCard icon={ShieldCheck} label="LICENSE METADATA" value={String(summary.missingLicense)} sub="Repos without recognized license"/>
      </div>
    </div>

    {summary.assessed === 0 ? <div className="adv5-empty"><Info size={27}/><h3>No eligible repositories in this sample</h3>
      <p>Forks and archived repositories are excluded from the metadata ranking. Try another public GitHub profile.</p></div>
      : <div className="adv5-layout">
        <aside className="adv5-roster" aria-label="Repository selection">
          <div className="adv5-roster-head"><span>YOUR PUBLIC REPOSITORIES</span><strong>{summary.assessed}</strong></div>
          <label className="adv5-search"><Search size={15}/><input aria-label="Find repository to advise" value={search} onChange={event => { setSearch(event.target.value); setShowAll(false) }} placeholder="Find a repository..." type="search" /></label>
          <button type="button" className={`adv5-toggle ${onlyNeeds ? 'adv5-toggle-on' : ''}`} aria-pressed={onlyNeeds} onClick={() => { setOnlyNeeds(value => !value); setShowAll(false) }}>
            <span className="adv5-toggle-dot"/> Needs improvement <span>{summary.improvementCandidates}</span>
          </button>
          <div className="adv5-repo-list">
            {displayed.map(({ repo, advice }) => <button key={repo.id} type="button" onClick={() => { setSelected(repo.full_name); setFeedback('') }}
              className={`adv5-repo-option ${activeName === repo.full_name ? 'adv5-repo-option-active' : ''}`} aria-pressed={activeName === repo.full_name}>
              <span className="adv5-repo-option-top"><span className="adv5-repo-name"><BookOpen size={13}/>{repo.name}</span><b>{advice.metadataCoverage}%</b></span>
              <span className="adv5-repo-desc">{repo.description || 'No public description'}</span>
              <span className="adv5-repo-meter"><span style={{ width: `${advice.metadataCoverage ?? 0}%` }}/></span>
              <span className="adv5-repo-foot"><span>{advice.actions.length} suggestions</span><span><Star size={11}/>{repo.stargazers_count}</span></span>
            </button>)}
            {!filtered.length && <p className="adv5-no-results">No repositories match this filter.</p>}
            {!showAll && filtered.length > displayed.length && <button className="adv5-more" type="button" onClick={()=>setShowAll(true)}>View all {filtered.length} repositories <ChevronRight size={14}/></button>}
            {showAll && filtered.length > 9 && <button className="adv5-more" type="button" onClick={()=>setShowAll(false)}>Show fewer <ChevronRight size={14}/></button>}
          </div>
        </aside>

        {active && <div className="adv5-detail">
          <div className="adv5-focus-card">
            <div className="adv5-focus-copy"><span className="adv5-step">01 / SELECTED REPOSITORY</span>
              <h3>{active.repo.name}</h3><p>{active.repo.description || 'No description published yet for this project.'}</p>
              <div className="adv5-focus-badges"><span><Globe2 size={12}/> Public repository</span><span><Star size={12}/>{active.repo.stargazers_count} stars</span><span>{active.repo.language || 'Unspecified language'}</span></div>
              <a href={active.repo.html_url} target="_blank" rel="noreferrer">Open on GitHub <ArrowUpRight size={14}/></a>
            </div>
            <ScoreRing score={active.advice.metadataCoverage}/>
          </div>

          <div className="adv5-panel">
            <div className="adv5-panel-head"><div><span className="adv5-step">02 / METADATA COVERAGE</span><h3>Four verifiable checks</h3></div><span className="adv5-panel-caption">NOT A SECURITY SCORE</span></div>
            <div className="adv5-check-grid">{active.advice.checks.map(check => <div className="adv5-check" key={check.id}>
              {check.passed ? <CheckCircle2 size={18} className="adv5-positive"/> : <CircleAlert size={18} className="adv5-negative"/>}
              <div><strong>{check.title}</strong><span>{check.explanation}</span></div>
              <small className={check.passed ? 'adv5-pass' : 'adv5-review'}>{check.passed ? 'PRESENT' : 'REVIEW'}</small>
            </div>)}</div>
          </div>

          <div className="adv5-panel adv5-inspection">
            <div className="adv5-panel-head"><div><span className="adv5-step">03 / OPTIONAL STRUCTURE CHECK</span><h3>Public file evidence</h3></div><span className="adv5-panel-caption">ON DEMAND</span></div>
            <p className="adv5-explain">Inspect visible directory names for README, SECURITY, CI and community files. File contents, workflow execution and vulnerabilities are <strong>not</strong> analyzed.</p>
            <div className="adv5-inspect-action"><button type="button" disabled={inspectionState === 'loading'} className="adv5-scan-button" onClick={()=>void runInspection(Boolean(scanned) || inspectionState === 'error')}>
              {inspectionState === 'loading' ? <LoaderCircle size={16} className="adv5-spin"/> : scanned ? <RefreshCw size={16}/> : <Search size={16}/>} {inspectionState === 'loading' ? 'Checking public files...' : scanned ? 'Recheck structure' : 'Inspect repository files'}
            </button><span>1 to 4 public GitHub API requests</span></div>
            {inspectionState === 'error' && <div className="adv5-inspection-error" role="alert"><CircleAlert size={18}/><p>{inspectionError} <a href={active.repo.html_url} target="_blank" rel="noreferrer">Review on GitHub <ArrowUpRight size={12}/></a></p></div>}
            {scanned && <><div className="adv5-inspection-timestamp"><Check size={14}/> {observed} of {scanned.evidence.length} recognized files/configurations visible · Checked {from}</div>
              <div className="adv5-evidence-grid">{scanned.evidence.map(item => <div className="adv5-evidence" key={item.id} title={item.detail}>
                {item.present ? <CheckCircle2 size={15}/> : <CircleDot size={15}/>}<span>{item.title}</span><small>{item.present ? 'FOUND' : 'NOT FOUND'}</small>
              </div>)}</div>
              <p className="adv5-caveat"><Info size={14}/> “Not found” means absent from checked locations, not that a practice is missing or that a vulnerability exists.</p>
            </>}
          </div>

          <div className="adv5-panel adv5-actions-panel">
            <div className="adv5-panel-head"><div><span className="adv5-step">04 / ACTION PLAN</span><h3>What to improve next</h3></div><span className="adv5-panel-caption">{suggestions.length} SUGGESTIONS</span></div>
            {suggestions.length ? <ol className="adv5-actions">{suggestions.map((action, index) => <Recommendation key={action.id} action={action} i={index}/>)}</ol>
              : <div className="adv5-clear"><CheckCircle2 size={22}/><p>No recommendations from available evidence. This does not certify the repository's quality or security.</p></div>}
            <div className="adv5-plan-controls"><button type="button" onClick={()=>void copyPlan()}><ClipboardCopy size={15}/> Copy improvement plan</button><button type="button" onClick={downloadPlan}><Download size={15}/> Download .md</button></div>
            {feedback && <p className="adv5-feedback" role="status">{feedback}</p>}
          </div>
        </div>}
      </div>}

    <p className="adv5-bottom-note"><Info size={15}/> Reviewing @{username}: at most 100 most recently updated owned public repositories. No source code or dependency packages are examined; nothing here should be interpreted as a vulnerability scan, legal review, security certification or AI-generated finding.</p>
  </section>
}
