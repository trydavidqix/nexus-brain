import { assertContract } from '@nexus-brain/contracts';
import type {
  EngineeringPlanV2,
  MaestriDecisionInput,
  MaestriDecisionPolicy,
  MaestriDecisionResult,
  NexusGoal,
  NexusIdentity,
  NexusProject,
  NexusProjectV2,
  NexusTask,
  ProviderEngineeringContext,
  TaskSkillSet,
} from '@nexus-brain/contracts';
import type { RiskLevel } from '@nexus-brain/contracts/workforce/types';
import { decide } from '../decisions/maestri-decision';
import type { SkillRegistry } from '../skills/skill-registry.d.mts';

export interface AuthenticatedEngineeringPrincipal {
  identity: NexusIdentity;
  capabilities: string[];
}

export interface EngineeringStateStore {
  getProject(project_id: string): { project: NexusProject | NexusProjectV2; version: number } | null;
  getGoal(project_id: string, goal_id: string): { goal: NexusGoal; version: number } | null;
}

export interface EngineeringOrchestrationRequest {
  /** Request claims from the NB-05 gateway boundary. */
  identity: NexusIdentity;
  /** Principal returned by the trusted NB-05 authenticator. */
  principal: AuthenticatedEngineeringPrincipal;
  task: NexusTask;
  /** Goal selected by the caller; the emitted plan uses the registered Goal ID. */
  goal_id: string;
  /** Classified values from the authorized Maestri caller; no fields are defaulted or inferred here. */
  plan_fields: Omit<EngineeringPlanV2, 'task_id' | 'agent_id' | 'goal_id' | 'skill_policy'> & {
    skill_policy: Pick<EngineeringPlanV2['skill_policy'], 'required' | 'optional' | 'forbidden'>;
  };
  /** Typed policy and signal inputs supplied by the authoritative Maestri caller. */
  decision_input: MaestriDecisionInput;
}

export interface EngineeringOrchestrationResult {
  status: 'ready' | 'blocked';
  engineering_plan?: EngineeringPlanV2;
  decision: MaestriDecisionResult;
  provider_context?: ProviderEngineeringContext;
}

export interface EngineeringOrchestratorDependencies {
  stateStore: EngineeringStateStore;
  skillRegistry: Pick<SkillRegistry, 'resolveSkills' | 'loadSkill' | 'getActiveSkills'>;
}

function sameIdentity(left: NexusIdentity, right: NexusIdentity): boolean {
  return left.project_id === right.project_id
    && left.task_id === right.task_id
    && left.agent_id === right.agent_id;
}

function requireIdentityMatch(expected: NexusIdentity, actual: NexusIdentity, source: string): void {
  if (!sameIdentity(expected, actual)) throw new Error(`engineering_${source}_identity_mismatch`);
}

function requireTaskAgentMatch(expected: NexusIdentity, actual: { task_id: string; agent_id: string }, source: string): void {
  if (expected.task_id !== actual.task_id || expected.agent_id !== actual.agent_id) {
    throw new Error(`engineering_${source}_identity_mismatch`);
  }
}

function requireSkillSetIdentity(skillSet: TaskSkillSet, identity: NexusIdentity): void {
  assertContract('task-skill-set', skillSet);
  requireTaskAgentMatch(identity, skillSet, 'resolver');
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function combineEngineeringPolicies(
  projectPolicy: MaestriDecisionPolicy,
  callerPolicy: MaestriDecisionPolicy,
): MaestriDecisionPolicy {
  if (projectPolicy.confidence_threshold !== undefined
    && callerPolicy.confidence_threshold !== undefined
    && projectPolicy.confidence_threshold_version !== callerPolicy.confidence_threshold_version) {
    throw new Error('engineering_policy_threshold_version_conflict');
  }
  const confidenceThreshold = [projectPolicy.confidence_threshold, callerPolicy.confidence_threshold]
    .filter((value): value is number => value !== undefined)
    .reduce<number | undefined>((highest, value) => highest === undefined ? value : Math.max(highest, value), undefined);
  return {
    denied: projectPolicy.denied || callerPolicy.denied,
    approval_required: projectPolicy.approval_required || callerPolicy.approval_required,
    ...(projectPolicy.ceo_required !== undefined || callerPolicy.ceo_required !== undefined
      ? { ceo_required: projectPolicy.ceo_required === true || callerPolicy.ceo_required === true }
      : {}),
    retry_allowed: projectPolicy.retry_allowed === true && callerPolicy.retry_allowed === true,
    ...(confidenceThreshold !== undefined ? { confidence_threshold: confidenceThreshold } : {}),
    ...(confidenceThreshold !== undefined && projectPolicy.confidence_threshold_version
      ? { confidence_threshold_version: projectPolicy.confidence_threshold_version }
      : confidenceThreshold !== undefined && callerPolicy.confidence_threshold_version
        ? { confidence_threshold_version: callerPolicy.confidence_threshold_version }
        : {}),
  };
}

const RISK_ORDER: Record<RiskLevel, number> = { R0: 0, R1: 1, R2: 2, R3: 3, R4: 4 };

function effectiveRisk(...risks: string[]): RiskLevel {
  if (risks.length === 0 || risks.some(risk => !Object.hasOwn(RISK_ORDER, risk))) {
    throw new Error('engineering_risk_invalid');
  }
  let highest: RiskLevel = 'R0';
  for (const value of risks) {
    const risk = value as RiskLevel;
    if (RISK_ORDER[risk] > RISK_ORDER[highest]) highest = risk;
  }
  return highest;
}

function validateEngineeringPlanCandidate(
  identity: NexusIdentity,
  registeredGoal: NexusGoal,
  fields: EngineeringOrchestrationRequest['plan_fields'],
  risk: RiskLevel,
): void {
  // Loaded/completed are Resolver-owned state; empty arrays here are only a preflight candidate.
  // The emitted plan is rebuilt from the Resolver's actual SkillSet after selection/loading.
  const candidate: EngineeringPlanV2 = {
    ...fields,
    task_id: identity.task_id,
    agent_id: identity.agent_id,
    goal_id: registeredGoal.goal_id,
    risk_level: risk,
    skill_policy: { ...fields.skill_policy, loaded: [], completed: [] },
  };
  assertContract('engineering-plan-v2', candidate);
}

function issueEngineeringPlan(
  identity: NexusIdentity,
  registeredGoal: NexusGoal,
  fields: EngineeringOrchestrationRequest['plan_fields'],
  skillSet: TaskSkillSet,
  risk: RiskLevel,
): EngineeringPlanV2 {
  const plan: EngineeringPlanV2 = {
    ...fields,
    task_id: identity.task_id,
    agent_id: identity.agent_id,
    goal_id: registeredGoal.goal_id,
    risk_level: risk,
    skill_policy: {
      ...fields.skill_policy,
      loaded: [...skillSet.loaded],
      completed: [...skillSet.completed],
    },
  };
  assertContract('engineering-plan-v2', plan);
  requireTaskAgentMatch(identity, plan, 'plan');
  return plan;
}

/**
 * Issues a v2 plan from caller-classified fields and composes the NB-12 provider context.
 * It does not classify work, route providers, or dispatch execution.
 */
export function prepareEngineeringContext(
  dependencies: EngineeringOrchestratorDependencies,
  request: EngineeringOrchestrationRequest,
): Promise<EngineeringOrchestrationResult> {
  return prepareEngineeringContextAsync(dependencies, request);
}

async function prepareEngineeringContextAsync(
  dependencies: EngineeringOrchestratorDependencies,
  request: EngineeringOrchestrationRequest,
): Promise<EngineeringOrchestrationResult> {
  if (!request?.principal?.identity || !Array.isArray(request.principal.capabilities)) {
    throw new Error('engineering_authenticated_principal_required');
  }

  assertContract('identity', request.identity);
  assertContract('identity', request.principal.identity);
  assertContract('nexus-task', request.task);
  requireIdentityMatch(request.identity, request.principal.identity, 'principal');
  if (request.identity.project_id !== request.task.project_id || request.identity.task_id !== request.task.task_id) {
    throw new Error('engineering_task_identity_mismatch');
  }
  if (!request.principal.capabilities.includes('engineering.execute')) {
    throw new Error('engineering_capability_not_authenticated');
  }
  const requiredCapabilities = request.task.capabilities ?? [];
  if (requiredCapabilities.some(capability => !request.principal.capabilities.includes(capability))) {
    throw new Error('engineering_task_capability_not_authenticated');
  }

  const registeredProject = dependencies.stateStore.getProject(request.identity.project_id);
  if (!registeredProject || registeredProject.project.project_id !== request.identity.project_id) {
    throw new Error('engineering_project_not_registered');
  }
  assertContract(Object.hasOwn(registeredProject.project, 'workspace_bindings') ? 'project-v2' : 'project', registeredProject.project);
  const engineeringPolicy = registeredProject.project.policies.engineering;
  if (!engineeringPolicy || typeof engineeringPolicy !== 'object' || Array.isArray(engineeringPolicy)) {
    throw new Error('engineering_project_policy_required');
  }

  const registeredGoal = dependencies.stateStore.getGoal(request.identity.project_id, request.goal_id);
  if (!registeredGoal) throw new Error('engineering_plan_goal_not_registered');
  assertContract('goal', registeredGoal.goal);
  if (registeredGoal.goal.project_id !== request.identity.project_id || registeredGoal.goal.goal_id !== request.goal_id) {
    throw new Error('engineering_plan_goal_scope_mismatch');
  }

  const projectPolicyInput: MaestriDecisionInput = {
    ...request.decision_input,
    policy: engineeringPolicy,
  };
  assertContract('maestri-decision-input', projectPolicyInput);
  const decisionInput: MaestriDecisionInput = {
    ...request.decision_input,
    policy: combineEngineeringPolicies(projectPolicyInput.policy, request.decision_input.policy),
  };
  assertContract('maestri-decision-input', decisionInput);
  requireIdentityMatch(request.identity, decisionInput, 'decision');
  const risk = effectiveRisk(registeredGoal.goal.risk, request.task.risk, request.plan_fields.risk_level, decisionInput.risk);
  validateEngineeringPlanCandidate(request.identity, registeredGoal.goal, request.plan_fields, risk);

  const decision = decide({ ...decisionInput, risk });
  if (decision.route !== 'execute'
    || decision.needs_approval || decision.needs_ceo || decision.abstain || decision.decision_source === 'fallback') {
    return { status: 'blocked', decision };
  }

  if (request.plan_fields.context_budget.input_tokens === undefined) {
    throw new Error('engineering_plan_context_budget_required');
  }

  const selectionInput = {
    task_id: request.identity.task_id,
    agent_id: request.identity.agent_id,
    task_type: request.plan_fields.task_type,
    risk_level: risk,
    required: request.plan_fields.skill_policy.required,
    optional: request.plan_fields.skill_policy.optional,
    forbidden: request.plan_fields.skill_policy.forbidden,
    context_budget: request.plan_fields.context_budget as Record<string, unknown> & { input_tokens: number },
  };
  const initialResolution = dependencies.skillRegistry.resolveSkills(selectionInput);
  requireSkillSetIdentity(initialResolution.skill_set, request.identity);
  const planSkillPolicy = request.plan_fields.skill_policy;
  const resolvedSkillPolicy = initialResolution.skill_set;
  if (!sameStrings(resolvedSkillPolicy.required, planSkillPolicy.required)
    || !sameStrings(resolvedSkillPolicy.optional, planSkillPolicy.optional)
    || !sameStrings(resolvedSkillPolicy.forbidden, planSkillPolicy.forbidden)) {
    throw new Error('engineering_plan_skill_policy_mismatch');
  }
  for (const skillId of initialResolution.skill_set.required) {
    await dependencies.skillRegistry.loadSkill({
      task_id: request.identity.task_id,
      agent_id: request.identity.agent_id,
      skill_id: skillId,
      selection_id: initialResolution.selection_id,
    });
  }

  const resolution = dependencies.skillRegistry.resolveSkills(selectionInput);
  requireSkillSetIdentity(resolution.skill_set, request.identity);
  if (!sameStrings(resolution.skill_set.required, planSkillPolicy.required)
    || !sameStrings(resolution.skill_set.optional, planSkillPolicy.optional)
    || !sameStrings(resolution.skill_set.forbidden, planSkillPolicy.forbidden)) {
    throw new Error('engineering_plan_skill_policy_mismatch');
  }
  const engineeringPlan = issueEngineeringPlan(request.identity, registeredGoal.goal, request.plan_fields, resolution.skill_set, risk);

  const loadedSkills = dependencies.skillRegistry.getActiveSkills({
    task_id: request.identity.task_id,
    agent_id: request.identity.agent_id,
  });
  const activeSkillIds = loadedSkills.map(skill => skill.skill_id);
  if (activeSkillIds.length !== resolution.skill_set.loaded.length
    || resolution.skill_set.loaded.some(skillId => !activeSkillIds.includes(skillId))) {
    throw new Error('engineering_resolver_loaded_skill_state_mismatch');
  }

  return {
    status: 'ready',
    engineering_plan: engineeringPlan,
    decision,
    provider_context: {
      engineering_plan: engineeringPlan,
      task_skill_set: resolution.skill_set,
      tool_profile: [...engineeringPlan.tool_profile],
      loaded_skills: loadedSkills,
    },
  };
}
