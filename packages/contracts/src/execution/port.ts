export type ExecutionRiskLevel = 'low' | 'medium' | 'high' | 'critical';
import type { ContextPacket } from '../context/packet.js';
export type { ContextPacket } from '../context/packet.js';

import type { RiskLevel } from '../workforce/types.js';
import type { EngineeringPlan, EngineeringPlanV2 } from '../engineering/plan.js';
import type { TaskSkillSet } from '../skills.js';

export function executionRiskFromPlanRisk(risk: RiskLevel): ExecutionRiskLevel {
  if (risk === 'R0' || risk === 'R1') return 'low';
  if (risk === 'R2') return 'medium';
  if (risk === 'R3') return 'high';
  return 'critical';
}

export function planRiskFromExecutionRisk(risk: ExecutionRiskLevel): RiskLevel {
  if (risk === 'low') return 'R1';
  if (risk === 'medium') return 'R2';
  if (risk === 'high') return 'R3';
  return 'R4';
}

export interface CapabilitySnapshot {
  provider: string;
  model?: string;
  capabilities: string[];
  supports_tools?: boolean;
  supports_vision?: boolean;
  supports_browser?: boolean;
  max_context_tokens?: number;
  health: 'healthy' | 'degraded' | 'unavailable';
  observed_at: string;
}

export interface BudgetLimits {
  input_tokens?: number;
  output_tokens?: number;
  context_percent?: number;
  definitions?: number;
  calls?: number;
  seconds?: number;
  cost_usd?: number;
}

export interface TaskContract {
  task_id: string;
  goal: string;
  scope: string;
  allowed_paths: string[];
  execution_mode?: 'read_only' | 'write';
  constraints: string[];
  capabilities: string[];
  risk: ExecutionRiskLevel;
  base_sha: string;
  context_budget: BudgetLimits;
  tool_budget: BudgetLimits;
  execution_budget: BudgetLimits;
  preferred_provider?: string;
  preferred_model?: string;
  evidence_required: string[];
  acceptance_criteria?: string[];
  context_packet?: ContextPacket;
}

export interface LoadedEngineeringSkill {
  skill_id: string;
  version: string;
  body: string;
}

/** Already-resolved task/agent context passed through the provider boundary. */
export interface ProviderEngineeringContext {
  engineering_plan: EngineeringPlan | EngineeringPlanV2;
  task_skill_set: TaskSkillSet;
  tool_profile: string[];
  loaded_skills: LoadedEngineeringSkill[];
}

export type ExecutionStatus = 'success' | 'failure' | 'partial' | 'blocked' | 'waiting_for_approval' | 'unavailable' | 'cancelled';

export interface TestResult {
  name?: string;
  passed: boolean;
  report: string;
  source?: string;
}

export interface ExecutionError {
  code: string;
  message: string;
  retryable?: boolean;
}

export interface ExecutionResult {
  task_id: string;
  execution_id?: string;
  provider?: string;
  model?: string;
  status: ExecutionStatus;
  summary: string;
  files_changed: string[];
  commands: string[];
  tests: TestResult[];
  evidence: string[];
  artifacts?: string[];
  logs?: string[];
  risks?: string[];
  attempts?: number;
  usage?: UsageSnapshot;
  context_used?: BudgetLimits;
  error?: ExecutionError;
}

export interface QuotaSnapshot {
  provider: string;
  model?: string;
  tokens_used: number;
  cost_usd: number;
  available?: boolean;
  remaining_budget?: number;
  remaining_percent?: number;
  health?: 'healthy' | 'degraded' | 'unavailable';
  observed_at?: string;
}

export interface UsageSnapshot {
  input_tokens: number;
  cached_tokens: number;
  output_tokens: number;
  duration_ms: number;
  cost_usd: number | null;
  reasoning_tokens?: number;
  measurement_type?: 'exact' | 'estimated' | 'unavailable';
  cost_measurement_type?: 'exact' | 'estimated' | 'unavailable';
  /** Provider-reported compatibility field; prefer cached_tokens. */
  cached_input_tokens?: number;
}

export interface HealthSnapshot {
  ok: boolean;
  status: 'healthy' | 'degraded' | 'unavailable';
  message?: string;
}

export interface ExecutionPort {
  execute(contract: TaskContract, engineeringContext?: ProviderEngineeringContext): Promise<ExecutionResult>;
  resume(taskId: string): Promise<ExecutionResult>;
  cancel(taskId: string): Promise<ExecutionResult>;
  health(): Promise<HealthSnapshot>;
  capabilities(): Promise<string[]>;
  usage(): Promise<UsageSnapshot>;
  quota(): Promise<QuotaSnapshot>;
  /** @deprecated use quota() */
  checkQuota(): Promise<QuotaSnapshot>;
  name: string;
}

export function unavailableResult(taskId: string, provider: string, message = `${provider} adapter is not configured`): ExecutionResult {
  return {
    task_id: taskId,
    status: 'unavailable',
    summary: message,
    files_changed: [],
    commands: [],
    tests: [],
    evidence: [],
    error: { code: 'provider_unavailable', message, retryable: false },
  };
}

export function cancelledResult(taskId: string, provider: string): ExecutionResult {
  return {
    task_id: taskId,
    status: 'cancelled',
    summary: `${provider} task cancelled before execution`,
    files_changed: [],
    commands: [],
    tests: [],
    evidence: [],
  };
}

export function unavailableQuota(provider: string): QuotaSnapshot {
  return { provider, tokens_used: 0, cost_usd: 0, available: false };
}
