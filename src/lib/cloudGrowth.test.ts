import { describe, it, expect } from 'vitest'
import { growthMetric, growthSummary, growthHistoryCsv, type CloudGrowthHistory } from './cloudGrowth'

const profile:CloudGrowthHistory={
  target:{id:'one',user_id:1,kind:'profile',resource:'octocat',created_at:0,next_due_at:0,last_attempt_at:null,last_success_at:null,last_status:'ok'},
  observations:[
    {observed_day:'2026-10-21',observed_at:1792540800,followers:12,public_repos:5,stars:null,forks:null},
    {observed_day:'2026-10-22',observed_at:1792627200,followers:20,public_repos:6,stars:null,forks:null},
  ],milestones:[],
}
describe('cloud growth reporting',()=>{
  it('calculates actual observed deltas rather than backfilling',()=>{
    expect(growthMetric(profile.target)).toBe('followers')
    expect(growthSummary(profile)).toEqual({first:12,last:20,delta:8,observations:2})
    expect(growthSummary({...profile,observations:profile.observations.slice(0,1)}).delta).toBe(null)
  })
  it('does not turn missing values into zero',()=>{
    expect(growthSummary({...profile,observations:[]}).last).toBe(null)
    expect(growthSummary({...profile,observations:[]}).delta).toBe(null)
  })
  it('uses repository stars, not profile followers',()=>{
    const repo={...profile,target:{...profile.target,kind:'repository' as const},observations:profile.observations.map(x=>({...x,stars:10,followers:null}))}
    expect(growthMetric(repo.target)).toBe('stars')
    expect(growthSummary(repo).delta).toBe(0)
  })
  it('exports only measured UTC rows',()=>{
    const csv=growthHistoryCsv(profile)
    expect(csv).toContain('observed_day,observed_at_utc')
    expect(csv.split('\r\n').length).toBe(4)
    expect(csv).not.toContain('octocat')
  })
})
