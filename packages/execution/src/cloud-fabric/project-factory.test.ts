import { describe, expect, it } from 'vitest';
import type { ProjectFactoryRequest } from '@nexus-brain/contracts';
import { compileProjectFactoryPlan } from './project-factory';

const request: ProjectFactoryRequest = {
  project_id: 'nexus-brain',
  factory_run_id: 'factory-1',
  requested_by: 'owner',
  objective: 'Compile a bounded implementation plan',
  requirements: ['web.interact', 'code.review', 'new.capability'],
  constraints: ['reuse before build'],
  risk_level: 'R2',
  discovery_budget: { max_queries: 8, max_candidates: 8, max_minutes: 20 },
};

describe('Project Factory compiler', () => {
  it('prefers reuse, then provider integration, and builds only when discovery has no reusable candidate', () => {
    const plan = compileProjectFactoryPlan({
      request,
      discovery_evidence_ids: ['evidence-discovery-1'],
      candidates: [
        {
          capability: 'web.interact',
          implementation: 'BrowserMesh',
          evidence_ids: ['evidence-browsermesh'],
          available: true,
          healthy: true,
          nexus_owned: true,
        },
        {
          capability: 'code.review',
          provider: 'codex',
          evidence_ids: ['evidence-codex'],
          available: true,
          healthy: true,
        },
      ],
    });

    expect(plan.status).toBe('READY');
    expect(plan.resource_decisions.map((decision) => decision.disposition)).toEqual([
      'REUSE',
      'USE_PROVIDER',
      'BUILD',
    ]);
    expect(plan.task_graph.map((task) => task.objective)).toEqual([
      'Integrate capability code.review',
      'Build capability new.capability',
    ]);
    expect(plan.completion_gates).toContain('independent-review');
  });

  it('fails closed when discovery evidence is absent', () => {
    const plan = compileProjectFactoryPlan({
      request,
      discovery_evidence_ids: [],
      candidates: [],
    });

    expect(plan.status).toBe('BLOCKED');
    expect(plan.blocked_by).toEqual(['discovery_evidence_required']);
    expect(plan.resource_decisions).toEqual([]);
  });

  it('blocks candidate overflow instead of silently exceeding the discovery budget', () => {
    const constrained = {
      ...request,
      discovery_budget: { ...request.discovery_budget, max_candidates: 1 },
    };
    const plan = compileProjectFactoryPlan({
      request: constrained,
      discovery_evidence_ids: ['evidence-discovery-1'],
      candidates: [
        { capability: 'web.interact', evidence_ids: ['e1'], available: true, healthy: true, nexus_owned: true },
        { capability: 'code.review', evidence_ids: ['e2'], available: true, healthy: true, provider: 'codex' },
      ],
    });

    expect(plan.status).toBe('BLOCKED');
    expect(plan.blocked_by).toEqual(['discovery_candidate_budget_exceeded']);
  });

  it('requires an owner gate for R3/R4 work', () => {
    const plan = compileProjectFactoryPlan({
      request: { ...request, risk_level: 'R3' },
      discovery_evidence_ids: ['evidence-discovery-1'],
      candidates: [],
    });

    expect(plan.human_gates).toEqual(['owner-approval-before-consequential-side-effects']);
  });
});
