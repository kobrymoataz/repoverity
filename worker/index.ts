import type { CloudEnv, CloudUser } from './db.ts'
import {
  addWatchlist, createWorkspace, deleteWorkspace, ensureDefaultWorkspace, listWatchlist,
  listWorkspaces, readPreferences, removeAccount, removeWatchlist, renameWorkspace, savePreferences,
} from './db.ts'
import { cookieValue, loginRedirect, logout, oauthCallback, resolveUser } from './auth.ts'
import { DEFAULT_PREFERENCES, MAX_JSON_BYTES, MAX_WATCHLIST_ITEMS, MAX_WORKSPACES,
  allowedOrigin, validFullName, validPreferences, validPublicOrigin, validWorkspaceId, validWorkspaceName } from './validation.ts'

const HEADERS:Record<string,string>={
  'Cache-Control':'no-store, private',
  'Content-Type':'application/json; charset=utf-8',
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer',
  'X-Frame-Options':'DENY',
}

function reply(value:unknown,status=200,headers?:HeadersInit):Response {
  return new Response(JSON.stringify(value),{status,headers:{...HEADERS,...headers}})
}
function fail(message:string,status=400):Response { return reply({error:message},status) }

async function readBody(request:Request):Promise<Record<string,unknown>|null> {
  const media=request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()
  if(media!=='application/json'||!request.body)return null
  const reader=request.body.getReader()
  const decoder=new TextDecoder('utf-8',{fatal:true})
  const pieces:Uint8Array[]=[]
  let total=0
  try {
    while(true){
      const chunk=await reader.read()
      if(chunk.done)break
      total+=chunk.value.byteLength
      if(total>MAX_JSON_BYTES){await reader.cancel();return null}
      pieces.push(chunk.value)
    }
    const bytes=new Uint8Array(total)
    let offset=0
    for(const part of pieces){bytes.set(part,offset);offset+=part.length}
    const text=decoder.decode(bytes)
    const value:unknown=JSON.parse(text)
    return value!==null&&typeof value==='object'&&!Array.isArray(value)
      ? value as Record<string,unknown>:null
  }catch{return null}
  finally { reader.releaseLock() }
}

function authorizeMutation(request:Request,env:CloudEnv):boolean {
  return allowedOrigin(request.headers.get('Origin'),env.APP_ORIGIN)&&
    request.headers.get('X-RepoVerity-Action')==='1'
}

async function routeApi(request:Request,env:CloudEnv, user:CloudUser|null, url:URL):Promise<Response> {
  const route=url.pathname
  const method=request.method.toUpperCase()
  if(route==='/api/v1/status'&&method==='GET'){
    return reply({enabled:true,auth:'GitHub OAuth',storage:'Cloudflare D1',version:'1.6.0'})
  }
  if(route==='/api/v1/me'&&method==='GET')return reply({user})
  if(!user)return fail('Sign in with GitHub to access your cloud workspace.',401)

  if(route==='/api/v1/workspaces'&&method==='GET'){
    await ensureDefaultWorkspace(env.DB,user.github_id,Math.floor(Date.now()/1000))
    return reply({workspaces:await listWorkspaces(env.DB,user.github_id),limit:MAX_WORKSPACES})
  }
  if(route==='/api/v1/workspaces'&&method==='POST'){
    const body=await readBody(request)
    const name=validWorkspaceName(body?.name)
    if(!name)return fail('Workspace name must contain 1 to 48 characters.')
    const id=await createWorkspace(env.DB,user.github_id,name,Math.floor(Date.now()/1000),MAX_WORKSPACES)
    return id?reply({id},201):fail('The maximum of 12 workspaces has been reached.',409)
  }
  const workspaceRoute=/^\/api\/v1\/workspaces\/([^/]+)$/.exec(route)
  if(workspaceRoute){
    const id=validWorkspaceId(workspaceRoute[1])
    if(!id)return fail('Invalid workspace identifier.')
    if(method==='PATCH'){
      const body=await readBody(request)
      const name=validWorkspaceName(body?.name)
      if(!name)return fail('Workspace name must contain 1 to 48 characters.')
      const updated=await renameWorkspace(env.DB,user.github_id,id,name,Math.floor(Date.now()/1000))
      return updated?reply({updated:true}):fail('Workspace not found.',404)
    }
    if(method==='DELETE'){
      const deleted=await deleteWorkspace(env.DB,user.github_id,id)
      return deleted?reply({deleted:true}):fail('Workspace not found or it is your final workspace.',409)
    }
  }
  if(route==='/api/v1/watchlist'&&method==='GET'){
    const id=validWorkspaceId(url.searchParams.get('workspaceId'))
    if(!id)return fail('Invalid workspace identifier.')
    const entries=await listWatchlist(env.DB,user.github_id,id)
    return entries?reply({entries,limit:MAX_WATCHLIST_ITEMS}):fail('Workspace not found.',404)
  }
  if(route==='/api/v1/watchlist'&&method==='POST'){
    const body=await readBody(request)
    const id=validWorkspaceId(body?.workspaceId)
    const fullName=validFullName(body?.fullName)
    if(!id||!fullName)return fail('Provide a valid workspace and owner/repository name.')
    const added=await addWatchlist(env.DB,user.github_id,id,fullName,Math.floor(Date.now()/1000),MAX_WATCHLIST_ITEMS)
    return added?reply({added:true},201):fail('Already saved, workspace unavailable, or watchlist limit reached.',409)
  }
  if(route==='/api/v1/watchlist'&&method==='DELETE'){
    const id=validWorkspaceId(url.searchParams.get('workspaceId'))
    const fullName=validFullName(url.searchParams.get('fullName'))
    if(!id||!fullName)return fail('Invalid workspace or repository name.')
    const removed=await removeWatchlist(env.DB,user.github_id,id,fullName)
    return removed?reply({removed:true}):fail('Item not found.',404)
  }
  if(route==='/api/v1/preferences'&&method==='GET'){
    const raw=await readPreferences(env.DB,user.github_id)
    const preferences=raw?validPreferences(JSON.parse(raw)):null
    return reply({preferences:preferences??DEFAULT_PREFERENCES})
  }
  if(route==='/api/v1/preferences'&&method==='PUT'){
    const body=await readBody(request)
    const preferences=validPreferences(body)
    if(!preferences)return fail('Theme and density must use supported values.')
    await savePreferences(env.DB,user.github_id,JSON.stringify(preferences),Math.floor(Date.now()/1000))
    return reply({preferences})
  }
  if(route==='/api/v1/account'&&method==='DELETE'){
    const body=await readBody(request)
    if(body?.confirm!=='DELETE MY CLOUD DATA')return fail('Enter the exact cloud data deletion confirmation.')
    await removeAccount(env.DB,user.github_id)
    const response=reply({deleted:true})
    response.headers.append('Set-Cookie',cookieValue(env.APP_ORIGIN,'session','',0))
    return response
  }
  return fail('API route not found.',404)
}

export async function handleRequest(request:Request,env:CloudEnv):Promise<Response> {
  const url=new URL(request.url)
  if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request)
  if(!validPublicOrigin(env.APP_ORIGIN)||url.origin!==new URL(env.APP_ORIGIN).origin){
    return fail('Cloud origin is not configured for this host.',503)
  }
  const method=request.method.toUpperCase()
  if(url.pathname==='/api/auth/login'&&method==='GET')return loginRedirect(env)
  if(url.pathname==='/api/auth/callback'&&method==='GET')return oauthCallback(request,env)
  if(!['GET','POST','PUT','PATCH','DELETE'].includes(method))return fail('Unsupported method.',405)
  if(!url.pathname.startsWith('/api/v1/')&&url.pathname!=='/api/auth/logout')return fail('API route not found.',404)
  if(method!=='GET'&&!authorizeMutation(request,env))return fail('Origin validation failed.',403)
  try {
    if(url.pathname==='/api/auth/logout'){
      if(method!=='POST')return fail('Method not allowed.',405)
      const clear=await logout(request,env)
      const response=reply({signedOut:true})
      response.headers.append('Set-Cookie',clear)
      return response
    }
    const user=await resolveUser(request,env)
    return await routeApi(request,env,user,url)
  }catch{
    // Never expose database details or secrets in public error responses.
    return fail('Cloud service is temporarily unavailable.',503)
  }
}

export default {fetch:handleRequest}
