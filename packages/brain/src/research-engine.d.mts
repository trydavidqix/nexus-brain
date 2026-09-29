import type { ResearchRequest, NexusResearchRun } from '@nexus-brain/contracts';

export interface ResearchEngineRequest extends ResearchRequest {
  data_classification: 'SYNTHETIC' | 'NON_SENSITIVE';
  include_global_reuse?: boolean;
  run_id?: string;
  session_id?: string;
  workspace_binding?: Record<string, unknown>;
}

export interface ResearchEngineResult extends NexusResearchRun {
  abstained: boolean;
  memory: Array<Record<string, unknown>>;
  code: Record<string, unknown>;
  research_evidence: Array<Record<string, unknown>>;
  grounded_findings: Array<{ evidence_id: string; excerpt: string; trust_level: 'UNTRUSTED' }>;
  coverage: Record<string, unknown>;
  persisted_evidence_ids: string[];
}

export interface ResearchEngineOptions {
  memoryEngine: { recall(input: Record<string, unknown>): Promise<Record<string, unknown>> };
  codeIntelligence?: {
    search?(input: Record<string, unknown>): Promise<Record<string, unknown>>;
    searchSymbol?(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  evidenceStore?: {
    searchEvidence?(input: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
    persistEvidence?(input: Record<string, unknown>): Promise<unknown>;
    persistResearchRun?(input: NexusResearchRun): Promise<unknown>;
  };
  reachEngine?: {
    execute(capability: string, input: Record<string, unknown>, policy: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  authorizeReuse?: (input: Record<string, unknown>) => Promise<boolean> | boolean;
  now?: () => Date;
}

export function createResearchEngine(options: ResearchEngineOptions): {
  research(request: ResearchEngineRequest): Promise<ResearchEngineResult>;
};
