import { describe, expect, it, vi } from 'vitest';
import { createSkillRegistry } from '../src/skills/skill-registry.mjs';

const entry = (skill_id, overrides = {}) => ({
  skill_id,
  purpose: `${skill_id} guidance`,
  task_types: ['BUG'],
  risk_levels: ['R1'],
  dependencies: [],
  conflicts: [],
  precedence_owner: skill_id,
  estimated_context_cost: 100,
  version: '1.0.0',
  status: 'ACTIVE',
  ...overrides,
});

describe('task-scoped Skill Registry', () => {
  it('resolves metadata first, loads only selected bodies, and isolates task-agent SkillSets', async () => {
    const readSkillBody = vi.fn(async ({ skill_id, task_id, agent_id }) => `${skill_id}:${task_id}:${agent_id}`);
    const recordEvent = vi.fn(async () => {});
    const registry = createSkillRegistry({
      entries: [entry('core'), entry('debug', { dependencies: ['core'] }), entry('review')],
      readSkillBody,
      recordEvent,
    });

    const metadata = registry.searchSkills({ query: 'debug', task_type: 'BUG', risk_level: 'R1' });
    expect(metadata.map(item => item.skill_id)).toContain('debug');
    expect(metadata.every(item => !Object.hasOwn(item, 'body'))).toBe(true);
    expect(readSkillBody).not.toHaveBeenCalled();

    const resolved = registry.resolveSkills({
      task_id: 'task-a', agent_id: 'agent-a', task_type: 'BUG', risk_level: 'R1',
      required: ['debug'], optional: [], forbidden: [], context_budget: { input_tokens: 250 },
    });
    expect(resolved.skill_set.required).toEqual(['core', 'debug']);
    expect(resolved.skill_set.loaded).toEqual([]);
    expect(readSkillBody).not.toHaveBeenCalled();

    await registry.loadSkill({ task_id: 'task-a', agent_id: 'agent-a', skill_id: 'core', selection_id: resolved.selection_id });
    await registry.loadSkill({ task_id: 'task-a', agent_id: 'agent-a', skill_id: 'debug', selection_id: resolved.selection_id });
    expect(registry.getActiveSkills({ task_id: 'task-a', agent_id: 'agent-a' })).toEqual([
      { skill_id: 'core', version: '1.0.0', body: 'core:task-a:agent-a' },
      { skill_id: 'debug', version: '1.0.0', body: 'debug:task-a:agent-a' },
    ]);
    expect(registry.getActiveSkills({ task_id: 'task-a', agent_id: 'agent-b' })).toEqual([]);
    expect(readSkillBody).toHaveBeenCalledTimes(2);
    expect(recordEvent).toHaveBeenCalledWith(expect.objectContaining({ task_id: 'task-a', agent_id: 'agent-a', event_type: 'LOADED', skill_ids: ['debug'] }));

    await registry.unloadSkill({ task_id: 'task-a', agent_id: 'agent-a', skill_id: 'debug' });
    expect(registry.getActiveSkills({ task_id: 'task-a', agent_id: 'agent-a' }).map(skill => skill.skill_id)).toEqual(['core']);
    expect(recordEvent).toHaveBeenLastCalledWith(expect.objectContaining({ event_type: 'COMPACTED', skill_ids: ['debug'] }));
  });

  it('keeps candidate skills unloaded and reports skill conflicts and version drift', () => {
    const registry = createSkillRegistry({
      entries: [
        entry('candidate', { status: 'CANDIDATE' }),
        entry('left', { conflicts: ['right'] }),
        entry('right', { conflicts: ['left'] }),
        entry('versioned', { version: '1.0.0' }),
        entry('versioned', { version: '2.0.0' }),
      ],
      readSkillBody: async () => 'body',
      recordEvent: async () => {},
    });

    const candidate = registry.resolveSkills({ task_id: 't', agent_id: 'a', task_type: 'BUG', risk_level: 'R1', optional: ['candidate'], context_budget: { input_tokens: 100 } });
    expect(candidate.skill_set.optional).toEqual([]);
    expect(candidate.diagnostics).toContain('skill_candidate_not_loadable:candidate');
    expect(() => registry.resolveSkills({ task_id: 't', agent_id: 'a', task_type: 'BUG', risk_level: 'R1', required: ['left', 'right'], context_budget: { input_tokens: 300 } })).toThrow('skill_conflict:left:right');
    expect(() => registry.resolveSkills({ task_id: 't', agent_id: 'a', task_type: 'BUG', risk_level: 'R1', required: ['versioned'], context_budget: { input_tokens: 300 } })).toThrow('skill_version_drift:versioned');
  });

  it('fails closed when a required skill is unavailable, candidate-only, or outside scope', () => {
    const registry = createSkillRegistry({
      entries: [
        entry('candidate', { status: 'CANDIDATE' }),
        entry('out-of-scope', { task_types: ['REVIEW'] }),
      ],
      readSkillBody: async () => 'body',
      recordEvent: async () => {},
    });
    const resolve = required => registry.resolveSkills({
      task_id: 't', agent_id: 'a', task_type: 'BUG', risk_level: 'R1',
      required: [required], context_budget: { input_tokens: 300 },
    });

    expect(() => resolve('missing')).toThrow('skill_required_unavailable:missing');
    expect(() => resolve('candidate')).toThrow('skill_required_candidate_not_loadable:candidate');
    expect(() => resolve('out-of-scope')).toThrow('skill_required_out_of_scope:out-of-scope');
  });

  it('fails closed when a required skill depends on an unavailable, candidate, or out-of-scope skill', () => {
    const registry = createSkillRegistry({
      entries: [
        entry('missing-dependency-root', { dependencies: ['missing-dependency'] }),
        entry('candidate-dependency-root', { dependencies: ['candidate-dependency'] }),
        entry('candidate-dependency', { status: 'CANDIDATE' }),
        entry('out-of-scope-dependency-root', { dependencies: ['out-of-scope-dependency'] }),
        entry('out-of-scope-dependency', { task_types: ['REVIEW'] }),
      ],
      readSkillBody: async () => 'body',
      recordEvent: async () => {},
    });
    const resolve = required => registry.resolveSkills({
      task_id: 't', agent_id: 'a', task_type: 'BUG', risk_level: 'R1',
      required: [required], context_budget: { input_tokens: 500 },
    });

    expect(() => resolve('missing-dependency-root')).toThrow('skill_required_dependency_unavailable:missing-dependency');
    expect(() => resolve('candidate-dependency-root')).toThrow('skill_required_dependency_not_loadable:candidate-dependency');
    expect(() => resolve('out-of-scope-dependency-root')).toThrow('skill_required_dependency_out_of_scope:out-of-scope-dependency');
  });

  it('detaches nested registry metadata and returned TaskSkillSets from internal state', async () => {
    const source = entry('safe', { dependencies: [], conflicts: [] });
    const registry = createSkillRegistry({ entries: [source], readSkillBody: async () => 'body', recordEvent: async () => {} });
    source.task_types.push('REVIEW');
    const metadata = registry.searchSkills({ task_type: 'BUG' });
    metadata[0].task_types.push('REVIEW');
    metadata[0].dependencies.push('injected');
    expect(registry.searchSkills({ task_type: 'REVIEW' })).toEqual([]);

    const resolved = registry.resolveSkills({ task_id: 't', agent_id: 'a', task_type: 'BUG', risk_level: 'R1', required: ['safe'], context_budget: { input_tokens: 200 } });
    resolved.skill_set.context_budget.input_tokens = 0;
    resolved.skill_set.required.push('injected');
    const loaded = await registry.loadSkill({ task_id: 't', agent_id: 'a', skill_id: 'safe', selection_id: resolved.selection_id });
    loaded.body = 'tampered';
    expect(registry.getActiveSkills({ task_id: 't', agent_id: 'a' })).toEqual([{ skill_id: 'safe', version: '1.0.0', body: 'body' }]);
  });

  it('serializes concurrent body loads so the task-agent token budget cannot be exceeded', async () => {
    const registry = createSkillRegistry({
      entries: [entry('first', { estimated_context_cost: 1 }), entry('second', { estimated_context_cost: 1 })],
      readSkillBody: async () => 'x'.repeat(280),
      recordEvent: async () => {},
    });
    const resolved = registry.resolveSkills({
      task_id: 't', agent_id: 'a', task_type: 'BUG', risk_level: 'R1',
      optional: ['first', 'second'], context_budget: { input_tokens: 120 },
    });
    const outcomes = await Promise.allSettled(['first', 'second'].map(skill_id => registry.loadSkill({
      task_id: 't', agent_id: 'a', skill_id, selection_id: resolved.selection_id,
    })));

    expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect(outcomes.find(result => result.status === 'rejected').reason.message).toBe('skill_context_budget_exceeded');
    expect(registry.getActiveSkills({ task_id: 't', agent_id: 'a' })).toHaveLength(1);
  });

  it('rejects a body load when its selection is revoked while the reader is pending', async () => {
    let finishRead;
    const readSkillBody = vi.fn(() => new Promise(resolve => { finishRead = resolve; }));
    const recordEvent = vi.fn(async () => {});
    const registry = createSkillRegistry({ entries: [entry('deferred')], readSkillBody, recordEvent });
    const original = registry.resolveSkills({
      task_id: 't', agent_id: 'a', task_type: 'BUG', risk_level: 'R1',
      required: ['deferred'], context_budget: { input_tokens: 200 },
    });
    const pendingLoad = registry.loadSkill({ task_id: 't', agent_id: 'a', skill_id: 'deferred', selection_id: original.selection_id });
    await vi.waitFor(() => expect(readSkillBody).toHaveBeenCalledOnce());

    registry.resolveSkills({
      task_id: 't', agent_id: 'a', task_type: 'BUG', risk_level: 'R1',
      required: [], context_budget: { input_tokens: 200 },
    });
    finishRead('deferred body');

    await expect(pendingLoad).rejects.toThrow('skill_selection_revoked');
    expect(recordEvent).not.toHaveBeenCalled();
    expect(registry.getActiveSkills({ task_id: 't', agent_id: 'a' })).toEqual([]);
  });

  it('keeps resolver and load event consistent while the load event is pending', async () => {
    let finishEvent;
    const recordEvent = vi.fn(() => new Promise(resolve => { finishEvent = resolve; }));
    const registry = createSkillRegistry({ entries: [entry('committing')], readSkillBody: async () => 'body', recordEvent });
    const original = registry.resolveSkills({
      task_id: 't', agent_id: 'a', task_type: 'BUG', risk_level: 'R1',
      required: ['committing'], context_budget: { input_tokens: 200 },
    });
    const pendingLoad = registry.loadSkill({ task_id: 't', agent_id: 'a', skill_id: 'committing', selection_id: original.selection_id });
    await vi.waitFor(() => expect(recordEvent).toHaveBeenCalledOnce());

    expect(() => registry.resolveSkills({
      task_id: 't', agent_id: 'a', task_type: 'BUG', risk_level: 'R1',
      required: [], context_budget: { input_tokens: 200 },
    })).toThrow('skill_task_agent_busy');
    finishEvent();

    await expect(pendingLoad).resolves.toEqual({ skill_id: 'committing', version: '1.0.0', body: 'body', context_cost: 1 });
    expect(recordEvent).toHaveBeenCalledOnce();
    expect(recordEvent).toHaveBeenCalledWith(expect.objectContaining({ event_type: 'LOADED', skill_ids: ['committing'] }));
    expect(registry.getActiveSkills({ task_id: 't', agent_id: 'a' })).toEqual([{ skill_id: 'committing', version: '1.0.0', body: 'body' }]);
  });

  it('releases the commit lock without loading a body when LOADED event recording fails', async () => {
    const recordEvent = vi.fn()
      .mockRejectedValueOnce(new Error('event_store_unavailable'))
      .mockResolvedValue(undefined);
    const registry = createSkillRegistry({ entries: [entry('retryable')], readSkillBody: async () => 'body', recordEvent });
    const input = {
      task_id: 't', agent_id: 'a', task_type: 'BUG', risk_level: 'R1',
      required: ['retryable'], context_budget: { input_tokens: 200 },
    };
    const first = registry.resolveSkills(input);

    await expect(registry.loadSkill({ ...input, skill_id: 'retryable', selection_id: first.selection_id })).rejects.toThrow('event_store_unavailable');
    expect(registry.getActiveSkills(input)).toEqual([]);

    const retry = registry.resolveSkills(input);
    await expect(registry.loadSkill({ ...input, skill_id: 'retryable', selection_id: retry.selection_id })).resolves.toEqual({
      skill_id: 'retryable', version: '1.0.0', body: 'body', context_cost: 1,
    });
    expect(recordEvent).toHaveBeenCalledTimes(2);
    expect(registry.getActiveSkills(input)).toEqual([{ skill_id: 'retryable', version: '1.0.0', body: 'body' }]);
  });

  it('rejects loading outside the Resolver-issued task-agent selection and context budget', async () => {
    const registry = createSkillRegistry({ entries: [entry('large', { estimated_context_cost: 500 })], readSkillBody: async () => 'body', recordEvent: async () => {} });
    expect(() => registry.resolveSkills({ task_id: 'task-a', agent_id: 'agent-a', task_type: 'BUG', risk_level: 'R1', required: ['large'], context_budget: { input_tokens: 100 } })).toThrow('skill_context_budget_exceeded');
    const resolved = registry.resolveSkills({ task_id: 'task-a', agent_id: 'agent-a', task_type: 'BUG', risk_level: 'R1', required: ['large'], context_budget: { input_tokens: 600 } });
    await expect(registry.loadSkill({ task_id: 'task-a', agent_id: 'agent-b', skill_id: 'large', selection_id: resolved.selection_id })).rejects.toThrow('skill_selection_scope_mismatch');
  });

  it('preserves already loaded skills when Resolver adds a justified skill to the same task-agent set', async () => {
    const registry = createSkillRegistry({ entries: [entry('core'), entry('debug', { dependencies: ['core'] })], readSkillBody: async ({ skill_id }) => skill_id, recordEvent: async () => {} });
    const first = registry.resolveSkills({ task_id: 'task-a', agent_id: 'agent-a', task_type: 'BUG', risk_level: 'R1', required: ['core'], context_budget: { input_tokens: 300 } });
    await registry.loadSkill({ task_id: 'task-a', agent_id: 'agent-a', skill_id: 'core', selection_id: first.selection_id });
    const expanded = registry.resolveSkills({ task_id: 'task-a', agent_id: 'agent-a', task_type: 'BUG', risk_level: 'R1', required: ['core'], optional: ['debug'], context_budget: { input_tokens: 300 } });
    expect(expanded.skill_set.loaded).toEqual(['core']);
    await registry.loadSkill({ task_id: 'task-a', agent_id: 'agent-a', skill_id: 'debug', selection_id: expanded.selection_id });
    expect(registry.getActiveSkills({ task_id: 'task-a', agent_id: 'agent-a' }).map(skill => skill.skill_id)).toEqual(['core', 'debug']);
  });
});
