import { describe, expect, it, vi } from 'vitest';
import type { EngineeringPlanV2, MaestriDecisionInput, NexusIdentity, NexusTask, ProviderEngineeringContext, SkillRegistryEntry } from '@nexus-brain/contracts';
import { createSkillRegistry } from '../src/skills/skill-registry.mjs';
import { decide } from '../src/decisions/maestri-decision';
import { prepareEngineeringContext } from '../src/engineering/orchestration';

const identity: NexusIdentity = { project_id: 'project-a', task_id: 'task-a', agent_id: 'agent-a' };
const principal = { identity: { ...identity }, capabilities: ['engineering.execute'] };
const task: NexusTask = {
  ...identity,
  objective: 'Fix a defect',
  risk: 'R1',
  complexity: 'LIGHT',
  acceptance_criteria: ['The defect is fixed'],
};
const plan: EngineeringPlanV2 = {
  task_id: identity.task_id,
  agent_id: identity.agent_id,
  goal_id: 'goal-a',
  task_type: 'BUG',
  risk_level: 'R1',
  ceremony: 'LIGHT',
  scope_size: 'one component',
  expected_files: ['src/example.ts'],
  expected_tests: ['tests/example.test.ts'],
  contract_impact: [],
  testability: 'unit tested',
  execution_mode: 'write',
  autonomy_level: 'A1',
  quality_profile: 'STANDARD',
  model_profile: 'opaque-profile-v1',
  stop_conditions: ['Stop when acceptance criteria pass'],
  skill_policy: { required: ['core'], optional: ['optional'], forbidden: [], loaded: ['core'], completed: [] },
  context_budget: { input_tokens: 300 },
  tool_profile: ['git.read', 'file.edit'],
  verification_gates: ['unit'],
  delivery_policy: {},
};
const { task_id: _taskId, agent_id: _agentId, goal_id: _goalId, skill_policy: outputSkillPolicy, ...planFieldsBase } = plan;
const planFields = {
  ...planFieldsBase,
  skill_policy: {
    required: outputSkillPolicy.required,
    optional: outputSkillPolicy.optional,
    forbidden: outputSkillPolicy.forbidden,
  },
};
const decisionInput: MaestriDecisionInput = {
  ...identity,
  decision_id: 'decision-a',
  proposed_route: 'execute',
  risk: 'R1',
  priority: 1,
  policy: { denied: false, approval_required: false, retry_allowed: true },
  signals: { exact: true },
  evidence_refs: ['policy-evidence-a'],
};
const project = {
  project_id: identity.project_id,
  repo: 'opaque:project-a',
  default_branch: 'main',
  workspace_policy: {},
  lifecycle: 'active',
  stack: [],
  permissions: {},
  policies: { engineering: { denied: false, approval_required: false, retry_allowed: true } },
  approvals: {},
  budgets: {},
  memory_namespace: 'project:project-a',
  task_scope: 'task:project-a',
  session_scope: 'session:project-a',
  evidence_scope: 'evidence:project-a',
  git_bindings: [],
  ci_bindings: [],
  deployment_bindings: [],
  provider_constraints: [],
};
const entry: SkillRegistryEntry = {
  skill_id: 'core',
  purpose: 'Core engineering guidance',
  task_types: ['BUG'],
  risk_levels: ['R1'],
  dependencies: [],
  conflicts: [],
  precedence_owner: 'nexus',
  estimated_context_cost: 50,
  version: '1.0.0',
  status: 'ACTIVE',
};
const goal = {
  goal_id: 'goal-a',
  project_id: identity.project_id,
  objective: 'Fix the tracked defect',
  scope: ['src/example.ts'],
  out_of_scope: [],
  requirements: [],
  constraints: [],
  assumptions: [],
  acceptance_criteria: ['The defect is fixed'],
  risk: 'R1',
  required_gates: [],
  definition_of_done: ['Acceptance criteria pass'],
};
const makeRegistry = () => createSkillRegistry({
  entries: [
    entry,
    { ...entry, skill_id: 'debug', purpose: 'Debugging guidance', dependencies: ['core'] },
    { ...entry, skill_id: 'optional', purpose: 'Optional guidance' },
  ],
  readSkillBody: ({ skill_id, task_id, agent_id }) => `${skill_id}:${task_id}:${agent_id}`,
  recordEvent: () => undefined,
});
const makeTrackedRegistry = () => {
  const registry = makeRegistry();
  return {
    ...registry,
    resolveSkills: vi.fn(registry.resolveSkills),
    loadSkill: vi.fn(registry.loadSkill),
    getActiveSkills: vi.fn(registry.getActiveSkills),
    searchSkills: vi.fn(registry.searchSkills),
  };
};
const makeStore = (projectRecord: unknown = { project, version: 1 }, goalRecord: unknown = { goal, version: 1 }) => ({
  getProject: vi.fn((projectId: string) => projectId === identity.project_id ? projectRecord as never : null),
  getGoal: vi.fn((projectId: string, goalId: string) => projectId === identity.project_id && goalId === 'goal-a' ? goalRecord as never : null),
});
const request = (overrides: Record<string, unknown> = {}) => ({
  identity,
  principal,
  task,
  goal_id: 'goal-a',
  plan_fields: planFields,
  decision_input: decisionInput,
  ...overrides,
});

describe('NB-13 engineering orchestration', () => {
  it('issues a v2 plan and resolves then loads only the task-agent required SkillSet', async () => {
    const stateStore = makeStore();
    const skillRegistry = makeTrackedRegistry();
    const result = await prepareEngineeringContext({ stateStore, skillRegistry }, request());

    expect(result.status).toBe('ready');
    expect(result.engineering_plan).toEqual(plan);
    expect(result.decision).toEqual(decide(decisionInput));
    expect(result.provider_context).toEqual<ProviderEngineeringContext>({
      engineering_plan: plan,
      task_skill_set: {
        task_id: identity.task_id,
        agent_id: identity.agent_id,
        required: ['core'],
        optional: ['optional'],
        forbidden: [],
        loaded: ['core'],
        completed: [],
        context_budget: { input_tokens: 300 },
      },
      tool_profile: plan.tool_profile,
      loaded_skills: [{ skill_id: 'core', version: '1.0.0', body: 'core:task-a:agent-a' }],
    });
    expect(stateStore.getProject).toHaveBeenCalledWith(identity.project_id);
    expect(stateStore.getGoal).toHaveBeenCalledWith(identity.project_id, 'goal-a');
    expect(skillRegistry.loadSkill).toHaveBeenCalledTimes(1);
    expect(skillRegistry.loadSkill).toHaveBeenCalledWith(expect.objectContaining({ skill_id: 'core', task_id: 'task-a', agent_id: 'agent-a' }));
    expect(skillRegistry.loadSkill).not.toHaveBeenCalledWith(expect.objectContaining({ skill_id: 'optional' }));
  });

  it('fails closed for missing or mismatched authenticated identity before decision or resolution', async () => {
    const stateStore = makeStore();
    const skillRegistry = makeTrackedRegistry();
    const resolve = skillRegistry.resolveSkills;

    await expect(prepareEngineeringContext({ stateStore, skillRegistry }, request({ principal: null }))).rejects.toThrow(/authenticated_principal_required/);
    await expect(prepareEngineeringContext({ stateStore, skillRegistry }, request({ principal: { ...principal, identity: { ...identity, agent_id: 'agent-other' } } }))).rejects.toThrow(/principal_identity_mismatch/);
    await expect(prepareEngineeringContext({ stateStore, skillRegistry }, request({ task: { ...task, project_id: 'project-other' } }))).rejects.toThrow(/task_identity_mismatch/);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('rejects task capabilities absent from the authenticated principal before resolution', async () => {
    const skillRegistry = makeTrackedRegistry();

    await expect(prepareEngineeringContext({ stateStore: makeStore(), skillRegistry }, request({
      task: { ...task, capabilities: ['code.search'] },
      principal: { ...principal, capabilities: ['engineering.execute'] },
    }))).rejects.toThrow(/task_capability_not_authenticated/);

    expect(skillRegistry.resolveSkills).not.toHaveBeenCalled();
    expect(skillRegistry.loadSkill).not.toHaveBeenCalled();
  });

  it('requires the authenticated engineering.execute capability before resolution', async () => {
    const skillRegistry = makeTrackedRegistry();

    await expect(prepareEngineeringContext({ stateStore: makeStore(), skillRegistry }, request({
      principal: { ...principal, capabilities: [] },
    }))).rejects.toThrow(/engineering_capability_not_authenticated/);

    expect(skillRegistry.resolveSkills).not.toHaveBeenCalled();
    expect(skillRegistry.loadSkill).not.toHaveBeenCalled();
  });

  it('blocks when the registered Project engineering policy denies the task even if caller policy allows it', async () => {
    const skillRegistry = makeTrackedRegistry();
    const deniedProject = { ...project, policies: { engineering: { denied: true, approval_required: false, retry_allowed: true } } };
    const result = await prepareEngineeringContext({
      stateStore: makeStore({ project: deniedProject, version: 1 }),
      skillRegistry,
    }, request({ decision_input: { ...decisionInput, policy: { denied: false, approval_required: false, retry_allowed: true } } }));

    expect(result.status).toBe('blocked');
    expect(result.decision.reason_codes).toContain('policy_denied');
    expect(skillRegistry.resolveSkills).not.toHaveBeenCalled();
  });

  it('rejects a malformed v2 plan before skill resolution', async () => {
    const stateStore = makeStore();
    const skillRegistry = makeTrackedRegistry();
    const resolve = skillRegistry.resolveSkills;
    const load = skillRegistry.loadSkill;
    const invalidPlanFields = { ...planFields, model_profile: '' };

    await expect(prepareEngineeringContext({ stateStore, skillRegistry }, request({ plan_fields: invalidPlanFields }))).rejects.toThrow(/engineering-plan-v2/);
    expect(resolve).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
    expect(skillRegistry.getActiveSkills({ task_id: identity.task_id, agent_id: identity.agent_id })).toEqual([]);
  });

  it('never lowers persisted Goal risk when task, plan, and decision request a lower risk', async () => {
    const skillRegistry = makeTrackedRegistry();
    const result = await prepareEngineeringContext({
      stateStore: makeStore(undefined, { goal: { ...goal, risk: 'R4' }, version: 1 }),
      skillRegistry,
    }, request());

    expect(result.status).toBe('blocked');
    expect(result.decision.risk).toBe('R4');
    expect(result.decision.needs_approval).toBe(true);
    expect(result.decision).toEqual(decide({ ...decisionInput, risk: 'R4' }));
    expect(result.engineering_plan).toBeUndefined();
    expect(skillRegistry.resolveSkills).not.toHaveBeenCalled();
    expect(skillRegistry.loadSkill).not.toHaveBeenCalled();
  });

  it('does not expose the full catalog or invoke providers for an executable decision', async () => {
    const skillRegistry = makeTrackedRegistry();
    const searchSkills = skillRegistry.searchSkills;
    const provider = { execute: vi.fn() };
    const result = await prepareEngineeringContext({ stateStore: makeStore(), skillRegistry, provider } as never, request());

    expect(result.status).toBe('ready');
    expect(result.provider_context?.task_skill_set.required).toEqual(['core']);
    expect(result.provider_context).not.toHaveProperty('skill_catalog');
    expect(searchSkills).not.toHaveBeenCalled();
    expect(provider.execute).not.toHaveBeenCalled();
  });

  it('loads required skills in Resolver dependency order and leaves optional skills unloaded', async () => {
    const skillRegistry = makeTrackedRegistry();
    const result = await prepareEngineeringContext({ stateStore: makeStore(), skillRegistry }, request({
      plan_fields: {
        ...planFields,
        skill_policy: { required: ['core', 'debug'], optional: ['optional'], forbidden: [] },
      },
    }));

    expect(skillRegistry.loadSkill.mock.calls.map(([input]) => input.skill_id)).toEqual(['core', 'debug']);
    expect(result.provider_context?.task_skill_set.required).toEqual(['core', 'debug']);
    expect(result.provider_context?.task_skill_set.loaded).toEqual(['core', 'debug']);
    expect(result.provider_context?.loaded_skills.map(skill => skill.skill_id)).toEqual(['core', 'debug']);
    expect(result.provider_context?.loaded_skills.some(skill => skill.skill_id === 'optional')).toBe(false);
  });

  it.each([
    ['policy denied', { ...decisionInput, policy: { ...decisionInput.policy, denied: true } }],
    ['approval required', { ...decisionInput, policy: { ...decisionInput.policy, approval_required: true } }],
    ['CEO escalation', { ...decisionInput, policy: { ...decisionInput.policy, ceo_required: true } }],
    ['abstention', { ...decisionInput, proposed_route: undefined, signals: { exact: false } }],
  ])('blocks provider context and skill resolution for %s', async (_label, blockedInput) => {
    const skillRegistry = makeTrackedRegistry();
    const result = await prepareEngineeringContext({ stateStore: makeStore(), skillRegistry }, request({ decision_input: blockedInput }));

    expect(result.status).toBe('blocked');
    expect(result.engineering_plan).toBeUndefined();
    expect(result.decision).toEqual(decide(blockedInput));
    expect(result.provider_context).toBeUndefined();
    expect(skillRegistry.resolveSkills).not.toHaveBeenCalled();
    expect(skillRegistry.loadSkill).not.toHaveBeenCalled();
    expect(skillRegistry.getActiveSkills).not.toHaveBeenCalled();
  });

  it('keeps resolver state isolated by both task and agent', async () => {
    const skillRegistry = makeRegistry();
    const initialSelection = skillRegistry.resolveSkills({
      task_id: identity.task_id,
      agent_id: identity.agent_id,
      task_type: plan.task_type,
      risk_level: plan.risk_level,
      required: ['core'],
      context_budget: { input_tokens: 300 },
    });
    await skillRegistry.loadSkill({ task_id: identity.task_id, agent_id: identity.agent_id, skill_id: 'core', selection_id: initialSelection.selection_id });
    const first = await prepareEngineeringContext({ stateStore: makeStore(), skillRegistry }, request());
    const otherAgent = { ...identity, agent_id: 'agent-b' };
    const second = await prepareEngineeringContext({ stateStore: makeStore(), skillRegistry }, request({
      identity: otherAgent,
      principal: { ...principal, identity: otherAgent },
      plan_fields: planFields,
      decision_input: { ...decisionInput, agent_id: otherAgent.agent_id },
    }));
    const otherTask = { ...identity, task_id: 'task-b' };
    const third = await prepareEngineeringContext({ stateStore: makeStore(), skillRegistry }, request({
      identity: otherTask,
      principal: { ...principal, identity: otherTask },
      task: { ...task, task_id: otherTask.task_id },
      decision_input: { ...decisionInput, task_id: otherTask.task_id },
    }));

    expect(initialSelection.selection_id).toBeTruthy();
    expect(first.provider_context?.task_skill_set.task_id).toBe(identity.task_id);
    expect(first.provider_context?.task_skill_set.agent_id).toBe(identity.agent_id);
    expect(first.provider_context?.task_skill_set.loaded).toEqual(['core']);
    expect(first.provider_context?.loaded_skills).toEqual([{ skill_id: 'core', version: '1.0.0', body: 'core:task-a:agent-a' }]);
    expect(second.provider_context?.task_skill_set.task_id).toBe(identity.task_id);
    expect(second.provider_context?.task_skill_set.agent_id).toBe(otherAgent.agent_id);
    expect(third.provider_context?.task_skill_set.task_id).toBe(otherTask.task_id);
    expect(third.provider_context?.task_skill_set.agent_id).toBe(identity.agent_id);
    expect(skillRegistry.getActiveSkills({ task_id: identity.task_id, agent_id: identity.agent_id })).toEqual([{ skill_id: 'core', version: '1.0.0', body: 'core:task-a:agent-a' }]);
    expect(skillRegistry.getActiveSkills({ task_id: identity.task_id, agent_id: otherAgent.agent_id })).toEqual([{ skill_id: 'core', version: '1.0.0', body: 'core:task-a:agent-b' }]);
    expect(skillRegistry.getActiveSkills({ task_id: otherTask.task_id, agent_id: identity.agent_id })).toEqual([{ skill_id: 'core', version: '1.0.0', body: 'core:task-b:agent-a' }]);
  });
});
