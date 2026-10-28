import type { AuditState, AuditReport } from './scanCore.mjs'
export type EvidenceCheck = { id: string; section: string; title: string; status: AuditState; evidence: string; recommendation: string }
export type EvidenceSnapshot = { schemaVersion: 1; repository: { name: string }; recordedAt: string; toolVersion: string; summary: Record<AuditState, number>; checks: EvidenceCheck[] }
export type ChangeKind = 'regression' | 'resolved' | 'new-review' | 'evidence-lost' | 'newly-observed' | 'changed' | 'added' | 'removed' | 'unchanged'
export type ComparisonChange = { id: string; section: string; title: string; kind: ChangeKind; beforeStatus: AuditState | null; afterStatus: AuditState | null; beforeEvidence: string; afterEvidence: string; recommendation: string }
export type EvidenceComparison = { schemaVersion: 1; kind: 'repoverity-evidence-comparison'; repository: string; previousAt: string; currentAt: string; previousSummary: Record<AuditState, number>; currentSummary: Record<AuditState, number>; summary: Record<string, number>; changes: ComparisonChange[]; disclaimer: string }
export const COMPARISON_LIMITS: { readonly jsonCharacters: number; readonly checks: number; readonly field: number }
export function parseEvidenceReport(input: string | object): EvidenceSnapshot
export function compareEvidenceReports(previous: string | EvidenceSnapshot | AuditReport, current: string | EvidenceSnapshot | AuditReport): EvidenceComparison
export function comparisonMarkdown(result: EvidenceComparison): string
export function comparisonOutput(result: EvidenceComparison, format: 'json' | 'markdown'): string
