import type { NexusLocalWorkspaceBinding } from '@nexus-brain/contracts';
import type { SqliteStateStore } from '@nexus-brain/state';

export type CodeIntelligenceStatus = 'OK' | 'PARTIAL' | 'UNAVAILABLE';
export type CodeIntelligenceSource = 'codebase-memory-mcp' | 'codebase-memory-mcp+direct-source' | 'direct-source' | 'unavailable';

export interface CodeIntelligenceCoverage {
  state: 'unknown' | 'reported';
  complete: false;
}

export interface CodeIntelligenceWarning {
  code: string;
  message: string;
}

export interface CodeIntelligenceRelatedTarget {
  project_id: string;
  source: 'codebase-memory-mcp';
  workspace_commit_before: string | null;
  workspace_commit: string | null;
  /** Populated only when CBM explicitly reports the commit for its target index. */
  index_commit: string | null;
  /** CBM coverage generation, or `unknown` when omitted. */
  index_version: string;
  freshness: 'verified' | 'stale' | 'unverified';
  workspace_stable: boolean;
  evidence_associated: boolean;
  warnings: CodeIntelligenceWarning[];
}

export interface CodeIntelligenceResult<T = unknown> {
  status: CodeIntelligenceStatus;
  project_id: string | null;
  source: CodeIntelligenceSource;
  /** Commit of the registered local workspace when readable; null when Git cannot prove it. */
  workspace_commit?: string | null;
  /** Commit the backend explicitly associated with its result, otherwise null. */
  commit: string | null;
  /** Backend index generation when it reports one; null means unknown. */
  index_version: string | null;
  backend_version?: string | null;
  related_targets?: CodeIntelligenceRelatedTarget[];
  coverage: CodeIntelligenceCoverage;
  confidence: number | null;
  data: T | null;
  warnings: CodeIntelligenceWarning[];
  operation?: string;
}

export interface CodeIntelligenceRequest {
  project_id: string;
  /** Must exactly identify one local binding stored in Project v2. */
  workspace_binding: NexusLocalWorkspaceBinding;
}

export interface CodeIntelligenceWorkspaceTarget {
  project_id: string;
  /** Must exactly identify one registered local binding in the target Project v2. */
  workspace_binding: NexusLocalWorkspaceBinding;
}

export interface CodeIntelligenceIndexRequest extends CodeIntelligenceRequest {
  /** Explicit allowlist of registered target workspaces; the engine accepts at most three. */
  target_projects?: CodeIntelligenceWorkspaceTarget[];
}

export interface CodeIntelligenceSymbolRequest extends CodeIntelligenceRequest {
  name: string;
  kind?: string;
  limit?: number;
}

export interface CodeIntelligenceFunctionRequest extends CodeIntelligenceRequest {
  function_name: string;
  depth?: number;
}

export interface CodeIntelligenceContextRequest extends CodeIntelligenceRequest {
  qualified_name: string;
}

export interface CodeIntelligenceAdapter {
  readonly version?: string;
  index(input: { repoPath: string; projectAlias: string; mode?: string; target_projects?: string[] }): Promise<unknown>;
  invoke(tool: string, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
  health(): Promise<{ ok: boolean; version?: string; message?: string }>;
}

export interface CodeIntelligenceEngineOptions {
  stateStore: Pick<SqliteStateStore, 'getProject'>;
  /** Resolves a registered opaque local binding through an authorized platform capability. */
  resolveWorkspace(input: { project_id: string; binding: NexusLocalWorkspaceBinding }): string | null | Promise<string | null>;
  adapter?: CodeIntelligenceAdapter;
}

export declare class CodeIntelligenceEngine {
  constructor(options: CodeIntelligenceEngineOptions);
  index(request: CodeIntelligenceIndexRequest): Promise<CodeIntelligenceResult>;
  searchSymbol(request: CodeIntelligenceSymbolRequest): Promise<CodeIntelligenceResult>;
  getContext(request: CodeIntelligenceContextRequest): Promise<CodeIntelligenceResult>;
  getCallers(request: CodeIntelligenceFunctionRequest): Promise<CodeIntelligenceResult>;
  getCallees(request: CodeIntelligenceFunctionRequest): Promise<CodeIntelligenceResult>;
  getTests(request: CodeIntelligenceFunctionRequest): Promise<CodeIntelligenceResult>;
  analyzeImpact(request: CodeIntelligenceRequest): Promise<CodeIntelligenceResult>;
  getChanges(request: CodeIntelligenceRequest): Promise<CodeIntelligenceResult>;
  health(request?: { project_id?: string }): Promise<CodeIntelligenceResult>;
}

export declare function createCodeIntelligenceEngine(options: CodeIntelligenceEngineOptions): CodeIntelligenceEngine;
export { CodebaseMemoryAdapter, createCodebaseMemoryAdapter } from './cbm-adapter.js';
