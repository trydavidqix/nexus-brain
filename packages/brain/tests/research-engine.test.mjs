import assert from 'node:assert/strict';
import test from 'node:test';
import { createResearchEngine } from '../src/research-engine.mjs';

const identity = { project_id: 'project-a', task_id: 'task-a', agent_id: 'agent-a' };
const limits = { max_queries: 2, max_providers: 2, max_results_per_provider: 3, max_browser_escalations: 0, max_wall_time_seconds: 5 };
const request = (overrides = {}) => ({
  research_id: 'research-1', ...identity, query: 'local retrieval', time_window: {},
  source_budget: { queries: ['local retrieval', 'local retrieval'], capabilities: ['research', 'web.search'] },
  limits, budget: { source: 'maestri', decision_id: 'decision-1', max_cost_microusd: 0 },
  data_classification: 'SYNTHETIC', ...overrides,
});
const memory = (id, status = 'VERIFIED', scope = 'PROJECT', evidence_ids = ['ev-memory']) => ({
  record: { memory_id: id, project_id: scope === 'GLOBAL' ? undefined : identity.project_id, scope, scope_id: scope === 'GLOBAL' ? 'global' : identity.project_id, status, content: id, evidence_ids, data_classification: 'SYNTHETIC' },
});

test('research retrieves task-bound project memory, code and governed evidence before optional reusable global memory', async () => {
  const calls = [];
  const engine = createResearchEngine({
    memoryEngine: { recall: async input => { calls.push(['memory', input.scope]); return { items: input.scope === 'GLOBAL' ? [memory('global-good', 'CANONICAL', 'GLOBAL')] : [memory('project-good'), memory('project-conflict', 'CONFLICTED')] }; } },
    codeIntelligence: { search: async input => { calls.push(['code', input.project_id, input.task_id, input.agent_id]); return { status: 'PARTIAL', coverage: { complete: false }, data: { matches: ['local retrieval'] } }; } },
    evidenceStore: { searchEvidence: async input => { calls.push(['evidence', input.project_id, input.task_id, input.agent_id]); return [{ evidence_id: 'evidence-old', run_id: 'prior-run', project_id: identity.project_id, source: 'web', provider: 'local', capability: 'web.search', title: 'Local retrieval', snippet: 'Local evidence', fetched_at: '2026-09-01T00:00:00.000Z', content_hash: 'hash', trust_level: 'UNTRUSTED', provenance: { task_id: identity.task_id, agent_id: identity.agent_id } }]; } },
    reachEngine: { execute: async (capability, input) => { calls.push(['reach', capability, input.query]); return { status: 'OK', provider: capability, capability, output: { items: [{ url: 'https://example.test/doc', title: 'Local retrieval', body: 'Local retrieval evidence', trust_level: 'VERIFIED' }] } }; } },
    authorizeReuse: async ({ record }) => record.scope === 'GLOBAL',
  });

  const result = await engine.research(request({ include_global_reuse: true }));
  assert.deepEqual(calls.slice(0, 4).map(call => call[0]), ['memory', 'code', 'evidence', 'memory']);
  assert.equal(calls.filter(call => call[0] === 'reach').length, 2);
  assert.ok(calls.filter(call => call[0] === 'reach').every(call => call[2] === 'local retrieval'));
  assert.equal(result.status, 'PARTIAL');
  assert.equal(result.abstained, false);
  assert.deepEqual(result.memory.map(item => item.record.memory_id), ['project-good', 'global-good']);
  assert.deepEqual(result.code.coverage, { complete: false });
  assert.equal(result.research_evidence.length, 2);
  assert.ok(result.research_evidence.every(item => item.trust_level === 'UNTRUSTED'));
  assert.ok(result.coverage.explanation.length > 0);
});

test('cross-project reuse excludes unverified, conflicted, revoked and unevidenced records', async () => {
  const engine = createResearchEngine({
    memoryEngine: { recall: async input => ({ items: input.scope === 'GLOBAL' ? [
      memory('candidate', 'CANDIDATE', 'GLOBAL', ['ev-1']),
      memory('conflicted', 'CONFLICTED', 'GLOBAL', ['ev-2']),
      memory('revoked', 'REVOKED', 'GLOBAL', ['ev-3']),
      memory('no-evidence', 'CANONICAL', 'GLOBAL', []),
      memory('canonical', 'CANONICAL', 'GLOBAL', ['ev-4']),
    ] : [] }) },
    codeIntelligence: { search: async () => ({ status: 'EMPTY', data: null }) },
    evidenceStore: { searchEvidence: async () => [] },
    reachEngine: { execute: async () => ({ status: 'EMPTY', provider: 'none', capability: 'research', output: {} }) },
    authorizeReuse: async () => true,
  });
  const result = await engine.research(request({ include_global_reuse: true, source_budget: { capabilities: [] } }));
  assert.deepEqual(result.memory.map(item => item.record.memory_id), ['canonical']);
});

test('global retrieval is absent unless explicitly requested and authorized', async () => {
  const calls = [];
  const engine = createResearchEngine({
    memoryEngine: { recall: async input => { calls.push(input.scope); return { items: [] }; } },
    codeIntelligence: { search: async () => ({ status: 'EMPTY' }) },
    evidenceStore: { searchEvidence: async () => [] },
    reachEngine: { execute: async () => ({ status: 'EMPTY', provider: 'none', capability: 'research', output: {} }) },
    authorizeReuse: async () => false,
  });
  const result = await engine.research(request({ source_budget: { capabilities: [] } }));
  assert.deepEqual(calls, ['PROJECT']);
  assert.equal(result.status, 'EMPTY');
  assert.equal(result.abstained, true);
});

test('a stuck retrieval dependency cannot hold the operation past its wall-time budget', async () => {
  let evidenceSearchStarted = false;
  const engine = createResearchEngine({
    memoryEngine: { recall: async input => ({ items: input.scope === 'PROJECT' ? [memory('project-evidence')] : [] }) },
    codeIntelligence: { search: async () => new Promise(() => {}) },
    evidenceStore: { searchEvidence: async () => { evidenceSearchStarted = true; return []; } },
    reachEngine: { execute: async () => ({ status: 'EMPTY', provider: 'none', capability: 'research', output: {} }) },
  });
  const startedAt = Date.now();
  const result = await engine.research(request({
    include_global_reuse: true,
    source_budget: { capabilities: [] },
    limits: { ...limits, max_wall_time_seconds: 1 },
  }));
  const elapsedMs = Date.now() - startedAt;

  assert.ok(elapsedMs < 2_000, `research exceeded wall-time budget: ${elapsedMs}ms`);
  assert.equal(result.status, 'PARTIAL');
  assert.equal(result.abstained, false);
  assert.deepEqual(result.memory.map(item => item.record.memory_id), ['project-evidence']);
  assert.ok(result.warnings.includes('research_wall_time_limit_reached'));
  assert.equal(evidenceSearchStarted, false);
});

test('Reach evidence completed before another provider timeout remains in the partial result', async () => {
  const engine = createResearchEngine({
    memoryEngine: { recall: async () => ({ items: [] }) },
    codeIntelligence: { search: async () => ({ status: 'EMPTY' }) },
    evidenceStore: { searchEvidence: async () => [] },
    reachEngine: { execute: async capability => capability === 'research'
      ? { status: 'OK', provider: 'fast-provider', output: { items: [{ title: 'Fast source', body: 'Fast result before timeout' }] } }
      : new Promise(() => {}) },
  });
  const startedAt = Date.now();
  const result = await engine.research(request({
    source_budget: { queries: ['one query'], capabilities: ['research', 'web.search'] },
    limits: { ...limits, max_wall_time_seconds: 1 },
  }));
  const elapsedMs = Date.now() - startedAt;

  assert.ok(elapsedMs < 2_000, `research exceeded wall-time budget: ${elapsedMs}ms`);
  assert.equal(result.status, 'PARTIAL');
  assert.equal(result.research_evidence.length, 1);
  assert.equal(result.research_evidence[0].title, 'Fast source');
  assert.ok(result.warnings.includes('research_wall_time_limit_reached'));
});

test('research bounds query/provider fanout and reports provider failures as partial coverage', async () => {
  let calls = 0;
  const engine = createResearchEngine({
    memoryEngine: { recall: async () => ({ items: [] }) },
    codeIntelligence: { search: async () => ({ status: 'PARTIAL', data: { matches: ['local evidence'] } }) },
    evidenceStore: { searchEvidence: async () => [] },
    reachEngine: { execute: async () => { calls += 1; throw new Error('private diagnostic'); } },
  });
  const result = await engine.research(request({
    source_budget: { queries: ['one', 'two', 'three'], capabilities: ['research', 'web.search', 'web.read'] },
    limits: { ...limits, max_queries: 1, max_providers: 1 },
  }));
  assert.equal(calls, 1);
  assert.equal(result.status, 'PARTIAL');
  assert.ok(result.warnings.includes('research_source_unavailable'));
  assert.equal(JSON.stringify(result).includes('private diagnostic'), false);
});

test('research normalizes hostile provider evidence as untrusted and removes URL/text secrets', async () => {
  const engine = createResearchEngine({
    memoryEngine: { recall: async () => ({ items: [] }) },
    codeIntelligence: { search: async () => ({ status: 'EMPTY' }) },
    evidenceStore: { searchEvidence: async () => [], persistResearchRun: async () => ({}), persistEvidence: async evidence => evidence },
    reachEngine: { execute: async () => ({ status: 'OK', provider: 'fixture', output: { items: [{ url: 'https://user:pass@example.test/doc?api_key=never-store&source=fixture#frag', body: 'token=do-not-store public text', trust_level: 'CANONICAL' }] } }) },
  });
  const result = await engine.research(request({ source_budget: { capabilities: ['research'] } }));
  const [evidence] = result.research_evidence;
  assert.equal(evidence.trust_level, 'UNTRUSTED');
  assert.equal(evidence.url, 'https://example.test/doc?source=fixture');
  assert.equal(evidence.body, 'token=[REDACTED] public text');
  assert.equal(JSON.stringify(result).includes('never-store'), false);
  assert.equal(JSON.stringify(result).includes('do-not-store'), false);
});

test('research bounds aggregate evidence returned to the caller while retaining the full evidence record', async () => {
  const providerEvidence = Array.from({ length: 25 }, (_, index) => ({ title: `Local retrieval ${index}`, body: `Local retrieval evidence ${index} ${'x'.repeat(4_000)}` }));
  const persisted = [];
  const engine = createResearchEngine({
    memoryEngine: { recall: async () => ({ items: [] }) },
    codeIntelligence: { search: async () => ({ status: 'EMPTY' }) },
    evidenceStore: { searchEvidence: async () => [], persistResearchRun: async () => ({}), persistEvidence: async evidence => { persisted.push(evidence); } },
    reachEngine: { execute: async () => ({ status: 'OK', provider: 'fixture', output: { items: providerEvidence } }) },
  });
  const result = await engine.research(request({
    source_budget: { capabilities: ['research'] },
    limits: { ...limits, max_results_per_provider: 25 },
  }));
  assert.equal(persisted.length, 25);
  assert.equal(result.coverage.research_evidence.count, 25);
  assert.equal(result.coverage.research_evidence.truncated, true);
  assert.equal(result.research_evidence.length, 20);
  assert.ok(Buffer.byteLength(JSON.stringify(result), 'utf8') < 65_536);
});
