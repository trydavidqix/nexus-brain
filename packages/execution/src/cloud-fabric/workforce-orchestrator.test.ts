import { describe, expect, it } from 'vitest';
import { createMasterPlan } from './master-plan.js';
import { ResourceRouter } from './resource-router.js';
import { ModelRegistry } from './model-registry.js';
import { WorkforceOrchestrator } from './workforce-orchestrator.js';
import { InMemoryWorkforcePersistence } from './durable-stores.js';
import { IdempotencyStore } from './idempotency.js';
import type { ExecutionLoopResult } from './execution-loop.js';
import type { ExecutionPort, ExecutionResult, TaskContract } from './execution-port.js';
import type { ProviderEngineeringContext } from './execution-port.js';
import { createSkillRegistry } from '@nexus-brain/control-plane/skills/registry';
import type { EngineeringOrchestrationRequest, EngineeringOrchestratorDependencies } from '@nexus-brain/control-plane/engineering';
import type { MasterPlanTask } from './workforce-types.js';
import type { EngineeringPlanV2, MaestriDecisionInput, NexusEngineeringProjectPolicy, NexusIdentity, NexusTask } from '@nexus-brain/contracts';
import type { WorkforceEngineeringAuthorization } from './workforce-orchestrator.js';

function executionPort(name: string, status: ExecutionResult['status'], received: TaskContract[], contexts: ProviderEngineeringContext[] = []): ExecutionPort {
  return {
    name,
    async execute(contract, context) {
      received.push(contract);
      if (context) contexts.push(context);
      return { task_id: contract.task_id, provider: name, model: contract.preferred_model, status, summary: 'verified', files_changed: status === 'success' ? ['packages/core/file.ts'] : [], commands: [], tests: [{ name: 'unit', passed: true, report: '1 passed' }], evidence: ['artifact://test-report'], usage: { input_tokens: 12, cached_tokens: 3, output_tokens: 4, duration_ms: 20, cost_usd: 0, measurement_type: 'unavailable' } };
    },
    async resume() { throw new Error('not used'); },
    async cancel() { throw new Error('not used'); },
    async health() { return { ok: true, status: 'healthy' }; },
    async capabilities() { return ['execute', 'read_only']; },
    async usage() { return { input_tokens: 0, cached_tokens: 0, output_tokens: 0, duration_ms: 0, cost_usd: 0 }; },
    async quota() { return { provider: name, tokens_used: 0, cost_usd: 0, remaining_budget: 100, remaining_percent: 80, available: true }; },
    async checkQuota() { return this.quota(); },
  };
}

function engineeringAuthorization(task: MasterPlanTask, modelProfile = 'codex-coding', options: { projectPolicy?: NexusEngineeringProjectPolicy; decisionPolicy?: MaestriDecisionInput['policy']; decisionExact?: boolean; agentId?: string; taskType?: EngineeringPlanV2['task_type']; goalRisk?: MasterPlanTask['risk'] } = {}): Omit<EngineeringOrchestrationRequest, 'task'> & { orchestration: EngineeringOrchestratorDependencies; task: NexusTask } {
  const projectId = 'project-workforce';
  const agentId = options.agentId ?? 'agent-workforce';
  const identity: NexusIdentity = { project_id: projectId, task_id: task.task_id, agent_id: agentId };
  const skillRegistry = createSkillRegistry({ entries: [], readSkillBody: () => '', recordEvent: () => undefined });
  const orchestration = {
    stateStore: {
      getProject: (project_id: string) => project_id === projectId ? {
        project: {
          project_id: projectId,
          repo: 'opaque:workforce',
          default_branch: 'main',
          workspace_policy: {},
          lifecycle: 'registered',
          stack: [],
          permissions: {},
          policies: { engineering: options.projectPolicy ?? { denied: false, approval_required: false, retry_allowed: true } },
          approvals: {},
          budgets: {},
          memory_namespace: `project:${projectId}`,
          task_scope: `task:${projectId}`,
          session_scope: `session:${projectId}`,
          evidence_scope: `evidence:${projectId}`,
          git_bindings: [],
          ci_bindings: [],
          deployment_bindings: [],
          provider_constraints: [],
        },
        version: 1,
      } : null,
      getGoal: (project_id: string, goal_id: string) => project_id === projectId && goal_id === 'goal-workforce' ? {
        goal: {
          goal_id,
          project_id: projectId,
          objective: 'Complete authorized engineering task',
          scope: ['packages/core'],
          out_of_scope: [],
          requirements: [],
          constraints: [],
          assumptions: [],
          acceptance_criteria: ['Task evidence passes'],
          risk: options.goalRisk ?? task.risk,
          required_gates: [],
          definition_of_done: ['Task evidence passes'],
        },
        version: 1,
      } : null,
    },
    skillRegistry,
  };
  return {
    orchestration,
    identity,
    principal: { identity, capabilities: ['engineering.execute', ...(task.capabilities ?? [])] },
    task: {
      ...identity,
      objective: task.objective,
      risk: task.risk,
      complexity: task.complexity,
      acceptance_criteria: task.acceptance_criteria,
      capabilities: task.capabilities,
      allowed_paths: task.allowed_paths,
      read_only: task.read_only,
    },
    goal_id: 'goal-workforce',
    plan_fields: {
      task_type: options.taskType ?? 'BUG',
      risk_level: task.risk,
      ceremony: 'LIGHT' as const,
      scope_size: task.objective,
      expected_files: task.allowed_paths ?? [],
      expected_tests: ['packages/core/task.test.ts'],
      contract_impact: [],
      testability: 'unit tested',
      execution_mode: task.read_only ? 'read_only' as const : 'write' as const,
      autonomy_level: 'A1' as const,
      quality_profile: 'STANDARD' as const,
      model_profile: modelProfile,
      stop_conditions: ['Stop when required evidence is present'],
      skill_policy: { required: [], optional: [], forbidden: [] },
      context_budget: { input_tokens: 800 },
      tool_profile: ['git.read', 'file.edit'],
      verification_gates: ['unit'],
      delivery_policy: {},
    },
    decision_input: {
      ...identity,
      decision_id: `decision-${task.task_id}`,
      proposed_route: 'execute',
      risk: task.risk,
      priority: 1,
      policy: options.decisionPolicy ?? { denied: false, approval_required: false, retry_allowed: true },
      signals: { exact: options.decisionExact ?? true },
      evidence_refs: [`evidence-${task.task_id}`],
    },
  };
}

function workforceEngineering(task: MasterPlanTask, options?: Parameters<typeof engineeringAuthorization>[2] & { modelProfile?: string; reviewModelProfile?: string }, reviewTask?: MasterPlanTask): WorkforceEngineeringAuthorization {
  const authorization = engineeringAuthorization(task, options?.modelProfile ?? 'codex-coding', options);
  const reviewAuthorization = reviewTask
    ? engineeringAuthorization(reviewTask, options?.reviewModelProfile ?? 'claude-review', { taskType: 'REVIEW', agentId: 'agent-review' })
    : undefined;
  return {
    orchestration: authorization.orchestration,
    tasks: { [task.task_id]: {
      identity: authorization.identity,
      principal: authorization.principal,
      goal_id: authorization.goal_id,
      plan_fields: authorization.plan_fields,
      decision_input: authorization.decision_input,
    } },
    ...(reviewAuthorization ? { review_tasks: { [task.task_id]: {
      identity: reviewAuthorization.identity,
      principal: reviewAuthorization.principal,
      task: reviewAuthorization.task,
      goal_id: reviewAuthorization.goal_id,
      plan_fields: reviewAuthorization.plan_fields,
      decision_input: reviewAuthorization.decision_input,
    } } } : {}),
  };
}

describe('WorkforceOrchestrator provider routing integration', () => {
  it('fails closed without Maestri EngineeringPlan context before provider dispatch', async () => {
    const calls: TaskContract[] = [];
    const codex = executionPort('codex', 'success', calls);
    const router = new ResourceRouter({ codex, modelRegistry: new ModelRegistry([
      { id: 'codex-coding', provider: 'codex', model: 'configured-codex-model', tier: 2, capabilities: ['coding'], preferred_for: ['coding'], max_risk: 'R4', max_complexity: 'EXCLUSIVE', subscription_backed: true, gateway_backed: false, enabled: true, relative_cost: 2, relative_latency: 2, reliability: 0.95 },
    ]) });
    const plan = createMasterPlan({ objective: 'Require Maestri context', tasks: [{ task_id: 'task-1', objective: 'Implement within scope', capabilities: ['coding'], allowed_paths: ['packages/core'], risk: 'R1', acceptance_criteria: ['unit passes'] }] });

    const result = await new WorkforceOrchestrator(router, { resolve: () => codex }).runPlan(plan, 'base-sha');

    expect(result.blocked).toEqual(['task-1']);
    expect(result.results[0]?.reason).toBe('engineering_plan_required');
    expect(calls).toHaveLength(0);
  });

  it('does not dispatch when the Maestri decision is blocked', async () => {
    const calls: TaskContract[] = [];
    const codex = executionPort('codex', 'success', calls);
    const router = new ResourceRouter({ codex, modelRegistry: new ModelRegistry([
      { id: 'codex-coding', provider: 'codex', model: 'configured-codex-model', tier: 2, capabilities: ['coding'], preferred_for: ['coding'], max_risk: 'R4', max_complexity: 'EXCLUSIVE', subscription_backed: true, gateway_backed: false, enabled: true, relative_cost: 2, relative_latency: 2, reliability: 0.95 },
    ]) });
    const plan = createMasterPlan({ objective: 'Respect Maestri policy', tasks: [{ task_id: 'task-denied', objective: 'Implement within scope', capabilities: ['coding'], allowed_paths: ['packages/core'], risk: 'R1', acceptance_criteria: ['unit passes'] }] });
    const engineering = workforceEngineering(plan.tasks[0]!, { decisionPolicy: { denied: true, approval_required: false, retry_allowed: false } });

    const result = await new WorkforceOrchestrator(router, { resolve: () => codex }).runPlan(plan, 'base-sha', engineering);

    expect(result.blocked).toEqual(['task-denied']);
    expect(result.results[0]?.reason).toBe('maestri_decision_blocked');
    expect(calls).toHaveLength(0);
  });

  it('blocks Maestri fallback when Project has no configured profile', async () => {
    const calls: TaskContract[] = [];
    const codex = executionPort('codex', 'success', calls);
    const router = new ResourceRouter({ codex, modelRegistry: new ModelRegistry([
      { id: 'codex-coding', provider: 'codex', model: 'configured-codex-model', tier: 2, capabilities: ['coding'], preferred_for: ['coding'], max_risk: 'R4', max_complexity: 'EXCLUSIVE', subscription_backed: true, gateway_backed: false, enabled: true, relative_cost: 2, relative_latency: 2, reliability: 0.95 },
    ]) });
    const plan = createMasterPlan({ objective: 'Require configured fallback', tasks: [{ task_id: 'task-no-fallback', objective: 'Implement within scope', capabilities: ['coding'], allowed_paths: ['packages/core'], risk: 'R1', acceptance_criteria: ['unit passes'] }] });

    const result = await new WorkforceOrchestrator(router, { resolve: () => codex }).runPlan(plan, 'base-sha', workforceEngineering(plan.tasks[0]!, { decisionExact: false }));

    expect(result.blocked).toEqual(['task-no-fallback']);
    expect(result.results[0]?.reason).toBe('maestri_decision_blocked');
    expect(calls).toHaveLength(0);
  });

  it('blocks an unregistered exact fallback profile without resolving or dispatching a provider', async () => {
    const calls: TaskContract[] = [];
    const codex = executionPort('codex', 'success', calls);
    const resolved: string[] = [];
    const router = new ResourceRouter({ codex, modelRegistry: new ModelRegistry([
      { id: 'codex-coding', provider: 'codex', model: 'configured-codex-model', tier: 2, capabilities: ['coding'], preferred_for: ['coding'], max_risk: 'R4', max_complexity: 'EXCLUSIVE', subscription_backed: true, gateway_backed: false, enabled: true, relative_cost: 2, relative_latency: 2, reliability: 0.95 },
    ]) });
    const plan = createMasterPlan({ objective: 'Require exact fallback profile', tasks: [{ task_id: 'task-invalid-fallback', objective: 'Implement within scope', capabilities: ['coding'], allowed_paths: ['packages/core'], risk: 'R1', acceptance_criteria: ['unit passes'] }] });
    const engineering = workforceEngineering(plan.tasks[0]!, { decisionExact: false, projectPolicy: { denied: false, approval_required: false, retry_allowed: true, fallback_model_profile: 'unknown-profile' } });

    const result = await new WorkforceOrchestrator(router, { resolve: provider => { resolved.push(provider); return codex; } }).runPlan(plan, 'base-sha', engineering);

    expect(result.blocked).toEqual(['task-invalid-fallback']);
    expect(result.results[0]?.reason).toBe('required_model_profile_unavailable');
    expect(result.results[0]?.fallback).toMatchObject({ used: false, status: 'blocked', model_profile: 'unknown-profile' });
    expect(resolved).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('blocks the exact fallback profile when its provider quota is unavailable', async () => {
    const calls: TaskContract[] = [];
    const codex = executionPort('codex', 'success', calls);
    const unavailableCodex: ExecutionPort = {
      ...codex,
      async quota() { return { provider: 'codex', tokens_used: 100, cost_usd: 1, remaining_budget: 0, remaining_percent: 0, available: false }; },
    };
    const resolved: string[] = [];
    const router = new ResourceRouter({ codex: unavailableCodex, modelRegistry: new ModelRegistry([
      { id: 'codex-strong-approved', provider: 'codex', model: 'configured-strong-model', tier: 3, capabilities: ['coding'], preferred_for: ['coding'], max_risk: 'R4', max_complexity: 'EXCLUSIVE', subscription_backed: true, gateway_backed: false, enabled: true, relative_cost: 3, relative_latency: 3, reliability: 0.99 },
    ]) });
    const plan = createMasterPlan({ objective: 'Require quota for fallback', tasks: [{ task_id: 'task-fallback-quota', objective: 'Implement within scope', capabilities: ['coding'], allowed_paths: ['packages/core'], risk: 'R1', acceptance_criteria: ['unit passes'] }] });
    const engineering = workforceEngineering(plan.tasks[0]!, { decisionExact: false, projectPolicy: { denied: false, approval_required: false, retry_allowed: true, fallback_model_profile: 'codex-strong-approved' } });

    const result = await new WorkforceOrchestrator(router, { resolve: provider => { resolved.push(provider); return unavailableCodex; } })
      .runPlan(plan, 'base-sha', engineering);

    expect(result.blocked).toEqual(['task-fallback-quota']);
    expect(result.results[0]?.reason).toBe('required_model_profile_unavailable');
    expect(result.results[0]?.fallback).toMatchObject({ used: false, status: 'blocked', model_profile: 'codex-strong-approved' });
    expect(resolved).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('uses one exact configured fallback attempt and records Maestri evidence', async () => {
    const calls: TaskContract[] = [];
    const codex = executionPort('codex', 'failure', calls);
    const router = new ResourceRouter({ codex, modelRegistry: new ModelRegistry([
      { id: 'codex-coding', provider: 'codex', model: 'configured-codex-model', tier: 2, capabilities: ['coding'], preferred_for: ['coding'], max_risk: 'R4', max_complexity: 'EXCLUSIVE', subscription_backed: true, gateway_backed: false, enabled: true, relative_cost: 2, relative_latency: 2, reliability: 0.95 },
      { id: 'codex-strong-approved', provider: 'codex', model: 'configured-strong-model', tier: 3, capabilities: ['coding'], preferred_for: ['coding'], max_risk: 'R4', max_complexity: 'EXCLUSIVE', subscription_backed: true, gateway_backed: false, enabled: true, relative_cost: 3, relative_latency: 3, reliability: 0.99 },
      { id: 'codex-strong-other', provider: 'codex', model: 'configured-other-strong-model', tier: 3, capabilities: ['coding'], preferred_for: ['coding'], max_risk: 'R4', max_complexity: 'EXCLUSIVE', subscription_backed: true, gateway_backed: false, enabled: true, relative_cost: 4, relative_latency: 4, reliability: 0.99 },
    ]) });
    const persistence = new InMemoryWorkforcePersistence();
    const idempotency = new IdempotencyStore<ExecutionLoopResult>();
    const plan = createMasterPlan({ objective: 'Bound approved fallback', tasks: [{ task_id: 'task-fallback', objective: 'Implement within scope', capabilities: ['coding'], allowed_paths: ['packages/core'], risk: 'R1', acceptance_criteria: ['unit passes'] }] });
    const engineering = workforceEngineering(plan.tasks[0]!, { decisionExact: false, projectPolicy: { denied: false, approval_required: false, retry_allowed: true, fallback_model_profile: 'codex-strong-approved' } });

    const result = await new WorkforceOrchestrator(router, { resolve: () => codex }, undefined, persistence, idempotency).runPlan(plan, 'base-sha', engineering);

    expect(result.failed).toEqual(['task-fallback']);
    expect(calls).toHaveLength(1);
    expect(result.results[0]?.contract.preferred_model).toBe('configured-strong-model');
    expect(result.results[0]?.fallback).toMatchObject({
      used: true,
      status: 'dispatched',
      model_profile: 'codex-strong-approved',
      decision_id: 'decision-task-fallback',
      reason_codes: ['classifier_threshold_unavailable'],
    });
    expect(persistence.routingTraces[0]?.execution_target?.reason).toContain('maestri_fallback_authorized:codex-strong-approved:decision-task-fallback:classifier_threshold_unavailable');

    const cachedResult = await new WorkforceOrchestrator(router, { resolve: () => codex }, undefined, undefined, idempotency)
      .runPlan(plan, 'base-sha', engineering);
    expect(calls).toHaveLength(1);
    expect(cachedResult.failed).toEqual(['task-fallback']);
    expect(cachedResult.results[0]?.fallback).toMatchObject({ used: false, status: 'cached', model_profile: 'codex-strong-approved' });

    const otherProfileAuth = workforceEngineering(plan.tasks[0]!, { decisionExact: false, projectPolicy: { denied: false, approval_required: false, retry_allowed: true, fallback_model_profile: 'codex-strong-other' } });
    const otherProfileResult = await new WorkforceOrchestrator(router, { resolve: () => codex }, undefined, undefined, idempotency)
      .runPlan(plan, 'base-sha', otherProfileAuth);
    expect(calls).toHaveLength(2);
    expect(otherProfileResult.failed).toEqual(['task-fallback']);
    expect(otherProfileResult.results[0]?.contract.preferred_model).toBe('configured-other-strong-model');
    expect(otherProfileResult.results[0]?.fallback).toMatchObject({ used: true, status: 'dispatched', model_profile: 'codex-strong-other' });
  });

  it('blocks an unregistered exact model profile before provider resolution or dispatch', async () => {
    const calls: TaskContract[] = [];
    const codex = executionPort('codex', 'success', calls);
    const resolved: string[] = [];
    const router = new ResourceRouter({ codex, modelRegistry: new ModelRegistry([
      { id: 'codex-coding', provider: 'codex', model: 'configured-codex-model', tier: 2, capabilities: ['coding'], preferred_for: ['coding'], max_risk: 'R4', max_complexity: 'EXCLUSIVE', subscription_backed: true, gateway_backed: false, enabled: true, relative_cost: 2, relative_latency: 2, reliability: 0.95 },
    ]) });
    const plan = createMasterPlan({ objective: 'Require exact profile', tasks: [{ task_id: 'task-profile-missing', objective: 'Implement within scope', capabilities: ['coding'], allowed_paths: ['packages/core'], risk: 'R1', acceptance_criteria: ['unit passes'] }] });

    const result = await new WorkforceOrchestrator(router, { resolve: provider => { resolved.push(provider); return codex; } })
      .runPlan(plan, 'base-sha', workforceEngineering(plan.tasks[0]!, { modelProfile: 'missing-profile' }));

    expect(result.blocked).toEqual(['task-profile-missing']);
    expect(result.results[0]?.reason).toBe('required_model_profile_unavailable');
    expect(resolved).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('requires a separate Maestri review plan before dispatch when the decision requires review', async () => {
    const calls: TaskContract[] = [];
    const codex = executionPort('codex', 'success', calls);
    const router = new ResourceRouter({ codex, modelRegistry: new ModelRegistry([
      { id: 'codex-coding', provider: 'codex', model: 'configured-codex-model', tier: 2, capabilities: ['coding'], preferred_for: ['coding'], max_risk: 'R4', max_complexity: 'EXCLUSIVE', subscription_backed: true, gateway_backed: false, enabled: true, relative_cost: 2, relative_latency: 2, reliability: 0.95 },
    ]) });
    const plan = createMasterPlan({ objective: 'Require review authorization', tasks: [{ task_id: 'task-review-required', objective: 'Implement within scope', capabilities: ['coding'], allowed_paths: ['packages/core'], risk: 'R2', acceptance_criteria: ['unit passes'] }] });

    const result = await new WorkforceOrchestrator(router, { resolve: () => codex }).runPlan(plan, 'base-sha', workforceEngineering(plan.tasks[0]!));

    expect(result.blocked).toEqual(['task-review-required']);
    expect(result.results[0]?.reason).toBe('review_engineering_plan_required');
    expect(calls).toHaveLength(0);
  });

  it('blocks before implementation when Maestri review profile is unavailable', async () => {
    const calls: TaskContract[] = [];
    const codex = executionPort('codex', 'success', calls);
    const router = new ResourceRouter({ codex, modelRegistry: new ModelRegistry([
      { id: 'codex-coding', provider: 'codex', model: 'configured-codex-model', tier: 2, capabilities: ['coding'], preferred_for: ['coding'], max_risk: 'R4', max_complexity: 'EXCLUSIVE', subscription_backed: true, gateway_backed: false, enabled: true, relative_cost: 2, relative_latency: 2, reliability: 0.95 },
    ]) });
    const plan = createMasterPlan({ objective: 'Require available review profile', tasks: [{ task_id: 'task-review-profile', objective: 'Implement within scope', capabilities: ['coding'], allowed_paths: ['packages/core'], risk: 'R2', acceptance_criteria: ['unit passes'] }] });
    const reviewTask: MasterPlanTask = { task_id: 'task-review-profile:review', objective: 'Review the completed implementation', capabilities: ['review'], allowed_paths: ['packages/core'], risk: 'R2', complexity: 'LIGHT', acceptance_criteria: ['Review evidence is recorded'] };

    const result = await new WorkforceOrchestrator(router, { resolve: () => codex })
      .runPlan(plan, 'base-sha', workforceEngineering(plan.tasks[0]!, { reviewModelProfile: 'missing-review-profile' }, reviewTask));

    expect(result.blocked).toEqual(['task-review-profile']);
    expect(result.results[0]?.reason).toBe('required_review_model_profile_unavailable');
    expect(calls).toHaveLength(0);
  });

  it('passes the selected model, enforces scope and persists distinct independent review evidence', async () => {
    const implementerCalls: TaskContract[] = [];
    const implementerContexts: ProviderEngineeringContext[] = [];
    const reviewerCalls: TaskContract[] = [];
    const reviewerContexts: ProviderEngineeringContext[] = [];
    const codex = executionPort('codex', 'success', implementerCalls, implementerContexts);
    const claude = executionPort('claude', 'success', reviewerCalls, reviewerContexts);
    const router = new ResourceRouter({ codex, claude, modelRegistry: new ModelRegistry([
      { id: 'codex-coding', provider: 'codex', model: 'configured-codex-model', tier: 2, capabilities: ['coding'], preferred_for: ['coding'], max_risk: 'R4', max_complexity: 'EXCLUSIVE', subscription_backed: true, gateway_backed: false, enabled: true, relative_cost: 2, relative_latency: 2, reliability: 0.95 },
      { id: 'claude-review', provider: 'claude', model: 'configured-review-model', tier: 1, capabilities: ['review'], preferred_for: ['review'], max_risk: 'R4', max_complexity: 'EXCLUSIVE', subscription_backed: true, gateway_backed: false, enabled: true, relative_cost: 2, relative_latency: 2, reliability: 0.95 },
    ]) });
    const persistence = new InMemoryWorkforcePersistence();
    const plan = createMasterPlan({ objective: 'Exercise provider selection', tasks: [{ task_id: 'task-1', objective: 'Implement within scope', capabilities: ['coding'], allowed_paths: ['packages/core'], risk: 'R2', acceptance_criteria: ['unit passes'] }] });
    const reviewTask: MasterPlanTask = { task_id: 'task-1:review', objective: 'Review the completed implementation', capabilities: ['review'], allowed_paths: ['packages/core'], risk: 'R2', complexity: 'LIGHT', acceptance_criteria: ['Review evidence is recorded'] };
    const engineering = workforceEngineering(plan.tasks[0]!, undefined, reviewTask);

    const result = await new WorkforceOrchestrator(router, { resolve: provider => provider === 'codex' ? codex : provider === 'claude' ? claude : undefined }, undefined, persistence).runPlan(plan, 'base-sha', engineering);

    expect(result.completed).toEqual(['task-1']);
    expect(implementerCalls[0]?.preferred_provider).toBe('codex');
    expect(implementerCalls[0]?.preferred_model).toBe('configured-codex-model');
    expect(implementerContexts[0]?.engineering_plan).toHaveProperty('model_profile', 'codex-coding');
    expect(implementerContexts[0]?.engineering_plan.task_id).toBe('task-1');
    expect(reviewerCalls).toHaveLength(1);
    expect(reviewerCalls[0]?.task_id).toBe('task-1:review');
    expect(reviewerCalls[0]?.preferred_model).toBe('configured-review-model');
    expect(reviewerContexts[0]?.engineering_plan).toHaveProperty('model_profile', 'claude-review');
    expect(reviewerContexts[0]?.engineering_plan.task_id).toBe('task-1:review');
    expect(reviewerContexts[0]?.engineering_plan.agent_id).toBe('agent-review');
    expect(persistence.routingTraces.map(trace => trace.phase)).toEqual(['execute', 'verify']);
    expect(persistence.executions).toHaveLength(2);
    expect(persistence.digests).toHaveLength(1);
    expect(persistence.observations[0]?.reviewer_accepted).toBe(true);
  });

  it('keeps Goal R3 effective for profile routing, evidence and review while preserving the task R1 claim', async () => {
    const implementerCalls: TaskContract[] = [];
    const implementerContexts: ProviderEngineeringContext[] = [];
    const reviewerCalls: TaskContract[] = [];
    const reviewerContexts: ProviderEngineeringContext[] = [];
    const codex = executionPort('codex', 'success', implementerCalls, implementerContexts);
    const claude = executionPort('claude', 'success', reviewerCalls, reviewerContexts);
    const lowRiskRouter = new ResourceRouter({ codex, claude, modelRegistry: new ModelRegistry([
      { id: 'codex-coding', provider: 'codex', model: 'configured-codex-model', tier: 2, capabilities: ['coding'], preferred_for: ['coding'], max_risk: 'R2', max_complexity: 'EXCLUSIVE', subscription_backed: true, gateway_backed: false, enabled: true, relative_cost: 2, relative_latency: 2, reliability: 0.95 },
      { id: 'claude-review', provider: 'claude', model: 'configured-review-model', tier: 1, capabilities: ['review'], preferred_for: ['review'], max_risk: 'R4', max_complexity: 'EXCLUSIVE', subscription_backed: true, gateway_backed: false, enabled: true, relative_cost: 2, relative_latency: 2, reliability: 0.95 },
    ]) });
    const plan = createMasterPlan({ objective: 'Honor registered Goal risk', tasks: [{ task_id: 'task-goal-risk', objective: 'Implement within scope', capabilities: ['coding'], allowed_paths: ['packages/core'], risk: 'R1', acceptance_criteria: ['unit passes'] }] });
    const reviewTask: MasterPlanTask = { task_id: 'task-goal-risk:review', objective: 'Review the completed implementation', capabilities: ['review'], allowed_paths: ['packages/core'], risk: 'R1', complexity: 'LIGHT', acceptance_criteria: ['Review evidence is recorded'] };

    const constrained = await new WorkforceOrchestrator(lowRiskRouter, { resolve: () => codex })
      .runPlan(plan, 'base-sha', workforceEngineering(plan.tasks[0]!, { goalRisk: 'R3' }, reviewTask));
    expect(constrained.blocked).toEqual(['task-goal-risk']);
    expect(constrained.results[0]?.reason).toBe('required_model_profile_unavailable');
    expect(implementerCalls).toHaveLength(0);

    const highRiskRouter = new ResourceRouter({ codex, claude, modelRegistry: new ModelRegistry([
      { id: 'codex-coding', provider: 'codex', model: 'configured-codex-model', tier: 2, capabilities: ['coding'], preferred_for: ['coding'], max_risk: 'R3', max_complexity: 'EXCLUSIVE', subscription_backed: true, gateway_backed: false, enabled: true, relative_cost: 2, relative_latency: 2, reliability: 0.95 },
      { id: 'claude-review', provider: 'claude', model: 'configured-review-model', tier: 1, capabilities: ['review'], preferred_for: ['review'], max_risk: 'R3', max_complexity: 'EXCLUSIVE', subscription_backed: true, gateway_backed: false, enabled: true, relative_cost: 2, relative_latency: 2, reliability: 0.95 },
    ]) });
    const result = await new WorkforceOrchestrator(highRiskRouter, { resolve: provider => provider === 'codex' ? codex : claude })
      .runPlan(plan, 'base-sha', workforceEngineering(plan.tasks[0]!, { goalRisk: 'R3' }, reviewTask));
    expect(result.completed).toEqual(['task-goal-risk']);
    expect(result.results[0]?.task.risk).toBe('R1');
    expect(implementerContexts[0]?.engineering_plan.risk_level).toBe('R3');
    expect(reviewerContexts[0]?.engineering_plan.risk_level).toBe('R3');
    expect(reviewerCalls).toHaveLength(1);

    const riskyExecutionPort: ExecutionPort = {
      ...codex,
      async execute(contract) {
        implementerCalls.push(contract);
        return { task_id: contract.task_id, provider: 'codex', status: 'success', summary: 'open risk remains', files_changed: ['packages/core/file.ts'], commands: [], tests: [{ name: 'unit', passed: true, report: '1 passed' }], evidence: ['artifact://test-report'], risks: ['open-risk'] };
      },
    };
    const evidenceRouter = new ResourceRouter({ codex: riskyExecutionPort, claude, modelRegistry: new ModelRegistry([
      { id: 'codex-coding', provider: 'codex', model: 'configured-codex-model', tier: 2, capabilities: ['coding'], preferred_for: ['coding'], max_risk: 'R3', max_complexity: 'EXCLUSIVE', subscription_backed: true, gateway_backed: false, enabled: true, relative_cost: 2, relative_latency: 2, reliability: 0.95 },
      { id: 'claude-review', provider: 'claude', model: 'configured-review-model', tier: 1, capabilities: ['review'], preferred_for: ['review'], max_risk: 'R3', max_complexity: 'EXCLUSIVE', subscription_backed: true, gateway_backed: false, enabled: true, relative_cost: 2, relative_latency: 2, reliability: 0.95 },
    ]) });
    const evidenceResult = await new WorkforceOrchestrator(evidenceRouter, { resolve: provider => provider === 'codex' ? riskyExecutionPort : claude })
      .runPlan(plan, 'base-sha', workforceEngineering(plan.tasks[0]!, { goalRisk: 'R3' }, reviewTask));
    expect(evidenceResult.failed).toEqual(['task-goal-risk']);
    expect(evidenceResult.results[0]?.reason).toContain('unresolved_risks');
    expect(reviewerCalls).toHaveLength(1);
    expect(evidenceResult.results[0]?.task.risk).toBe('R1');
  });

  it('blocks changes outside allowed paths before evidence can mark the task complete', async () => {
    const calls: TaskContract[] = [];
    const codex = executionPort('codex', 'success', calls);
    const outOfScope: ExecutionPort = { ...codex, async execute(contract) { calls.push(contract); return { task_id: contract.task_id, provider: 'codex', status: 'success', summary: 'changed another package', files_changed: ['packages/other/file.ts'], commands: [], tests: [{ passed: true, report: 'pass' }], evidence: ['artifact://test'] }; } };
    const plan = createMasterPlan({ objective: 'Enforce scope', tasks: [{ task_id: 'task-scope', objective: 'Stay in package', capabilities: ['coding'], allowed_paths: ['packages/core'], risk: 'R1', acceptance_criteria: [] }] });
    const router = new ResourceRouter({ codex: outOfScope, modelRegistry: new ModelRegistry([
      { id: 'codex-coding', provider: 'codex', model: 'configured-codex-model', tier: 2, capabilities: ['coding'], preferred_for: ['coding'], max_risk: 'R4', max_complexity: 'EXCLUSIVE', subscription_backed: true, gateway_backed: false, enabled: true, relative_cost: 2, relative_latency: 2, reliability: 0.95 },
    ]) });
    const result = await new WorkforceOrchestrator(router, { resolve: () => outOfScope }).runPlan(plan, 'base-sha', workforceEngineering(plan.tasks[0]!));
    expect(result.completed).toEqual([]);
    expect(result.blocked).toEqual(['task-scope']);
    expect(result.results[0]?.execution?.error?.code).toBe('execution_scope_violation');
  });
});
