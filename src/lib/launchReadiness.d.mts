export type LaunchStatus = 'pass' | 'review' | 'unknown'
export interface LaunchFinding { id: string; title: string; status: LaunchStatus; evidence: string; url?: string }
export interface LaunchTask { id: string; category: string; title: string; detail: string }
export const LAUNCH_VERSION: string
export const STORAGE_KEY: string
export const RELEASE_TASKS: ReadonlyArray<LaunchTask>
export function normalizeChecklist(raw: unknown): Record<string, boolean>
export function summarizeLaunch(findings: ReadonlyArray<LaunchFinding>, checked: Record<string, boolean>): { pass:number; review:number; unknown:number; manualCompleted:number; manualTotal:number; ready:boolean }
export function collectLaunchEvidence(options?: { fetcher?: typeof fetch; signal?: AbortSignal; secureContext?: boolean; localPreview?: boolean; appRoot?: boolean }): Promise<LaunchFinding[]>
export function buildLaunchExport(findings: ReadonlyArray<LaunchFinding>, checked: Record<string, boolean>, timestamp?: string): string
