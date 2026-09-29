import { describe, expect, it } from 'vitest';
import type { MaestriDecisionInput } from '@nexus-brain/contracts';
import { decide } from '../src/decisions/maestri-decision';
import { benchmarkLocalDecisionAdapter } from '../src/decisions/local-decision-benchmark';

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
    expect(unknown.escalation_target).toBe('strong_model');
  });

  it('keeps classifier suggestions in shadow and sends them to fallback while hard policy still wins', () => {
    const classifierSuggestion = {
      ...baseInput,
      proposed_route: 'local-classifier-route',
      policy: { ...baseInput.policy, confidence_threshold: 0.8, confidence_threshold_version: 'eval-v3' },
      signals: { exact: false, calibrated_confidence: 0.91 },
    };
    const shadowed = decide(classifierSuggestion);
    expect(shadowed.route).toBe('fallback');
    expect(shadowed.abstain).toBe(true);
    expect(shadowed.escalation_target).toBe('strong_model');
    expect(shadowed.decision_source).toBe('fallback');
    expect(shadowed.confidence).toBe(0.91);
    expect(shadowed.reason_codes).toContain('classifier_shadow_only');

    const denied = decide({ ...classifierSuggestion, policy: { ...classifierSuggestion.policy, denied: true } });
    expect(denied.route).toBe('blocked');
    expect(denied.decision_source).toBe('deterministic');

    const belowThreshold = decide({ ...classifierSuggestion, signals: { ...classifierSuggestion.signals, calibrated_confidence: 0.79 } });
    expect(belowThreshold.abstain).toBe(true);
    expect(belowThreshold.escalation_target).toBe('strong_model');
    expect(belowThreshold.reason_codes).toContain('calibrated_confidence_below_threshold');

    const uncalibrated = decide({
      ...classifierSuggestion,
      policy: { ...baseInput.policy },
      signals: { exact: false },
    });
    expect(uncalibrated.reason_codes).toContain('classifier_threshold_unavailable');
  });

  it('benchmarks a local adapter without giving it decision authority', async () => {
    const cases = [
      { input: baseInput, expected_route: 'execute' },
      { input: { ...baseInput, policy: { ...baseInput.policy, denied: true } }, expected_route: 'blocked' },
    ];
    const result = await benchmarkLocalDecisionAdapter({
      adapter_id: 'local-fixture',
      version: 'fixture-v1',
      execution_mode: 'local',
      predict: async input => input.policy.denied
        ? { route: 'execute', calibrated_confidence: 0.99 }
        : { route: 'execute', calibrated_confidence: 0.9 },
    }, cases, 'held-out');
    expect(result.sample_count).toBe(2);
    expect(result.route_accuracy).toBe(0.5);
    expect(result.deterministic_route_accuracy).toBe(1);
    expect(result.route_accuracy_delta).toBe(-0.5);
    expect(result.policy_override_attempts).toBe(1);
    expect(result.production_authority).toBe(false);
  });
});
