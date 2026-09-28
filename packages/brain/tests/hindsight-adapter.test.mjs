import assert from 'node:assert/strict';
import test from 'node:test';
import { createHindsightAdapter } from '../src/hindsight-adapter.mjs';
function fakeFetch(responses = []) { const requests = []; const fetchImpl = async (url, options = {}) => { requests.push({ url, options }); const next = responses.shift() || { status: 200, body: {} }; return { ok: next.status >= 200 && next.status < 300, status: next.status, json: async () => next.body }; }; return { fetchImpl, requests }; }
test('rejects non-local endpoints and unclassified data', async () => {
 assert.throws(() => createHindsightAdapter({ baseUrl: 'https://example.test' }), /local HTTP endpoint/); const { fetchImpl, requests } = fakeFetch(); const adapter = createHindsightAdapter({ fetchImpl });
 await assert.rejects(adapter.reflect({ query: 'synthetic question' }), /explicit SYNTHETIC or NON_SENSITIVE/); await assert.rejects(adapter.retain({ memory_id: 'm1', content: 'synthetic fact' }), /explicit SYNTHETIC or NON_SENSITIVE/); assert.equal(requests.length, 0);
});
test('retain uses documented bank and task-agent scoped memory metadata', async () => {
 const { fetchImpl, requests } = fakeFetch([{ status: 200, body: { bank_id: 'project-test' } }, { status: 200, body: { success: true, items_count: 1 } }]); const result = await createHindsightAdapter({ fetchImpl }).retain({ memory_id: 'memory-1', project_id: 'nexus-brain', scope: 'TASK', task_id: 'task-7', status: 'CANDIDATE', version: 1, data_classification: 'SYNTHETIC', content: 'The test task uses an isolated Nexus project.', provenance: { actor_id: 'agent-7' }, temporal: { observed_at: '2026-09-27T00:00:00.000Z' } });
 assert.equal(result.success, true); assert.equal(requests[0].options.method, 'PUT'); assert.equal(requests[1].options.method, 'POST'); assert.match(requests[1].url, /\/memories$/); const body = JSON.parse(requests[1].options.body);
 assert.equal(body.async, false); assert.equal(body.items[0].document_id, 'nexus-memory-memory-1'); assert.deepEqual(body.items[0].tags, ['nexus', 'scope:task', 'project:nexus-brain', 'task:task-7', 'agent:agent-7']); assert.equal(body.items[0].metadata.nexus_status, 'CANDIDATE');
});
test('recall and reflect use documented endpoints with strict scope tags', async () => {
 const { fetchImpl, requests } = fakeFetch([{ status: 200, body: {} }, { status: 200, body: { results: [] } }, { status: 200, body: {} }, { status: 200, body: { text: 'synthetic answer' } }]); const adapter = createHindsightAdapter({ fetchImpl }); const input = { project_id: 'nexus-brain', task_id: 'task-8', agent_id: 'agent-8', scope: 'TASK', query: 'Where is the synthetic task isolated?', data_classification: 'NON_SENSITIVE' };
 await adapter.recall(input); await adapter.reflect(input); assert.match(requests[1].url, /\/memories\/recall$/); assert.match(requests[3].url, /\/reflect$/); const recallBody = JSON.parse(requests[1].options.body); const reflectBody = JSON.parse(requests[3].options.body);
 assert.equal(recallBody.tags_match, 'all_strict'); assert.equal(reflectBody.tags_match, 'all_strict'); assert.deepEqual(recallBody.tags, ['nexus', 'scope:task', 'project:nexus-brain', 'task:task-8', 'agent:agent-8']); assert.deepEqual(reflectBody.include, { facts: {} });
});
test('project retrieval ignores caller task and agent tags', async () => {
 const { fetchImpl, requests } = fakeFetch([{ status: 200, body: {} }, { status: 200, body: { results: [] } }]);
 await createHindsightAdapter({ fetchImpl }).recall({ project_id: 'nexus-brain', task_id: 'task-current', agent_id: 'agent-current', scope: 'PROJECT', query: 'synthetic project fact', data_classification: 'SYNTHETIC' });
 const body = JSON.parse(requests[1].options.body);
 assert.deepEqual(body.tags, ['nexus', 'scope:project', 'project:nexus-brain']);
});
test('derives stable isolated Hindsight banks from project IDs', async () => {
 const { fetchImpl, requests } = fakeFetch(); const adapter = createHindsightAdapter({ fetchImpl });
 for (const project_id of ['project-alpha', 'project-beta', 'project-alpha']) {
  await adapter.recall({ project_id, scope: 'PROJECT', query: 'synthetic project fact', data_classification: 'SYNTHETIC' });
 }
 const bankIds = requests.filter(request => request.options.method === 'PUT').map(request => {
  const match = request.url.match(/\/v1\/default\/banks\/([^/]+)/);
  assert.ok(match, 'expected adapter to address a physical Hindsight bank');
  return decodeURIComponent(match[1]);
 });
 assert.equal(bankIds.length, 3);
 assert.equal(bankIds[0], bankIds[2]);
 assert.notEqual(bankIds[0], bankIds[1]);
});
test('task retrieval requires agent identity', async () => {
 const { fetchImpl, requests } = fakeFetch();
 await assert.rejects(createHindsightAdapter({ fetchImpl }).recall({ project_id: 'nexus-brain', task_id: 'task-9', scope: 'TASK', query: 'synthetic', data_classification: 'SYNTHETIC' }), /agent_id/);
 assert.equal(requests.length, 0);
});
test('request errors omit provider details and memory content', async () => { const { fetchImpl } = fakeFetch([{ status: 500, body: { detail: 'sensitive provider text' } }]); await assert.rejects(createHindsightAdapter({ fetchImpl }).health(), error => { assert.match(error.message, /HTTP 500/); assert.doesNotMatch(error.message, /sensitive provider text/); return true; }); });
