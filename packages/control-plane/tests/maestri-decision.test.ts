import { describe, expect, it } from 'vitest';
import type { MaestriDecisionInput } from '@nexus-brain/contracts';
import { decide } from '../src/decisions/maestri-decision';

const baseInput: MaestriDecisionInput = {
  project_id: 'nexus-brain',
  task_id: 'task-1',
  agent_id: 'maestri',
  decision_id: 'decision-1',
  proposed_route: 'execute',
  risk: 'R1',
  priority: 1,
  policy: { denied: false, approval_required: false, retry_allowed: true },
  signals: { exact: true },
  evidence_refs: ['evidence-1'],
};

describe('maestri.decide deterministic baseline', () => {
  it('returns an exact deterministic route without a model', () => {
    const result = decide(baseInput);
    expect(result.route).toBe('execute');
    expect(result.abstain).toBe(false);
    expect(result.confidence).toBe(1);
    expect(result.decision_source).toBe('deterministic');
  });

  it('lets hard policy denial outrank a confident route', () => {
    const result = decide({
      ...baseInput,
      policy: { ...baseInput.policy, denied: true },
      signals: { exact: true, calibrated_confidence: 1 },
    });
    expect(result.route).toBe('blocked');
    expect(result.retry_allowed).toBe(false);
    expect(result.reason_codes).toContain('policy_denied');
  });

  it('requires approval for R4 regardless of confidence', () => {
    const result = decide({
      ...baseInput,
      risk: 'R4',
      signals: { exact: true, calibrated_confidence: 1 },
    });
    expect(result.route).toBe('approval');
    expect(result.needs_approval).toBe(true);
    expect(result.needs_ceo).toBe(true);
  });

  it('abstains on conflict or insufficient deterministic evidence', () => {
    const conflict = decide({
      ...baseInput,
      signals: { exact: false, conflict: true, calibrated_confidence: 0.95 },
    });
    expect(conflict.abstain).toBe(true);
    expect(conflict.route).toBe('fallback');

    const unknown = decide({
      ...baseInput,
      proposed_route: undefined,
      signals: { exact: false },
    });
    expect(unknown.abstain).toBe(true);
    expect(unknown.reason_codes).toContain('deterministic_abstain');
  });
});
