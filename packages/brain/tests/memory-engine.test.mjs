import assert from 'node:assert/strict';
import test from 'node:test';
import { createMemoryEngine } from '../src/memory-engine.mjs';
const stamp = '2026-09-27T00:00:00.000Z';
const record = { memory_id: 'memory-1', project_id: 'nexus-brain', scope: 'PROJECT', scope_id: 'nexus-brain', status: 'CANDIDATE', content: 'Synthetic architectural fact.', content_hash: 'sha256:test', data_classification: 'SYNTHETIC', evidence_ids: [], provenance: { source_type: 'test', source_id: 'task-1', actor_id: 'agent-1' }, temporal: { observed_at: stamp, recorded_at: stamp, valid_from: stamp }, acl: { policy_id: 'project-read-grant', read_permission_ids: ['read:nexus-brain'], write_permission_ids: [] }, version: 1 };
function fixture() { const calls = []; const stored = [record]; const store = { persistRecord: async value => { calls.push('persist'); stored.push(value); }, getByIds: async (ids, scope) => { calls.push({ type: 'canonical-filter', scope }); return stored.filter(item => ids.includes(item.memory_id) && item.scope === scope.scope && item.scope_id === scope.scope_id && (scope.scope === 'GLOBAL' ? !item.project_id : item.project_id === scope.project_id)); }, recordEvent: async event => { calls.push(event.event_type); }, health: async () => ({ healthy: true }) }; const hindsight = { retain: async () => { calls.push('index'); return { success: true }; }, recall: async () => ({ results: [{ id: 'fact-1', document_id: 'nexus-memory-memory-1', scores: { final: 0.9 } }, { id: 'untrusted', document_id: 'nexus-memory-foreign' }] }), reflect: async () => ({ text: 'Derived candidate', based_on: {} }), health: async () => ({ healthy: true }) }; const authorizeRead = async ({ record: candidate, input }) => input.permission_ids?.some(id => candidate.acl.read_permission_ids.includes(id)) === true; return { calls, store, hindsight, engine: createMemoryEngine({ store, hindsight, authorizeRead }) }; }
test('retain commits canonical record before Hindsight indexing', async () => { const f = fixture(); const result = await f.engine.retain(record); assert.equal(result.indexed, true); assert.deepEqual(f.calls.slice(0, 2), ['persist', 'index']); });
test('sensitive records remain canonical but never reach Hindsight provider', async () => { const f = fixture(); const result = await f.engine.retain({ ...record, data_classification: 'SENSITIVE' }); assert.equal(result.indexed, false); assert.equal(f.calls.includes('persist'), true); assert.equal(f.calls.includes('index'), false); });
test('recall returns only authorized canonical project records and records usage provenance', async () => { const f = fixture(); const result = await f.engine.recall({ query: 'synthetic', project_id: 'nexus-brain', task_id: 'task-2', agent_id: 'agent-2', permission_ids: ['read:nexus-brain'], scope: 'PROJECT', data_classification: 'SYNTHETIC' }); assert.equal(result.items.length, 1); assert.equal(result.items[0].record.memory_id, 'memory-1'); assert.equal(f.calls.some(call => call.type === 'canonical-filter' && call.scope.task_id === 'task-2'), true); assert.equal(f.calls.includes('RECALLED'), true); });
test('reflect remains an unpersisted candidate', async () => { const f = fixture(); const result = await f.engine.reflect({ query: 'synthetic', project_id: 'nexus-brain', task_id: 'task-3', data_classification: 'NON_SENSITIVE' }); assert.equal(result.status, 'CANDIDATE'); assert.equal(f.calls.length, 0); });
test('verified and canonical promotion fails closed without an approval authorizer', async () => { const f = fixture(); await assert.rejects(f.engine.retain({ ...record, status: 'CANONICAL', evidence_ids: ['evidence-1'] }), /explicit validation approval/); assert.equal(f.calls.length, 0); });
test('recall fails closed without task and agent attribution', async () => { const f = fixture(); await assert.rejects(f.engine.recall({ query: 'synthetic', project_id: 'nexus-brain', data_classification: 'SYNTHETIC' }), /task_id and agent_id/); assert.equal(f.calls.length, 0); });
test('project and global memories are retrieved separately and filtered by canonical scope', async () => {
  const f = fixture();
  const globalRecord = { ...record, memory_id: 'global-1', project_id: undefined, scope: 'GLOBAL', scope_id: 'global' };
  const requestedScopes = [];
  f.store.getByIds = async (ids, scope) => ids.flatMap(id => id === 'memory-1' && scope.scope === 'PROJECT' ? [record] : id === 'global-1' && scope.scope === 'GLOBAL' ? [globalRecord] : []);
  f.hindsight.recall = async input => { requestedScopes.push(input.scope); return { results: [{ id: input.scope, document_id: input.scope === 'GLOBAL' ? 'nexus-memory-global-1' : 'nexus-memory-memory-1' }] }; };
  const result = await f.engine.recall({ query: 'synthetic', project_id: 'nexus-brain', task_id: 'task-4', agent_id: 'agent-4', permission_ids: ['read:nexus-brain'], scope: 'PROJECT', data_classification: 'SYNTHETIC', include_global: true });
  assert.deepEqual(requestedScopes, ['PROJECT', 'GLOBAL']);
  assert.deepEqual(result.items.map(item => item.record.scope), ['PROJECT', 'GLOBAL']);
});
test('recall fails closed when no ACL authorizer or permission grant exists', async () => {
  const f = fixture();
  const engine = createMemoryEngine({ store: f.store, hindsight: f.hindsight });
  const result = await engine.recall({ query: 'synthetic', project_id: 'nexus-brain', task_id: 'task-5', agent_id: 'agent-5', scope: 'PROJECT', data_classification: 'SYNTHETIC' });
  assert.equal(result.items.length, 0);
  assert.equal(f.calls.includes('RECALLED'), false);
});
test('project recall is not expanded to global scope unless caller opts in', async () => {
  const f = fixture();
  await f.engine.recall({ query: 'synthetic', project_id: 'nexus-brain', task_id: 'task-6', agent_id: 'agent-6', permission_ids: ['read:nexus-brain'], scope: 'PROJECT', data_classification: 'SYNTHETIC' });
  assert.deepEqual(f.calls.filter(call => call.type === 'canonical-filter').map(call => call.scope.scope), ['PROJECT']);
  assert.deepEqual(f.calls.filter(call => call.type === 'canonical-filter').map(call => call.scope.scope_id), ['nexus-brain']);
});
