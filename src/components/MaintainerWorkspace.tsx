import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AlertCircle, ArrowUpRight, BookOpen, Check, ClipboardList, Download, GitPullRequest, Github, LoaderCircle, RefreshCw, Search, Trash2, Users } from 'lucide-react'
import { activityDays, filterMaintainerItems, normalizeRepository, queueCsv, queueKey, readLocalQueue, saveLocalQueue, TRIAGE_STAGES, upsertLocalQueue, type MaintainerIssue, type MaintainerKind, type MaintainerQueueRecord, type TriageStage } from '../lib/maintainer'
import { loadMaintainerOverview, loadMaintainerPage, type MaintainerOverview } from '../lib/maintainerGithub'
import { maintainerCloud, maintainerCloudEnabled } from '../lib/maintainerCloud'

type Tab = 'issues' | 'pulls' | 'contributors' | 'queue'
type QueueMode = 'loading' | 'local' | 'cloud' | 'unavailable'
const fmt = (value:number) => new Intl.NumberFormat('en-US').format(value)
function latestCount(value:MaintainerIssue[]|null) {return value ? fmt(value.length) : 'N/A'}
function downloadCsv(repo:string,records:MaintainerQueueRecord[]) {
  const blob=new Blob([queueCsv(records)],{type:'text/csv;charset=utf-8'})
  const url=URL.createObjectURL(blob)
  const a=document.createElement('a')
  a.href=url; a.download=`repoverity-maintainer-${repo.replace('/','-')}.csv`
  document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url)
}
export function MaintainerWorkspace({defaultRepo,suggestedRepos=[]}:{defaultRepo:string;suggestedRepos?:string[]}) {
  const start=normalizeRepository(defaultRepo)??'kobrymoataz/repoverity'
  const [repo,setRepo]=useState(start)
  const [draft,setDraft]=useState(start)
  const [repoError,setRepoError]=useState('')
  const [tab,setTab]=useState<Tab>('issues')
  const [overview,setOverview]=useState<MaintainerOverview|null>(null)
  const [loading,setLoading]=useState(true)
  const [refreshToken,setRefreshToken]=useState(0)
  const [loadingMore,setLoadingMore]=useState<MaintainerKind|null>(null)
  const [dataError,setDataError]=useState('')
  const [queue,setQueue]=useState<MaintainerQueueRecord[]>([])
  const [queueMode,setQueueMode]=useState<QueueMode>('loading')
  const [queueMessage,setQueueMessage]=useState('')
  const [working,setWorking]=useState<string|null>(null)
  const [filter,setFilter]=useState('')
  const [label,setLabel]=useState('')
  const [focus,setFocus]=useState<'all'|'unassigned'|'stale'>('all')
  const [activeEdit,setActiveEdit]=useState<string|null>(null)
  const [noteDraft,setNoteDraft]=useState('')
  const [stageDraft,setStageDraft]=useState<TriageStage>('next')

  useEffect(()=>{
    const abort=new AbortController()
    setLoading(true);setDataError('');setOverview(null)
    void loadMaintainerOverview(repo,abort.signal).then(value=>{
      if(!abort.signal.aborted)setOverview(value)
    }).catch(error=>{
      if(!abort.signal.aborted)setDataError(error instanceof Error?error.message:'Unable to load repository.')
    }).finally(()=>{if(!abort.signal.aborted)setLoading(false)})
    return ()=>abort.abort()
  },[repo,refreshToken])
  useEffect(()=>{
    const abort=new AbortController()
    setQueueMode('loading');setQueueMessage('');setQueue([])
    async function fetchQueue() {
      try {
        if(maintainerCloudEnabled && await maintainerCloud.signedIn(abort.signal)) {
          const entries=await maintainerCloud.queue(repo,abort.signal)
          if(!abort.signal.aborted){setQueue(entries);setQueueMode('cloud')}
        }else{
          const saved=readLocalQueue(window.localStorage)
          if(!abort.signal.aborted){setQueue(saved.filter(x=>x.repo===repo));setQueueMode('local')}
        }
      }catch(error) {
        if(!abort.signal.aborted){setQueueMode('unavailable');setQueueMessage(error instanceof Error?error.message:'Could not access cloud queue.')}
      }
    }
    void fetchQueue()
    return ()=>abort.abort()
  },[repo])
  function submitRepo(event:FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next=normalizeRepository(draft)
    if(!next){setRepoError('Enter a valid public owner/repository.');return}
    setRepoError('');setTab('issues');setFilter('');setLabel('');setFocus('all');setRepo(next)
    if(next===repo)setRefreshToken(n=>n+1)
  }
  const labels=useMemo(()=>[...new Set([...(overview?.issues?.items??[]),...(overview?.pulls?.items??[])].flatMap(x=>x.labels))].sort(),[overview])
  const issues=overview?.issues?.items??null
  const pulls=overview?.pulls?.items??null
  const selectedItems=tab==='pulls'?pulls:issues
  const visible=useMemo(()=>filterMaintainerItems(selectedItems??[],{query:filter,label,mode:focus}),[selectedItems,filter,label,focus])
  const queuedKeys=useMemo(()=>new Set(queue.map(queueKey)),[queue])
  async function more(kind:MaintainerKind){
    if(!overview)return
    const part=kind==='issue'?overview.issues:overview.pulls
    if(!part?.hasMore)return
    setLoadingMore(kind);setDataError('')
    try{
      const next=await loadMaintainerPage(repo,kind,part.page+1)
      const combined={...next,items:[...part.items,...next.items.filter(item=>!part.items.some(prev=>prev.number===item.number))]}
      setOverview(current=>current?{...current,[kind==='issue'?'issues':'pulls']:combined}:current)
    }catch(error){setDataError(error instanceof Error?error.message:'Could not load another page.')}
    finally{setLoadingMore(null)}
  }
  async function persist(entry:Omit<MaintainerQueueRecord,'updated_at'>) {
    if(queueMode!=='cloud'&&queueMode!=='local'){setQueueMessage('The worklist is not available.');return false}
    const key=queueKey(entry)
    setWorking(key);setQueueMessage('')
    try{
      if(queueMode==='cloud'){
        await maintainerCloud.save(entry)
        setQueue(await maintainerCloud.queue(repo))
      }else{
        const all=readLocalQueue(window.localStorage)
        const next=upsertLocalQueue(all,{...entry,updated_at:Math.floor(Date.now()/1000)})
        saveLocalQueue(window.localStorage,next)
        setQueue(next.filter(item=>item.repo===repo))
      }
      return true
    }catch(error){setQueueMessage(error instanceof Error?error.message:'Could not save worklist item.');return false}
    finally{setWorking(null)}
  }
  async function remove(item:MaintainerQueueRecord) {
    setWorking(queueKey(item));setQueueMessage('')
    try{
      if(queueMode==='cloud'){
        await maintainerCloud.remove(item)
        setQueue(await maintainerCloud.queue(repo))
      }else if(queueMode==='local'){
        const next=readLocalQueue(window.localStorage).filter(x=>queueKey(x)!==queueKey(item))
        saveLocalQueue(window.localStorage,next)
        setQueue(next.filter(x=>x.repo===repo))
      }
      setActiveEdit(null)
    }catch(error){setQueueMessage(error instanceof Error?error.message:'Could not remove worklist item.')}
    finally{setWorking(null)}
  }
  const startEdit=(item:MaintainerQueueRecord)=>{setActiveEdit(queueKey(item));setNoteDraft(item.note);setStageDraft(item.stage)}
  const available=queueMode==='local'||queueMode==='cloud'
  return <section className="rv-maintainer rv-panel" aria-label="Maintainer desk">
    <div className="rv-maintainer-head"><div><span className="rv-kicker"><ClipboardList size={14}/> PERSONAL MAINTAINER DESK</span><h2>Community work, in one place.</h2><p>Review public issues and pull requests, plan your follow-ups, and see contributor activity. Your triage notes are private to your device or signed-in cloud account.</p></div><a href={`https://github.com/${repo}`} className="rv-outline-button" target="_blank" rel="noopener noreferrer"><Github size={16}/> Open repository <ArrowUpRight size={15}/></a></div>
    <form onSubmit={submitRepo} className="rv-maintainer-repo-form">
      <label htmlFor="maintainer-repo">Public GitHub repository</label><div><input id="maintainer-repo" value={draft} onChange={(event:{target:{value:string}})=>{setDraft(event.target.value);setRepoError('')}} placeholder="owner/repository" spellCheck={false} autoComplete="off"/><button type="submit" className="rv-primary-button">Inspect <ArrowUpRight size={15}/></button><button type="button" className="rv-outline-button" title="Refresh repository data" onClick={()=>setRefreshToken(n=>n+1)}><RefreshCw size={16}/> Refresh</button></div>
      {repoError&&<p role="alert" className="rv-maintainer-error">{repoError}</p>}
      <div className="rv-maintainer-suggestions">{[...new Set(suggestedRepos.map(normalizeRepository).filter((x):x is string=>Boolean(x)))].slice(0,4).map(r=><button key={r} type="button" onClick={()=>{setDraft(r);setRepo(r);setRepoError('')}}>{r}</button>)}</div>
    </form>
    <div className="rv-maintainer-summary" aria-label="Loaded repository summary">
      <div><span>Open issues sampled</span><strong>{loading?'...':latestCount(issues)}</strong><small>{overview?.issues?.hasMore?'More pages available':'Latest page, up to 40'}</small></div>
      <div><span>Open PRs sampled</span><strong>{loading?'...':latestCount(pulls)}</strong><small>{overview?.pulls?.hasMore?'More pages available':'Latest page, up to 40'}</small></div>
      <div><span>Contributors returned</span><strong>{loading?'...':overview?.contributors?fmt(overview.contributors.length):'N/A'}</strong><small>Up to 40 reported by GitHub</small></div>
      <div><span>My worklist</span><strong>{queueMode==='loading'?'...':available?fmt(queue.length):'N/A'}</strong><small>{queueMode==='cloud'?'Synced to my account':queueMode==='local'?'Stored on this device':'Waiting for storage'}</small></div>
    </div>
    <p className="rv-maintainer-caveat"><AlertCircle size={15}/> These are limited public API pages, not lifetime totals. Queue stages and notes do not change GitHub issues, labels, or PRs.</p>
    <div className="rv-maintainer-tabs" role="tablist" aria-label="Maintainer views">
      {([['issues','Issues',BookOpen],['pulls','Pull requests',GitPullRequest],['contributors','Contributors',Users],['queue','My triage queue',ClipboardList]] as const).map(([id,title,Icon])=><button key={id} type="button" role="tab" aria-selected={tab===id} className={tab===id?'selected':''} onClick={()=>{setTab(id);setFilter('');setLabel('');setFocus('all')}}><Icon size={17}/>{title}</button>)}
    </div>
    {(tab==='issues'||tab==='pulls')&&<div role="tabpanel" className="rv-maintainer-section">
      <div className="rv-maintainer-filter"><label className="rv-visually-hidden" htmlFor="maintainer-find">Filter results</label><div className="rv-maintainer-search"><Search size={16}/><input id="maintainer-find" value={filter} onChange={(event:{target:{value:string}})=>setFilter(event.target.value)} placeholder="Search title, author or label"/></div><label className="rv-visually-hidden" htmlFor="maintainer-label">Label</label><select id="maintainer-label" value={label} onChange={(event:{target:{value:string}})=>setLabel(event.target.value)}><option value="">All labels</option>{labels.map(x=><option key={x} value={x}>{x}</option>)}</select><label className="rv-visually-hidden" htmlFor="maintainer-focus">Focus filter</label><select id="maintainer-focus" value={focus} onChange={(event:{target:{value:string}})=>setFocus(event.target.value as typeof focus)}><option value="all">All loaded</option><option value="unassigned">Unassigned</option><option value="stale">No update in 30 days</option></select></div>
      {loading?<p role="status" className="rv-maintainer-empty"><LoaderCircle size={19}/> Loading GitHub records...</p>:selectedItems===null?<p role="alert" className="rv-maintainer-empty"><AlertCircle size={19}/>{(tab==='issues' ? overview?.errors.issues : overview?.errors.pulls) ?? dataError ?? 'GitHub data unavailable.'}</p>:<>
        <p className="rv-maintainer-result-count">Showing {visible.length} of {selectedItems.length} loaded {tab==='issues'?'issues':'pull requests'}.</p>
        {visible.length===0?<p className="rv-maintainer-empty">No results in the loaded pages match your filters.</p>:<ul className="rv-maintainer-items">{visible.map(item=>{
          const key=queueKey({repo,kind:item.kind,number:item.number})
          const days=activityDays(item.updated_at)
          return <li key={key} className="rv-maintainer-item"><div className="rv-maintainer-item-top"><span className="rv-maintainer-identifier">#{item.number} {item.draft?' / DRAFT':''}</span>{days!==null&&<span>{days===0?'Updated today':`${days}d since update`}</span>}</div><a className="rv-maintainer-item-title" href={item.url} target="_blank" rel="noopener noreferrer">{item.title||'Untitled GitHub item'} <ArrowUpRight size={15}/></a><p>Opened by <strong>{item.author||'Unknown'}</strong> · {item.comments} comments · {item.assignees.length===0?'Unassigned':`${item.assignees.length} assignee(s)`}</p><div className="rv-maintainer-item-bottom"><div className="rv-maintainer-labels">{item.labels.slice(0,5).map(tag=><span key={tag}>{tag}</span>)}</div><button type="button" disabled={!available||working===key||queuedKeys.has(key)} onClick={()=>void persist({repo,kind:item.kind,number:item.number,stage:'inbox',note:''})}>{queuedKeys.has(key)?<><Check size={15}/> In my queue</>:<><ClipboardList size={15}/> Add to queue</>}</button></div></li>
        })}</ul>}
        {(tab==='issues'?overview?.issues?.hasMore:overview?.pulls?.hasMore)&&<div className="rv-maintainer-more"><button type="button" className="rv-outline-button" disabled={Boolean(loadingMore)} onClick={()=>void more(tab==='issues'?'issue':'pull')}>{loadingMore?'Loading...':'Load next page'} <ArrowUpRight size={15}/></button><span>Maximum 3 pages of 40. Results may include fewer items after deduplication.</span></div>}
      </>}
    </div>}
    {tab==='contributors'&&<div role="tabpanel" className="rv-maintainer-section"><p className="rv-maintainer-result-count">GitHub-reported contributions in this repository. Limited to the first 40 returned accounts. Counts do not indicate review quality or current availability.</p>{loading?<p className="rv-maintainer-empty">Loading contributors...</p>:!overview?.contributors?<p role="alert" className="rv-maintainer-empty">{overview?.errors.contributors??'Contributor information unavailable.'}</p>:overview.contributors.length===0?<p className="rv-maintainer-empty">No public contributors were returned.</p>:<div className="rv-maintainer-contributors">{overview.contributors.map(item=><a key={item.login} href={item.url} target="_blank" rel="noopener noreferrer"><img src={item.avatar_url} alt="" loading="lazy" referrerPolicy="no-referrer"/><span>{item.login}</span><strong>{fmt(item.contributions)}</strong><ArrowUpRight size={14}/></a>)}</div>}</div>}
    {tab==='queue'&&<div role="tabpanel" className="rv-maintainer-section">
      <div className="rv-maintainer-queue-head"><div><h3>My personal triage board</h3><p>{queueMode==='cloud'?'Private cloud notes synced with your signed-in account.':'Local notes are saved only in this browser.'} This is not a shared GitHub Projects board.</p></div><button type="button" className="rv-outline-button" disabled={queue.length===0||!available} onClick={()=>downloadCsv(repo,queue)}><Download size={16}/> Export CSV</button></div>
      {queueMode==='loading'?<p className="rv-maintainer-empty">Loading personal worklist...</p>:queueMode==='unavailable'?<p role="alert" className="rv-maintainer-empty">{queueMessage||'Cloud storage unavailable.'}</p>:queue.length===0?<p className="rv-maintainer-empty">Nothing queued for this repository. Add an issue or PR from the other tabs.</p>:<div className="rv-maintainer-board">{TRIAGE_STAGES.map(stage=><section key={stage.id} className="rv-maintainer-lane"><h4>{stage.label}<span>{queue.filter(x=>x.stage===stage.id).length}</span></h4><div>{queue.filter(x=>x.stage===stage.id).map(item=>{
        const key=queueKey(item)
        return <article key={key} className="rv-maintainer-ticket"><a href={`https://github.com/${repo}/${item.kind==='pull'?'pull':'issues'}/${item.number}`} target="_blank" rel="noopener noreferrer">{item.kind==='pull'?'PR':'Issue'} #{item.number}<ArrowUpRight size={14}/></a>{item.note&&<p>{item.note}</p>}{activeEdit===key?<div className="rv-maintainer-edit"><label>Next step<select value={stageDraft} onChange={(event:{target:{value:string}})=>setStageDraft(event.target.value as TriageStage)}>{TRIAGE_STAGES.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></label><label>Private note<textarea value={noteDraft} onChange={(event:{target:{value:string}})=>setNoteDraft(event.target.value)} maxLength={600} rows={3} placeholder="Next action or handoff context"/></label><div><button type="button" disabled={working===key} onClick={()=>void persist({repo:item.repo,kind:item.kind,number:item.number,stage:stageDraft,note:noteDraft}).then(ok=>{if(ok)setActiveEdit(null)})}>Save</button><button type="button" onClick={()=>setActiveEdit(null)}>Cancel</button></div></div>:<div className="rv-maintainer-ticket-actions"><button type="button" onClick={()=>startEdit(item)}>Edit note / stage</button><button type="button" aria-label={`Remove ${item.kind} ${item.number} from queue`} disabled={working===key} onClick={()=>void remove(item)}><Trash2 size={15}/></button></div>}</article>
      })}</div></section>)}</div>}
    </div>}
    {dataError&&<p role="alert" className="rv-maintainer-error">{dataError}</p>}
    {queueMessage&&queueMode!=='unavailable'&&<p role="alert" className="rv-maintainer-error">{queueMessage}</p>}
  </section>
}
