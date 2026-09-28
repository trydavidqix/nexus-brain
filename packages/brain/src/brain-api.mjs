import { assertContract, validateContract } from '@nexus-brain/contracts';

const MAX_INPUT_BYTES = 16_384;
const MAX_OUTPUT_BYTES = 65_536;
const MAX_QUERY_LENGTH = 4_000;
const MAX_TOP_K = 20;
const REACH_CAPABILITIES = new Set(['research', 'web.search']);
const REACH_LIMIT_FIELDS = Object.freeze([
  'max_queries',
  'max_providers',
  'max_results_per_provider',
  'max_browser_escalations',
  'max_wall_time_seconds',
]);
const BRAIN_CAPABILITIES = Object.freeze({
  brain_context: 'brain.context',
  brain_search: 'brain.search',
  brain_reuse: 'brain.reuse',
  brain_remember: 'brain.remember',
  local_search: 'code.search',
  brain_status: 'brain.status',
});

function sameIdentity(left, right) {
  return left?.project_id === right?.project_id
    && left?.task_id === right?.task_id
    && left?.agent_id === right?.agent_id
    && (left?.session_id ?? null) === (right?.session_id ?? null);
}

function response(request, status, data = {}, options = {}) {
  const coverage = options.coverage ?? (status === 'OK' ? 'FULL' : status === 'PARTIAL' || status === 'DEGRADED' ? 'PARTIAL' : 'MISSING');
  const value = {
    request_id: request.request_id ?? request.research_id ?? `${request.capability}:${request.task_id}`,
    project_id: request.project_id,
    task_id: request.task_id,
    agent_id: request.agent_id,
    status,
    source: options.source ?? 'nexus-brain-api',
    provenance: options.provenance ?? { request_id: request.request_id },
    coverage,
    trust_level: options.trust_level ?? 'UNVERIFIED',
    data,
  };
  assertContract('brain-response', value);
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > MAX_OUTPUT_BYTES) {
    return response(request, 'PARTIAL', { error_code: 'response_limit_exceeded' }, { coverage: 'PARTIAL' });
  }
  return value;
}

function statusOf(result) {
  if (['OK', 'EMPTY', 'PARTIAL', 'DEGRADED', 'BLOCKED', 'TIMEOUT', 'POLICY_DENIED', 'APPROVAL_REQUIRED', 'PROVIDER_DOWN', 'AUTH_REQUIRED', 'RATE_LIMITED', 'QUOTA_EXHAUSTED', 'SCHEMA_CHANGED', 'HOST_UNAVAILABLE'].includes(result?.status)) return result.status;
  if (Array.isArray(result?.items) && result.items.length === 0) return 'EMPTY';
  return 'OK';
}

function coverageOf(status) {
  if (status === 'OK') return 'FULL';
  if (status === 'PARTIAL' || status === 'DEGRADED') return 'PARTIAL';
  return 'MISSING';
}

function boundedInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  try { return Buffer.byteLength(JSON.stringify(input), 'utf8') <= MAX_INPUT_BYTES; } catch { return false; }
}

function authResult(request, principal, capability) {
  if (!principal?.identity || !Array.isArray(principal.capabilities)) return response(request, 'AUTH_REQUIRED', { error_code: 'auth_required' });
  if (!sameIdentity(request, principal.identity)) return response(request, 'AUTH_REQUIRED', { error_code: 'identity_mismatch' });
  if (!principal.capabilities.includes(capability)) return response(request, 'POLICY_DENIED', { error_code: 'capability_denied' });
  return null;
}

function validReachBudget(budget, identity, capability) {
  return budget?.source === 'maestri'
    && typeof budget.decision_id === 'string'
    && budget.decision_id.length > 0
    && budget.capability === capability
    && sameIdentity(identity, budget.identity)
    && REACH_LIMIT_FIELDS.every(field => Number.isSafeInteger(budget.limits?.[field]) && budget.limits[field] >= (field === 'max_wall_time_seconds' ? 1 : 0))
    && Number.isSafeInteger(budget.max_cost_microusd)
    && budget.max_cost_microusd >= 0;
}

export function createBrainApi({ authenticate, resolveReachBudget, memoryEngine, context, localSearch, reach } = {}) {
  if (typeof authenticate !== 'function') throw new Error('Brain API requires a trusted authenticator; requests fail closed.');

  async function handle(request, transportContext = {}) {
    const validation = validateContract('brain-request', request);
    if (!validation.valid) throw new Error('brain_request_invalid');
    if (!boundedInput(request.input)) return response(request, 'BLOCKED', { error_code: 'input_limit_exceeded' });
    if (typeof request.input.query === 'string' && request.input.query.length > MAX_QUERY_LENGTH) return response(request, 'BLOCKED', { error_code: 'input_limit_exceeded' });
    if (request.input.top_k !== undefined && (!Number.isInteger(request.input.top_k) || request.input.top_k < 1 || request.input.top_k > MAX_TOP_K)) return response(request, 'BLOCKED', { error_code: 'input_limit_exceeded' });

    let principal;
    try { principal = await authenticate({ request, transport: transportContext }); } catch { return response(request, 'AUTH_REQUIRED', { error_code: 'auth_required' }); }
    const denied = authResult(request, principal, BRAIN_CAPABILITIES[request.operation]);
    if (denied) return denied;

    try {
      let result;
      let source;
      let trustLevel;
      switch (request.operation) {
        case 'brain_context':
          if (!context?.build) return response(request, 'PROVIDER_DOWN', { error_code: 'context_unavailable' });
          result = await context.build({ ...request.input, project_id: request.project_id, task_id: request.task_id, agent_id: request.agent_id, session_id: request.session_id });
          source = result?.source ?? 'context-compiler';
          break;
        case 'brain_search':
        case 'brain_reuse':
          if (!['SYNTHETIC', 'NON_SENSITIVE'].includes(request.input.data_classification)) return response(request, 'POLICY_DENIED', { error_code: 'safe_data_classification_required' });
          if (request.input.include_global === true && !principal.capabilities.includes('memory.global.read')) return response(request, 'POLICY_DENIED', { error_code: 'global_read_denied' });
          if (!memoryEngine?.recall) return response(request, 'PROVIDER_DOWN', { error_code: 'memory_unavailable' });
          result = await memoryEngine.recall({ ...request.input, project_id: request.project_id, task_id: request.task_id, agent_id: request.agent_id, session_id: request.session_id, scope: request.input.scope ?? 'PROJECT' });
          source = result?.source ?? 'canonical-memory';
          trustLevel = result?.items?.length ? result.items[0]?.record?.status ?? 'UNVERIFIED' : 'UNVERIFIED';
          break;
        case 'brain_remember': {
          const record = request.input.record;
          if (!validateContract('memory-record', record).valid) return response(request, 'BLOCKED', { error_code: 'memory_record_invalid' });
          if (!record || !['OBSERVED', 'CANDIDATE'].includes(record.status)) return response(request, 'POLICY_DENIED', { error_code: 'promotion_requires_validation' });
          if (record.scope === 'GLOBAL' && !principal.capabilities.includes('brain.remember.global')) return response(request, 'POLICY_DENIED', { error_code: 'global_write_denied' });
          if (record.scope !== 'GLOBAL' && record.project_id !== request.project_id) return response(request, 'POLICY_DENIED', { error_code: 'project_scope_mismatch' });
          if (record.scope === 'TASK' && (record.task_id !== request.task_id || record.scope_id !== request.task_id)) return response(request, 'POLICY_DENIED', { error_code: 'task_scope_mismatch' });
          if (record.scope === 'SESSION' && (record.session_id !== request.session_id || record.scope_id !== request.session_id)) return response(request, 'POLICY_DENIED', { error_code: 'session_scope_mismatch' });
          if (record.provenance?.actor_id !== request.agent_id || record.provenance?.task_id !== request.task_id) return response(request, 'POLICY_DENIED', { error_code: 'provenance_identity_mismatch' });
          if (!memoryEngine?.retain) return response(request, 'PROVIDER_DOWN', { error_code: 'memory_unavailable' });
          result = await memoryEngine.retain(record);
          source = 'canonical-memory';
          trustLevel = record.status;
          break;
        }
        case 'local_search':
          if (request.input.mode !== undefined && !['search', 'edit_context'].includes(request.input.mode)) return response(request, 'BLOCKED', { error_code: 'code_mode_unsupported' });
          if (request.input.mode === 'edit_context') {
            if (!Array.isArray(request.input.paths) || request.input.paths.length < 1 || request.input.paths.length > 20 || !request.input.paths.every(path => typeof path === 'string' && path.length > 0 && path.length <= 4_096) || !Number.isInteger(request.input.max_bytes) || request.input.max_bytes < 1 || request.input.max_bytes > 65_536) return response(request, 'BLOCKED', { error_code: 'input_limit_exceeded' });
            if (!localSearch?.editContext) return response(request, 'PROVIDER_DOWN', { error_code: 'code_context_unavailable' });
            result = await localSearch.editContext({ ...request.input, project_id: request.project_id, task_id: request.task_id, agent_id: request.agent_id });
          } else {
            if (!localSearch?.search) return response(request, 'PROVIDER_DOWN', { error_code: 'code_search_unavailable' });
            result = await localSearch.search({ ...request.input, project_id: request.project_id, task_id: request.task_id, agent_id: request.agent_id });
          }
          source = result?.source ?? 'code-intelligence';
          break;
        case 'brain_status':
          if (!memoryEngine?.health) return response(request, 'PROVIDER_DOWN', { error_code: 'memory_unavailable' });
          result = await memoryEngine.health();
          source = 'nexus-brain-health';
          trustLevel = 'SYSTEM';
          break;
        default:
          return response(request, 'BLOCKED', { error_code: 'operation_not_supported' });
      }
      const status = statusOf(result);
      return response(request, status, result ?? {}, { source, trust_level: trustLevel, coverage: coverageOf(status), provenance: result?.provenance ?? { request_id: request.request_id } });
    } catch {
      return response(request, 'DEGRADED', { error_code: 'operation_failed' }, { coverage: 'PARTIAL' });
    }
  }

  async function handleReach(request, transportContext = {}) {
    const validation = validateContract('reach-request', request);
    if (!validation.valid) throw new Error('reach_request_invalid');
    if (!REACH_CAPABILITIES.has(request.capability) || !boundedInput(request.input) || !boundedInput(request.policy)) return response(request, 'BLOCKED', { error_code: 'reach_request_blocked' });
    if (!['SYNTHETIC', 'NON_SENSITIVE'].includes(request.policy.data_classification)) return response(request, 'POLICY_DENIED', { error_code: 'safe_data_classification_required' });
    if (typeof request.input.query === 'string' && request.input.query.length > MAX_QUERY_LENGTH) return response(request, 'BLOCKED', { error_code: 'input_limit_exceeded' });

    let principal;
    try { principal = await authenticate({ request, transport: transportContext }); } catch { return response(request, 'AUTH_REQUIRED', { error_code: 'auth_required' }); }
    const denied = authResult(request, principal, request.capability);
    if (denied) return denied;

    if (typeof resolveReachBudget !== 'function') return response(request, 'POLICY_DENIED', { error_code: 'reach_budget_unavailable' });
    let reachBudget;
    try {
      reachBudget = await resolveReachBudget({
        identity: principal.identity,
        capability: request.capability,
        request: { input: request.input, data_classification: request.policy.data_classification },
      });
    } catch {
      return response(request, 'POLICY_DENIED', { error_code: 'reach_budget_unavailable' });
    }
    if (!validReachBudget(reachBudget, principal.identity, request.capability)) {
      return response(request, 'POLICY_DENIED', { error_code: 'reach_budget_invalid' });
    }
    for (const field of REACH_LIMIT_FIELDS) {
      const requested = request.input.limits?.[field];
      if (requested !== undefined && (!Number.isSafeInteger(requested) || requested < (field === 'max_wall_time_seconds' ? 1 : 0) || requested > reachBudget.limits[field])) {
        return response(request, 'POLICY_DENIED', { error_code: 'reach_budget_exceeded' });
      }
    }

    const adapter = request.capability === 'research' ? reach?.research : reach?.web;
    if (typeof adapter !== 'function') return response(request, 'PROVIDER_DOWN', { error_code: 'reach_unavailable' });
    try {
      const { limits: _callerLimits, budget: _callerBudget, source_budget: _callerSourceBudget, ...safeInput } = request.input;
      const result = await adapter({
        ...request,
        input: safeInput,
        policy: { data_classification: request.policy.data_classification, reach_budget: reachBudget },
        identity: { project_id: request.project_id, task_id: request.task_id, agent_id: request.agent_id },
      });
      const status = statusOf(result);
      return response(request, status, result ?? {}, { source: result?.provider ?? request.capability, trust_level: 'UNTRUSTED', coverage: coverageOf(status), provenance: result?.provenance ?? { capability: request.capability } });
    } catch {
      return response(request, 'DEGRADED', { error_code: 'operation_failed' }, { coverage: 'PARTIAL', trust_level: 'UNTRUSTED' });
    }
  }

  return Object.freeze({ handle, handleReach });
}
