import { createHash } from 'node:crypto';
const DEFAULT_BASE_URL = 'http://127.0.0.1:8888';
const ALLOWED_EXTERNAL_CLASSIFICATIONS = new Set(['SYNTHETIC', 'NON_SENSITIVE']);
function assertLocalBaseUrl(value) { const url = new URL(value); if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Hindsight adapter only permits a local HTTP endpoint.'); return url.origin; }
function requireNonSensitive(classification) { if (!ALLOWED_EXTERNAL_CLASSIFICATIONS.has(classification)) throw new Error('Hindsight LLM operations require explicit SYNTHETIC or NON_SENSITIVE data classification.'); }
function normalizeScope(input = {}) {
 const scope = input.scope || 'PROJECT';
 if (!['GLOBAL', 'PROJECT', 'SESSION', 'TASK'].includes(scope)) throw new Error('Unsupported Nexus memory scope.');
 if (scope !== 'GLOBAL' && !input.project_id) throw new Error('Project, session, and task memory require project_id.');
 if (scope === 'SESSION' && !input.session_id) throw new Error('Session memory requires session_id.');
 if (scope === 'TASK' && !input.task_id) throw new Error('Task memory requires task_id.');
 if (scope === 'TASK' && !input.agent_id) throw new Error('Task memory requires agent_id for isolated retrieval.');
 const tags = ['nexus', 'scope:' + scope.toLowerCase()];
 if (input.project_id) tags.push('project:' + input.project_id);
 if (scope === 'SESSION') tags.push('session:' + input.session_id);
 if (scope === 'TASK') tags.push('task:' + input.task_id, 'agent:' + input.agent_id);
 return { scope, bank_id: scope === 'GLOBAL' ? 'global' : 'project-' + createHash('sha256').update(input.project_id).digest('hex').slice(0, 24), tags };
}
export function createHindsightAdapter({ baseUrl = process.env.NEXUS_HINDSIGHT_URL || DEFAULT_BASE_URL, fetchImpl = globalThis.fetch, timeoutMs = 120_000 } = {}) {
 const origin = assertLocalBaseUrl(baseUrl); if (typeof fetchImpl !== 'function') throw new Error('A Fetch-compatible implementation is required.');
 async function request(path, { method = 'GET', body } = {}) {
  let response; try { response = await fetchImpl(origin + path, { method, headers: body === undefined ? undefined : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) }); } catch { throw new Error('Hindsight local request failed before receiving an HTTP response.'); }
  if (!response.ok) throw new Error('Hindsight local request failed with HTTP ' + response.status + '.'); if (response.status === 204) return null;
  try { return await response.json(); } catch { throw new Error('Hindsight returned an invalid JSON response.'); }
 }
 const bankPath = id => '/v1/default/banks/' + encodeURIComponent(id);
 async function ensureBank(id) { await request(bankPath(id), { method: 'PUT', body: {} }); }
 async function health() { const result = await request('/health'); return { healthy: result?.status === 'healthy' || result?.status === 'ok', database: result?.database ?? null }; }
 async function retain(record) {
  requireNonSensitive(record?.data_classification); if (!record?.memory_id || !record?.content || !record?.temporal?.observed_at) throw new Error('Hindsight retain requires a canonical memory id, content, and observed_at timestamp.');
  const scope = normalizeScope({ ...record, agent_id: record.agent_id || record.provenance?.actor_id }); await ensureBank(scope.bank_id);
  return request(bankPath(scope.bank_id) + '/memories', { method: 'POST', body: { items: [{ content: record.content, timestamp: record.temporal.observed_at, context: 'Nexus governed memory candidate; canonical policy remains in Nexus.', document_id: 'nexus-memory-' + record.memory_id, metadata: { nexus_memory_id: record.memory_id, nexus_scope: scope.scope, nexus_status: record.status, nexus_version: String(record.version) }, tags: scope.tags }], async: false } });
 }
 async function recall(input = {}) {
  requireNonSensitive(input.data_classification); if (!input.query) throw new Error('Hindsight recall requires a query.'); const scope = normalizeScope(input); await ensureBank(scope.bank_id);
  return request(bankPath(scope.bank_id) + '/memories/recall', { method: 'POST', body: { query: input.query, types: ['world', 'experience', 'observation'], budget: input.budget || 'mid', max_tokens: Math.min(Math.max(Number(input.max_tokens) || 4096, 1), 8192), tags: scope.tags, tags_match: 'all_strict' } });
 }
 async function reflect(input = {}) {
  requireNonSensitive(input.data_classification); if (!input.query) throw new Error('Hindsight reflect requires a query.'); const scope = normalizeScope(input); await ensureBank(scope.bank_id);
  return request(bankPath(scope.bank_id) + '/reflect', { method: 'POST', body: { query: input.query, budget: input.budget || 'low', max_tokens: Math.min(Math.max(Number(input.max_tokens) || 4096, 1), 8192), tags: scope.tags, tags_match: 'all_strict', include: { facts: {} } } });
 }
 return Object.freeze({ health, retain, recall, search: recall, relate: recall, reflect });
}
