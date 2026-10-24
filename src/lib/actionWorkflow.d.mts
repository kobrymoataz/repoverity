export const STABLE_ACTION_REF: 'v1.9.0'
export const UPCOMING_ACTION_REF: 'v2.1.0'
export type ActionWorkflowTrigger = 'manual' | 'main-push'
export type ActionWorkflowOptions = {
  repository?: string
  ref?: string
  trigger?: ActionWorkflowTrigger
  includeRuns?: boolean
  failOnReview?: boolean
  uploadArtifact?: boolean
}
export function normalizeActionRepository(value: unknown): string | null
export function normalizeActionRef(value: unknown): string | null
export function createActionWorkflow(settings?: ActionWorkflowOptions): string
