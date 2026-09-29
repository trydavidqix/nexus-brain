import type { MaestriDecisionInput, MaestriDecisionResult } from '@nexus-brain/contracts';
import { assertContract } from '@nexus-brain/contracts';

const REVIEW_RISKS = new Set(['R2', 'R3', 'R4']);

export function decide(input: MaestriDecisionInput): MaestriDecisionResult {
  assertContract('maestri-decision-input', input);
  const common = {
    project_id: input.project_id,
    task_id: input.task_id,
    agent_id: input.agent_id,
    decision_id: input.decision_id,
    risk: input.risk,
    priority: input.priority,
    retry_allowed: input.policy.retry_allowed ?? false,
    needs_review: REVIEW_RISKS.has(input.risk),
    needs_ceo: input.policy.ceo_required ?? input.risk === 'R4',
    evidence_refs: [...input.evidence_refs],
  };
  const priorReasons = input.reason_codes ?? [];

  if (input.policy.denied) {
    return assertContract('maestri-decision-result', {
      ...common,
      route: 'blocked',
      retry_allowed: false,
      needs_approval: false,
      abstain: false,
      confidence: 1,
      decision_source: 'deterministic',
      reason_codes: [...priorReasons, 'policy_denied'],
    });
  }

  if (input.policy.approval_required || input.risk === 'R4') {
    return assertContract('maestri-decision-result', {
      ...common,
      route: 'approval',
      needs_approval: true,
      needs_ceo: common.needs_ceo || input.risk === 'R4',
      escalation_target: 'owner',
      abstain: false,
      confidence: 1,
      decision_source: 'deterministic',
      reason_codes: [...priorReasons, 'approval_required'],
    });
  }

  if (input.signals.conflict || input.signals.unsupported || !input.signals.exact || !input.proposed_route) {
    const classifierConfidence = input.signals.calibrated_confidence;
    const confidenceThreshold = input.policy.confidence_threshold;
    const thresholdVersion = input.policy.confidence_threshold_version;
    const classifierSuggestion = input.signals.exact === false && Boolean(input.proposed_route);
    const abstentionReason = input.signals.conflict || input.signals.unsupported || !classifierSuggestion
      ? 'deterministic_abstain'
      : confidenceThreshold === undefined || !thresholdVersion || classifierConfidence === undefined
        ? 'classifier_threshold_unavailable'
        : classifierConfidence !== undefined && classifierConfidence < confidenceThreshold
          ? 'calibrated_confidence_below_threshold'
          : 'classifier_shadow_only';
    return assertContract('maestri-decision-result', {
      ...common,
      route: 'fallback',
      needs_approval: false,
      escalation_target: 'strong_model',
      abstain: true,
      confidence: classifierConfidence ?? 0,
      decision_source: 'fallback',
      reason_codes: [...priorReasons, abstentionReason],
    });
  }

  return assertContract('maestri-decision-result', {
    ...common,
    route: input.proposed_route,
    needs_approval: false,
    abstain: false,
    confidence: 1,
    decision_source: 'deterministic',
    reason_codes: [...priorReasons, 'exact_deterministic_match'],
  });
}
