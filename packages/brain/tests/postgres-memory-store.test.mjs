import assert from 'node:assert/strict';
import test from 'node:test';
import { PostgresMemoryStore } from '../src/postgres-memory-store.mjs';

test('canonical task lookup binds project, task, scope id, and originating agent', async () => {
  let captured;
  const store = new PostgresMemoryStore({ connect: async () => ({ release() {} }), query: async (sql, values) => { captured = { sql, values }; return { rows: [] }; } });
  await store.getByIds(['memory-1'], { project_id: 'nexus-brain', scope: 'TASK', scope_id: 'task-1', task_id: 'task-1', agent_id: 'agent-1' });
  assert.match(captured.sql, /scope_id = \$4/);
  assert.match(captured.sql, /task_id = \$6/);
  assert.match(captured.sql, /provenance->>'actor_id' = \$7/);
  assert.deepEqual(captured.values.slice(0, 7), [['memory-1'], 'TASK', 'nexus-brain', 'task-1', null, 'task-1', 'agent-1']);
});

test('canonical task lookup fails closed without agent scope', async () => {
  let queried = false;
  const store = new PostgresMemoryStore({ connect: async () => ({ release() {} }), query: async () => { queried = true; return { rows: [] }; } });
  await assert.rejects(store.getByIds(['memory-1'], { project_id: 'nexus-brain', scope: 'TASK', scope_id: 'task-1', task_id: 'task-1' }), /task_id and agent_id/);
  assert.equal(queried, false);
});

test('persist rejects a task record with mismatched task scope before connecting', async () => {
  let connected = false;
  const store = new PostgresMemoryStore({ query: async () => ({ rows: [] }), connect: async () => { connected = true; throw new Error('unexpected connection'); } });
  const stamp = '2026-09-27T00:00:00.000Z';
  const record = { memory_id: 'memory-1', project_id: 'nexus-brain', scope: 'TASK', scope_id: 'task-other', task_id: 'task-1', status: 'CANDIDATE', content: 'synthetic task memory', content_hash: 'sha256:test', data_classification: 'SYNTHETIC', evidence_ids: [], provenance: { source_type: 'test', source_id: 'task-1', actor_id: 'agent-1' }, temporal: { observed_at: stamp, recorded_at: stamp, valid_from: stamp }, acl: { policy_id: 'default-deny', read_permission_ids: [], write_permission_ids: [] }, version: 1 };
  await assert.rejects(store.persistRecord(record), /scope identifiers/);
  assert.equal(connected, false);
});

test('research run, raw evidence, and sightings use separate typed canonical stores', async () => {
  const statements = [];
  const pool = { connect: async () => ({ release() {} }), query: async (sql, values) => { statements.push({ sql, values }); return { rowCount: 1, rows: [] }; } };
  const store = new PostgresMemoryStore(pool);
  const run = { run_id: 'run-1', project_id: 'project-1', task_id: 'task-1', agent_id: 'agent-1', status: 'OK', started_at: '2026-09-27T00:00:00.000Z', completed_at: '2026-09-27T00:00:01.000Z', evidence_ids: ['evidence-1'], warnings: [], limits: { max_queries: 1, max_providers: 1, max_results_per_provider: 1, max_browser_escalations: 0, max_wall_time_seconds: 30 }, budget: { cost_limit: 0 }, provenance: { source_type: 'test', source_id: 'task-1' } };
  const evidence = { evidence_id: 'evidence-1', project_id: 'project-1', run_id: 'run-1', source: 'synthetic', provider: 'fixture', capability: 'local', fetched_at: '2026-09-27T00:00:01.000Z', content_hash: 'sha256:synthetic', trust_level: 'UNTRUSTED', provenance: { source_type: 'test', source_id: 'task-1' }, body: 'synthetic only', relevance: 0.5 };
  const sighting = { sighting_id: 'sighting-1', evidence_id: 'evidence-1', project_id: 'project-1', run_id: 'run-1', observed_at: '2026-09-27T00:00:02.000Z', source: 'synthetic', content_hash: 'sha256:synthetic', provenance: { source_type: 'test', source_id: 'task-1' } };
  assert.deepEqual(await store.persistResearchRun(run), { inserted: true, run_id: 'run-1' });
  assert.deepEqual(await store.persistEvidence(evidence), { inserted: true, evidence_id: 'evidence-1' });
  assert.deepEqual(await store.recordEvidenceSighting(sighting), { inserted: true, sighting_id: 'sighting-1' });
  assert.match(statements[0].sql, /nexus_research_runs/);
  assert.match(statements[1].sql, /nexus_evidence_records/);
  assert.match(statements[2].sql, /nexus_evidence_sightings/);
  assert.equal(statements[1].values[15], 'UNTRUSTED');
});

test('raw evidence contract rejects a trusted classification before database access', async () => {
  let queried = false;
  const store = new PostgresMemoryStore({ connect: async () => ({ release() {} }), query: async () => { queried = true; return { rowCount: 1, rows: [] }; } });
  await assert.rejects(store.persistEvidence({ evidence_id: 'evidence-1', project_id: 'project-1', run_id: 'run-1', source: 'synthetic', provider: 'fixture', capability: 'local', fetched_at: '2026-09-27T00:00:00.000Z', content_hash: 'sha256:synthetic', trust_level: 'CANONICAL', provenance: {} }), /evidence contract/);
  assert.equal(queried, false);
});

test('PostgreSQL store rejects canonical promotion without an explicit approval authorizer', async () => {
  let connected = false;
  const store = new PostgresMemoryStore({ query: async () => ({ rows: [] }), connect: async () => { connected = true; throw new Error('unexpected connection'); } });
  const stamp = '2026-09-27T00:00:00.000Z';
  const record = { memory_id: 'memory-verified', project_id: 'nexus-brain', scope: 'PROJECT', scope_id: 'nexus-brain', status: 'CANONICAL', content: 'synthetic fact', content_hash: 'sha256:test', data_classification: 'SYNTHETIC', evidence_ids: ['evidence-1'], provenance: { source_type: 'test', source_id: 'task-1', actor_id: 'agent-1' }, temporal: { observed_at: stamp, recorded_at: stamp, valid_from: stamp }, acl: { policy_id: 'default-deny', read_permission_ids: [], write_permission_ids: [] }, version: 1 };
  await assert.rejects(store.persistRecord(record), /explicit validation approval/);
  assert.equal(connected, false);
});
