import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Activity, ArrowDownRight, ArrowUpRight, CalendarDays, Cloud, Download, Plus, RefreshCw, ShieldCheck, Trash2, TrendingUp } from 'lucide-react'
import { CLOUD_ENABLED, CloudRequestError, cloudRequest } from '../lib/cloudApi'
import {
  cloudGrowthService, growthHistoryCsv, growthMetric, growthSummary,
  type CloudGrowthHistory, type CloudGrowthKind, type CloudGrowthTarget,
} from '../lib/cloudGrowth'

const format=(n:number)=>new Intl.NumberFormat('en').format(n)
const date=(time:number)=>new Intl.DateTimeFormat('en',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(time*1000)

function Timeline({history}:{history:CloudGrowthHistory}){
  const metric=growthMetric(history.target)
  const points=history.observations.filter(p=>p[metric]!==null)
  if(points.length<2)return <div className="rv-historical-empty">At least two recorded UTC dates are needed for a trend chart. No earlier values are estimated.</div>
  const W=820,H=230,pad={left:50,right:20,top:16,bottom:35}
  const vals=points.map(point=>point[metric] as number)
  const min=Math.min(...vals),max=Math.max(...vals),range=Math.max(1,max-min)
  const ceiling=max+Math.max(1,range*.2),floor=Math.max(0,min-Math.max(1,range*.2))
  const coords=points.map((p,i)=>({x:pad.left+(W-pad.left-pad.right)*(i/(points.length-1)),
    y:pad.top+(H-pad.top-pad.bottom)*(ceiling-(p[metric] as number))/(ceiling-floor),p}))
  const d=coords.map((p,i)=>`${i===0?'M':'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
  return <div className="rv-historical-chart"><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Measured ${metric} history from ${points[0].observed_day} to ${points.at(-1)?.observed_day}`}>
    {[0,0.5,1].map(v=><g key={v}><line x1={pad.left} y1={pad.top+v*(H-pad.top-pad.bottom)} x2={W-pad.right} y2={pad.top+v*(H-pad.top-pad.bottom)} stroke="currentColor" opacity=".15"/><text x={pad.left-10} y={pad.top+v*(H-pad.top-pad.bottom)+5} textAnchor="end" className="rv-historical-axis">{format(Math.round(ceiling-v*(ceiling-floor)))}</text></g>)}
    <path d={d} fill="none" stroke="#9db7de" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    {coords.length<=45&&coords.map(p=><circle key={p.p.observed_day} cx={p.x} cy={p.y} r="4" fill="#c9d9ec" stroke="#1b222d" strokeWidth="2"><title>{p.p.observed_day}: {format(p.p[metric] as number)} {metric}</title></circle>)}
    <text x={pad.left} y={H-7} className="rv-historical-axis">{points[0].observed_day}</text>
    <text x={W-pad.right} y={H-7} textAnchor="end" className="rv-historical-axis">{points.at(-1)?.observed_day}</text>
  </svg><span className="rv-historical-caption">Measured observations only · {points.length} UTC dates</span></div>
}

function downloadHistory(history:CloudGrowthHistory){
  if(history.observations.length===0)return
  const blob=new Blob(['\uFEFF',growthHistoryCsv(history)],{type:'text/csv;charset=utf-8'})
  const url=URL.createObjectURL(blob)
  const link=document.createElement('a')
  link.href=url;link.download=`repoverity-cloud-growth-${history.target.kind}-${history.target.resource.replace(/[^a-z0-9-]/gi,'_')}.csv`
  document.body.appendChild(link);link.click();link.remove()
  window.setTimeout(()=>URL.revokeObjectURL(url),1000)
}

export function CloudGrowth({defaultUsername}:{defaultUsername:string}){
  const [account,setAccount]=useState<'loading'|'guest'|'ready'|'error'>('loading')
  const [targets,setTargets]=useState<CloudGrowthTarget[]>([])
  const [selected,setSelected]=useState('')
  const [kind,setKind]=useState<CloudGrowthKind>('profile')
  const [resource,setResource]=useState(defaultUsername)
  const [history,setHistory]=useState<CloudGrowthHistory|null>(null)
  const [busy,setBusy]=useState(false)
  const [loadingHistory,setLoadingHistory]=useState(false)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')

  useEffect(()=>{
    if(!CLOUD_ENABLED)return
    const controller=new AbortController()
    async function initialize(){
      try {
        const response=await cloudRequest<{user:{login:string}|null}>('/api/v1/me',{signal:controller.signal})
        if(!response.user){setAccount('guest');return}
        const data=await cloudGrowthService.targets(controller.signal)
        setTargets(data);setSelected(previous=>previous||data[0]?.id||'');setAccount('ready')
      }catch(e){if(!controller.signal.aborted){setAccount('error');setError(e instanceof Error?e.message:'Unable to open cloud growth.')}}
    }
    void initialize()
    return ()=>controller.abort()
  },[])
  useEffect(()=>{
    if(!CLOUD_ENABLED||account!=='ready'||!selected){setHistory(null);setLoadingHistory(false);return}
    const controller=new AbortController()
    setLoadingHistory(true)
    void cloudGrowthService.history(selected,controller.signal).then(data=>{
      if(!controller.signal.aborted){setHistory(data);setLoadingHistory(false)}
    }).catch(reason=>{if(!controller.signal.aborted){setHistory(null);setError(reason instanceof Error?reason.message:'History unavailable');setLoadingHistory(false)}})
    return ()=>controller.abort()
  },[selected,account])
  const summary=useMemo(()=>history?growthSummary(history):null,[history])

  async function add(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return
    setBusy(true);setError('');setMessage('')
    try {const target=await cloudGrowthService.add(kind,resource.trim());const items=await cloudGrowthService.targets();setTargets(items);setSelected(target.id);setMessage('Tracking enabled. Capture the first observation or wait for the next scheduled run. No previous history is invented.')}
    catch(e){setError(e instanceof Error?e.message:'Tracking could not be enabled.')}
    finally{setBusy(false)}
  }
  async function capture(){
    if(!selected||busy)return
    setBusy(true);setError('');setMessage('')
    try{
      const outcome=await cloudGrowthService.capture(selected)
      if(outcome==='ok'){setHistory(await cloudGrowthService.history(selected));setMessage('Recorded today\'s public GitHub observation. Subsequent observations create the trend.')}
      else setError(outcome==='limited'?'GitHub API limit reached. Collection will retry later.':outcome==='not_found'?'This public target could not be found. Private resources are not tracked.':'GitHub data could not be verified. No observation was saved.')
      setTargets(await cloudGrowthService.targets())
    }catch(e){setError(e instanceof CloudRequestError && e.status===409?'Manual capture is limited to once every six hours per target.':e instanceof Error?e.message:'Capture unavailable.')}
    finally{setBusy(false)}
  }
  async function remove(){
    if(!selected||busy||!window.confirm('Stop tracking and permanently delete this cloud target, its observations, and milestones?'))return
    setBusy(true);setError('');setMessage('')
    try{await cloudGrowthService.remove(selected);const remaining=targets.filter(item=>item.id!==selected);setTargets(remaining);setSelected(remaining[0]?.id??'');setHistory(null);setMessage('Cloud history deleted for this target. Browser-local growth history is unchanged.')}
    catch(e){setError(e instanceof Error?e.message:'Unable to remove target.')}
    finally{setBusy(false)}
  }

  if(!CLOUD_ENABLED)return null
  return <section className="rv-historical rv-panel" aria-label="Cloud historical growth">
    <div className="rv-historical-heading"><span className="rv-kicker"><Cloud size={15}/> CLOUD HISTORY · V1.7</span><h2>Historical growth intelligence</h2><p>Opt-in daily observations collected by your Cloudflare Worker. This is separate from browser-local history and requires a configured cloud deployment.</p></div>
    {account==='loading'&&<p role="status">Checking cloud account...</p>}
    {account==='error'&&<p role="alert">{error||'Cloud connection unavailable.'}</p>}
    {account==='guest'&&<div className="rv-historical-empty"><ShieldCheck size={20}/><span>Sign in under <a href="/#/cloud">Cloud workspaces</a> to start tracking public profiles or repositories. Nothing is recorded without your consent.</span></div>}
    {account==='ready'&&<>
      <div className="rv-historical-controls"><form onSubmit={event=>void add(event)} className="rv-historical-add">
        <label htmlFor="rv-growth-kind">Target</label><select id="rv-growth-kind" value={kind} onChange={event=>{setKind(event.target.value as CloudGrowthKind);setResource(event.target.value==='profile'?defaultUsername:'')}}><option value="profile">Public profile</option><option value="repository">Public repository</option></select>
        <label className="rv-visually-hidden" htmlFor="rv-growth-resource">GitHub resource</label><input id="rv-growth-resource" placeholder={kind==='profile'?'GitHub username':'owner/repository'} value={resource} onChange={event=>setResource(event.target.value)} maxLength={140} required/>
        <button className="rv-cloud-primary" type="submit" disabled={busy||targets.length>=20}><Plus size={16}/> Track</button>
      </form><span className="rv-historical-count">{targets.length}/20 tracked</span></div>
      <p className="rv-historical-disclaimer"><ShieldCheck size={15}/> Tracked targets are public GitHub resources. Scheduling runs daily at 07:15 UTC, subject to deployment and API limits.</p>
      {error&&<p role="alert" className="rv-cloud-alert rv-cloud-error">{error}</p>}
      {message&&<p role="status" className="rv-cloud-alert">{message}</p>}
      {targets.length===0&&<div className="rv-historical-empty">No cloud targets yet. Choose a public GitHub profile or repository to start collecting real history.</div>}
      {targets.length>0&&<>
        <div className="rv-historical-targets" aria-label="Tracked targets">{targets.map(item=><button key={item.id} type="button" aria-pressed={selected===item.id} onClick={()=>{setSelected(item.id);setMessage('');setError('')}} className={selected===item.id?'rv-historical-target active':'rv-historical-target'}><span>{item.kind==='profile'?'@':''}{item.resource}</span><small>{item.last_status==='ok'?'Recorded':item.last_status==='pending'?'Awaiting first reading':item.last_status==='limited'?'Rate limited':item.last_status==='not_found'?'Not public or not found':'Fetch error'}</small></button>)}</div>
        {loadingHistory&&<p role="status">Loading observations...</p>}
        {!loadingHistory&&history&&<>
          <div className="rv-historical-actions"><span>Tracking since {date(history.target.created_at)}</span><div><button type="button" disabled={busy} onClick={()=>void capture()}><RefreshCw size={15}/> Capture now</button><button type="button" disabled={history.observations.length===0} onClick={()=>downloadHistory(history)}><Download size={15}/> CSV</button><button type="button" className="rv-historical-delete" disabled={busy} onClick={()=>void remove()}><Trash2 size={15}/> Stop tracking</button></div></div>
          <div className="rv-historical-stats"><div><span>Current observed {growthMetric(history.target)}</span><strong>{summary?.last == null?'N/A':format(summary.last)}</strong></div><div><span>Change since first reading</span><strong className={!summary||summary.delta===null?'neutral':summary.delta<0?'negative':'positive'}>{!summary||summary.delta===null?'Not enough data':<>{summary.delta<0?<ArrowDownRight size={19}/>:<ArrowUpRight size={19}/>} {summary.delta>0?'+':''}{format(summary.delta)}</>}</strong></div><div><span>Recorded UTC dates</span><strong>{summary?.observations??0}</strong></div></div>
          <Timeline history={history}/>
          <div className="rv-historical-bottom"><div><h3><CalendarDays size={18}/> Recent observations</h3>{history.observations.length===0?<p>No measurements yet.</p>:<div className="rv-historical-measures">{history.observations.slice(-7).reverse().map(point=><div key={point.observed_day}><span>{point.observed_day}</span><strong>{(history.target.kind==='profile'?point.followers:point.stars)===null?'N/A':format((history.target.kind==='profile'?point.followers:point.stars) as number)} {growthMetric(history.target)}</strong></div>)}</div>}</div><div><h3><TrendingUp size={18}/> Observed milestones</h3>{history.milestones.length===0?<p>Milestones are recorded only when two measurements cross a threshold.</p>:<ul>{history.milestones.slice(0,8).map(item=><li key={`${item.metric}-${item.threshold}`}><Activity size={15}/>{format(item.threshold)} {item.metric}<small>{date(item.observed_at)}</small></li>)}</ul>}</div></div>
          <p className="rv-historical-disclaimer">Changes reflect snapshots, not every intermediate event. No backfilled history, predictions, or email notifications. Retention is up to 730 days.</p>
        </>}
      </>}
    </>}
  </section>
}
