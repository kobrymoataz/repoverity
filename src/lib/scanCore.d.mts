export const REPORT_VERSION: string
export const REPORT_LIMITS: { readonly requests: number; readonly workflows: number; readonly runs: number; readonly timeoutMs: number }
export class ScanError extends Error { status: number; constructor(message: string, status?: number) }
export type AuditState = 'pass' | 'review' | 'unknown' | 'info'
export type AuditCheck = { id: string; section: string; title: string; status: AuditState; evidence: string; recommendation: string; url: string | null }
export type AuditReport = {
  schemaVersion: number; toolVersion: string; recordedAt: string;
  repository: { name: string; url: string; description: string; defaultBranch: string; stars: number; forks: number; archived: boolean };
  requestCount: number; sampleLimits: { workflows: number; runs: number };
  summary: Record<AuditState, number>; checks: AuditCheck[]; disclaimer: string;
}
export function normalizeRepository(value: unknown): string | null
export function scanRepository(input: string, options?: { fetcher?: typeof fetch; token?: string; signal?: AbortSignal; timeoutMs?: number; includeRuns?: boolean; now?: number | string }): Promise<AuditReport>
export function reportMarkdown(report: AuditReport): string
export function reportCsv(report: AuditReport): string
export function reportHtml(report: AuditReport): string
export function reportOutput(report: AuditReport, format: 'json' | 'markdown' | 'csv' | 'html'): string
export const EXTENSIONS: { readonly json: 'json'; readonly markdown: 'md'; readonly csv: 'csv'; readonly html: 'html' }
