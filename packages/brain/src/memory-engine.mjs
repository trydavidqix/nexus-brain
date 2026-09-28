import { randomUUID } from 'node:crypto';
import { validateContract } from '@nexus-brain/contracts';

const EXTERNAL_CLASSIFICATIONS = new Set(['SYNTHETIC', 'NON_SENSITIVE']);
const isExternalSafe = classification => EXTERNAL_CLASSIFICATIONS.has(classification);

export function createMemoryEngine({ store, hindsight, authorizeRead = async () => false, authorizePromotion = async () => false }) {
  if (!store?.persistRecord || !store?.getByIds || !store?.recordEvent || !store?.health || !hindsight?.retain || !hindsight?.recall || !hindsight?.reflect || !hindsight?.health) {
    throw new Error('MemoryEngine requires a canonical store and Hindsight adapter.');
  }

  async function retain(record, options = {}) {
    const validation = validateContract('memory-record', record);
    if (!validation.valid) throw new Error('Memory record failed the versioned memory-record contract.');
    if (['VERIFIED', 'CANONICAL'].includes(record.status) && await authorizePromotion({ record }) !== true) throw new Error('Memory promotion requires explicit validation approval.');
    await store.persistRecord(record, options);
    if (!isExternalSafe(record.data_classification)) return { record, indexed: false, reason: 'classification-blocks-external-provider' };
    try {
      const index = await hindsight.retain(record);
      return { record, indexed: true, index };
    } catch {
      throw new Error('Canonical memory is committed; Hindsight indexing failed. Retry retain with the same memory_id and version.');
    }
  }

  async function recall(input = {}) {
    if (!input.task_id || !input.agent_id) throw new Error('Memory recall requires task_id and agent_id for audit provenance.');
    if (!isExternalSafe(input.data_classification)) throw new Error('Hindsight recall requires explicitly classified SYNTHETIC or NON_SENSITIVE query data.');
    const primaryScope = input.scope || 'PROJECT';
    const scopeId = input.scope_id || (primaryScope === 'GLOBAL' ? 'global' : primaryScope === 'PROJECT' ? input.project_id : primaryScope === 'SESSION' ? input.session_id : input.task_id);
    const filters = { project_id: primaryScope === 'GLOBAL' ? null : input.project_id, scope: primaryScope, scope_id: scopeId, session_id: input.session_id, task_id: input.task_id, agent_id: input.agent_id };
    const responses = [{ scope: primaryScope, result: await hindsight.recall({ ...input, scope: primaryScope }) }];
    if (input.include_global === true && primaryScope === 'PROJECT') {
      responses.push({ scope: 'GLOBAL', result: await hindsight.recall({ query: input.query, scope: 'GLOBAL', data_classification: input.data_classification, top_k: input.top_k }) });
    }
    const items = [];
    const seen = new Set();
    for (const response of responses) {
      const facts = Array.isArray(response.result?.results) ? response.result.results : [];
      const ids = facts.map(item => String(item.document_id || '').replace(/^nexus-memory-/, '')).filter(Boolean);
      const responseFilters = response.scope === 'GLOBAL' ? { project_id: null, scope: 'GLOBAL', scope_id: 'global' } : filters;
      const canonical = await store.getByIds(ids, responseFilters);
      const byId = new Map(canonical.map(record => [record.memory_id, record]));
      for (const fact of facts) {
        const id = String(fact.document_id || '').replace(/^nexus-memory-/, '');
        const record = byId.get(id);
        if (!record || seen.has(id)) continue;
        if (await authorizeRead({ record, input }) !== true) continue;
        seen.add(id);
        const event = { event_id: randomUUID(), memory_id: record.memory_id, project_id: record.project_id ?? undefined, scope: record.scope, scope_id: record.scope_id, event_type: 'RECALLED', recorded_at: new Date().toISOString(), task_id: input.task_id, session_id: input.session_id, agent_id: input.agent_id, trace_id: input.trace_id, actor: { actor_id: input.agent_id, actor_type: 'agent' }, provenance: { source_type: 'hindsight', source_id: fact.id, evidence_ids: record.evidence_ids, attributes: { engine: 'hindsight' } }, payload: { query_id: input.trace_id || input.task_id } };
        await store.recordEvent(event);
        items.push({ record, scores: fact.scores || null });
      }
    }
    return { items: items.slice(0, Math.min(Math.max(Number(input.top_k) || 5, 1), 20)), source: 'hindsight', scope: primaryScope };
  }

  async function reflect(input = {}) {
    if (!isExternalSafe(input.data_classification)) throw new Error('Hindsight reflect requires explicitly classified SYNTHETIC or NON_SENSITIVE query data.');
    const result = await hindsight.reflect(input);
    return { status: 'CANDIDATE', content: String(result?.text || ''), based_on: result?.based_on || null, provenance: { source_type: 'hindsight.reflect', source_id: input.trace_id || input.task_id || 'unattributed' }, data_classification: input.data_classification };
  }

  async function health() {
    const [database, memoryEngine] = await Promise.all([store.health(), hindsight.health()]);
    return { healthy: database.healthy === true && memoryEngine.healthy === true, database, memory_engine: memoryEngine };
  }

  return Object.freeze({ retain, recall, search: recall, relate: recall, reflect, health });
}
