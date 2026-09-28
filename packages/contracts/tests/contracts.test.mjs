import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contractSchema, contractTypes, normalizeLegacy, validateContract } from '../src/index.mjs';
assert.equal(contractTypes().length,47);
assert.equal(contractSchema('trace').$id,'lumenva.trace.v1');
assert.equal(validateContract('trace',{trace_id:'tr-1',timestamp:new Date().toISOString(),source:'test'}).valid,true);
const invalid=validateContract('trace',{timestamp:'not-a-date'});assert.equal(invalid.valid,false);assert.ok(invalid.errors.some(error=>error.includes('trace_id')));
assert.equal(validateContract('telemetry',{timestamp:new Date().toISOString(),source:'test',measurement_type:'exact',total_tokens:10}).valid,true);
assert.equal(validateContract('telemetry',{timestamp:new Date().toISOString(),source:'test',measurement_type:'fabricated'}).valid,false);
const legacy=normalizeLegacy({task_id:'old-1',executor:'codex',internal_state:'DONE'},'task');assert.equal(legacy.task_id,'old-1');assert.equal(legacy.status,'completed');assert.equal(legacy.measurement_type,'unavailable');

const project = {
  project_id: 'project-1',
  repo: 'opaque locator: preserve exactly as supplied',
  default_branch: 'main',
  workspace_policy: {},
  lifecycle: 'active',
  stack: [],
  permissions: {},
  policies: {},
  approvals: {},
  budgets: {},
  memory_namespace: 'memory:project-1',
  task_scope: 'task:project-1',
  session_scope: 'session:project-1',
  evidence_scope: 'evidence:project-1',
  git_bindings: [],
  ci_bindings: [],
  deployment_bindings: [],
  provider_constraints: [],
};

const projectV2 = {
  ...project,
  memory_namespace: 'project:project-1',
  workspace_bindings: [],
};

const goal = {
  goal_id: 'goal-1',
  project_id: project.project_id,
  objective: 'Implement a bounded capability',
  scope: ['contracts package'],
  out_of_scope: [],
  requirements: [],
  constraints: [],
  assumptions: [],
  acceptance_criteria: ['Contract validates'],
  risk: 'R2',
  required_gates: [],
  definition_of_done: ['Required checks pass'],
};

test('registers and validates Project v1 and Goal v1 contracts', () => {
  assert.ok(contractTypes().includes('project'));
  assert.ok(contractTypes().includes('goal'));
  assert.equal(contractSchema('project').$id, 'nexus.project.v1');
  assert.equal(contractSchema('goal').$id, 'nexus.goal.v1');

  const projectResult = validateContract('project', project);
  assert.equal(projectResult.valid, true, projectResult.errors.join(', '));
  const goalResult = validateContract('goal', goal);
  assert.equal(goalResult.valid, true, goalResult.errors.join(', '));
  assert.equal(goal.project_id, project.project_id);
  assert.equal(project.repo, 'opaque locator: preserve exactly as supplied');
});

test('Project v1 requires every field and rejects wrong container or scalar types', () => {
  for (const field of Object.keys(project)) {
    const { [field]: _omitted, ...missingField } = project;
    assert.equal(validateContract('project', missingField).valid, false, `accepted Project without ${field}`);
  }

  const wrongTypes = {
    project_id: 1, repo: {}, default_branch: [], workspace_policy: [], lifecycle: false,
    stack: {}, permissions: [], policies: null, approvals: 'none', budgets: 1,
    memory_namespace: {}, task_scope: [], session_scope: false, evidence_scope: null,
    git_bindings: {}, ci_bindings: [null], deployment_bindings: ['binding'], provider_constraints: [1],
  };
  for (const [field, value] of Object.entries(wrongTypes)) {
    assert.equal(validateContract('project', { ...project, [field]: value }).valid, false, `accepted wrong Project type for ${field}`);
  }
});

test('Project v1 accepts empty optional collections and rejects empty required strings or extra fields', () => {
  assert.equal(validateContract('project', project).valid, true);
  for (const field of ['project_id', 'repo', 'default_branch', 'lifecycle', 'memory_namespace', 'task_scope', 'session_scope', 'evidence_scope']) {
    assert.equal(validateContract('project', { ...project, [field]: '' }).valid, false, `accepted empty Project ${field}`);
  }
  assert.equal(validateContract('project', { ...project, extra: true }).valid, false);
  assert.equal(validateContract('project', { ...project, stack: [''] }).valid, false);
  for (const field of ['git_bindings', 'ci_bindings', 'deployment_bindings', 'provider_constraints']) {
    assert.equal(validateContract('project', { ...project, [field]: [{}] }).valid, true, `rejected object item in ${field}`);
  }
});

test('registers Project v2 while preserving the closed Project v1 contract', () => {
  assert.ok(contractTypes().includes('project-v2'));
  assert.equal(contractSchema('project-v2').$id, 'nexus.project.v2');
  assert.equal(validateContract('project', project).valid, true);
  assert.equal(validateContract('project', { ...project, workspace_bindings: [] }).valid, false);

  const result = validateContract('project-v2', projectV2);
  assert.equal(result.valid, true, result.errors.join(', '));
  assert.equal(projectV2.repo, project.repo);
  assert.equal(projectV2.memory_namespace, `project:${projectV2.project_id}`);
});

test('Project v2 requires typed local workspace bindings and a project-derived memory namespace', () => {
  const { workspace_bindings: _omitted, ...missingBindings } = projectV2;
  assert.equal(validateContract('project-v2', missingBindings).valid, false);
  assert.equal(validateContract('project-v2', { ...projectV2, workspace_bindings: null }).valid, false);
  assert.equal(validateContract('project-v2', { ...projectV2, workspace_bindings: [{ kind: 'cloud', location: 'opaque-location' }] }).valid, false);
  assert.equal(validateContract('project-v2', { ...projectV2, workspace_bindings: [{ kind: 'local', location: '' }] }).valid, false);
  assert.equal(validateContract('project-v2', { ...projectV2, workspace_bindings: [{ kind: 'local' }] }).valid, false);
  assert.equal(validateContract('project-v2', { ...projectV2, workspace_bindings: [{ kind: 'local', location: 'opaque://local-workspace/path' }] }).valid, true);
  assert.equal(validateContract('project-v2', { ...projectV2, memory_namespace: 'other-project-memory' }).valid, false);
  assert.equal(validateContract('project-v2', { ...projectV2, extra: true }).valid, false);
});

test('Goal v1 requires every field, validates types and rejects unknown top-level fields', () => {
  for (const field of Object.keys(goal)) {
    const { [field]: _omitted, ...missingField } = goal;
    assert.equal(validateContract('goal', missingField).valid, false, `accepted Goal without ${field}`);
  }

  const wrongTypes = {
    goal_id: 1, project_id: {}, objective: [], scope: {}, out_of_scope: 'none',
    requirements: [1], constraints: [null], assumptions: [{}], acceptance_criteria: [false],
    risk: 2, required_gates: [1], definition_of_done: [{}],
  };
  for (const [field, value] of Object.entries(wrongTypes)) {
    assert.equal(validateContract('goal', { ...goal, [field]: value }).valid, false, `accepted wrong Goal type for ${field}`);
  }
  assert.equal(validateContract('goal', { ...goal, extra: true }).valid, false);
});

test('Goal v1 enforces non-empty strings and required non-empty lists, with risk R0 through R4', () => {
  for (const field of ['goal_id', 'project_id', 'objective']) {
    assert.equal(validateContract('goal', { ...goal, [field]: '' }).valid, false, `accepted empty Goal ${field}`);
  }
  for (const field of ['scope', 'acceptance_criteria', 'definition_of_done']) {
    assert.equal(validateContract('goal', { ...goal, [field]: [] }).valid, false, `accepted empty required list ${field}`);
    assert.equal(validateContract('goal', { ...goal, [field]: [''] }).valid, false, `accepted empty item in ${field}`);
  }
  for (const field of ['out_of_scope', 'requirements', 'constraints', 'assumptions', 'required_gates']) {
    assert.equal(validateContract('goal', { ...goal, [field]: [] }).valid, true, `rejected empty optional list ${field}`);
    assert.equal(validateContract('goal', { ...goal, [field]: [''] }).valid, false, `accepted empty item in ${field}`);
  }
  for (const risk of ['R0', 'R1', 'R2', 'R3', 'R4']) {
    assert.equal(validateContract('goal', { ...goal, risk }).valid, true, `rejected risk ${risk}`);
  }
  assert.equal(validateContract('goal', { ...goal, risk: 'R5' }).valid, false);
});

console.log('contract tests: 1 passed');
