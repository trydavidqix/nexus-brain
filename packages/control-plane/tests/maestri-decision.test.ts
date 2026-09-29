import { describe, expect, it } from 'vitest';
import type { MaestriDecisionInput } from '@nexus-brain/contracts';
import { decide } from '../src/decisions/maestri-decision';
import { benchmarkLocalDecisionAdapter } from '../src/decisions/local-decision-benchmark';
import { MAESTRI_DECISION_CORPUS_V1, MAESTRI_DECISION_CORPUS_VERSION } from '../src/decisions/maestri-decision-corpus.v1';
import { trainLocalMaestriClassifier } from '../src/decisions/local-maestri-classifier';

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
    expect(result.correctness_brier_score).toBeCloseTo(0.49505);
    expect(result.policy_override_attempts).toBe(1);
    expect(result.review_required_cases).toBe(0);
    expect(result.approval_required_cases).toBe(0);
    expect(result.safety_gate_passed).toBe(false);
    expect(result.production_authority).toBe(false);
  });

  it('counts missing safety flags on an abstaining fallback as false negatives', async () => {
    const result = await benchmarkLocalDecisionAdapter({
      adapter_id: 'unsafe-abstaining-fixture', version: 'fixture-v1', execution_mode: 'local',
      predict: () => ({ route: 'fallback', calibrated_confidence: 0, abstain: true }),
    }, [{
      input: { ...baseInput, risk: 'R4' }, expected_route: 'approval',
    }], 'held-out');

    expect(result.abstentions).toBe(1);
    expect(result.risk_false_negatives).toBe(1);
    expect(result.approval_false_negatives).toBe(1);
    expect(result.safety_gate_passed).toBe(false);

    await expect(benchmarkLocalDecisionAdapter({
      adapter_id: 'invalid-abstain-route', version: 'fixture-v1', execution_mode: 'local',
      predict: () => ({ route: 'execute', calibrated_confidence: 0, abstain: true }),
    }, [{ input: { ...baseInput, policy: { ...baseInput.policy, denied: true } }, expected_route: 'blocked' }], 'held-out'))
      .rejects.toThrow('local_decision_abstention_requires_fallback_route');

    const policyMismatch = await benchmarkLocalDecisionAdapter({
      adapter_id: 'policy-mismatch-abstain', version: 'fixture-v1', execution_mode: 'local',
      predict: () => ({ route: 'fallback', calibrated_confidence: 0, abstain: true }),
    }, [{ input: { ...baseInput, policy: { ...baseInput.policy, denied: true } }, expected_route: 'blocked' }], 'held-out');
    expect(policyMismatch.policy_override_attempts).toBe(1);
  });

  it('keeps the versioned contract corpus deterministic, split-isolated, and correctly labeled', () => {
    expect(MAESTRI_DECISION_CORPUS_VERSION).toBe('maestri-decision-contract-v1');
    const ids = MAESTRI_DECISION_CORPUS_V1.map(example => example.case_id);
    expect(new Set(ids).size).toBe(ids.length);
    const featureSignature = (input: MaestriDecisionInput) => JSON.stringify([
      input.risk, input.policy.denied, input.policy.approval_required, input.policy.ceo_required ?? false,
      input.policy.retry_allowed ?? false, input.signals.exact, input.signals.conflict ?? false,
      input.signals.unsupported ?? false, Boolean(input.proposed_route),
    ]);
    const splitSignatures = new Map<string, string>();
    for (const example of MAESTRI_DECISION_CORPUS_V1) {
      const signature = featureSignature(example.input);
      expect(splitSignatures.get(signature) ?? example.split).toBe(example.split);
      splitSignatures.set(signature, example.split);
      const actual = decide(example.input);
      expect({ route: actual.route, needs_review: actual.needs_review, needs_approval: actual.needs_approval, needs_ceo: actual.needs_ceo, abstain: actual.abstain }).toEqual(example.expected);
    }
    const splitIds = (split: string) => MAESTRI_DECISION_CORPUS_V1.filter(example => example.split === split).map(example => example.case_id);
    expect(splitIds('train')).toEqual([
      'tr-route-r0-p0', 'tr-route-r1-p1', 'tr-route-r2-p2', 'tr-route-r3-p3',
      'tr-block-r0-p4', 'tr-block-r1-p5', 'tr-block-r2-p6',
      'tr-approval-r0-p7', 'tr-approval-r2-p8', 'tr-approval-r4-p9',
      'tr-fallback-nonexact-p10', 'tr-fallback-conflict-p11', 'tr-fallback-unsupported-p12',
      'tr-fallback-no-route-p17',
    ]);
    expect(splitIds('calibration')).toHaveLength(4);
    expect(splitIds('held-out')).toHaveLength(6);
    expect(splitIds('train').some(id => splitIds('held-out').includes(id))).toBe(false);
  });

  it('runs a fitted local classifier on held-out cases with zero observed safety false negatives', async () => {
    const training = MAESTRI_DECISION_CORPUS_V1.filter(example => example.split === 'train');
    const calibration = MAESTRI_DECISION_CORPUS_V1.filter(example => example.split === 'calibration');
    const heldOut = MAESTRI_DECISION_CORPUS_V1.filter(example => example.split === 'held-out');
    const adapter = trainLocalMaestriClassifier(training, calibration);
    const result = await benchmarkLocalDecisionAdapter(adapter, heldOut.map(example => ({
      input: example.input, expected_route: example.expected.route,
    })), 'held-out');
    expect(adapter.adapter_id).toBe('nexus-native-categorical-naive-bayes');
    expect(adapter.training_count).toBe(training.length);
    expect(adapter.calibration_count).toBe(calibration.length);
    expect(adapter.calibration_fit_count).toBe(3);
    expect(result.sample_count).toBe(heldOut.length);
    expect(result.correctness_brier_score).toBeGreaterThanOrEqual(0);
    expect(result.risk_false_negatives).toBe(0);
    expect(result.approval_false_negatives).toBe(0);
    expect(result.review_required_cases).toBeGreaterThan(0);
    expect(result.approval_required_cases).toBeGreaterThan(0);
    expect(result.safety_gate_passed).toBe(true);
    expect(result.production_authority).toBe(false);
    for (const example of heldOut) {
      const candidate = adapter.predict(example.input);
      if (candidate.abstain) {
        expect(candidate.needs_review || !example.expected.needs_review).toBe(true);
        expect(candidate.needs_approval || !example.expected.needs_approval).toBe(true);
      }
    }

    const conflicted = adapter.predict({ ...baseInput, signals: { exact: false, conflict: true } });
    expect(conflicted.abstain).toBe(true);
    expect(conflicted.route).toBe('fallback');
    const unsupported = adapter.predict({ ...baseInput, signals: { exact: false, unsupported: true } });
    expect(unsupported.abstain).toBe(true);
    const outOfDomain = adapter.predict({ ...baseInput, proposed_route: 'unseen-route' });
    expect(outOfDomain.abstain).toBe(true);
    expect(outOfDomain.route).toBe('fallback');

    const malicious = {
      adapter_id: 'malicious-shadow', version: 'fixture-v1', execution_mode: 'local' as const,
      predict: () => ({ route: 'execute', calibrated_confidence: 1 }),
    };
    const denied = decide({ ...baseInput, policy: { ...baseInput.policy, denied: true } });
    expect(denied.route).toBe('blocked');
    const nonAuthoritative = await benchmarkLocalDecisionAdapter(malicious, [{ input: { ...baseInput, policy: { ...baseInput.policy, denied: true } }, expected_route: 'blocked' }], 'held-out');
    expect(nonAuthoritative.policy_override_attempts).toBe(1);
    expect(nonAuthoritative.production_authority).toBe(false);
  });
});
