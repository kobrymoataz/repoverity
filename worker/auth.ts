import type { CloudEnv, CloudUser } from './db.ts'
import { createSession, ensureDefaultWorkspace, findSession, revokeSession, saveUser } from './db.ts'
import { parseCookie, validPublicOrigin } from './validation.ts'

const TTL_SECONDS = 14 * 24 * 60 * 60
const STATE_SECONDS = 10 * 60
const encoder = new TextEncoder()

export function cookieName(origin:string,kind:'session'|'state'):string {
  const secure=new URL(origin).protocol==='https:'
  return secure ? `__Host-rv_${kind}` : `rv_${kind}_dev`
}

export function cookieValue(origin:string,kind:'session'|'state',value:string,maxAge:number):string {
  const secure=new URL(origin).protocol==='https:'
  return `${cookieName(origin,kind)}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure?'; Secure':''}`
}

export function randomToken():string {
  const bytes=crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('')
}

export async function tokenHash(value:string):Promise<string> {
  const raw=await crypto.subtle.digest('SHA-256',encoder.encode(value))
  return Array.from(new Uint8Array(raw),b=>b.toString(16).padStart(2,'0')).join('')
}

export async function resolveUser(request:Request,env:CloudEnv):Promise<CloudUser|null> {
  const token=parseCookie(request.headers.get('Cookie'),cookieName(env.APP_ORIGIN,'session'))
  if(!token||!(/^[a-f0-9]{64}$/.test(token)))return null
  return findSession(env.DB,await tokenHash(token),Math.floor(Date.now()/1000))
}

export async function logout(request:Request,env:CloudEnv) {
  const token=parseCookie(request.headers.get('Cookie'),cookieName(env.APP_ORIGIN,'session'))
  if(token&&/^[a-f0-9]{64}$/.test(token)) await revokeSession(env.DB,await tokenHash(token))
  return cookieValue(env.APP_ORIGIN,'session','',0)
}

export function loginRedirect(env:CloudEnv):Response {
  if(!validPublicOrigin(env.APP_ORIGIN)||!env.GITHUB_CLIENT_ID||!env.GITHUB_CLIENT_SECRET){
    return new Response('Sign-in is not configured.',{status:503,headers:{'Cache-Control':'no-store'}})
  }
  const state=randomToken()
  const authorization=new URL('https://github.com/login/oauth/authorize')
  authorization.search=new URLSearchParams({
    client_id:env.GITHUB_CLIENT_ID,
    redirect_uri:`${env.APP_ORIGIN}/api/auth/callback`,
    scope:'read:user',
    state,
  }).toString()
  return new Response(null,{status:302,headers:{
    'Location':authorization.toString(),
    'Set-Cookie':cookieValue(env.APP_ORIGIN,'state',state,STATE_SECONDS),
    'Cache-Control':'no-store',
    'Referrer-Policy':'no-referrer',
  }})
}

export async function oauthCallback(request:Request,env:CloudEnv):Promise<Response> {
  if(!validPublicOrigin(env.APP_ORIGIN)) return new Response('Origin misconfigured',{status:503})
  const url=new URL(request.url)
  const expected=parseCookie(request.headers.get('Cookie'),cookieName(env.APP_ORIGIN,'state'))
  const received=url.searchParams.get('state')
  const code=url.searchParams.get('code')
  if (!expected || !received || expected!==received || !/^[a-f0-9]{64}$/.test(received) || !code || code.length>400) {
    return new Response('OAuth validation failed. Restart sign-in.',{status:400,headers:{
      'Cache-Control':'no-store','Set-Cookie':cookieValue(env.APP_ORIGIN,'state','',0),
    }})
  }
  try {
    const exchange=await fetch('https://github.com/login/oauth/access_token',{
      method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json', 'User-Agent':'RepoVerity'},
      body:JSON.stringify({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,
        code,redirect_uri:`${env.APP_ORIGIN}/api/auth/callback`}),
    })
    if(!exchange.ok)throw Error('code exchange failed')
    const result=await exchange.json() as {access_token?:unknown,error?:unknown,token_type?:unknown}
    if(typeof result.access_token!=='string'||result.access_token.length<10)throw Error('token missing')
    const userResponse=await fetch('https://api.github.com/user',{
      headers:{'Authorization':`Bearer ${result.access_token}`,'Accept':'application/vnd.github+json',
        'X-GitHub-Api-Version':'2022-11-28','User-Agent':'RepoVerity'},
    })
    if(!userResponse.ok)throw Error('profile request failed')
    const github=await userResponse.json() as {id?:unknown,login?:unknown,avatar_url?:unknown}
    if(!Number.isSafeInteger(github.id)||Number(github.id)<=0||typeof github.login!=='string'||
      !/^[a-zA-Z0-9-]{1,39}$/.test(github.login))throw Error('profile invalid')
    const avatar=typeof github.avatar_url==='string'&&github.avatar_url.startsWith('https://avatars.githubusercontent.com/')
      ?github.avatar_url:''
    const now=Math.floor(Date.now()/1000)
    const id=Number(github.id)
    await saveUser(env.DB,id,github.login,avatar,now)
    await ensureDefaultWorkspace(env.DB,id,now)
    const secret=randomToken()
    await createSession(env.DB,id,await tokenHash(secret),now+TTL_SECONDS,now)
    const headers=new Headers({Location:`${env.APP_ORIGIN}/#/cloud`,'Cache-Control':'no-store',
      'Referrer-Policy':'no-referrer'})
    headers.append('Set-Cookie',cookieValue(env.APP_ORIGIN,'state','',0))
    headers.append('Set-Cookie',cookieValue(env.APP_ORIGIN,'session',secret,TTL_SECONDS))
    return new Response(null,{status:302,headers})
  } catch {
    return new Response('GitHub sign-in could not be completed.',{status:502,headers:{
      'Cache-Control':'no-store','Set-Cookie':cookieValue(env.APP_ORIGIN,'state','',0),
    }})
  }
}
