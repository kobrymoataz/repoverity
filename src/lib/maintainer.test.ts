import { describe, expect, it } from 'vitest'
import { activityDays, filterMaintainerItems, normalizeRepository, queueCsv, queueKey, readLocalQueue, saveLocalQueue, upsertLocalQueue, type MaintainerIssue, type MaintainerQueueRecord } from './maintainer'
const issue:MaintainerIssue={kind:'issue',number:3,title:'Fix login',url:'https://github.com/a/b/issues/3',author:'alice',updated_at:'2026-10-01T00:00:00Z',created_at:'2026-09-01T00:00:00Z',comments:2,labels:['bug'],assignees:[],draft:false}
const queued:MaintainerQueueRecord={repo:'a/b',kind:'issue',number:3,stage:'next',note:'Review tests',updated_at:1790000000}
describe('maintainer planning utilities',()=>{
  it('normalizes only GitHub repository names',()=>{
    expect(normalizeRepository('https://github.com/Owner/Repo/')).toBe('owner/repo')
    expect(normalizeRepository('../escape')).toBeNull()
    expect(normalizeRepository('https://evil.example/owner/repo')).toBeNull()
    expect(normalizeRepository('owner/repo/path')).toBeNull()
  })
  it('filters sampled public issues without mutating',()=>{
    expect(filterMaintainerItems([issue],{query:'FIX BUG'})).toHaveLength(1)
    expect(filterMaintainerItems([issue],{query:'missing'})).toEqual([])
    expect(filterMaintainerItems([issue],{mode:'unassigned'})).toHaveLength(1)
    expect(filterMaintainerItems([issue],{mode:'stale',now:Date.parse('2026-11-10T00:00:00Z')})).toHaveLength(1)
    expect(issue.labels).toEqual(['bug'])
  })
  it('never represents future or invalid dates as stale',()=>{
    expect(activityDays('not-a-date')).toBeNull()
    expect(activityDays('2026-12-01',Date.parse('2026-11-01'))).toBeNull()
  })
  it('maintains distinct PR and issue identifiers',()=>{
    expect(queueKey(queued)).not.toBe(queueKey({...queued,kind:'pull'}))
    expect(upsertLocalQueue([queued],{...queued,note:'Updated'})).toHaveLength(1)
  })
  it('escapes CSV formulas, quotes and notes',()=>{
    const text=queueCsv([{...queued,note:'=HYPERLINK("evil")'}])
    expect(text).toContain("'=HYPERLINK")
    expect(text).toContain('""evil""')
  })
  it('restores valid local records and rejects malformed storage',()=>{
    const memory:{value:string}={value:''}
    const store={getItem:()=>memory.value,setItem:(_key:string,value:string)=>{memory.value=value}}
    saveLocalQueue(store,[queued])
    expect(readLocalQueue(store)).toEqual([queued])
    memory.value='not-json'
    expect(readLocalQueue(store)).toEqual([])
  })
  it('enforces personal worklist limits',()=>{
    expect(()=>saveLocalQueue({setItem:()=>undefined},Array(151).fill(queued))).toThrow()
    expect(()=>upsertLocalQueue(Array.from({length:150},(_,i)=>({...queued,number:i+1})),{...queued,number:151})).toThrow()
  })
})
