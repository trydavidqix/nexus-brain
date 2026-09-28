import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateContract } from '../src/index.mjs';

const request = {
  project_id: 'nexus-brain',
  factory_run_id: 'factory-1',
  requested_by: 'owner',
  objective: 'Build a bounded provider-neutral capability',
  requirements: ['reuse existing Nexus owners before building'],
  constraints: ['no duplicate control plane'],
  risk_level: 'R2',
  discovery_budget: { max_queries: 8, max_candidates: 12, max_minutes: 20 },
  repository: { full_name: 'trydavidqix/nexus-brain', default_branch: 'main' },
};

const plan = {
  project_id: 'nexus-brain',
  factory_run_id: 'factory-1',
  status: 'READY',
  discovery_evidence_ids: ['evidence-1'],
  architecture_decisions: ['Reach owns capability discovery'],
  resource_decisions: [{
    capability: 'web.interact',
    disposition: 'REUSE',
    implementation: 'BrowserMesh',
    reason: 'Canonical Nexus owner already exists',
    evidence_ids: ['evidence-1'],
  }],
  task_graph: [{
    task_id: 'factory-1-t1',
    objective: 'Add contract-first support',
    depends_on: [],
    acceptance_criteria: ['schema validates', 'tests pass'],
    required_capabilities: ['coding', 'tests'],
  }],
  completion_gates: ['unit-tests', 'independent-review'],
  human_gates: ['R3-or-R4-side-effects'],
};

test('validates bounded Project Factory requests and plans', () => {
  assert.equal(validateContract('project-factory-request', request).valid, true);
  assert.equal(validateContract('project-factory-plan', plan).valid, true);
});

test('rejects unknown build/reuse dispositions and plans without completion gates', () => {
  const badDisposition = validateContract('project-factory-plan', {
    ...plan,
    resource_decisions: [{ ...plan.resource_decisions[0], disposition: 'INSTALL_RANDOMLY' }],
  });
  assert.equal(badDisposition.valid, false);

  const noGates = validateContract('project-factory-plan', { ...plan, completion_gates: [] });
  assert.equal(noGates.valid, false);
});
