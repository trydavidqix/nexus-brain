import type { MaestriDecisionInput, MaestriDecisionResult } from '@nexus-brain/contracts';

const REVIEW_RISKS = new Set(['R2', 'R3', 'R4']);

export function decide(input: MaestriDecisionInput): MaestriDecisionResult {
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
    return {
      ...common,
      route: 'blocked',
      retry_allowed: false,
      needs_approval: false,
      abstain: false,
      confidence: 1,
      decision_source: 'deterministic',
      reason_codes: [...priorReasons, 'policy_denied'],
    };
  }

  if (input.policy.approval_required || input.risk === 'R4') {
    return {
      ...common,
      route: 'approval',
      needs_approval: true,
      needs_ceo: common.needs_ceo || input.risk === 'R4',
      escalation_target: 'owner',
      abstain: false,
      confidence: 1,
      decision_source: 'deterministic',
      reason_codes: [...priorReasons, 'approval_required'],
    };
  }

  if (input.signals.conflict || input.signals.unsupported || !input.signals.exact || !input.proposed_route) {
    return {
      ...common,
      route: 'fallback',
      needs_approval: false,
      abstain: true,
      confidence: input.signals.calibrated_confidence ?? 0,
      decision_source: 'deterministic',
      reason_codes: [...priorReasons, 'deterministic_abstain'],
    };
  }

  return {
    ...common,
    route: input.proposed_route,
    needs_approval: false,
    abstain: false,
    confidence: 1,
    decision_source: 'deterministic',
    reason_codes: [...priorReasons, 'exact_deterministic_match'],
  };
}
