export type ProjectFactoryRisk = 'R0' | 'R1' | 'R2' | 'R3' | 'R4';
export type ProjectFactoryDisposition = 'REUSE' | 'USE_PROVIDER' | 'ADAPT' | 'BUILD';
export type ProjectFactoryStatus = 'PLANNED' | 'READY' | 'BLOCKED';

export interface ProjectFactoryDiscoveryBudget {
  max_queries: number;
  max_candidates: number;
  max_minutes: number;
}

export interface ProjectFactoryRequest {
  project_id: string;
  factory_run_id: string;
  requested_by: string;
  objective: string;
  requirements: string[];
  constraints: string[];
  risk_level: ProjectFactoryRisk;
  discovery_budget: ProjectFactoryDiscoveryBudget;
  repository?: {
    full_name?: string;
    default_branch?: string;
  };
}

export interface ProjectFactoryResourceDecision {
  capability: string;
  disposition: ProjectFactoryDisposition;
  implementation?: string;
  provider?: string;
  reason: string;
  evidence_ids: string[];
}

export interface ProjectFactoryTaskSeed {
  task_id: string;
  objective: string;
  depends_on: string[];
  acceptance_criteria: string[];
  required_capabilities: string[];
}

export interface ProjectFactoryPlan {
  project_id: string;
  factory_run_id: string;
  status: ProjectFactoryStatus;
  discovery_evidence_ids: string[];
  architecture_decisions: string[];
  resource_decisions: ProjectFactoryResourceDecision[];
  task_graph: ProjectFactoryTaskSeed[];
  completion_gates: string[];
  human_gates: string[];
  blocked_by?: string[];
}
