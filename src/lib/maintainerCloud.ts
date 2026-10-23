import { CLOUD_ENABLED, cloudRequest } from './cloudApi'
import type { MaintainerQueueRecord } from './maintainer'

export const maintainerCloudEnabled = CLOUD_ENABLED
export const maintainerCloud = {
  async signedIn(signal?:AbortSignal):Promise<boolean> {
    const result = await cloudRequest<{user:{github_id:number}|null}>('/api/v1/me',{signal})
    return Boolean(result.user?.github_id)
  },
  async queue(repo:string,signal?:AbortSignal):Promise<MaintainerQueueRecord[]> {
    const result=await cloudRequest<{entries:MaintainerQueueRecord[]}>(`/api/v1/maintainer/queue?repo=${encodeURIComponent(repo)}`,{signal})
    return result.entries
  },
  async save(entry:Omit<MaintainerQueueRecord,'updated_at'>):Promise<void> {
    await cloudRequest('/api/v1/maintainer/queue',{method:'POST',data:entry})
  },
  async remove(entry:Pick<MaintainerQueueRecord,'repo'|'kind'|'number'>):Promise<void> {
    await cloudRequest('/api/v1/maintainer/queue',{method:'DELETE',data:entry})
  },
}
