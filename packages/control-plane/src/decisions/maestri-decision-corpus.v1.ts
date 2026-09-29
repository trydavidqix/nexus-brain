import type { MaestriDecisionInput } from '@nexus-brain/contracts';

export type DecisionCorpusSplit = 'train' | 'calibration' | 'held-out';

export interface MaestriDecisionCorpusCase {
  case_id: string;
  split: DecisionCorpusSplit;
  source_fixture: string;
  input: MaestriDecisionInput;
  expected: {
    route: string;
    needs_review: boolean;
    needs_approval: boolean;
    needs_ceo: boolean;
    abstain: boolean;
  };
}

export const MAESTRI_DECISION_CORPUS_VERSION = 'maestri-decision-contract-v1';

const make = (
  case_id: string,
  split: DecisionCorpusSplit,
  source_fixture: string,
  input: Partial<MaestriDecisionInput> & Pick<MaestriDecisionInput, 'risk' | 'priority' | 'signals' | 'policy'>,
  expected: MaestriDecisionCorpusCase['expected'],
): MaestriDecisionCorpusCase => ({
  case_id,
  split,
  source_fixture,
  input: {
    project_id: 'nexus-decision-eval', task_id: `task-${case_id}`, agent_id: 'maestri-eval',
    decision_id: `decision-${case_id}`, proposed_route: 'execute', evidence_refs: [`fixture:${source_fixture}`],
    ...Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)),
  } as MaestriDecisionInput,
  expected,
});

const policy = (overrides: Partial<MaestriDecisionInput['policy']> = {}) => ({ denied: false, approval_required: false, retry_allowed: false, confidence_threshold: 0.5, confidence_threshold_version: 'corpus-v1', ...overrides });
const signals = (overrides: Partial<MaestriDecisionInput['signals']> = {}) => ({ exact: true, ...overrides });
const route = (risk: MaestriDecisionInput['risk'], priority: number, split: DecisionCorpusSplit, id: string, proposed_route = 'execute', policyOverrides: Partial<MaestriDecisionInput['policy']> = {}) => make(id, split, 'exact-deterministic-route', { risk, priority, proposed_route, policy: policy(policyOverrides), signals: signals() }, { route: proposed_route, needs_review: ['R2', 'R3', 'R4'].includes(risk), needs_approval: false, needs_ceo: policyOverrides.ceo_required ?? false, abstain: false });
const blocked = (risk: MaestriDecisionInput['risk'], priority: number, split: DecisionCorpusSplit, id: string, overrides: Partial<MaestriDecisionInput['policy']> = {}) => make(id, split, 'policy-denial', { risk, priority, policy: policy({ denied: true, ...overrides }), signals: signals() }, { route: 'blocked', needs_review: ['R2', 'R3', 'R4'].includes(risk), needs_approval: false, needs_ceo: risk === 'R4' || overrides.ceo_required === true, abstain: false });
const approval = (risk: MaestriDecisionInput['risk'], priority: number, split: DecisionCorpusSplit, id: string, overrides: Partial<MaestriDecisionInput['policy']> = {}, signalOverrides: Partial<MaestriDecisionInput['signals']> = {}) => make(id, split, 'approval-required', { risk, priority, policy: policy({ approval_required: true, ...overrides }), signals: signals(signalOverrides) }, { route: 'approval', needs_review: ['R2', 'R3', 'R4'].includes(risk), needs_approval: true, needs_ceo: risk === 'R4' || overrides.ceo_required === true, abstain: false });
const fallback = (risk: MaestriDecisionInput['risk'], priority: number, split: DecisionCorpusSplit, id: string, signalOverrides: Partial<MaestriDecisionInput['signals']>, proposed_route?: string) => make(id, split, 'uncertain-conflicting-or-unsupported', { risk, priority, ...(proposed_route ? { proposed_route } : { proposed_route: undefined }), policy: policy(), signals: signals({ exact: false, ...signalOverrides }) }, { route: 'fallback', needs_review: ['R2', 'R3', 'R4'].includes(risk), needs_approval: false, needs_ceo: false, abstain: true });

// Fixed contract fixtures. The held-out rows have different case IDs and feature combinations from train/calibration.
export const MAESTRI_DECISION_CORPUS_V1: readonly MaestriDecisionCorpusCase[] = Object.freeze([
  route('R0', 0, 'train', 'tr-route-r0-p0'), route('R1', 1, 'train', 'tr-route-r1-p1'), route('R2', 2, 'train', 'tr-route-r2-p2', 'inspect'), route('R3', 3, 'train', 'tr-route-r3-p3'),
  blocked('R0', 4, 'train', 'tr-block-r0-p4'), blocked('R1', 5, 'train', 'tr-block-r1-p5'), blocked('R2', 6, 'train', 'tr-block-r2-p6'),
  approval('R0', 7, 'train', 'tr-approval-r0-p7'), approval('R2', 8, 'train', 'tr-approval-r2-p8'), approval('R4', 9, 'train', 'tr-approval-r4-p9', { approval_required: false }),
  fallback('R0', 10, 'train', 'tr-fallback-nonexact-p10', {}, 'execute'),
  fallback('R1', 11, 'train', 'tr-fallback-conflict-p11', { conflict: true }, 'execute'),
  fallback('R2', 12, 'train', 'tr-fallback-unsupported-p12', { unsupported: true }, 'inspect'),

  route('R1', 13, 'calibration', 'ca-route-r1-p13', 'inspect', { retry_allowed: true }),
  blocked('R3', 14, 'calibration', 'ca-block-r3-p14'),
  approval('R1', 15, 'calibration', 'ca-approval-r1-p15'),
  fallback('R3', 16, 'calibration', 'ca-fallback-conflict-p16', { conflict: true }, 'inspect'),
  fallback('R0', 17, 'train', 'tr-fallback-no-route-p17', {}, undefined),

  route('R3', 18, 'held-out', 'ho-route-r3-p18', 'inspect', { ceo_required: true }),
  blocked('R4', 19, 'held-out', 'ho-block-r4-p19'),
  approval('R3', 20, 'held-out', 'ho-approval-r3-p20'),
  approval('R4', 21, 'held-out', 'ho-approval-r4-p21', { approval_required: false }, { exact: false, conflict: true }),
  fallback('R2', 22, 'held-out', 'ho-fallback-unsupported-p22', { unsupported: true, conflict: true }, 'execute'),
  fallback('R1', 23, 'held-out', 'ho-fallback-conflict-p23', { conflict: true, unsupported: true }, 'inspect'),
]);

