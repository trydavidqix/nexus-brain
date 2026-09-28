import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateContract } from '../src/index.mjs';

const input = {
  project_id: 'nexus-brain',
  task_id: 'task-1',
  agent_id: 'maestri',
  decision_id: 'decision-1',
  proposed_route: 'execute',
  risk: 'R1',
  priority: 1,
  policy: { denied: false, approval_required: false, retry_allowed: true },
  signals: { exact: true, calibrated_confidence: 1 },
  evidence_refs: ['evidence-1'],
};

const result = {
  project_id: 'nexus-brain',
  task_id: 'task-1',
  agent_id: 'maestri',
  decision_id: 'decision-1',
  route: 'execute',
  risk: 'R1',
  priority: 1,
  retry_allowed: true,
  needs_review: false,
  needs_approval: false,
  needs_ceo: false,
  abstain: false,
  confidence: 1,
  decision_source: 'deterministic',
  reason_codes: ['exact_deterministic_match'],
  evidence_refs: ['evidence-1'],
};

test('validates typed Maestri decision input and result', () => {
  assert.equal(validateContract('maestri-decision-input', input).valid, true);
  assert.equal(validateContract('maestri-decision-result', result).valid, true);
});

test('rejects out-of-range confidence and unknown decision sources', () => {
  assert.equal(validateContract('maestri-decision-input', {
    ...input,
    signals: { ...input.signals, calibrated_confidence: 1.2 },
  }).valid, false);
  assert.equal(validateContract('maestri-decision-result', {
    ...result,
    decision_source: 'secret_router',
  }).valid, false);
});
