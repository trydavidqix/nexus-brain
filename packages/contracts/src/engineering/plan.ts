import type { RiskLevel } from '../workforce/types.js';
import type { BudgetLimits } from '../execution/port.js';

export type EngineeringTaskType =
  | 'BUG'
  | 'FEATURE'
  | 'REFACTOR'
  | 'ARCHITECTURE'
  | 'REVIEW'
  | 'AUDIT'
  | 'PROTOTYPE'
  | 'MIGRATION'
  | 'BRANCH_INTEGRATION'
  | 'DEPENDENCY_CHANGE'
  | 'UI'
  | 'COPY'
  | 'TEST_ONLY'
  | 'PERFORMANCE'
  | 'SECURITY_RELATED';

export type EngineeringAutonomyLevel = 'A0' | 'A1' | 'A2' | 'A3' | 'A4';

export interface EngineeringSkillPolicy {
  required: string[];
  optional: string[];
  forbidden: string[];
  loaded: string[];
  completed: string[];
}

/** Task and agent scope are both required; plans cannot be session-wide. */
export interface EngineeringPlan {
  task_id: string;
  agent_id: string;
  task_type: EngineeringTaskType;
  risk_level: RiskLevel;
  scope_size: string;
  expected_files: string[];
  expected_tests: string[];
  contract_impact: string[];
  testability: string;
  execution_mode: 'read_only' | 'write';
  autonomy_level: EngineeringAutonomyLevel;
  skill_policy: EngineeringSkillPolicy;
  context_budget: BudgetLimits;
  tool_profile: string[];
  verification_gates: string[];
  delivery_policy: Record<string, unknown>;
}

export type EngineeringCeremony = 'TINY' | 'LIGHT' | 'NORMAL' | 'HEAVY';
export type EngineeringQualityProfile = 'FAST' | 'STANDARD' | 'DEEP' | 'RELEASE' | 'INCIDENT';

/** Versioned plan contract. V1 remains available for persisted/provider compatibility. */
export interface EngineeringPlanV2 extends EngineeringPlan {
  goal_id: string;
  ceremony: EngineeringCeremony;
  quality_profile: EngineeringQualityProfile;
  /** Opaque profile identifier; Maestri resolves its meaning. */
  model_profile: string;
  stop_conditions: string[];
}
