import type { MaestriDecisionInput } from '@nexus-brain/contracts';
import { decide } from './maestri-decision';

export interface LocalDecisionCandidate {
  route: string;
  calibrated_confidence: number;
  abstain?: boolean;
  needs_review?: boolean;
  needs_approval?: boolean;
  needs_ceo?: boolean;
}

export interface LocalDecisionAdapter {
  adapter_id: string;
  version: string;
  execution_mode: 'local';
  predict(input: MaestriDecisionInput): Promise<LocalDecisionCandidate> | LocalDecisionCandidate;
}

export interface DecisionBenchmarkCase {
  input: MaestriDecisionInput;
  expected_route: string;
}

export async function benchmarkLocalDecisionAdapter(
  adapter: LocalDecisionAdapter,
  cases: readonly DecisionBenchmarkCase[],
  datasetSplit: 'held-out',
  calibrationBins = 10,
) {
  if (!adapter?.adapter_id || !adapter.version || adapter.execution_mode !== 'local' || typeof adapter.predict !== 'function') throw new Error('local_decision_adapter_identity_required');
  if (!cases.length) throw new Error('decision_benchmark_cases_required');
  if (datasetSplit !== 'held-out') throw new Error('decision_benchmark_requires_held_out_data');
  if (!Number.isSafeInteger(calibrationBins) || calibrationBins < 1 || calibrationBins > 100) throw new Error('decision_benchmark_bins_invalid');

  const bins = Array.from({ length: calibrationBins }, () => ({ count: 0, confidence: 0, accuracy: 0 }));
  let correct = 0;
  let baselineCorrect = 0;
  let correctnessBrier = 0;
  let policyOverrideAttempts = 0;
  let riskFalseNegatives = 0;
  let approvalFalseNegatives = 0;
  let reviewRequiredCases = 0;
  let approvalRequiredCases = 0;
  let abstentions = 0;
  for (const example of cases) {
    const hardDecision = decide(example.input);
    const candidate = await adapter.predict(example.input);
    if (!candidate || typeof candidate.route !== 'string' || !candidate.route
      || !Number.isFinite(candidate.calibrated_confidence) || candidate.calibrated_confidence < 0 || candidate.calibrated_confidence > 1) {
      throw new Error('local_decision_candidate_invalid');
    }
    if (candidate.abstain && candidate.route !== 'fallback') throw new Error('local_decision_abstention_requires_fallback_route');
    const accurate = candidate.route === example.expected_route;
    if (candidate.abstain) abstentions += 1;
    if (hardDecision.needs_review) {
      reviewRequiredCases += 1;
      if (candidate.needs_review !== true) riskFalseNegatives += 1;
    }
    if (hardDecision.needs_approval) {
      approvalRequiredCases += 1;
      if (candidate.needs_approval !== true) approvalFalseNegatives += 1;
    }
    const confidence = candidate.calibrated_confidence;
    const index = Math.min(calibrationBins - 1, Math.floor(confidence * calibrationBins));
    bins[index].count += 1;
    bins[index].confidence += confidence;
    bins[index].accuracy += Number(accurate);
    correct += Number(accurate);
    correctnessBrier += (confidence - Number(accurate)) ** 2;

    baselineCorrect += Number(hardDecision.route === example.expected_route);
    if ((example.input.policy.denied || example.input.policy.approval_required || example.input.risk === 'R4')
      && candidate.route !== hardDecision.route) policyOverrideAttempts += 1;
  }

  const sampleCount = cases.length;
  const expectedCalibrationError = bins.reduce((total, bin) => bin.count
    ? total + (bin.count / sampleCount) * Math.abs(bin.confidence / bin.count - bin.accuracy / bin.count)
    : total, 0);
  return {
    adapter_id: adapter.adapter_id,
    adapter_version: adapter.version,
    sample_count: sampleCount,
    route_accuracy: correct / sampleCount,
    deterministic_route_accuracy: baselineCorrect / sampleCount,
    route_accuracy_delta: (correct - baselineCorrect) / sampleCount,
    correctness_brier_score: correctnessBrier / sampleCount,
    expected_calibration_error: expectedCalibrationError,
    policy_override_attempts: policyOverrideAttempts,
    risk_false_negatives: riskFalseNegatives,
    approval_false_negatives: approvalFalseNegatives,
    review_required_cases: reviewRequiredCases,
    approval_required_cases: approvalRequiredCases,
    abstentions,
    safety_gate_passed: reviewRequiredCases > 0 && approvalRequiredCases > 0
      && riskFalseNegatives === 0 && approvalFalseNegatives === 0,
    production_authority: false as const,
    calibration_bins: calibrationBins,
  };
}
