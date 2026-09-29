import { randomUUID } from 'node:crypto';
import { assertContract } from '@nexus-brain/contracts';

const ACTIVE = 'ACTIVE';
const keyFor = ({ task_id, agent_id }) => JSON.stringify([task_id, agent_id]);
const requireIdentity = ({ task_id, agent_id }) => {
  if (typeof task_id !== 'string' || !task_id || typeof agent_id !== 'string' || !agent_id) {
    throw new Error('skill_task_agent_scope_required');
  }
};

function validateEntry(entry) {
  assertContract('skill-registry-entry', entry);
  return Object.freeze({
    ...entry,
    task_types: Object.freeze([...entry.task_types]),
    risk_levels: Object.freeze([...entry.risk_levels]),
    dependencies: Object.freeze([...entry.dependencies]),
    conflicts: Object.freeze([...entry.conflicts]),
  });
}

function copyEntry(entry) {
  return {
    ...entry,
    task_types: [...entry.task_types],
    risk_levels: [...entry.risk_levels],
    dependencies: [...entry.dependencies],
    conflicts: [...entry.conflicts],
  };
}

function copySkillSet(skillSet) {
  return {
    ...skillSet,
    required: [...skillSet.required],
    optional: [...skillSet.optional],
    forbidden: [...skillSet.forbidden],
    loaded: [...skillSet.loaded],
    completed: [...skillSet.completed],
    context_budget: { ...skillSet.context_budget },
  };
}

function copyLoadedSkill(skill) {
  return { ...skill };
}

function matches(entry, input) {
  return (!input.task_type || entry.task_types.includes(input.task_type))
    && (!input.risk_level || entry.risk_levels.includes(input.risk_level));
}

export function createSkillRegistry({ entries = [], readSkillBody, recordEvent, now = () => new Date() } = {}) {
  if (!Array.isArray(entries)) throw new Error('skill_registry_entries_required');
  if (typeof readSkillBody !== 'function') throw new Error('skill_body_reader_required');
  if (typeof recordEvent !== 'function') throw new Error('skill_event_recorder_required');

  const registry = entries.map(validateEntry);
  const activeById = new Map();
  for (const entry of registry) {
    if (entry.status !== ACTIVE) continue;
    const versions = activeById.get(entry.skill_id) || [];
    versions.push(entry);
    activeById.set(entry.skill_id, versions);
  }
  const active = new Map([...activeById].filter(([, versions]) => versions.length === 1).map(([id, versions]) => [id, versions[0]]));
  const taskSets = new Map();
  const selections = new Map();
  const loadQueues = new Map();
  const commitLocks = new Set();

  function assertTaskAgentAvailable(key) {
    if (commitLocks.has(key)) throw new Error('skill_task_agent_busy');
  }

  function emitEvent(task, event_type, skill_ids, reason) {
    const event = {
      event_id: randomUUID(), task_id: task.task_id, agent_id: task.agent_id, event_type,
      skill_ids: [...skill_ids], occurred_at: now().toISOString(), ...(reason ? { reason } : {}),
    };
    assertContract('skill-event', event);
    return recordEvent(event);
  }

  function searchSkills({ query = '', task_type, risk_level, limit = 25 } = {}) {
    const normalizedQuery = String(query).trim().toLowerCase();
    const resultLimit = Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, 100) : 25;
    return registry.filter(entry => matches(entry, { task_type, risk_level })
      && (!normalizedQuery || `${entry.skill_id} ${entry.purpose} ${entry.task_types.join(' ')}`.toLowerCase().includes(normalizedQuery)))
      .sort((left, right) => left.skill_id.localeCompare(right.skill_id) || left.version.localeCompare(right.version))
      .slice(0, resultLimit)
      .map(copyEntry);
  }

  function resolveSkills(input = {}) {
    requireIdentity(input);
    const taskKey = keyFor(input);
    assertTaskAgentAvailable(taskKey);
    for (const field of ['required', 'optional', 'forbidden']) if (input[field] !== undefined && !Array.isArray(input[field])) throw new Error('skill_resolution_sets_invalid');
    const requestedRequired = input.required || [];
    const requestedOptional = input.optional || [];
    const requestedForbidden = input.forbidden || [];
    const budget = input.context_budget?.input_tokens;
    if (!Number.isSafeInteger(budget) || budget < 0) throw new Error('skill_context_budget_required');
    const diagnostics = [];
    const forbidden = new Set(requestedForbidden);
    const required = [];
    const optional = [];
    const visiting = new Set();
    const drifted = new Set([...activeById].filter(([, versions]) => versions.length > 1).map(([id]) => id));

    const select = (skillId, target, root = 'dependency') => {
      if (forbidden.has(skillId)) throw new Error(`skill_required_but_forbidden:${skillId}`);
      if (drifted.has(skillId)) throw new Error(`skill_version_drift:${skillId}`);
      const requiredChain = root === 'required' || root === 'required-dependency';
      const optionalChain = root === 'optional' || root === 'optional-dependency';
      const entry = active.get(skillId);
      if (!entry) {
        const candidate = registry.some(item => item.skill_id === skillId && item.status !== ACTIVE);
        if (candidate && root === 'required') throw new Error(`skill_required_candidate_not_loadable:${skillId}`);
        if (candidate && requiredChain) throw new Error(`skill_required_dependency_not_loadable:${skillId}`);
        if (candidate && root === 'optional') { diagnostics.push(`skill_candidate_not_loadable:${skillId}`); return false; }
        if (candidate && optionalChain) { diagnostics.push(`skill_dependency_not_active:${skillId}`); return false; }
        if (candidate) { diagnostics.push(`skill_candidate_not_loadable:${skillId}`); return false; }
        if (root === 'required') throw new Error(`skill_required_unavailable:${skillId}`);
        if (requiredChain) throw new Error(`skill_required_dependency_unavailable:${skillId}`);
        if (optionalChain) { diagnostics.push(`skill_optional_unavailable:${skillId}`); return false; }
        throw new Error(`skill_dependency_missing:${skillId}`);
      }
      if (!matches(entry, input)) {
        if (root === 'required') throw new Error(`skill_required_out_of_scope:${skillId}`);
        if (requiredChain) throw new Error(`skill_required_dependency_out_of_scope:${skillId}`);
        if (optionalChain) { diagnostics.push(`skill_optional_out_of_scope:${skillId}`); return false; }
        throw new Error(`skill_dependency_out_of_scope:${skillId}`);
      }
      if (target.includes(skillId)) return true;
      if (visiting.has(skillId)) throw new Error(`skill_dependency_cycle:${skillId}`);
      visiting.add(skillId);
      for (const dependency of entry.dependencies) {
        const dependencyRoot = requiredChain ? 'required-dependency' : optionalChain ? 'optional-dependency' : 'dependency';
        if (!select(dependency, target, dependencyRoot)) {
          visiting.delete(skillId);
          if (optionalChain) return false;
          throw new Error(`skill_dependency_missing:${dependency}`);
        }
      }
      visiting.delete(skillId);
      target.push(skillId);
      return true;
    };

    for (const skillId of requestedRequired) select(skillId, required, 'required');
    if (new Set(required).size !== required.length) throw new Error('skill_dependency_cycle');
    const requiredCost = required.reduce((sum, id) => sum + active.get(id).estimated_context_cost, 0);
    if (requiredCost > budget) throw new Error('skill_context_budget_exceeded');

    let usedCost = requiredCost;
    for (const skillId of requestedOptional) {
      if (forbidden.has(skillId)) { diagnostics.push(`skill_optional_forbidden:${skillId}`); continue; }
      const proposed = [];
      if (!select(skillId, proposed, 'optional')) continue;
      const combined = [...required, ...optional, ...proposed.filter(id => !required.includes(id) && !optional.includes(id))];
      const conflict = combined.find((left, index) => combined.slice(index + 1).some(right => active.get(left).conflicts.includes(right) || active.get(right).conflicts.includes(left)));
      if (conflict) { diagnostics.push(`skill_conflict_excluded:${skillId}`); continue; }
      const added = proposed.filter(id => !required.includes(id) && !optional.includes(id));
      const addedCost = added.reduce((sum, id) => sum + active.get(id).estimated_context_cost, 0);
      if (usedCost + addedCost > budget) { diagnostics.push(`skill_optional_over_budget:${skillId}`); continue; }
      optional.push(...added);
      usedCost += addedCost;
    }

    const conflict = required.find((left, index) => required.slice(index + 1).some(right => active.get(left).conflicts.includes(right) || active.get(right).conflicts.includes(left)));
    if (conflict) throw new Error(`skill_conflict:${conflict}:${required.find(right => active.get(conflict).conflicts.includes(right) || active.get(right).conflicts.includes(conflict))}`);

    const task = { task_id: input.task_id, agent_id: input.agent_id };
    const previousState = taskSets.get(taskKey);
    const selected = new Set([...required, ...optional]);
    for (const skillId of previousState?.loaded.keys() || []) {
      if (!selected.has(skillId)) throw new Error(`skill_loaded_selection_change_requires_unload:${skillId}`);
    }
    const loaded = new Map([...previousState?.loaded || []].filter(([skillId, skill]) => selected.has(skillId) && active.get(skillId)?.version === skill.version));
    for (const [selectionId, selection] of selections) if (selection.key === taskKey) selections.delete(selectionId);
    const skill_set = {
      ...task, required, optional, forbidden: [...forbidden].sort(), loaded: [...loaded.keys()],
      completed: (previousState?.skill_set.completed || []).filter(skillId => selected.has(skillId)),
      context_budget: { ...input.context_budget },
    };
    assertContract('task-skill-set', skill_set);
    const selection_id = randomUUID();
    selections.set(selection_id, { key: keyFor(task), selected: new Set([...required, ...optional]) });
    taskSets.set(taskKey, { skill_set, loaded });
    return { skill_set: copySkillSet(skill_set), selection_id, diagnostics: [...diagnostics] };
  }

  async function loadSkill(input = {}) {
    requireIdentity(input);
    const key = keyFor(input);
    const previous = loadQueues.get(key) || Promise.resolve();
    const current = previous.catch(() => {}).then(() => loadSkillLocked(input));
    loadQueues.set(key, current);
    try {
      return copyLoadedSkill(await current);
    } finally {
      if (loadQueues.get(key) === current) loadQueues.delete(key);
    }
  }

  async function loadSkillLocked(input) {
    requireIdentity(input);
    const selection = selections.get(input.selection_id);
    const key = keyFor(input);
    if (!selection) throw new Error('skill_selection_required');
    if (selection.key !== key) throw new Error('skill_selection_scope_mismatch');
    if (!selection.selected.has(input.skill_id)) throw new Error('skill_not_selected');
    const entry = active.get(input.skill_id);
    if (!entry) throw new Error(`skill_not_active:${input.skill_id}`);
    let state = taskSets.get(key);
    if (!state) throw new Error('skill_task_set_missing');
    if (state.loaded.has(input.skill_id)) return state.loaded.get(input.skill_id);
    const missingDependency = entry.dependencies.find(skillId => !state.loaded.has(skillId));
    if (missingDependency) throw new Error(`skill_dependency_not_loaded:${missingDependency}`);
    const body = await readSkillBody({ skill_id: entry.skill_id, version: entry.version, task_id: input.task_id, agent_id: input.agent_id });
    if (selections.get(input.selection_id) !== selection || !selection.selected.has(input.skill_id) || taskSets.get(key) !== state) {
      throw new Error('skill_selection_revoked');
    }
    if (typeof body !== 'string' || !body.trim()) throw new Error(`skill_body_unavailable:${entry.skill_id}`);
    const bodyCost = Math.ceil(body.length / 4);
    const loadedCost = [...state.loaded.values()].reduce((sum, skill) => sum + skill.context_cost, 0);
    if (loadedCost + bodyCost > state.skill_set.context_budget.input_tokens) throw new Error('skill_context_budget_exceeded');
    commitLocks.add(key);
    try {
      await emitEvent(input, 'LOADED', [entry.skill_id], 'resolver-selected');
      state.loaded.set(entry.skill_id, { skill_id: entry.skill_id, version: entry.version, body, context_cost: bodyCost });
      state.skill_set.loaded = [...state.loaded.keys()];
      return state.loaded.get(entry.skill_id);
    } finally {
      commitLocks.delete(key);
    }
  }

  async function unloadSkill(input = {}) {
    requireIdentity(input);
    const key = keyFor(input);
    assertTaskAgentAvailable(key);
    const state = taskSets.get(key);
    if (!state?.loaded.has(input.skill_id)) return false;
    await emitEvent(input, 'COMPACTED', [input.skill_id], 'task-skill-unload');
    state.loaded.delete(input.skill_id);
    state.skill_set.loaded = [...state.loaded.keys()];
    return true;
  }

  async function completeSkill(input = {}) {
    requireIdentity(input);
    const key = keyFor(input);
    assertTaskAgentAvailable(key);
    const state = taskSets.get(key);
    if (!state?.loaded.has(input.skill_id)) throw new Error('skill_completion_requires_loaded_skill');
    await emitEvent(input, 'COMPLETED', [input.skill_id], 'task-skill-completed');
    if (!state.skill_set.completed.includes(input.skill_id)) state.skill_set.completed.push(input.skill_id);
    return copySkillSet(state.skill_set);
  }

  function getActiveSkills(input = {}) {
    requireIdentity(input);
    return [...(taskSets.get(keyFor(input))?.loaded.values() || [])].map(({ skill_id, version, body }) => ({ skill_id, version, body }));
  }

  return Object.freeze({ searchSkills, resolveSkills, loadSkill, unloadSkill, completeSkill, getActiveSkills });
}
