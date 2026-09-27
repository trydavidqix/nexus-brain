import type {
  ProjectFactoryDisposition,
  ProjectFactoryPlan,
  ProjectFactoryRequest,
  ProjectFactoryResourceDecision,
  ProjectFactoryTaskSeed,
} from '@nexus-brain/contracts';

export interface ProjectFactoryDiscoveryCandidate {
  capability: string;
  implementation?: string;
  provider?: string;
  evidence_ids: string[];
  available: boolean;
  healthy: boolean;
  nexus_owned?: boolean;
  adaptable?: boolean;
}

export interface ProjectFactoryCompileInput {
  request: ProjectFactoryRequest;
  discovery_evidence_ids: string[];
  candidates: ProjectFactoryDiscoveryCandidate[];
}

const rank: Record<ProjectFactoryDisposition, number> = {
  REUSE: 0,
  USE_PROVIDER: 1,
  ADAPT: 2,
  BUILD: 3,
};

function disposition(candidate: ProjectFactoryDiscoveryCandidate): ProjectFactoryDisposition {
  if (candidate.available && candidate.healthy && candidate.nexus_owned) return 'REUSE';
  if (candidate.available && candidate.healthy && candidate.provider) return 'USE_PROVIDER';
  if (candidate.available && candidate.adaptable) return 'ADAPT';
  return 'BUILD';
}

function chooseCandidate(
  capability: string,
  candidates: ProjectFactoryDiscoveryCandidate[],
): ProjectFactoryDiscoveryCandidate | undefined {
  return candidates
    .filter((candidate) => candidate.capability === capability)
    .sort((left, right) => {
      const byDisposition = rank[disposition(left)] - rank[disposition(right)];
      if (byDisposition !== 0) return byDisposition;
      const leftName = left.implementation ?? left.provider ?? '';
      const rightName = right.implementation ?? right.provider ?? '';
      return leftName.localeCompare(rightName);
    })[0];
}

function resourceDecision(
  capability: string,
  candidate: ProjectFactoryDiscoveryCandidate | undefined,
): ProjectFactoryResourceDecision {
  if (!candidate) {
    return {
      capability,
      disposition: 'BUILD',
      reason: 'No discovered implementation satisfied the requirement.',
      evidence_ids: [],
    };
  }

  const selectedDisposition = disposition(candidate);
  const reason = {
    REUSE: 'A healthy Nexus-owned implementation already satisfies the capability.',
    USE_PROVIDER: 'A healthy provider implementation satisfies the capability without new core code.',
    ADAPT: 'An existing implementation is reusable only behind a Nexus-owned adapter.',
    BUILD: 'Discovery found no healthy reusable implementation; bounded implementation work is required.',
  }[selectedDisposition];

  return {
    capability,
    disposition: selectedDisposition,
    implementation: candidate.implementation,
    provider: candidate.provider,
    reason,
    evidence_ids: [...candidate.evidence_ids],
  };
}

function taskSeed(
  factoryRunId: string,
  index: number,
  decision: ProjectFactoryResourceDecision,
): ProjectFactoryTaskSeed | undefined {
  if (decision.disposition === 'REUSE') return undefined;

  const verb = decision.disposition === 'USE_PROVIDER'
    ? 'Integrate'
    : decision.disposition === 'ADAPT'
      ? 'Adapt'
      : 'Build';

  return {
    task_id: `${factoryRunId}-t${index + 1}`,
    objective: `${verb} capability ${decision.capability}`,
    depends_on: [],
    acceptance_criteria: [
      `${decision.capability} satisfies its typed contract`,
      'Deterministic tests pass',
      'Independent verification accepts the result',
    ],
    required_capabilities: ['coding', 'tests', 'review'],
  };
}

export function compileProjectFactoryPlan(input: ProjectFactoryCompileInput): ProjectFactoryPlan {
  const { request, discovery_evidence_ids: discoveryEvidenceIds } = input;
  const uniqueRequirements = [...new Set(request.requirements)];

  if (input.candidates.length > request.discovery_budget.max_candidates) {
    return {
      project_id: request.project_id,
      factory_run_id: request.factory_run_id,
      status: 'BLOCKED',
      discovery_evidence_ids: [...discoveryEvidenceIds],
      architecture_decisions: ['Discovery budget is authoritative; no candidate overflow is silently accepted.'],
      resource_decisions: [],
      task_graph: [],
      completion_gates: ['discovery-budget'],
      human_gates: [],
      blocked_by: ['discovery_candidate_budget_exceeded'],
    };
  }

  if (uniqueRequirements.length > 0 && discoveryEvidenceIds.length === 0) {
    return {
      project_id: request.project_id,
      factory_run_id: request.factory_run_id,
      status: 'BLOCKED',
      discovery_evidence_ids: [],
      architecture_decisions: ['Project Factory is discovery-first and cannot choose build/reuse without evidence.'],
      resource_decisions: [],
      task_graph: [],
      completion_gates: ['discovery-evidence'],
      human_gates: [],
      blocked_by: ['discovery_evidence_required'],
    };
  }

  const resourceDecisions = uniqueRequirements.map((capability) =>
    resourceDecision(capability, chooseCandidate(capability, input.candidates)),
  );
  const taskGraph = resourceDecisions
    .map((decision, index) => taskSeed(request.factory_run_id, index, decision))
    .filter((task): task is ProjectFactoryTaskSeed => Boolean(task));

  const humanGates = request.risk_level === 'R3' || request.risk_level === 'R4'
    ? ['owner-approval-before-consequential-side-effects']
    : [];

  return {
    project_id: request.project_id,
    factory_run_id: request.factory_run_id,
    status: 'READY',
    discovery_evidence_ids: [...discoveryEvidenceIds],
    architecture_decisions: [
      'Prefer healthy Nexus-owned reuse before provider integration, adaptation, or new implementation.',
      'Project Factory coordinates existing owners; it does not create a second router, store, or control plane.',
    ],
    resource_decisions: resourceDecisions,
    task_graph: taskGraph,
    completion_gates: ['unit-tests', 'integration-tests', 'independent-review', 'scope-verification'],
    human_gates: humanGates,
  };
}
