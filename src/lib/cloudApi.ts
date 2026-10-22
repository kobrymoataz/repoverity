/** The static GitHub Pages build never calls the Cloud API. */
export const CLOUD_ENABLED = import.meta.env.VITE_CLOUD_ENABLED === 'true'

export type CloudAccount = { github_id: number; login: string; avatar_url: string }
export type CloudWorkspaceRecord = {
  id: string; name: string; created_at: number; updated_at: number; watch_count: number
}
export type CloudWatchEntry = { repo_full_name: string; added_at: number }
export type CloudPreferences = {
  defaultView: 'overview' | 'repositories' | 'analytics' | 'growth'
  density: 'comfortable' | 'compact'
}

export class CloudRequestError extends Error {
  constructor(message: string,public readonly status:number) {super(message);this.name='CloudRequestError'}
}

export async function cloudRequest<T>(path:string,options: {method?:'GET'|'POST'|'PUT'|'PATCH'|'DELETE';data?:unknown;signal?:AbortSignal}={}):Promise<T> {
  if(!CLOUD_ENABLED)throw new CloudRequestError('Cloud sync is not enabled on this deployment.',503)
  if(!/^\/api\/(?:v1\/|auth\/)[a-zA-Z0-9/?=&._%-]+$/.test(path))throw new CloudRequestError('Invalid cloud endpoint.',400)
  const method=options.method??'GET'
  let response:Response
  try {
    response=await fetch(path,{
      method,credentials:'same-origin',cache:'no-store',signal:options.signal,
      headers:method==='GET'?{'Accept':'application/json'}:{'Content-Type':'application/json','Accept':'application/json','X-RepoVerity-Action':'1'},
      body:method==='GET'?undefined:JSON.stringify(options.data??{}),
    })
  }catch(error) {
    if(options.signal?.aborted)throw error
    throw new CloudRequestError('Cloud service could not be reached.',503)
  }
  const contentType=response.headers.get('content-type')??''
  if(!contentType.includes('application/json'))throw new CloudRequestError('Unexpected cloud response.',502)
  const payload=await response.json() as {error?:unknown}&T
  if(!response.ok)throw new CloudRequestError(typeof payload.error==='string'?payload.error:'Cloud request failed.',response.status)
  return payload as T
}
