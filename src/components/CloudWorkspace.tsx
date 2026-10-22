import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  ArrowRight, Bookmark, Cloud, ExternalLink, Github, LockKeyhole, Plus, RefreshCw,
  Settings2, ShieldCheck, Trash2, Users, X,
} from 'lucide-react'
import { CLOUD_ENABLED, cloudRequest, type CloudAccount, type CloudPreferences,
  type CloudWatchEntry, type CloudWorkspaceRecord } from '../lib/cloudApi'

const DEFAULT:CloudPreferences = {defaultView:'overview',density:'comfortable'}
const DOCUMENTATION='https://github.com/kobrymoataz/repoverity/blob/main/docs/CLOUD_V1_6.md'

type ViewState = 'loading'|'guest'|'ready'|'error'
function displayError(error:unknown):string {return error instanceof Error ? error.message:'Cloud request could not be completed.'}

export function CloudWorkspace() {
  const [view,setView]=useState<ViewState>(CLOUD_ENABLED?'loading':'guest')
  const [user,setUser]=useState<CloudAccount|null>(null)
  const [workspaces,setWorkspaces]=useState<CloudWorkspaceRecord[]>([])
  const [selected,setSelected]=useState('')
  const [entries,setEntries]=useState<CloudWatchEntry[]>([])
  const [prefs,setPrefs]=useState<CloudPreferences>(DEFAULT)
  const [newName,setNewName]=useState('')
  const [editName,setEditName]=useState('')
  const [repoName,setRepoName]=useState('')
  const [deleteText,setDeleteText]=useState('')
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)

  const refresh=useCallback(async()=>{
    if(!CLOUD_ENABLED)return
    setError('')
    const me=await cloudRequest<{user:CloudAccount|null}>('/api/v1/me')
    setUser(me.user)
    if(!me.user){setView('guest');setWorkspaces([]);setSelected('');setEntries([]);return}
    const [spaces,settings]=await Promise.all([
      cloudRequest<{workspaces:CloudWorkspaceRecord[]}>('/api/v1/workspaces'),
      cloudRequest<{preferences:CloudPreferences}>('/api/v1/preferences'),
    ])
    setWorkspaces(spaces.workspaces)
    setSelected(previous=>spaces.workspaces.some(item=>item.id===previous)?previous:spaces.workspaces[0]?.id??'')
    setPrefs(settings.preferences)
    setView('ready')
  },[])

  useEffect(()=>{
    if(!CLOUD_ENABLED)return
    let live=true
    void refresh().catch(problem=>{if(live){setError(displayError(problem));setView('error')}})
    return ()=>{live=false}
  },[refresh])

  useEffect(()=>{
    if(view!=='ready'||!selected){setEntries([]);return}
    let active=true
    void cloudRequest<{entries:CloudWatchEntry[]}>(`/api/v1/watchlist?workspaceId=${encodeURIComponent(selected)}`)
      .then(result=>{if(active)setEntries(result.entries)})
      .catch(problem=>{if(active){setEntries([]);setError(displayError(problem))}})
    return ()=>{active=false}
  },[selected,view])

  useEffect(()=>{
    if(view==='ready')document.documentElement.dataset.rvDensity=prefs.density
    else delete document.documentElement.dataset.rvDensity
    return ()=>{delete document.documentElement.dataset.rvDensity}
  },[prefs.density,view])

  async function act(operation:()=>Promise<void>,success:string){
    setBusy(true);setError('');setMessage('')
    try{await operation();setMessage(success)}catch(problem){setError(displayError(problem))}
    finally{setBusy(false)}
  }

  async function createWorkspace(event:FormEvent){
    event.preventDefault()
    await act(async()=>{
      const result=await cloudRequest<{id:string}>('/api/v1/workspaces',{method:'POST',data:{name:newName}})
      setNewName('');await refresh();setSelected(result.id)
    },'Workspace created.')
  }

  async function rename(){
    if(!selected)return
    await act(async()=>{await cloudRequest(`/api/v1/workspaces/${selected}`,{method:'PATCH',data:{name:editName}});setEditName('');await refresh()},'Workspace renamed.')
  }

  async function removeWorkspace(){
    if(!selected||workspaces.length<=1||!window.confirm('Delete this workspace and its saved repositories?'))return
    await act(async()=>{await cloudRequest(`/api/v1/workspaces/${selected}`,{method:'DELETE'});setSelected('');await refresh()},'Workspace deleted.')
  }

  async function addRepo(event:FormEvent){
    event.preventDefault()
    if(!selected)return
    await act(async()=>{
      await cloudRequest('/api/v1/watchlist',{method:'POST',data:{workspaceId:selected,fullName:repoName.trim()}})
      setRepoName('')
      const result=await cloudRequest<{entries:CloudWatchEntry[]}>(`/api/v1/watchlist?workspaceId=${encodeURIComponent(selected)}`)
      setEntries(result.entries);await refresh()
    },'Repository saved to this workspace.')
  }

  async function removeRepo(fullName:string){
    await act(async()=>{
      await cloudRequest(`/api/v1/watchlist?workspaceId=${encodeURIComponent(selected)}&fullName=${encodeURIComponent(fullName)}`,{method:'DELETE'})
      setEntries(items=>items.filter(item=>item.repo_full_name!==fullName));await refresh()
    },'Repository removed.')
  }

  async function savePreferences(next:CloudPreferences){
    await act(async()=>{
      const result=await cloudRequest<{preferences:CloudPreferences}>('/api/v1/preferences',{method:'PUT',data:next})
      setPrefs(result.preferences)
    },'Preferences synced across your signed-in devices.')
  }

  async function signOut(){
    await act(async()=>{
      await cloudRequest('/api/auth/logout',{method:'POST'})
      setUser(null);setView('guest');setWorkspaces([]);setEntries([])
    },'Signed out of your cloud workspace.')
  }

  async function deleteAccount(){
    if(deleteText!=='DELETE MY CLOUD DATA')return
    await act(async()=>{
      await cloudRequest('/api/v1/account',{method:'DELETE',data:{confirm:deleteText}})
      setDeleteText('');setUser(null);setWorkspaces([]);setEntries([]);setView('guest')
    },'Cloud account records deleted. Local browser records are unchanged.')
  }

  if(!CLOUD_ENABLED)return <div className="rv-cloud rv-cloud-center">
    <Cloud size={32}/><h2>Cloud workspaces are not enabled on this host.</h2>
    <p>This public GitHub Pages deployment continues to work without sign-in. Optional account sync is available when RepoVerity is deployed with its Cloudflare Worker and D1 database.</p>
    <a className="rv-outline-button" href={DOCUMENTATION} target="_blank" rel="noreferrer"><ExternalLink size={16}/> Deployment instructions</a>
  </div>

  return <section className="rv-cloud" aria-label="Cloud workspaces">
    <div className="rv-cloud-hero"><div><span className="rv-kicker">OPTIONAL ACCOUNT FEATURES</span><h2>Cloud workspaces</h2><p>Save repository watchlists and display preferences across devices. Public analysis remains available without an account.</p></div><Cloud size={29}/></div>
    {error&&<p className="rv-cloud-alert rv-cloud-error" role="alert">{error}</p>}
    {message&&<p className="rv-cloud-alert" role="status">{message}</p>}
    {view==='loading'&&<p className="rv-cloud-alert" role="status">Loading your workspace...</p>}
    {view==='error'&&<button className="rv-outline-button" type="button" onClick={()=>{setView('loading');void refresh().catch(reason=>{setError(displayError(reason));setView('error')})}}><RefreshCw size={16}/> Retry cloud connection</button>}
    {view==='guest'&&<div className="rv-cloud-guest"><Github size={32}/><h3>Sign in with GitHub</h3>
      <p>RepoVerity requests only public profile identity using the read:user scope. Your GitHub access token is not stored, and the session is managed by a secure cookie.</p>
      <a className="rv-cloud-primary" href="/api/auth/login"><Github size={17}/> Continue with GitHub <ArrowRight size={16}/></a>
      <p className="rv-cloud-foot"><LockKeyhole size={15}/> No private repository access. No automatic Stars or followers.</p>
    </div>}
    {view==='ready'&&user&&<>
      <div className="rv-cloud-account"><div className="rv-cloud-identity">
        {user.avatar_url?<img src={user.avatar_url} alt="" width="42" height="42" referrerPolicy="no-referrer"/>:<Github size={25}/>}
        <span><strong>@{user.login}</strong><small>Connected GitHub account</small></span></div>
        <button className="rv-outline-button" type="button" onClick={()=>void signOut()} disabled={busy}>Sign out</button>
      </div>
      <div className="rv-cloud-cols">
        <div className="rv-cloud-panel">
          <div className="rv-cloud-panel-title"><h3><Users size={19}/> Your workspaces</h3><span>{workspaces.length}/12</span></div>
          <div className="rv-cloud-tabs" aria-label="Saved workspaces">
            {workspaces.map(space=><button type="button" key={space.id} aria-pressed={selected===space.id}
              className={selected===space.id?'rv-cloud-tab rv-cloud-tab-active':'rv-cloud-tab'} onClick={()=>{setSelected(space.id);setEditName('')}}>
              {space.name}<span>{space.watch_count}</span></button>)}
          </div>
          <form className="rv-cloud-inline" onSubmit={event=>void createWorkspace(event)}>
            <label className="rv-visually-hidden" htmlFor="rv-cloud-new">New workspace name</label>
            <input id="rv-cloud-new" value={newName} maxLength={48} placeholder="New workspace" onChange={event=>setNewName(event.target.value)} required/>
            <button type="submit" disabled={busy||workspaces.length>=12}><Plus size={16}/> Create</button>
          </form>
          <div className="rv-cloud-inline">
            <label className="rv-visually-hidden" htmlFor="rv-cloud-rename">Rename selected workspace</label>
            <input id="rv-cloud-rename" value={editName} maxLength={48} placeholder="Rename selected workspace" onChange={event=>setEditName(event.target.value)}/>
            <button type="button" disabled={busy||!selected||!editName.trim()} onClick={()=>void rename()}>Rename</button>
          </div>
          <button className="rv-cloud-delete-link" type="button" disabled={busy||workspaces.length<=1} onClick={()=>void removeWorkspace()}><Trash2 size={15}/> Delete selected workspace</button>
        </div>
        <div className="rv-cloud-panel">
          <div className="rv-cloud-panel-title"><h3><Bookmark size={19}/> Repository watchlist</h3><span>{entries.length}/100</span></div>
          <form className="rv-cloud-inline" onSubmit={event=>void addRepo(event)}>
            <label className="rv-visually-hidden" htmlFor="rv-cloud-repository">Repository to save</label>
            <input id="rv-cloud-repository" placeholder="owner/repository" value={repoName} maxLength={140} required onChange={event=>setRepoName(event.target.value)}/>
            <button type="submit" disabled={!selected||busy||entries.length>=100}><Plus size={16}/> Save</button>
          </form>
          <p className="rv-cloud-hint">Saved references are not verified or scanned automatically.</p>
          <div className="rv-cloud-watchlist">
            {entries.length===0&&<p className="rv-cloud-empty">No repositories saved in this workspace yet.</p>}
            {entries.map(item=><div className="rv-cloud-watch" key={item.repo_full_name}>
              <a href={`https://github.com/${item.repo_full_name}`} target="_blank" rel="noreferrer"><Github size={16}/>{item.repo_full_name}<ExternalLink size={13}/></a>
              <button type="button" disabled={busy} aria-label={`Remove ${item.repo_full_name}`} onClick={()=>void removeRepo(item.repo_full_name)}><X size={16}/></button>
            </div>)}
          </div>
        </div>
      </div>
      <div className="rv-cloud-panel rv-cloud-settings">
        <div className="rv-cloud-panel-title"><h3><Settings2 size={19}/> Synced preferences</h3><ShieldCheck size={16}/></div>
        <div className="rv-cloud-settings-grid">
          <label>Workspace density<select value={prefs.density} disabled={busy} onChange={event=>void savePreferences({...prefs,density:event.target.value as CloudPreferences['density']})}>
            <option value="comfortable">Comfortable</option><option value="compact">Compact</option>
          </select></label>
          <label>Quick launch view<select value={prefs.defaultView} disabled={busy} onChange={event=>void savePreferences({...prefs,defaultView:event.target.value as CloudPreferences['defaultView']})}>
            <option value="overview">Overview</option><option value="repositories">Repositories</option>
            <option value="analytics">Analytics Pro</option><option value="growth">Growth history</option>
          </select></label>
          <a className="rv-outline-button" href={`#/${prefs.defaultView}`}><ArrowRight size={16}/> Open preferred view</a>
        </div>
      </div>
      <div className="rv-cloud-panel rv-cloud-danger">
        <div className="rv-cloud-panel-title"><h3><Trash2 size={18}/> Delete cloud account data</h3></div>
        <p>This removes saved workspaces, watchlists, preferences and active sessions. Local growth and achievement records on this browser are not deleted.</p>
        <label htmlFor="rv-cloud-delete-confirm">Type DELETE MY CLOUD DATA to confirm</label>
        <div className="rv-cloud-inline"><input id="rv-cloud-delete-confirm" value={deleteText} onChange={event=>setDeleteText(event.target.value)}/>
          <button type="button" className="rv-cloud-danger-button" disabled={busy||deleteText!=='DELETE MY CLOUD DATA'} onClick={()=>void deleteAccount()}>Delete cloud data</button></div>
      </div>
    </>}
  </section>
}
