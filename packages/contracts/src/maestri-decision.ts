import type { NexusIdentity } from './identity.js';

export type MaestriDecisionRisk = 'R0' | 'R1' | 'R2' | 'R3' | 'R4';
export type MaestriDecisionSource = 'deterministic' | 'classifier' | 'contextual' | 'fallback';

export interface MaestriDecisionPolicy {
  denied: boolean;
  approval_required: boolean;
  ceo_required?: boolean;
  retry_allowed?: boolean;
}

export interface MaestriDecisionSignals {
  exact: boolean;
  conflict?: boolean;
  unsupported?: boolean;
  calibrated_confidence?: number;
}

export interface MaestriDecisionInput extends NexusIdentity {
  decision_id: string;
  proposed_route?: string;
  risk: MaestriDecisionRisk;
  priority: number;
  policy: MaestriDecisionPolicy;
  signals: MaestriDecisionSignals;
  evidence_refs: string[];
  reason_codes?: string[];
}

export interface MaestriDecisionResult extends NexusIdentity {
  decision_id: string;
  route: string;
  risk: MaestriDecisionRisk;
  priority: number;
  retry_allowed: boolean;
  needs_review: boolean;
  needs_approval: boolean;
  needs_ceo: boolean;
  escalation_target?: string;
  abstain: boolean;
  confidence: number;
  decision_source: MaestriDecisionSource;
  reason_codes: string[];
  evidence_refs: string[];
}
