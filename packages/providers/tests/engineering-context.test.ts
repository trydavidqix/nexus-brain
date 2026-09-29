import { describe, expect, it } from 'vitest';
import type { ProviderEngineeringContext } from '@nexus-brain/providers/engineering-context';
import type { TaskContract } from '@nexus-brain/contracts/execution/port';
import { CodexAdapter } from '@nexus-brain/providers/codex/adapter';
import { ClaudeAdapter } from '@nexus-brain/providers/claude/adapter';

const contract: TaskContract = {
  task_id: 'task-provider-context',
  goal: 'implement a bounded change',
  scope: 'one package',
  allowed_paths: ['packages/providers'],
  execution_mode: 'write',
  constraints: ['use selected skills only'],
  capabilities: ['read_file', 'write_file'],
  risk: 'low',
  base_sha: 'abc123',
  context_budget: { input_tokens: 1200 },
  tool_budget: { definitions: 3, calls: 4 },
  execution_budget: { seconds: 60 },
  preferred_provider: 'local-test',
  evidence_required: ['tests'],
};

const engineeringInput: ProviderEngineeringContext = {
  engineering_plan: {
    task_id: contract.task_id,
    agent_id: 'agent-provider-context',
    task_type: 'FEATURE',
    risk_level: 'R1',
    scope_size: 'small',
    expected_files: ['packages/providers/tests/engineering-context.test.ts'],
    expected_tests: ['focused provider tests'],
    contract_impact: [],
    testability: 'unit',
    execution_mode: 'write',
    autonomy_level: 'A1',
    skill_policy: {
      required: ['skill.required'],
      optional: ['skill.optional'],
      forbidden: ['skill.forbidden'],
      loaded: ['skill.required'],
      completed: [],
    },
    context_budget: { input_tokens: 1200 },
    tool_profile: ['read_file', 'write_file'],
    verification_gates: ['focused provider tests'],
    delivery_policy: { commit: false },
  },
  task_skill_set: {
    task_id: contract.task_id,
    agent_id: 'agent-provider-context',
    required: ['skill.required'],
    optional: ['skill.optional'],
    forbidden: ['skill.forbidden'],
    loaded: ['skill.required'],
    completed: [],
    context_budget: { input_tokens: 1200 },
  },
  tool_profile: ['read_file', 'write_file'],
  loaded_skills: [{ skill_id: 'skill.required', version: '1.0.0', body: 'Only the resolver-selected body.' }],
};

const unrelatedCatalogBody = 'UNRELATED_CATALOG_SKILL_MUST_NEVER_REACH_PROVIDER';

function invalidInputs(): Array<[string, ProviderEngineeringContext]> {
  return [
    ['plan task differs from execution task', { ...engineeringInput, engineering_plan: { ...engineeringInput.engineering_plan, task_id: 'other-task' } }],
    ['TaskSkillSet task differs from plan', { ...engineeringInput, task_skill_set: { ...engineeringInput.task_skill_set, task_id: 'other-task' } }],
    ['TaskSkillSet agent differs from plan', { ...engineeringInput, task_skill_set: { ...engineeringInput.task_skill_set, agent_id: 'other-agent' } }],
    ['plan and TaskSkillSet required policy differ', { ...engineeringInput, task_skill_set: { ...engineeringInput.task_skill_set, required: ['skill.other'] } }],
    ['plan and TaskSkillSet optional policy differ', { ...engineeringInput, task_skill_set: { ...engineeringInput.task_skill_set, optional: ['skill.other'] } }],
    ['plan and TaskSkillSet forbidden policy differ', { ...engineeringInput, task_skill_set: { ...engineeringInput.task_skill_set, forbidden: ['skill.other'] } }],
    ['plan and TaskSkillSet loaded lists differ', { ...engineeringInput, task_skill_set: { ...engineeringInput.task_skill_set, loaded: [] } }],
    ['plan and TaskSkillSet completed lists differ', { ...engineeringInput, task_skill_set: { ...engineeringInput.task_skill_set, completed: ['skill.required'] } }],
    ['tool profile differs from plan', { ...engineeringInput, tool_profile: ['read_file'] }],
    ['selected skill body is missing', { ...engineeringInput, loaded_skills: [] }],
    ['skill body is present for an unloaded optional skill', { ...engineeringInput, loaded_skills: [...engineeringInput.loaded_skills, { skill_id: 'skill.optional', version: '1.0.0', body: unrelatedCatalogBody }] }],
    ['selected skill body is duplicated', { ...engineeringInput, loaded_skills: [...engineeringInput.loaded_skills, engineeringInput.loaded_skills[0]] }],
    ['forbidden skill is loaded', { ...engineeringInput, task_skill_set: { ...engineeringInput.task_skill_set, loaded: ['skill.required', 'skill.forbidden'] }, engineering_plan: { ...engineeringInput.engineering_plan, skill_policy: { ...engineeringInput.engineering_plan.skill_policy, loaded: ['skill.required', 'skill.forbidden'] } }, loaded_skills: [...engineeringInput.loaded_skills, { skill_id: 'skill.forbidden', version: '1.0.0', body: unrelatedCatalogBody }] }],
    ['loaded skill is outside required and optional selections', { ...engineeringInput, task_skill_set: { ...engineeringInput.task_skill_set, loaded: ['skill.outside-selection'] }, engineering_plan: { ...engineeringInput.engineering_plan, skill_policy: { ...engineeringInput.engineering_plan.skill_policy, loaded: ['skill.outside-selection'] } }, loaded_skills: [{ skill_id: 'skill.outside-selection', version: '1.0.0', body: unrelatedCatalogBody }] }],
    ['full catalog is attached to provider context', { ...engineeringInput, skill_catalog: [{ skill_id: 'unrelated.skill', body: unrelatedCatalogBody }] } as unknown as ProviderEngineeringContext],
    ['parallel registry authority is attached to provider context', { ...engineeringInput, skill_registry: {}, decision_router: {} } as unknown as ProviderEngineeringContext],
    ['engineering plan adds parallel router authority', { ...engineeringInput, engineering_plan: { ...engineeringInput.engineering_plan, router: {} } } as unknown as ProviderEngineeringContext],
    ['engineering plan adds parallel dispatch authority', { ...engineeringInput, engineering_plan: { ...engineeringInput.engineering_plan, dispatch: {} } } as unknown as ProviderEngineeringContext],
    ['TaskSkillSet adds registry authority', { ...engineeringInput, task_skill_set: { ...engineeringInput.task_skill_set, registry: {} } } as unknown as ProviderEngineeringContext],
    ['TaskSkillSet adds catalog authority', { ...engineeringInput, task_skill_set: { ...engineeringInput.task_skill_set, catalog: [] } } as unknown as ProviderEngineeringContext],
  ];
}

describe.each([
  ['Codex', (runner: { run: (...args: unknown[]) => Promise<unknown> }) => new CodexAdapter(runner as never)],
  ['Claude', (runner: { run: (...args: unknown[]) => Promise<unknown> }) => new ClaudeAdapter(runner as never)],
])('%s Engineering Control provider boundary', (_provider, createAdapter) => {
  it('passes only the resolved plan, task-agent SkillSet, tool profile, and loaded bodies to the provider runner', async () => {
    let received: unknown;
    const runner = {
      run: async (...args: unknown[]) => {
        received = args[1];
        return _provider === 'Codex'
          ? { finalResponse: JSON.stringify({ status: 'success', summary: 'ok', files_changed: [], commands: [], tests: [], evidence: [] }) }
          : { output: JSON.stringify({ status: 'success', summary: 'ok', files_changed: [], commands: [], tests: [], evidence: [] }) };
      },
    };
    const adapter = createAdapter(runner);
    const execute = adapter.execute.bind(adapter);

    await execute(contract, engineeringInput);

    expect(received).toEqual(engineeringInput);
    expect(JSON.stringify(received)).not.toContain(unrelatedCatalogBody);
    expect(Object.keys(received as object).sort()).toEqual(['engineering_plan', 'loaded_skills', 'task_skill_set', 'tool_profile']);
    for (const authorityKey of ['router', 'dispatch', 'registry', 'catalog', 'skill_catalog', 'skill_registry', 'decision_router']) {
      expect(received).not.toHaveProperty(`engineering_plan.${authorityKey}`);
      expect(received).not.toHaveProperty(`task_skill_set.${authorityKey}`);
      expect(received).not.toHaveProperty(authorityKey);
    }
  });

  it.each(invalidInputs())('does not dispatch when %s', async (_caseName, input) => {
    let calls = 0;
    const runner = {
      run: async (..._args: unknown[]) => {
        calls += 1;
        return _provider === 'Codex'
          ? { finalResponse: JSON.stringify({ status: 'success', summary: 'ok', files_changed: [], commands: [], tests: [], evidence: [] }) }
          : { output: JSON.stringify({ status: 'success', summary: 'ok', files_changed: [], commands: [], tests: [], evidence: [] }) };
      },
    };
    const adapter = createAdapter(runner);
    const execute = adapter.execute.bind(adapter);

    await execute(contract, input);

    expect(calls).toBe(0);
  });

  it('does not dispatch without an EngineeringContext', async () => {
    let calls = 0;
    const runner = {
      run: async (..._args: unknown[]) => {
        calls += 1;
        return _provider === 'Codex'
          ? { finalResponse: JSON.stringify({ status: 'success', summary: 'ok', files_changed: [], commands: [], tests: [], evidence: [] }) }
          : { output: JSON.stringify({ status: 'success', summary: 'ok', files_changed: [], commands: [], tests: [], evidence: [] }) };
      },
    };
    const adapter = createAdapter(runner);
    const execute = adapter.execute.bind(adapter) as (task: TaskContract) => Promise<unknown>;

    await execute(contract);

    expect(calls).toBe(0);
  });
});
