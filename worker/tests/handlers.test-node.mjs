import {test} from 'node:test'
import assert from 'node:assert/strict'
import {handleRequest} from '../index.ts'
import {cookieName} from '../auth.ts'

const origin='https://repoverity-cloud.example'
const env={APP_ORIGIN:origin,GITHUB_CLIENT_ID:'Iv1.test',GITHUB_CLIENT_SECRET:'secret-placeholder',
 ASSETS:{async fetch(){return new Response('asset')}} ,DB:{prepare(){throw Error('database must not be touched for unauthenticated route')}}}
const get=(pathname,headers={})=>new Request(origin+pathname,{headers})

test('public status is available without a session',async()=>{
 const response=await handleRequest(get('/api/v1/status'),env)
 assert.equal(response.status,200)
 assert.equal((await response.json()).enabled,true)
 assert.equal(response.headers.get('cache-control'),'no-store, private')
})
test('guest endpoint does not leak session data',async()=>{
 const response=await handleRequest(get('/api/v1/me'),env)
 assert.equal(response.status,200)
 assert.deepEqual(await response.json(),{user:null})
})
test('mutation requires strict Origin and action header',async()=>{
 const request=new Request(origin+'/api/v1/workspaces',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json', 'X-RepoVerity-Action':'1'},body:'{"name":"Open Source"}'})
 const response=await handleRequest(request,env)
 assert.equal(response.status,403)
})
test('unauthenticated writes are rejected without D1 access',async()=>{
 const request=new Request(origin+'/api/v1/workspaces',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-RepoVerity-Action':'1'},body:'{"name":"Open Source"}'})
 const response=await handleRequest(request,env)
 assert.equal(response.status,401)
})
test('OAuth redirect has a secure state cookie',async()=>{
 const response=await handleRequest(get('/api/auth/login'),env)
 assert.equal(response.status,302)
 assert.match(response.headers.get('set-cookie'),new RegExp(cookieName(origin,'state')))
 assert.match(response.headers.get('set-cookie'),/HttpOnly; SameSite=Lax; Path=\/; Max-Age=600; Secure/)
 const url=new URL(response.headers.get('location'))
 assert.equal(url.hostname,'github.com')
 assert.equal(url.searchParams.get('scope'),'read:user')
 assert.match(url.searchParams.get('state'),/^[a-f0-9]{64}$/)
})
test('OAuth callback rejects requests without valid state',async()=>{
 const response=await handleRequest(get('/api/auth/callback?code=xyz&state=abc'),env)
 assert.equal(response.status,400)
})
test('static requests are served as assets',async()=>{
 const response=await handleRequest(get('/robots.txt'),env)
 assert.equal(response.status,200)
 assert.equal(await response.text(),'asset')
})
test('cross-origin host mismatch fails closed',async()=>{
 const response=await handleRequest(new Request('https://evil.example/api/v1/status'),env)
 assert.equal(response.status,503)
})
