import { cloudRequest } from './cloudApi'

export type CloudGrowthKind = 'profile' | 'repository'
export type CloudGrowthStatus = 'pending' | 'ok' | 'limited' | 'not_found' | 'error'
export interface CloudGrowthTarget {
  id:string; user_id:number; kind:CloudGrowthKind; resource:string; created_at:number;
  next_due_at:number; last_attempt_at:number|null; last_success_at:number|null;
  last_status:CloudGrowthStatus;
}
export interface CloudGrowthPoint {
  observed_day:string; observed_at:number; followers:number|null; public_repos:number|null;
  stars:number|null; forks:number|null;
}
export interface CloudGrowthMilestone {
  metric:'followers'|'stars'; threshold:number; observed_at:number;
}
export interface CloudGrowthHistory {
  target:CloudGrowthTarget; observations:CloudGrowthPoint[]; milestones:CloudGrowthMilestone[];
}

export const cloudGrowthService = {
  async targets(signal?:AbortSignal):Promise<CloudGrowthTarget[]> {
    const response=await cloudRequest<{targets:CloudGrowthTarget[]}>('/api/v1/growth/targets',{signal})
    return response.targets
  },
  async add(kind:CloudGrowthKind,resource:string):Promise<CloudGrowthTarget> {
    const response=await cloudRequest<{target:CloudGrowthTarget}>('/api/v1/growth/targets',{method:'POST',data:{kind,resource}})
    return response.target
  },
  async remove(id:string):Promise<void> {
    await cloudRequest(`/api/v1/growth/targets/${encodeURIComponent(id)}`,{method:'DELETE'})
  },
  async history(id:string,signal?:AbortSignal):Promise<CloudGrowthHistory> {
    const response=await cloudRequest<{history:CloudGrowthHistory}>(`/api/v1/growth/targets/${encodeURIComponent(id)}/history`,{signal})
    return response.history
  },
  async capture(id:string):Promise<'ok'|'limited'|'not_found'|'error'> {
    const response=await cloudRequest<{outcome:{status:'ok'|'limited'|'not_found'|'error'}}> (
      `/api/v1/growth/targets/${encodeURIComponent(id)}/capture`,{method:'POST'})
    return response.outcome.status
  },
}

export function growthMetric(target:CloudGrowthTarget):'followers'|'stars' {
  return target.kind==='profile'?'followers':'stars'
}
export function growthSummary(history:CloudGrowthHistory):{first:number|null;last:number|null;delta:number|null;observations:number} {
  const metric=growthMetric(history.target)
  const values=history.observations.map(item=>item[metric]).filter((value):value is number=>typeof value==='number'&&Number.isFinite(value))
  return { first:values.at(0)??null,last:values.at(-1)??null,delta:values.length>=2?values[values.length-1]-values[0]:null,observations:values.length }
}
export function growthHistoryCsv(history:CloudGrowthHistory):string {
  const rows=['observed_day,observed_at_utc,followers,public_repos,stars,forks']
  for(const item of history.observations) {
    const cells=[item.observed_day,new Date(item.observed_at*1000).toISOString(),item.followers,item.public_repos,item.stars,item.forks]
    rows.push(cells.map(value=>value===null?'':String(value)).join(','))
  }
  return rows.join('\r\n')+'\r\n'
}
