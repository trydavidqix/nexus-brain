import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrainApi } from '../src/brain-api.mjs';

const identity = { project_id: 'project-a', task_id: 'task-a', agent_id: 'agent-a' };
const request = (operation, input = {}) => ({ request_id: 'request-1', ...identity, operation, input });
const principal = (capabilities = ['brain.search']) => ({ identity, capabilities });
const reachBudget = (capability = 'research') => ({
  source: 'maestri', decision_id: 'decision-1', identity, capability,
  limits: { max_queries: 3, max_providers: 2, max_results_per_provider: 5, max_browser_escalations: 1, max_wall_time_seconds: 30 },
  max_cost_microusd: 0,
});

test('denies requests when the trusted caller cannot authenticate', async () => {
  const api = createBrainApi({ authenticate: async () => null });
  const response = await api.handle(request('brain_search'));
  assert.equal(response.status, 'AUTH_REQUIRED');
  assert.equal(response.data.error_code, 'auth_required');
});

test('does not construct a Brain API without a trusted authenticator', () => {
  assert.throws(() => createBrainApi(), /trusted authenticator/);
});

test('rejects a caller identity that does not match the authenticated task and agent', async () => {
  const api = createBrainApi({ authenticate: async () => ({ ...principal(), identity: { ...identity, agent_id: 'other-agent' } }), memoryEngine: { recall: async () => { throw new Error('must_not_run'); } } });
  const response = await api.handle(request('brain_search'));
  assert.equal(response.status, 'AUTH_REQUIRED');
  assert.equal(response.data.error_code, 'identity_mismatch');
});

test('requires operation capability before calling canonical memory search', async () => {
  let calls = 0;
  const api = createBrainApi({ authenticate: async () => principal([]), memoryEngine: { recall: async () => { calls += 1; return { items: [] }; } } });
  const response = await api.handle(request('brain_search', { query: 'synthetic', data_classification: 'SYNTHETIC' }));
  assert.equal(response.status, 'POLICY_DENIED');
  assert.equal(calls, 0);
});

test('blocks unclassified queries before they reach Hindsight', async () => {
  let calls = 0;
  const api = createBrainApi({ authenticate: async () => principal(), memoryEngine: { recall: async () => { calls += 1; return { items: [] }; } } });
  const response = await api.handle(request('brain_search', { query: 'private query' }));
  assert.equal(response.status, 'POLICY_DENIED');
  assert.equal(response.data.error_code, 'safe_data_classification_required');
  assert.equal(calls, 0);
});

test('search returns canonical records with source, provenance, coverage and trust', async () => {
  let received;
  const api = createBrainApi({
    authenticate: async () => principal(),
    memoryEngine: { recall: async input => { received = input; return { items: [{ record: { memory_id: 'memory-1', content: 'synthetic fact', status: 'CANDIDATE' }, scores: { final: 0.9 } }], source: 'hindsight', scope: 'PROJECT' }; } },
  });
  const response = await api.handle(request('brain_search', { query: 'synthetic', data_classification: 'SYNTHETIC' }));
  assert.equal(received.project_id, 'project-a');
  assert.equal(received.task_id, 'task-a');
  assert.equal(received.agent_id, 'agent-a');
  assert.equal(response.status, 'OK');
  assert.equal(response.source, 'hindsight');
  assert.deepEqual(response.provenance, { request_id: 'request-1' });
  assert.equal(response.coverage, 'FULL');
  assert.equal(response.trust_level, 'CANDIDATE');
  assert.equal(response.data.items[0].record.memory_id, 'memory-1');
});

test('requires a separate grant before project search can include global memory', async () => {
  let calls = 0;
  const api = createBrainApi({ authenticate: async () => principal(['brain.search']), memoryEngine: { recall: async () => { calls += 1; return { items: [] }; } } });
  const response = await api.handle(request('brain_search', { query: 'synthetic', data_classification: 'SYNTHETIC', include_global: true }));
  assert.equal(response.status, 'POLICY_DENIED');
  assert.equal(response.data.error_code, 'global_read_denied');
  assert.equal(calls, 0);
});

test('remember rejects canonical promotion through provider-facing request', async () => {
  let calls = 0;
  const api = createBrainApi({ authenticate: async () => principal(['brain.remember']), memoryEngine: { retain: async () => { calls += 1; } } });
  const record = {
    memory_id: 'memory-verified', project_id: identity.project_id, scope: 'PROJECT', scope_id: identity.project_id,
    status: 'CANONICAL', content: 'synthetic verified fact', content_hash: 'sha256:test', evidence_ids: ['evidence-1'],
    provenance: { source_type: 'agent_observation', source_id: 'request-1', actor_id: identity.agent_id, task_id: identity.task_id },
    temporal: { observed_at: '2026-09-27T00:00:00.000Z', recorded_at: '2026-09-27T00:00:00.000Z', valid_from: '2026-09-27T00:00:00.000Z' },
    acl: { policy_id: 'default-deny', read_permission_ids: [], write_permission_ids: [] }, data_classification: 'SYNTHETIC', version: 1,
  };
  const response = await api.handle(request('brain_remember', { record }));
  assert.equal(response.status, 'POLICY_DENIED');
  assert.equal(response.data.error_code, 'promotion_requires_validation');
  assert.equal(calls, 0);
});

test('remember accepts only validated candidate records attributed to the current task and agent', async () => {
  let saved;
  const record = {
    memory_id: 'memory-1', project_id: identity.project_id, scope: 'PROJECT', scope_id: identity.project_id,
    status: 'CANDIDATE', content: 'synthetic decision', content_hash: 'sha256:test', evidence_ids: [],
    provenance: { source_type: 'agent_observation', source_id: 'request-1', actor_id: identity.agent_id, task_id: identity.task_id },
    temporal: { observed_at: '2026-09-27T00:00:00.000Z', recorded_at: '2026-09-27T00:00:00.000Z', valid_from: '2026-09-27T00:00:00.000Z' },
    acl: { policy_id: 'default-deny', read_permission_ids: [], write_permission_ids: [] }, data_classification: 'SYNTHETIC', version: 1,
  };
  const api = createBrainApi({ authenticate: async () => principal(['brain.remember']), memoryEngine: { retain: async value => { saved = value; return { record: value, indexed: true }; } } });
  const result = await api.handle(request('brain_remember', { record }));
  assert.equal(result.status, 'OK');
  assert.equal(result.trust_level, 'CANDIDATE');
  assert.equal(saved.memory_id, 'memory-1');
});

test('remember cannot write a task-scoped candidate into another task partition', async () => {
  let calls = 0;
  const record = {
    memory_id: 'memory-other-task', project_id: identity.project_id, scope: 'TASK', scope_id: 'task-other', task_id: 'task-other',
    status: 'CANDIDATE', content: 'synthetic decision', content_hash: 'sha256:test', evidence_ids: [],
    provenance: { source_type: 'agent_observation', source_id: 'request-1', actor_id: identity.agent_id, task_id: identity.task_id },
    temporal: { observed_at: '2026-09-27T00:00:00.000Z', recorded_at: '2026-09-27T00:00:00.000Z', valid_from: '2026-09-27T00:00:00.000Z' },
    acl: { policy_id: 'default-deny', read_permission_ids: [], write_permission_ids: [] }, data_classification: 'SYNTHETIC', version: 1,
  };
  const api = createBrainApi({ authenticate: async () => principal(['brain.remember']), memoryEngine: { retain: async () => { calls += 1; } } });
  const response = await api.handle(request('brain_remember', { record }));
  assert.equal(response.status, 'POLICY_DENIED');
  assert.equal(response.data.error_code, 'task_scope_mismatch');
  assert.equal(calls, 0);
});

test('remember cannot write a session-scoped candidate into another session partition', async () => {
  let calls = 0;
  const record = {
    memory_id: 'memory-other-session', project_id: identity.project_id, scope: 'SESSION', scope_id: 'session-other', session_id: 'session-other',
    status: 'CANDIDATE', content: 'synthetic decision', content_hash: 'sha256:test', evidence_ids: [],
    provenance: { source_type: 'agent_observation', source_id: 'request-1', actor_id: identity.agent_id, task_id: identity.task_id },
    temporal: { observed_at: '2026-09-27T00:00:00.000Z', recorded_at: '2026-09-27T00:00:00.000Z', valid_from: '2026-09-27T00:00:00.000Z' },
    acl: { policy_id: 'default-deny', read_permission_ids: [], write_permission_ids: [] }, data_classification: 'SYNTHETIC', version: 1,
  };
  const api = createBrainApi({ authenticate: async () => principal(['brain.remember']), memoryEngine: { retain: async () => { calls += 1; } } });
  const response = await api.handle(request('brain_remember', { record }));
  assert.equal(response.status, 'POLICY_DENIED');
  assert.equal(response.data.error_code, 'session_scope_mismatch');
  assert.equal(calls, 0);
});

test('bounds local search input before calling the code facade', async () => {
  let calls = 0;
  const api = createBrainApi({ authenticate: async () => principal(['code.search']), localSearch: { search: async () => { calls += 1; return { items: [] }; } } });
  const response = await api.handle(request('local_search', { query: 'x'.repeat(4_001) }));
  assert.equal(response.status, 'BLOCKED');
  assert.equal(response.data.error_code, 'input_limit_exceeded');
  assert.equal(calls, 0);
});

test('bounds edit-context paths and bytes before calling the code facade', async () => {
  let calls = 0;
  const api = createBrainApi({ authenticate: async () => principal(['code.search']), localSearch: { editContext: async () => { calls += 1; return { files: [] }; } } });
  const response = await api.handle(request('local_search', { mode: 'edit_context', paths: ['src/a.ts'], max_bytes: 65_537 }));
  assert.equal(response.status, 'BLOCKED');
  assert.equal(response.data.error_code, 'input_limit_exceeded');
  assert.equal(calls, 0);
});

test('routes only bounded research and web capabilities through the reach facade', async () => {
  const seen = [];
  const api = createBrainApi({
    authenticate: async () => principal(['research', 'web.search', 'reach:admin']),
    resolveReachBudget: async ({ capability }) => reachBudget(capability),
    reach: {
      research: async input => {
        seen.push(input.capability);
        assert.equal(input.policy.reach_budget.source, 'maestri');
        assert.equal('limits' in input.input, false);
        assert.equal('budget' in input.input, false);
        assert.equal('source_budget' in input.input, false);
        return { status: 'OK', provider: 'local-research', output: { evidence_ids: ['e-1'] }, evidence_ids: ['e-1'] };
      },
      web: async input => { seen.push(input.capability); assert.equal(input.policy.reach_budget.max_cost_microusd, 0); return { status: 'EMPTY', provider: 'no-provider', output: {}, evidence_ids: [] }; },
    },
  });
  const research = await api.handleReach({ ...identity, capability: 'research', input: { query: 'synthetic', limits: { max_queries: 2 }, budget: { max_cost_microusd: 9_999_999 }, source_budget: { providers: ['caller-selected'] } }, policy: { data_classification: 'SYNTHETIC', max_cost_microusd: 9_999_999 } });
  const web = await api.handleReach({ ...identity, capability: 'web.search', input: { query: 'synthetic' }, policy: { data_classification: 'NON_SENSITIVE' } });
  const unknown = await api.handleReach({ ...identity, capability: 'admin', input: {}, policy: { data_classification: 'SYNTHETIC' } });
  assert.deepEqual(seen, ['research', 'web.search']);
  assert.equal(research.status, 'OK');
  assert.equal(research.coverage, 'FULL');
  assert.equal(web.status, 'EMPTY');
  assert.equal(unknown.status, 'BLOCKED');
});

test('does not dispatch Reach without a trusted Maestri budget', async () => {
  let calls = 0;
  const api = createBrainApi({ authenticate: async () => principal(['research']), reach: { research: async () => { calls += 1; } } });
  const response = await api.handleReach({ ...identity, capability: 'research', input: { query: 'synthetic' }, policy: { data_classification: 'SYNTHETIC' } });
  assert.equal(response.status, 'POLICY_DENIED');
  assert.equal(response.data.error_code, 'reach_budget_unavailable');
  assert.equal(calls, 0);
});

test('rejects a caller request that exceeds Maestri Reach limits before adapter dispatch', async () => {
  let calls = 0;
  const api = createBrainApi({
    authenticate: async () => principal(['research']),
    resolveReachBudget: async () => reachBudget(),
    reach: { research: async () => { calls += 1; } },
  });
  const response = await api.handleReach({ ...identity, capability: 'research', input: { query: 'synthetic', limits: { max_queries: 4 } }, policy: { data_classification: 'SYNTHETIC' } });
  assert.equal(response.status, 'POLICY_DENIED');
  assert.equal(response.data.error_code, 'reach_budget_exceeded');
  assert.equal(calls, 0);
});

test('rejects a Maestri Reach budget bound to another task', async () => {
  let calls = 0;
  const api = createBrainApi({
    authenticate: async () => principal(['research']),
    resolveReachBudget: async () => ({ ...reachBudget(), identity: { ...identity, task_id: 'other-task' } }),
    reach: { research: async () => { calls += 1; } },
  });
  const response = await api.handleReach({ ...identity, capability: 'research', input: { query: 'synthetic' }, policy: { data_classification: 'SYNTHETIC' } });
  assert.equal(response.status, 'POLICY_DENIED');
  assert.equal(response.data.error_code, 'reach_budget_invalid');
  assert.equal(calls, 0);
});

test('blocks research without safe data classification before provider dispatch', async () => {
  let calls = 0;
  const api = createBrainApi({ authenticate: async () => principal(['research']), reach: { research: async () => { calls += 1; return { status: 'OK' }; } } });
  const response = await api.handleReach({ ...identity, capability: 'research', input: { query: 'unclassified' }, policy: {} });
  assert.equal(response.status, 'POLICY_DENIED');
  assert.equal(response.data.error_code, 'safe_data_classification_required');
  assert.equal(calls, 0);
});

test('returns sanitized degraded status when an internal adapter throws', async () => {
  const api = createBrainApi({ authenticate: async () => principal(), memoryEngine: { recall: async () => { throw new Error('token=private-value'); } } });
  const response = await api.handle(request('brain_search', { query: 'synthetic', data_classification: 'SYNTHETIC' }));
  assert.equal(response.status, 'DEGRADED');
  assert.deepEqual(response.data, { error_code: 'operation_failed' });
  assert.equal(JSON.stringify(response).includes('private-value'), false);
});
