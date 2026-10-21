import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, ArrowUpRight, CircleDot, Compass, ExternalLink, GitPullRequest, MessageSquare, Search, ShieldCheck } from 'lucide-react'
import {
  buildGithubIssueSearchUrl, DEFAULT_ISSUE_FILTERS, findContributionIssues,
  type ContributionSearchResult, type IssueSearchFilters, type IssueLanguage, type IssueLabel,
} from '../lib/contributions'

const LANGUAGES: IssueLanguage[] = ['TypeScript', 'JavaScript', 'Python', 'Java', 'Go', 'Rust', 'PHP', 'all']

export function ContributionFinder() {
  const [filters, setFilters] = useState<IssueSearchFilters>(DEFAULT_ISSUE_FILTERS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ContributionSearchResult | null>(null)
  const controller = useRef<AbortController | null>(null)
  const requestId = useRef(0)

  function updateFilters(next: IssueSearchFilters) {
    controller.current?.abort()
    requestId.current++
    setLoading(false)
    setError(null)
    setResult(null)
    setFilters(next)
  }

  useEffect(() => () => { controller.current?.abort(); requestId.current++ }, [])

  async function runSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    controller.current?.abort()
    const active = new AbortController()
    controller.current = active
    const currentId = ++requestId.current
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await findContributionIssues(filters, active.signal)
      if (currentId === requestId.current) setResult(data)
    } catch (reason) {
      if (active.signal.aborted || currentId !== requestId.current) return
      setError(reason instanceof Error ? reason.message : 'Search is temporarily unavailable.')
    } finally {
      if (currentId === requestId.current) setLoading(false)
    }
  }

  const githubSearchUrl = buildGithubIssueSearchUrl(filters)
  return <section className="os4-section" id="contributions" aria-labelledby="os4-title">
    <div className="section-title-row os4-top"><div><div className="eyebrow">OPEN SOURCE · REAL OPPORTUNITIES</div><h2 id="os4-title">Contribution finder</h2><p>Discover open, unassigned issues tagged by maintainers. Read the discussion before taking on any work.</p></div><span className="os4-live"><CircleDot size={14}/> GitHub search API</span></div>
    <div className="os4-workspace">
      <form className="os4-form" onSubmit={runSearch}>
        <div className="os4-control"><label htmlFor="os4-language">Repository language</label><select id="os4-language" value={filters.language} onChange={event => updateFilters({...filters,language:event.target.value as IssueLanguage})}>{LANGUAGES.map(language => <option key={language} value={language}>{language==='all'?'All languages':language}</option>)}</select></div>
        <div className="os4-control"><label htmlFor="os4-label">Issue label</label><select id="os4-label" value={filters.label} onChange={event => updateFilters({...filters,label:event.target.value as IssueLabel})}><option value="good-first-issue">Good first issue</option><option value="help-wanted">Help wanted</option></select></div>
        <div className="os4-control os4-keyword"><label htmlFor="os4-keyword">Keywords (optional)</label><div className="os4-input-wrap"><Search size={16}/><input id="os4-keyword" maxLength={64} value={filters.keywords} onChange={event => updateFilters({...filters,keywords:event.target.value})} placeholder="e.g. documentation" autoComplete="off"/></div></div>
        <button type="submit" disabled={loading} className="os4-submit"><Search size={17}/>{loading ? 'Searching...' : 'Find issues'}</button>
      </form>
      <div className="os4-guidance"><ShieldCheck size={15}/><p>Search runs only when you click the button. No account permissions, tokens, automated PRs or artificial interactions. GitHub may limit anonymous search requests.</p><a href={githubSearchUrl} target="_blank" rel="noreferrer">Open on GitHub <ExternalLink size={13}/></a></div>
      {!result && !loading && !error && <div className="os4-placeholder"><span><Compass size={31}/></span><h3>Start with a real project.</h3><p>Find tasks that match your technology stack, inspect their scope, then discuss a solution with the maintainers.</p></div>}
      {loading && <div className="os4-placeholder" role="status"><span className="os4-loading"><Compass size={30}/></span><h3>Searching GitHub...</h3><p>Looking for open issues from public repositories.</p></div>}
      {error && <div className="os4-error" role="alert"><CircleDot size={21}/><div><strong>Couldn’t complete this search.</strong><p>{error}</p><a href={githubSearchUrl} target="_blank" rel="noreferrer">Search directly on GitHub <ArrowUpRight size={14}/></a></div></div>}
      {result && <div className="os4-results">
        <div className="os4-results-head"><div><strong>{result.issues.length} public issues shown</strong><span>{result.total.toLocaleString()} matches reported by GitHub{result.incomplete?' · Results may be incomplete':''}</span></div><span>Updated results · up to 18</span></div>
        {result.issues.length ? <div className="os4-results-grid">{result.issues.map(issue => <article key={issue.id} className="os4-issue">
          <div className="os4-issue-top"><GitPullRequest size={17}/><span>{issue.repo}</span><small>#{issue.number}</small></div>
          <h3><a href={issue.url} target="_blank" rel="noreferrer">{issue.title}<ArrowUpRight size={15}/></a></h3>
          <div className="os4-labels">{issue.labels.map(label => <span key={label}>{label}</span>)}</div>
          <div className="os4-issue-foot"><span><MessageSquare size={13}/>{issue.comments} comments</span><a href={issue.url} target="_blank" rel="noreferrer">Review issue <ArrowRight size={14}/></a></div>
        </article>)}</div> : <div className="os4-empty"><Search size={24}/><h3>No matching unassigned issues found.</h3><p>Try another language, broader keywords or “Help wanted”.</p></div>}
      </div>}
    </div>
    <p className="os4-note"><ShieldCheck size={15}/> Open issues can change or be claimed at any time. Always confirm availability and project guidelines on GitHub before contributing.</p>
  </section>
}
