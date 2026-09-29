import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateContract } from '../src/index.mjs';

const validPlan = {
  task_id: 'nexus-task-1-nb13',
  agent_id: '/root',
  goal_id: 'nexus-task-1-25-milestones',
  task_type: 'ARCHITECTURE',
  risk_level: 'R3',
  ceremony: 'HEAVY',
  scope_size: 'NB-13 only',
  expected_files: ['packages/control-plane/src/maestri-orchestrator.ts'],
  expected_tests: ['packages/control-plane/tests/maestri-orchestrator.test.ts'],
  contract_impact: ['nexus.engineering-plan.v2'],
  testability: 'unit and integration',
  execution_mode: 'write',
  autonomy_level: 'A3',
  quality_profile: 'DEEP',
  model_profile: 'default-codex',
  skill_policy: {
    required: ['core-discipline'],
    optional: [],
    forbidden: [],
    loaded: ['core-discipline'],
    completed: [],
  },
  context_budget: { input_tokens: 10000 },
  tool_profile: ['git', 'node', 'pnpm'],
  verification_gates: ['unit-tests', 'typecheck', 'review', 'ci'],
  stop_conditions: ['architecture ambiguity', 'paid resource required'],
  delivery_policy: { branch_only: 'codex/nb13-maestri-control-plane' },
};

test('accepts versioned EngineeringPlan v2 and keeps v1 as a separate contract', () => {
  const result = validateContract('engineering-plan-v2', validPlan);
  const { goal_id: _goalId, ceremony: _ceremony, quality_profile: _quality, model_profile: _model, stop_conditions: _stops, ...v1Plan } = validPlan;

  assert.equal(result.valid, true, result.errors.join(', '));
  assert.equal(result.schema_id, 'nexus.engineering-plan.v2');
  const legacyResult = validateContract('engineering-plan', v1Plan);
  assert.equal(legacyResult.valid, true, legacyResult.errors.join(', '));
  assert.equal(legacyResult.schema_id, 'nexus.engineering-plan.v1');
});

test('rejects missing required v2 additions', () => {
  for (const field of ['goal_id', 'ceremony', 'quality_profile', 'model_profile', 'stop_conditions']) {
    const plan = { ...validPlan };
    delete plan[field];
    const result = validateContract('engineering-plan-v2', plan);

    assert.equal(result.valid, false, `${field} must be required`);
    if (result.schema_id === 'nexus.engineering-plan.v2') {
      assert.ok(result.errors.includes(`$.${field}: required`), `${field} should name missing field`);
    }
  }
});

test('rejects invalid ceremony and quality profile values', () => {
  assert.equal(validateContract('engineering-plan-v2', { ...validPlan, ceremony: 'UNBOUNDED' }).valid, false);
  assert.equal(validateContract('engineering-plan-v2', { ...validPlan, quality_profile: 'UNBOUNDED' }).valid, false);
});

test('rejects an empty model profile or empty stop condition list', () => {
  assert.equal(validateContract('engineering-plan-v2', { ...validPlan, model_profile: '' }).valid, false);
  assert.equal(validateContract('engineering-plan-v2', { ...validPlan, stop_conditions: [] }).valid, false);
});

test('rejects unrecognized top-level authority fields in v2', () => {
  const result = validateContract('engineering-plan-v2', { ...validPlan, dispatch: { target: 'provider' } });

  assert.equal(result.valid, false);
  if (result.schema_id === 'nexus.engineering-plan.v2') {
    assert.ok(result.errors.includes('$.dispatch: additional property not allowed'));
  }
});
