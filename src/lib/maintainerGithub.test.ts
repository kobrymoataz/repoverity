import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadMaintainerContributors, loadMaintainerOverview, loadMaintainerPage, MaintainerApiError } from './maintainerGithub'
const issue=(n:number, pull=false)=>({number:n,title:`Issue ${n}`,html_url:`https://github.com/user/repo/${pull?'pull':'issues'}/${n}`,user:{login:'author'},updated_at:'2026-10-01T00:00:00Z',created_at:'2026-10-01T00:00:00Z',comments:1,labels:[{name:'bug'}],assignees:[],...(pull?{pull_request:{url:'https://api.github.com/pr'}}:{})})
afterEach(()=>vi.unstubAllGlobals())
describe('bounded read-only GitHub maintainer API',()=>{
  it('filters PRs out of the issue endpoint',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify([issue(1),issue(2,true)]))))
    const page=await loadMaintainerPage('user/repo','issue',1)
    expect(page.items.map(x=>x.number)).toEqual([1])
    expect(page.hasMore).toBe(false)
  })
  it('keeps pagination bounded and separate',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify(Array.from({length:40},(_,i)=>issue(i+1,true))))))
    expect((await loadMaintainerPage('user/repo','pull',1)).hasMore).toBe(true)
    await expect(loadMaintainerPage('user/repo','pull',4)).rejects.toMatchObject({status:400})
  })
  it('does not convert failed endpoints into invented zero counts',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}',{status:429})))
    const result=await loadMaintainerOverview('user/repo')
    expect(result.issues).toBeNull()
    expect(result.pulls).toBeNull()
    expect(result.contributors).toBeNull()
    expect(result.errors.issues).toMatch(/rate limit/)
  })
  it('rejects malformed response bodies',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}',{status:200})))
    await expect(loadMaintainerContributors('user/repo')).rejects.toBeInstanceOf(MaintainerApiError)
  })
})
