import type { BrainRequest, BrainResponse, ReachRequest } from '@nexus-brain/contracts';

export interface BrainApi {
  handle(request: BrainRequest, transportContext?: Record<string, unknown>): Promise<BrainResponse>;
  handleReach(request: ReachRequest, transportContext?: Record<string, unknown>): Promise<BrainResponse>;
}

export interface BrainPrincipal {
  identity: { project_id: string; task_id: string; agent_id: string; session_id?: string };
  capabilities: string[];
}

export interface MaestriReachBudget {
  source: 'maestri';
  decision_id: string;
  identity: BrainPrincipal['identity'];
  capability: 'research' | 'web.search';
  limits: {
    max_queries: number;
    max_providers: number;
    max_results_per_provider: number;
    max_browser_escalations: number;
    max_wall_time_seconds: number;
  };
  max_cost_microusd: number;
}

export function createBrainApi(options: {
  authenticate: (input: { request: BrainRequest | ReachRequest; transport: Record<string, unknown> }) => Promise<BrainPrincipal | null> | BrainPrincipal | null;
  resolveReachBudget?: (input: {
    identity: BrainPrincipal['identity'];
    capability: 'research' | 'web.search';
    request: { input: Record<string, unknown>; data_classification: string };
  }) => Promise<MaestriReachBudget | null> | MaestriReachBudget | null;
  memoryEngine?: Record<string, (...args: never[]) => Promise<unknown>>;
  context?: { build?: (input: Record<string, unknown>) => Promise<Record<string, unknown>> };
  localSearch?: { search?: (input: Record<string, unknown>) => Promise<Record<string, unknown>>; editContext?: (input: Record<string, unknown>) => Promise<Record<string, unknown>> };
  reach?: { research?: (input: ReachRequest) => Promise<Record<string, unknown>>; web?: (input: ReachRequest) => Promise<Record<string, unknown>> };
}): BrainApi;
