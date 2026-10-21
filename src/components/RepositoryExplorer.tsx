import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  AlertCircle, Archive, ArrowRight, ArrowUpRight, BookOpen, Check,
  ChevronDown, Columns3, Download, FileText, GitFork, LayoutGrid,
  List, LoaderCircle, RotateCcw, Save, Search, Star, X,
} from 'lucide-react'
import type { GitHubRepository, GitHubSnapshot } from '../types/github'
import { compactNumber, shortDate } from '../lib/insights'
import {
  availableLanguages, availableTopics, buildComparison, DEFAULT_EXPLORER_FILTERS,
  EXPLORER_STORAGE_KEY, explorerCsv, filterExplorerRepositories,
  MAX_SAVED_VIEWS_PER_PROFILE, parseSavedViews, removeSavedView,
  storeSavedView, type ExplorerFilters, type ExplorerLayout,
  type ExplorerSort, type ExplorerStatus, type SavedExplorerView,
} from '../lib/explorer'
import { useRepositoryPages } from '../hooks/useRepositoryPages'

const SHOW_INITIAL = 20
const SHOW_INCREMENT = 20

const statusOptions: { value: ExplorerStatus; label: string }[] = [
  { value: 'all', label: 'All repositories' },
  { value: 'source', label: 'Original projects' },
  { value: 'fork', label: 'Forks' },
  { value: 'active', label: 'Active in 90 days' },
  { value: 'archived', label: 'Archived' },
]

const sortOptions: { value: ExplorerSort; label: string }[] = [
  { value: 'updated', label: 'Last push' },
  { value: 'stars', label: 'Most stars' },
  { value: 'forks', label: 'Most forks' },
  { value: 'name', label: 'Name A to Z' },
]

function formatDate(value: string | null): string { return shortDate(value) }

function downloadCsv(username: string, repos: GitHubRepository[]) {
  const blob = new Blob([explorerCsv(repos)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `repoverity-${username.toLowerCase()}-repositories.csv`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

function useViews() {
  const [views, setViews] = useState<SavedExplorerView[]>(() => {
    try { return parseSavedViews(window.localStorage.getItem(EXPLORER_STORAGE_KEY)) } catch { return [] }
  })
  const [storageError, setStorageError] = useState(false)
  function update(next: SavedExplorerView[]) {
    try {
      window.localStorage.setItem(EXPLORER_STORAGE_KEY, JSON.stringify(next))
      setViews(next)
      setStorageError(false)
    } catch { setStorageError(true) }
  }
  return { views, update, storageError }
}

function ComparePanel({ repositories, reducedMotion, onClose, onRemove }: {
  repositories: GitHubRepository[]; reducedMotion: boolean;
  onClose: () => void; onRemove: (id: number) => void;
}) {
  const rows: { label: string; value: (repo: GitHubRepository) => string }[] = [
    { label: 'Primary language', value: repo => repo.language || 'Not specified' },
    { label: 'Stars', value: repo => repo.stargazers_count.toLocaleString('en') },
    { label: 'Forks', value: repo => repo.forks_count.toLocaleString('en') },
    { label: 'Last push', value: repo => formatDate(repo.pushed_at) },
    { label: 'License metadata', value: repo => repo.license?.name || 'None reported' },
    { label: 'Status', value: repo => repo.archived ? 'Archived' : repo.fork ? 'Fork' : 'Source' },
    { label: 'Topics', value: repo => repo.topics.join(', ') || 'None' },
  ]
  return <motion.section className="rx-compare" aria-label="Repository comparison"
    initial={reducedMotion ? false : { opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={reducedMotion ? undefined : { opacity: 0, y: -5 }}
    transition={{ duration: reducedMotion ? 0 : 0.18 }}>
    <div className="rx-compare-top"><div><span className="rx-eyebrow">SIDE BY SIDE</span><h3>Repository comparison</h3><p>Public metadata from the repositories currently loaded.</p></div>
      <button type="button" className="rx-icon-button" onClick={onClose} aria-label="Close comparison"><X size={17}/></button></div>
    <div className="rx-scroll"><table className="rx-compare-table"><thead><tr><th scope="col">Metric</th>{repositories.map(repo => <th scope="col" key={repo.id}><div className="rx-compare-col-head"><a href={repo.html_url} target="_blank" rel="noopener noreferrer">{repo.name}<ArrowUpRight size={13}/></a>
      <button type="button" onClick={() => onRemove(repo.id)} aria-label={`Remove ${repo.name} from comparison`}><X size={15}/></button></div></th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={row.label}><th scope="row">{row.label}</th>{repositories.map(repo => <td key={repo.id}>{row.value(repo)}</td>)}</tr>)}</tbody></table></div>
    <p className="rx-compare-foot">These signals do not assess source-code security or software quality.</p>
  </motion.section>
}

function RepositoryRow({ repo, selected, disabled, onToggle }: {
  repo: GitHubRepository; selected: boolean; disabled: boolean; onToggle: (repo: GitHubRepository) => void;
}) {
  return <tr className={selected ? 'rx-row-selected' : ''}>
    <td className="rx-check-cell"><input type="checkbox" checked={selected} disabled={disabled} onChange={() => onToggle(repo)} aria-label={`Compare ${repo.name}`}/></td>
    <td><div className="rx-repo-title"><span className="rx-repo-glyph"><BookOpen size={15}/></span><div><a href={repo.html_url} target="_blank" rel="noopener noreferrer">{repo.name}<ArrowUpRight size={14}/></a>
      <p>{repo.description || 'No description available'}</p><span className="rx-tag-list">{repo.archived && <small>ARCHIVED</small>}{repo.fork && <small>FORK</small>}{repo.topics.slice(0, 2).map(t => <small key={t}>{t}</small>)}</span></div></div></td>
    <td><span className="rx-language">{repo.language && <i/>}{repo.language || 'Unspecified'}</span></td>
    <td><span className="rx-number"><Star size={13}/>{compactNumber(repo.stargazers_count)}</span></td>
    <td><span className="rx-number"><GitFork size={13}/>{compactNumber(repo.forks_count)}</span></td>
    <td className="rx-date">{formatDate(repo.pushed_at)}</td>
  </tr>
}

function RepositoryCard({ repo, selected, disabled, onToggle }: {
  repo: GitHubRepository; selected: boolean; disabled: boolean; onToggle: (repo: GitHubRepository) => void;
}) {
  return <article className={`rx-card ${selected ? 'rx-card-selected' : ''}`}>
    <div className="rx-card-head"><span className="rx-repo-glyph"><BookOpen size={17}/></span>
      <label className="rx-card-select"><input type="checkbox" checked={selected} disabled={disabled} onChange={() => onToggle(repo)}/><span>Compare</span></label></div>
    <a className="rx-card-title" href={repo.html_url} target="_blank" rel="noopener noreferrer">{repo.name} <ArrowUpRight size={15}/></a>
    <p className="rx-card-desc">{repo.description || 'No description available'}</p>
    <div className="rx-card-tags">{repo.archived && <span><Archive size={12}/> Archived</span>}{repo.fork && <span>Fork</span>}{repo.topics.slice(0, 3).map(t=><span key={t}>{t}</span>)}</div>
    <div className="rx-card-footer"><span>{repo.language || 'Unspecified'}</span><span><Star size={13}/>{compactNumber(repo.stargazers_count)}</span><span><GitFork size={13}/>{compactNumber(repo.forks_count)}</span></div>
  </article>
}

export function RepositoryExplorer({ snapshot, reducedMotion }: { snapshot: GitHubSnapshot; reducedMotion: boolean }) {
  const { repositories, nextPage, hasMore, pagesLoaded, message, error, loading, capped, loadNext } = useRepositoryPages(snapshot)
  const [filters, setFilters] = useState<ExplorerFilters>({ ...DEFAULT_EXPLORER_FILTERS })
  const [layout, setLayout] = useState<ExplorerLayout>('table')
  const [visibleCount, setVisibleCount] = useState(SHOW_INITIAL)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [compareOpen, setCompareOpen] = useState(false)
  const [viewName, setViewName] = useState('')
  const [showSaveInput, setShowSaveInput] = useState(false)
  const [notice, setNotice] = useState('')
  const { views, update, storageError } = useViews()
  const owner = snapshot.user.login
  const savedForOwner = useMemo(() => views.filter(v => v.owner.toLowerCase() === owner.toLowerCase()), [views, owner])
  const languages = useMemo(() => availableLanguages(repositories), [repositories])
  const topics = useMemo(() => availableTopics(repositories), [repositories])
  const filtered = useMemo(() => filterExplorerRepositories(repositories, filters), [repositories, filters])
  const shown = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount])
  const comparison = useMemo(() => buildComparison(repositories, selectedIds), [repositories, selectedIds])

  useEffect(() => { setVisibleCount(SHOW_INITIAL) }, [filters])

  function updateFilter<K extends keyof ExplorerFilters>(key: K, value: ExplorerFilters[K]) {
    setFilters(previous => ({ ...previous, [key]: value }))
    setNotice('')
  }

  function toggleCompare(repo: GitHubRepository) {
    setSelectedIds(previous => previous.includes(repo.id) ? previous.filter(id => id !== repo.id)
      : previous.length < 3 ? [...previous, repo.id] : previous)
  }

  function saveView(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const label = viewName.trim().slice(0, 50)
    if (!label) return
    if (savedForOwner.length >= MAX_SAVED_VIEWS_PER_PROFILE) {
      setNotice('You have reached the 12-view limit. Remove a saved view first.')
      return
    }
    const view: SavedExplorerView = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
      owner, label, filters: { ...filters } }
    update(storeSavedView(views, view))
    setShowSaveInput(false)
    setViewName('')
    setNotice(`Saved view: ${label}`)
  }

  function applyView(id: string) {
    const found = savedForOwner.find(v => v.id === id)
    if (!found) return
    setFilters({ ...found.filters })
    setNotice(`Applied view: ${found.label}`)
  }

  function exportFiltered() {
    try { downloadCsv(owner, filtered); setNotice(`Exported ${filtered.length} loaded matching repositories.`) }
    catch { setNotice('CSV export was blocked by the browser.') }
  }

  return <div className="rx-workspace">
    <div className="rx-topline"><div><span className="rx-eyebrow">EXPLORER PRO / PUBLIC REPOSITORIES</span><h2>Repository index</h2>
      <p>Filter, compare and export public repositories. Additional pages load only when you request them.</p></div>
      <a href={`${snapshot.user.html_url}?tab=repositories`} target="_blank" rel="noopener noreferrer" className="rx-external">GitHub profile <ArrowUpRight size={15}/></a></div>

    <div className="rx-summary" role="status" aria-live="polite"><div><strong>{repositories.length.toLocaleString('en')}</strong><span>loaded</span></div><div><strong>{snapshot.user.public_repos.toLocaleString('en')}</strong><span>reported public</span></div>
      <div><strong>{filtered.length.toLocaleString('en')}</strong><span>matching loaded</span></div><div><strong>{pagesLoaded}</strong><span>API pages in view</span></div></div>

    <section className="rx-toolbar" aria-label="Repository filters">
      <div className="rx-toolbar-first"><label className="rx-search"><Search size={18}/><input type="search" value={filters.search} onChange={(event: ChangeEvent<HTMLInputElement>)=>updateFilter('search', event.target.value.slice(0, 200))}
        placeholder="Search names, descriptions, topics" aria-label="Search loaded repositories"/></label>
      <label className="rx-field"><span>Status</span><div><select aria-label="Repository status" value={filters.status} onChange={(event: ChangeEvent<HTMLSelectElement>)=>updateFilter('status', event.target.value as ExplorerStatus)}>
        {statusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown size={14}/></div></label>
      <label className="rx-field"><span>Language</span><div><select aria-label="Filter by language" value={filters.language} onChange={(event: ChangeEvent<HTMLSelectElement>)=>updateFilter('language', event.target.value)}>
        <option value="all">All languages</option>{languages.map(language => <option key={language} value={language}>{language}</option>)}</select><ChevronDown size={14}/></div></label>
      <label className="rx-field"><span>Topic</span><div><select aria-label="Filter by topic" value={filters.topic} onChange={(event: ChangeEvent<HTMLSelectElement>)=>updateFilter('topic', event.target.value)}>
        <option value="all">All topics</option>{topics.map(topic => <option key={topic} value={topic}>{topic}</option>)}</select><ChevronDown size={14}/></div></label></div>
      <div className="rx-toolbar-second"><label className="rx-field rx-sort"><span>Sort</span><div><select aria-label="Sort repositories" value={filters.sort} onChange={(event: ChangeEvent<HTMLSelectElement>)=>updateFilter('sort', event.target.value as ExplorerSort)}>
        {sortOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown size={14}/></div></label>
        <div className="rx-layout-control" role="group" aria-label="Repository layout"><button type="button" title="Table view" aria-pressed={layout === 'table'} onClick={()=>setLayout('table')}><List size={17}/></button>
          <button type="button" title="Card view" aria-pressed={layout === 'cards'} onClick={()=>setLayout('cards')}><LayoutGrid size={16}/></button></div>
        <button type="button" className="rx-text-button" onClick={()=>setFilters({ ...DEFAULT_EXPLORER_FILTERS })}><RotateCcw size={15}/> Reset filters</button>
        <button type="button" className="rx-text-button" onClick={exportFiltered} disabled={filtered.length === 0}><Download size={15}/> Export CSV</button></div>
    </section>

    <section className="rx-saved" aria-label="Saved repository views"><div className="rx-saved-title"><span><Save size={15}/> Saved views</span>
      <button type="button" onClick={()=>setShowSaveInput(open=>!open)} disabled={!showSaveInput && savedForOwner.length >= MAX_SAVED_VIEWS_PER_PROFILE}><Save size={14}/> Save current filters</button></div>
      <div className="rx-saved-list">{savedForOwner.length===0 && <span className="rx-muted">No saved views for @{owner} yet.</span>}
        {savedForOwner.map(view=><span className="rx-saved-pill" key={view.id}><button type="button" onClick={()=>applyView(view.id)}>{view.label}</button>
          <button type="button" className="rx-saved-remove" aria-label={`Delete saved view ${view.label}`} onClick={()=>update(removeSavedView(views, view.id, owner))}><X size={13}/></button></span>)}</div>
      {showSaveInput && <form className="rx-save-form" onSubmit={saveView}><input autoFocus maxLength={50} value={viewName} onChange={(event: ChangeEvent<HTMLInputElement>)=>setViewName(event.target.value)}
        placeholder="Name this view" aria-label="Saved view name" required/><button type="submit" disabled={!viewName.trim()}><Check size={14}/> Save view</button></form>}
      {storageError && <p className="rx-error" role="alert">Saved views could not be written to local storage.</p>}
    </section>

    <section className="rx-results" aria-label="Repository results"><div className="rx-results-heading"><div><strong>Repositories</strong><span>{shown.length} shown of {filtered.length} matching loaded</span></div>
      <div className="rx-results-actions"><span>{selectedIds.length} / 3 selected</span><button type="button" className="rx-action" disabled={selectedIds.length < 2} onClick={()=>setCompareOpen(true)}>
        <Columns3 size={16}/> Compare selected</button>{selectedIds.length > 0 && <button type="button" className="rx-icon-button" aria-label="Clear comparison selection" onClick={()=>{setSelectedIds([]);setCompareOpen(false)}}><X size={16}/></button>}</div></div>
      {shown.length === 0 ? <div className="rx-empty"><Search size={23}/><h3>No repositories match these filters</h3><p>Try clearing search, status, language or topic filters.</p></div>
        : layout === 'table' ? <div className="rx-scroll"><table className="rx-table"><thead><tr><th scope="col"><span className="rx-sr-only">Compare</span></th><th scope="col">Repository</th><th scope="col">Language</th><th scope="col">Stars</th><th scope="col">Forks</th><th scope="col">Last push</th></tr></thead>
          <tbody>{shown.map(repo=><RepositoryRow key={repo.id} repo={repo} selected={selectedIds.includes(repo.id)} disabled={selectedIds.length>=3 && !selectedIds.includes(repo.id)} onToggle={toggleCompare}/>)}</tbody></table></div>
          : <div className="rx-card-grid">{shown.map(repo=><RepositoryCard key={repo.id} repo={repo} selected={selectedIds.includes(repo.id)} disabled={selectedIds.length>=3 && !selectedIds.includes(repo.id)} onToggle={toggleCompare}/>)}</div>}
      {visibleCount < filtered.length && <div className="rx-bottom-actions"><button type="button" className="rx-action rx-action-outline" onClick={()=>setVisibleCount(count=>count+SHOW_INCREMENT)}>Show next {Math.min(SHOW_INCREMENT, filtered.length-visibleCount)} matching <ArrowRight size={15}/></button></div>}
    </section>

    <AnimatePresence>{compareOpen && comparison.length>=2 && <ComparePanel repositories={comparison} reducedMotion={reducedMotion} onClose={()=>setCompareOpen(false)} onRemove={id=>{
      setSelectedIds(previous=>previous.filter(x=>x!==id)); if (comparison.length<=2) setCompareOpen(false)
    }}/>}</AnimatePresence>

    <div className="rx-pagination"><div><strong>Need older repositories?</strong><p>GitHub returns repositories in pages of 100. Load each additional page on demand. Anonymous API limits apply.</p></div>
      <button className="rx-action rx-load" type="button" disabled={!hasMore || loading} onClick={()=>void loadNext()}>
        {loading ? <LoaderCircle size={16} className="rx-spin"/> : <ArrowRight size={16}/>}
        {loading ? 'Loading from GitHub' : hasMore ? `Load next 100 (page ${nextPage})` : 'No more pages available'}</button></div>
    {error && <p className="rx-error" role="alert"><AlertCircle size={16}/>{error}</p>}
    {(message || capped) && <p className="rx-note"><AlertCircle size={15}/>{message || 'GitHub REST pagination is capped at page 100 for this release.'}</p>}
    <p className="rx-method"><FileText size={15}/> The explorer covers only pages actually loaded for @{owner}. Overview metrics, growth history and advisor keep their existing 100-repository sample. Saved views stay in this browser and are not included in the V1.0 JSON backup.</p>
    {notice && <p className="rx-notice" role="status" aria-live="polite">{notice}</p>}
  </div>
}
