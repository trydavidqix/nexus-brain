import { createHash } from 'node:crypto';
import { assertContract, validateContract } from '@nexus-brain/contracts';
import { redactText } from '@nexus-brain/evidence/redaction';

const EXTERNAL_CLASSIFICATIONS = new Set(['SYNTHETIC', 'NON_SENSITIVE']);
const RESEARCH_CAPABILITIES = new Set(['research', 'web.search', 'github.search', 'reddit.search', 'youtube.search', 'x.search']);
const EXCLUDED_MEMORY_STATES = new Set(['SUPERSEDED', 'CONFLICTED', 'REVOKED']);
const REUSABLE_MEMORY_STATES = new Set(['VERIFIED', 'CANONICAL']);
const MAX_RESULTS = 100;
const MAX_INPUT_BYTES = 16_384;
const MAX_QUERY_LENGTH = 4_000;
const MAX_OUTPUT_BYTES = 65_536;
const DEADLINE_REACHED = Symbol('research-deadline-reached');
const hash = value => createHash('sha256').update(String(value)).digest('hex');
const bounded = (value, fallback, max = MAX_RESULTS) => Number.isSafeInteger(value) && value >= 0 ? Math.min(value, max) : fallback;
const clampScore = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : null;

function cleanText(value, max) {
  return typeof value === 'string' ? value.slice(0, max) : undefined;
}

function canonicalUrl(value) {
  if (typeof value !== 'string' || value.length > 4_096) return undefined;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    url.username = '';
    url.password = '';
    for (const name of [...url.searchParams.keys()]) {
      if (/(?:^|[_-])(?:api[_-]?key|key|token|secret|password|passwd|auth|authorization|cookie|credential)(?:$|[_-])/i.test(name)) url.searchParams.delete(name);
    }
    url.hash = '';
    return url.toString();
  } catch { return undefined; }
}

function queryTerms(query) {
  return [...new Set(String(query).toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || [])];
}

function relevanceOf(item, query) {
  const terms = queryTerms(query);
  if (!terms.length) return 0;
  const text = `${item.title || ''} ${item.snippet || ''} ${item.body || ''}`.toLowerCase();
  return terms.filter(term => text.includes(term)).length / terms.length;
}

function evidenceFrom(raw, request, runId, query, capability, provider) {
  const title = cleanText(redactText(raw?.title), 2_000);
  const body = cleanText(redactText(raw?.body ?? raw?.content), 32_000);
  const snippet = cleanText(redactText(raw?.snippet ?? raw?.summary), 4_000);
  const url = canonicalUrl(raw?.url ?? raw?.canonical_url);
  const contentHash = raw?.content_hash || hash(`${title || ''}\n${body || ''}\n${snippet || ''}`);
  const canonical = url || contentHash;
  const fetchedAt = Number.isFinite(Date.parse(raw?.fetched_at)) ? new Date(raw.fetched_at).toISOString() : new Date().toISOString();
  const id = `research-evidence-${hash(`${request.project_id}\0${runId}\0${canonical}`).slice(0, 32)}`;
  const evidence = {
    evidence_id: id,
    project_id: request.project_id,
    run_id: runId,
    source: cleanText(redactText(raw?.source), 300) || provider,
    provider: cleanText(redactText(raw?.provider), 300) || provider,
    capability: cleanText(redactText(raw?.capability), 100) || capability,
    ...(url ? { url, canonical_url: url } : {}),
    ...(title ? { title } : {}),
    ...(body ? { body } : {}),
    ...(snippet ? { snippet } : {}),
    ...(typeof raw?.author === 'string' ? { author: cleanText(redactText(raw.author), 500) } : {}),
    ...(Number.isFinite(Date.parse(raw?.published_at)) ? { published_at: new Date(raw.published_at).toISOString() } : {}),
    fetched_at: fetchedAt,
    relevance: clampScore(raw?.relevance) ?? relevanceOf({ title, body, snippet }, query),
    ...(clampScore(raw?.freshness) === null ? {} : { freshness: clampScore(raw.freshness) }),
    ...(clampScore(raw?.authority) === null ? {} : { authority: clampScore(raw.authority) }),
    query: redactText(query),
    ...(typeof raw?.extraction_method === 'string' ? { extraction_method: cleanText(redactText(raw.extraction_method), 100) } : {}),
    ...(typeof raw?.backend === 'string' ? { backend: cleanText(redactText(raw.backend), 100) } : {}),
    content_hash: contentHash,
    trust_level: 'UNTRUSTED',
    provenance: { source_type: 'reach', source_id: String(raw?.evidence_id || raw?.id || id), run_id: runId, capability, provider, task_id: request.task_id, agent_id: request.agent_id },
  };
  return validateContract('evidence', evidence).valid ? evidence : null;
}

function fuseEvidence(items) {
  const fused = new Map();
  for (const item of items) {
    const key = item.canonical_url || item.content_hash;
    const current = fused.get(key);
    if (!current) { fused.set(key, item); continue; }
    const queries = [...new Set([current.query, item.query].filter(Boolean))].sort();
    fused.set(key, {
      ...current,
      relevance: Math.max(current.relevance || 0, item.relevance || 0),
      ...(current.freshness === undefined && item.freshness !== undefined ? { freshness: item.freshness } : {}),
      ...(current.authority === undefined && item.authority !== undefined ? { authority: item.authority } : {}),
      query: queries.join(' | '),
      provenance: { ...current.provenance, sightings: [...new Set([current.provider, item.provider])] },
    });
  }
  return [...fused.values()].sort((a, b) => (b.relevance || 0) - (a.relevance || 0)
    || (b.freshness || 0) - (a.freshness || 0)
    || (b.authority || 0) - (a.authority || 0)
    || a.evidence_id.localeCompare(b.evidence_id));
}

function validMemoryItem(item, { projectId, taskId, agentId, sessionId, global = false }) {
  const record = item?.record;
  if (!record || EXCLUDED_MEMORY_STATES.has(record.status)) return false;
  if (global) return record.scope === 'GLOBAL' && record.scope_id === 'global' && !record.project_id
    && REUSABLE_MEMORY_STATES.has(record.status) && Array.isArray(record.evidence_ids) && record.evidence_ids.length > 0
    && EXTERNAL_CLASSIFICATIONS.has(record.data_classification);
  if (record.project_id !== projectId || record.scope === 'GLOBAL') return false;
  if (record.scope === 'TASK' && (record.task_id !== taskId || record.scope_id !== taskId || record.provenance?.actor_id !== agentId)) return false;
  if (record.scope === 'SESSION' && (!sessionId || record.session_id !== sessionId || record.scope_id !== sessionId)) return false;
  return true;
}

function rankMemory(items) {
  return items.sort((left, right) => (right.scores?.final ?? 0) - (left.scores?.final ?? 0)
    || String(left.record.memory_id).localeCompare(String(right.record.memory_id)));
}

function statusFor({ evidenceCount, warnings, routeStatuses, codeStatus, timedOut }) {
  if (timedOut && !evidenceCount) return 'TIMEOUT';
  if (!evidenceCount) return warnings.length ? 'DEGRADED' : 'EMPTY';
  if (warnings.length || routeStatuses.some(status => status !== 'OK' && status !== 'EMPTY') || codeStatus === 'PARTIAL' || codeStatus === 'DEGRADED') return 'PARTIAL';
  return 'OK';
}

function compactCode(code) {
  try {
    if (Buffer.byteLength(JSON.stringify(code), 'utf8') <= 16_384) return code;
  } catch { /* return a bounded metadata view for malformed adapter results */ }
  return {
    status: code?.status || 'PARTIAL',
    source: code?.source || 'code-intelligence',
    coverage: code?.coverage || { state: 'unknown', complete: false },
    confidence: code?.confidence ?? null,
    truncated: true,
  };
}

function boundResult(result) {
  const fits = () => Buffer.byteLength(JSON.stringify(result), 'utf8') <= MAX_OUTPUT_BYTES;
  if (fits()) return result;
  result.status = 'PARTIAL';
  result.warnings = [...new Set([...result.warnings, 'research_output_limit_applied'])];
  result.summary = 'Research output was bounded; use the scoped evidence IDs to retrieve source records.';
  result.code = compactCode(result.code);
  result.memory = result.memory.slice(0, 10).map(item => ({
    ...item,
    record: { ...item.record, content: redactText(item.record.content).slice(0, 1_000) },
  }));
  result.research_evidence = result.research_evidence.slice(0, 10).map(item => ({
    ...item,
    title: item.title?.slice(0, 300),
    body: item.body?.slice(0, 1_000),
    snippet: item.snippet?.slice(0, 1_000),
    query: item.query?.slice(0, 500),
  }));
  result.grounded_findings = result.research_evidence.map(item => ({ evidence_id: item.evidence_id, excerpt: item.snippet || item.title || '', trust_level: 'UNTRUSTED' }));
  if (fits()) return result;
  result.memory = result.memory.slice(0, 3);
  result.research_evidence = result.research_evidence.slice(0, 3);
  result.grounded_findings = result.grounded_findings.slice(0, 3);
  if (fits()) return result;
  result.memory = [];
  result.research_evidence = [];
  result.grounded_findings = [];
  result.code = { status: result.code?.status || 'PARTIAL', truncated: true };
  return result;
}

export function createResearchEngine({ memoryEngine, codeIntelligence, evidenceStore, reachEngine, authorizeReuse = async () => false, now = () => new Date() } = {}) {
  if (!memoryEngine?.recall) throw new Error('ResearchEngine requires the canonical MemoryEngine.');
  if (typeof authorizeReuse !== 'function') throw new Error('ResearchEngine requires a cross-project reuse authorizer.');

  async function research(request) {
    assertContract('research-request', request);
    if (!EXTERNAL_CLASSIFICATIONS.has(request.data_classification)) throw new Error('Research requires an explicit SYNTHETIC or NON_SENSITIVE data classification.');
    if (Buffer.byteLength(JSON.stringify(request), 'utf8') > MAX_INPUT_BYTES || request.query.length > MAX_QUERY_LENGTH) throw new Error('Research request exceeded the configured input limit.');
    if (!Number.isSafeInteger(request.limits.max_wall_time_seconds) || request.limits.max_wall_time_seconds < 1) throw new Error('Research requires a positive Maestri wall-time limit.');
    const started = now();
    const deadline = Date.now() + request.limits.max_wall_time_seconds * 1000;
    const controller = new AbortController();
    let timedOut = false;
    let resolveDeadline;
    const deadlineReached = new Promise(resolve => { resolveDeadline = () => resolve(DEADLINE_REACHED); });
    const deadlineTimer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      resolveDeadline();
    }, Math.max(0, deadline - Date.now()));
    const withinDeadline = async operation => {
      if (timedOut || controller.signal.aborted) {
        timedOut = true;
        return DEADLINE_REACHED;
      }
      const pending = Promise.resolve().then(operation).then(value => ({ value }), error => ({ error }));
      const outcome = await Promise.race([pending, deadlineReached]);
      if (outcome === DEADLINE_REACHED) {
        timedOut = true;
        return DEADLINE_REACHED;
      }
      if (outcome.error) throw outcome.error;
      return outcome.value;
    };
    const markTimeout = () => {
      if (timedOut && !warnings.includes('research_wall_time_limit_reached')) warnings.push('research_wall_time_limit_reached');
    };
    const runId = request.run_id || `research-${request.research_id}`;
    const warnings = [];
    const queries = [...new Set((Array.isArray(request.source_budget.queries) ? request.source_budget.queries : [request.query])
      .filter(value => typeof value === 'string' && value.trim()).map(value => value.trim()))].slice(0, request.limits.max_queries);
    const capabilities = [...new Set((Array.isArray(request.source_budget.capabilities) ? request.source_budget.capabilities : [])
      .filter(value => RESEARCH_CAPABILITIES.has(value)))].slice(0, request.limits.max_providers);
    if (queries.length < (request.source_budget.queries?.length || 1)) warnings.push('query_limit_applied');
    if (capabilities.length < (request.source_budget.capabilities?.length || 0)) warnings.push('provider_limit_or_capability_filter_applied');

    let projectMemory = [];
    try {
      const projectRecall = await withinDeadline(() => memoryEngine.recall({
        query: request.query, project_id: request.project_id, task_id: request.task_id, agent_id: request.agent_id,
        session_id: request.session_id, scope: 'PROJECT', data_classification: request.data_classification,
        top_k: bounded(request.limits.max_results_per_provider, 5), include_global: false,
      }));
      if (projectRecall !== DEADLINE_REACHED) {
        projectMemory = (projectRecall?.items || []).filter(item => validMemoryItem(item, {
          projectId: request.project_id, taskId: request.task_id, agentId: request.agent_id, sessionId: request.session_id,
        })).slice(0, bounded(request.limits.max_results_per_provider, 5));
      } else markTimeout();
    } catch { warnings.push('project_memory_unavailable'); }

    let code = { status: 'EMPTY', data: null, coverage: { state: 'unavailable', complete: false } };
    if (!timedOut && (codeIntelligence?.search || codeIntelligence?.searchSymbol)) {
      try {
        const search = codeIntelligence.search || codeIntelligence.searchSymbol;
        const codeResult = await withinDeadline(() => search.call(codeIntelligence, { query: request.query, name: request.query, project_id: request.project_id, task_id: request.task_id, agent_id: request.agent_id, session_id: request.session_id, workspace_binding: request.workspace_binding, top_k: bounded(request.limits.max_results_per_provider, 5) }));
        if (codeResult === DEADLINE_REACHED) markTimeout();
        else code = codeResult || code;
        if (code.status === 'PARTIAL' || code.coverage?.complete === false) warnings.push('code_evidence_partial');
      } catch { warnings.push('code_evidence_unavailable'); }
    } else if (!timedOut) warnings.push('code_evidence_unavailable');

    let priorEvidence = [];
    if (!timedOut && evidenceStore?.searchEvidence) {
      try {
        const evidenceResult = await withinDeadline(() => evidenceStore.searchEvidence({ project_id: request.project_id, task_id: request.task_id, agent_id: request.agent_id, query: request.query, limit: bounded(request.limits.max_results_per_provider, 5) }));
        if (evidenceResult === DEADLINE_REACHED) markTimeout();
        else priorEvidence = evidenceResult;
      } catch { warnings.push('research_evidence_unavailable'); }
    } else if (!timedOut && !evidenceStore?.searchEvidence) warnings.push('research_evidence_unavailable');
    priorEvidence = (Array.isArray(priorEvidence) ? priorEvidence : []).filter(item => item?.project_id === request.project_id
      && item?.trust_level === 'UNTRUSTED'
      && item?.provenance?.task_id === request.task_id
      && item?.provenance?.agent_id === request.agent_id);

    let globalMemory = [];
    if (!timedOut && request.include_global_reuse === true) {
      try {
        const reusable = await withinDeadline(() => memoryEngine.recall({ query: request.query, scope: 'GLOBAL', data_classification: request.data_classification, top_k: bounded(request.limits.max_results_per_provider, 5), include_global: false }));
        if (reusable === DEADLINE_REACHED) markTimeout();
        for (const item of reusable?.items || []) {
          if (!validMemoryItem(item, { global: true })) continue;
          const authorized = await withinDeadline(() => authorizeReuse({ record: item.record, identity: { project_id: request.project_id, task_id: request.task_id, agent_id: request.agent_id }, query: request.query }));
          if (authorized === DEADLINE_REACHED) { markTimeout(); break; }
          if (authorized !== true) continue;
          globalMemory.push(item);
        }
      } catch { warnings.push('global_reuse_unavailable'); }
    }

    const providerJobs = [];
    const routeStatuses = [];
    const foundEvidence = [];
    if (!timedOut && capabilities.length && queries.length && request.budget?.source === 'maestri'
      && typeof request.budget.decision_id === 'string' && request.budget.decision_id.length > 0
      && Number.isSafeInteger(request.budget.max_cost_microusd) && request.budget.max_cost_microusd === 0
      && EXTERNAL_CLASSIFICATIONS.has(request.data_classification) && reachEngine?.execute) {
      const remainingMs = Math.max(0, deadline - Date.now());
      if (!remainingMs) {
          controller.abort();
          timedOut = true;
          markTimeout();
      } else {
          for (const query of queries) for (const capability of capabilities) {
            providerJobs.push(Promise.resolve().then(() => reachEngine.execute(capability, {
              project_id: request.project_id, task_id: request.task_id, agent_id: request.agent_id,
              query, time_window: request.time_window, max_results: bounded(request.limits.max_results_per_provider, 5),
              data_classification: request.data_classification,
            }, { budget: request.budget, limits: request.limits, deadline_at: new Date(deadline).toISOString(), signal: controller.signal })));
          }
          const observedResults = new Array(providerJobs.length);
          providerJobs.forEach((job, index) => {
            job.then(
              value => { observedResults[index] = { status: 'fulfilled', value }; },
              reason => { observedResults[index] = { status: 'rejected', reason }; },
            );
          });
          const results = await Promise.race([
            Promise.allSettled(providerJobs),
            new Promise(resolve => controller.signal.addEventListener('abort', () => resolve(null), { once: true })),
          ]);
          if (results === null) { timedOut = true; markTimeout(); }
          {
            const completedResults = results || observedResults;
            for (let index = 0; index < completedResults.length; index += 1) {
              const settled = completedResults[index];
              if (!settled) continue;
              if (settled.status === 'rejected') { warnings.push('research_source_unavailable'); continue; }
              const outcome = settled.value;
              const capability = capabilities[index % capabilities.length];
              const query = queries[Math.floor(index / capabilities.length)];
              if (!outcome || !['OK', 'EMPTY', 'PARTIAL'].includes(outcome.status)) { warnings.push('research_source_unavailable'); continue; }
              if (outcome.status === 'PARTIAL') warnings.push('research_source_partial');
              routeStatuses.push(outcome.status);
              const rows = outcome.output?.evidence || outcome.output?.items || outcome.output?.results || [];
              if (!Array.isArray(rows)) { warnings.push('research_source_schema_unavailable'); continue; }
              for (const raw of rows.slice(0, bounded(request.limits.max_results_per_provider, 5))) {
                if (foundEvidence.length >= MAX_RESULTS) { warnings.push('aggregate_result_limit_applied'); break; }
                const evidence = evidenceFrom(raw, request, runId, query, capability, outcome.provider || capability);
                if (evidence) foundEvidence.push(evidence);
                else warnings.push('research_source_schema_unavailable');
              }
            }
          }
      }
    } else if (!timedOut && capabilities.length) warnings.push(request.budget?.max_cost_microusd !== 0 ? 'research_budget_unavailable' : 'research_source_unavailable');

    const reranked = fuseEvidence([...priorEvidence, ...foundEvidence]).slice(0, MAX_RESULTS);
    const memory = [...rankMemory(projectMemory), ...rankMemory(globalMemory)];
    const codeCount = Array.isArray(code?.data?.matches) ? code.data.matches.length : Array.isArray(code?.items) ? code.items.length : code?.status === 'OK' ? 1 : 0;
    const evidenceCount = memory.length + codeCount + reranked.length;
    const abstained = evidenceCount === 0;
    const status = statusFor({ evidenceCount, warnings, routeStatuses, codeStatus: code.status, timedOut });
    const completed = now();
    const limits = { ...request.limits };
    const run = {
      run_id: runId, project_id: request.project_id, task_id: request.task_id, agent_id: request.agent_id,
      status, started_at: started.toISOString(), completed_at: completed.toISOString(),
      evidence_ids: reranked.map(item => item.evidence_id), warnings: [...new Set(warnings)], limits,
      budget: request.budget, provenance: { source_type: 'research-engine', source_id: request.research_id, task_id: request.task_id, agent_id: request.agent_id },
      summary: abstained ? undefined : `Retrieved ${evidenceCount} scoped memory, code, or research evidence item(s); external evidence remains untrusted.`,
    };
    assertContract('research-run', run);
    if (evidenceStore?.persistResearchRun) {
      try {
        const persistedRun = await withinDeadline(() => evidenceStore.persistResearchRun(run));
        if (persistedRun === DEADLINE_REACHED) markTimeout();
      }
      catch { warnings.push('research_run_persistence_unavailable'); }
    }
    const persisted = [];
    if (evidenceStore?.persistEvidence) {
      for (const evidence of foundEvidence) {
        try {
          const persistedEvidence = await withinDeadline(() => evidenceStore.persistEvidence(evidence));
          if (persistedEvidence === DEADLINE_REACHED) { markTimeout(); break; }
          persisted.push(evidence.evidence_id);
        }
        catch { warnings.push('research_evidence_persistence_unavailable'); }
      }
    } else if (foundEvidence.length) warnings.push('research_evidence_persistence_unavailable');
    const result = {
      ...run,
      status: statusFor({ evidenceCount, warnings, routeStatuses, codeStatus: code.status, timedOut }),
      abstained,
      memory: [...rankMemory(projectMemory).slice(0, 10), ...rankMemory(globalMemory).slice(0, 10)].map(item => ({
        ...item,
        record: { ...item.record, content: redactText(item.record.content).slice(0, 1_000) },
      })),
      code: compactCode(code),
      research_evidence: reranked.slice(0, 20).map(item => ({
        ...item, title: item.title?.slice(0, 300), body: item.body?.slice(0, 1_000),
        snippet: item.snippet?.slice(0, 1_000), query: item.query?.slice(0, 500),
      })),
      grounded_findings: reranked.slice(0, 20).map(item => ({ evidence_id: item.evidence_id, excerpt: (item.snippet || item.title || '').slice(0, 1_000), trust_level: 'UNTRUSTED' })),
      coverage: {
        project_memory: { status: projectMemory.length ? 'AVAILABLE' : warnings.includes('project_memory_unavailable') ? 'UNAVAILABLE' : 'EMPTY', count: projectMemory.length },
        global_reuse: { status: request.include_global_reuse === true ? globalMemory.length ? 'AVAILABLE' : 'EMPTY' : 'NOT_REQUESTED', count: globalMemory.length },
        code: { status: code.status || 'UNAVAILABLE', count: codeCount, complete: code.coverage?.complete === true },
        research_evidence: { status: reranked.length ? 'AVAILABLE' : 'EMPTY', count: reranked.length, truncated: reranked.length > 20 },
        providers: { requested: providerJobs.length, completed: routeStatuses.length, failed: warnings.filter(code => code === 'research_source_unavailable').length },
        explanation: `Project memory was retrieved before optional global reuse; ${projectMemory.length} project memory item(s), ${globalMemory.length} authorized reusable global item(s), ${codeCount} code item(s), and ${reranked.length} untrusted research item(s) selected. ${warnings.length ? 'Some sources or bounded limits were unavailable.' : 'All requested retrieval sources returned.'}`,
      },
      persisted_evidence_ids: persisted,
      warnings: [...new Set(warnings)],
    };
    const boundedResultValue = boundResult(result);
    const validation = validateContract('research-result', boundedResultValue);
    if (!validation.valid) throw new Error('Research result failed the versioned contract.');
    clearTimeout(deadlineTimer);
    return boundedResultValue;
  }

  return Object.freeze({ research });
}
