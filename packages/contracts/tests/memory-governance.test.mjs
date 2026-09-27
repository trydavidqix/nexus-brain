import assert from 'node:assert/strict';
import test from 'node:test';
import { contractSchema, validateContract } from '../src/index.mjs';

const timestamp = '2026-09-27T00:00:00.000Z';
const record = {
  memory_id: 'memory-1',
  project_id: 'nexus-brain',
  scope: 'PROJECT',
  scope_id: 'nexus-brain',
  status: 'CANDIDATE',
  content: 'A candidate needs evidence before canonical promotion.',
  content_hash: 'sha256:content-1',
  evidence_ids: [],
  provenance: { source_type: 'task', source_id: 'task-1', actor_id: 'agent-1' },
  temporal: { observed_at: timestamp, recorded_at: timestamp, valid_from: timestamp },
  acl: { policy_id: 'default-deny', read_permission_ids: [], write_permission_ids: [] },
  version: 1
};

const event = {
  event_id: 'memory-event-1',
  memory_id: 'memory-1',
  project_id: 'nexus-brain',
  scope: 'PROJECT',
  scope_id: 'nexus-brain',
  event_type: 'OBSERVED',
  recorded_at: timestamp,
  actor: { actor_id: 'agent-1', actor_type: 'agent' },
  provenance: { source_type: 'task', source_id: 'task-1' },
  payload: { content_hash: 'sha256:abc123' }
};

test('defines versioned canonical record and append-only event contracts', () => {
  assert.equal(contractSchema('memory-record').$id, 'nexus.memory-record.v1');
  assert.equal(contractSchema('memory-event').$id, 'nexus.memory-event.v1');
  assert.equal(validateContract('memory-record', record).valid, true);
  assert.equal(validateContract('memory-event', event).valid, true);
});

test('requires explicit scope, temporal facts, provenance, and ACL bindings', () => {
  for (const field of ['scope_id', 'provenance', 'temporal', 'acl']) {
    const missing = { ...record };
    delete missing[field];
    assert.equal(validateContract('memory-record', missing).valid, false, field);
  }
  assert.equal(validateContract('memory-record', { ...record, project_id: undefined }).valid, false);
  assert.equal(validateContract('memory-record', { ...record, scope_id: 'another-project' }).valid, false);
  const { project_id: _projectId, ...globalRecord } = record;
  assert.equal(validateContract('memory-record', { ...globalRecord, scope: 'GLOBAL', scope_id: 'global' }).valid, true);
  assert.equal(validateContract('memory-record', { ...record, scope: 'GLOBAL', scope_id: 'global', project_id: 'nexus-brain' }).valid, false);
});

test('prevents invalid temporal intervals and canonical promotion without evidence', () => {
  const invalidInterval = { ...record, temporal: { ...record.temporal, valid_until: timestamp } };
  assert.equal(validateContract('memory-record', invalidInterval).valid, false);
  assert.equal(validateContract('memory-record', { ...record, status: 'CANONICAL' }).valid, false);
  assert.equal(validateContract('memory-record', { ...record, status: 'VERIFIED' }).valid, false);
  assert.equal(validateContract('memory-record', { ...record, status: 'CANONICAL', evidence_ids: ['evidence-1'] }).valid, true);
});

test('records lifecycle and memory-use events without permitting mutable update events', () => {
  for (const event_type of ['OBSERVED', 'CANDIDATE', 'VERIFIED', 'CANONICAL', 'SUPERSEDED', 'CONFLICTED', 'REVOKED', 'RECALLED', 'SELECTED', 'INJECTED', 'USED', 'VALIDATED', 'CONTRIBUTED']) {
    const usage = ['RECALLED', 'SELECTED', 'INJECTED', 'USED', 'VALIDATED', 'CONTRIBUTED'].includes(event_type);
    assert.equal(validateContract('memory-event', { ...event, event_type, ...(usage ? { task_id: 'task-1', agent_id: 'agent-1' } : {}) }).valid, true, event_type);
  }
  assert.equal(validateContract('memory-event', { ...event, event_type: 'UPDATED' }).valid, false);
  const noActor = { ...event, actor: undefined };
  assert.equal(validateContract('memory-event', noActor).valid, false);
});

test('keeps evidence untrusted and sightings/run provenance separately addressable', () => {
  const evidence = {
    evidence_id: 'evidence-1', project_id: 'nexus-brain', run_id: 'run-1', source: 'https://example.test',
    provider: 'web.read', capability: 'web.read', fetched_at: timestamp, trust_level: 'UNTRUSTED', provenance: { source_id: 'source-1' }
  };
  const sighting = {
    sighting_id: 'sighting-1', evidence_id: 'evidence-1', project_id: 'nexus-brain', run_id: 'run-1',
    observed_at: timestamp, source: 'https://example.test', content_hash: 'sha256:sighting-1', provenance: { source_id: 'source-1' }
  };
  const researchRun = {
    run_id: 'run-1', project_id: 'nexus-brain', task_id: 'task-1', agent_id: 'agent-1', status: 'OK',
    started_at: timestamp, completed_at: timestamp, evidence_ids: ['evidence-1'], warnings: [],
    limits: { max_queries: 2, max_providers: 2, max_results_per_provider: 4, max_browser_escalations: 0, max_wall_time_seconds: 30 },
    budget: {}, provenance: { source: 'research-engine' }
  };
  assert.equal(validateContract('evidence', evidence).valid, true);
  assert.equal(validateContract('memory-sighting', sighting).valid, true);
  assert.equal(validateContract('research-run', researchRun).valid, true);
  assert.equal(validateContract('evidence', { ...evidence, trust_level: 'TRUSTED' }).valid, false);
  assert.equal(validateContract('research-run', { ...researchRun, completed_at: '2026-09-26T00:00:00.000Z' }).valid, false);
});
