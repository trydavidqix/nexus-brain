import { describe, expect, it } from "vitest";
import { JOB_EVENT_TYPES, JOB_STATUSES, type Job } from "@nexus-brain/contracts/job";
import { RUNTIME_PROTOCOL_VERSION, assertRuntimeCommand, type RuntimeCommand } from "@nexus-brain/contracts/runtime";
import type { EngineeringPlan, GoalRisk, NexusCanonicalMemoryRecord, NexusEvidenceSighting, NexusGoal, NexusIdentity, NexusMemoryEvent, NexusProject, NexusResearchRun, NexusTask } from "@nexus-brain/contracts";

describe("shared TypeScript contracts", () => {
  it("keeps job and runtime protocol definitions importable from contracts", () => {
    const job: Job = {
      id: "job-1",
      organizationId: "org-1",
      kind: "test",
      payload: {},
      status: "queued",
      claimedBy: null,
      attempts: 0,
      evidence: [],
      createdAt: "2026-09-25T00:00:00.000Z",
      updatedAt: "2026-09-25T00:00:00.000Z",
    };
    const command: RuntimeCommand = {
      id: "command-1",
      correlation: { organizationId: "org-1", traceId: "trace-1" },
      capabilityId: "read-file",
      executable: "node",
      args: [],
      cwd: ".",
      timeoutMs: 1000,
      maxOutputBytes: 1024,
      risk: "R1",
    };
    const plan: EngineeringPlan = {
      task_id: "task-17",
      agent_id: "agent-codex-1",
      task_type: "FEATURE",
      risk_level: "R1",
      scope_size: "bounded",
      expected_files: ["packages/contracts/src/engineering/plan.ts"],
      expected_tests: ["packages/contracts/tests/engineering-plan.test.mjs"],
      contract_impact: ["nexus.engineering-plan.v1"],
      testability: "direct",
      execution_mode: "write",
      autonomy_level: "A2",
      skill_policy: { required: ["core-discipline"], optional: [], forbidden: [], loaded: ["core-discipline"], completed: [] },
      context_budget: { input_tokens: 4000 },
      tool_profile: ["engineering.default"],
      verification_gates: ["unit-tests"],
      delivery_policy: {},
    };
    const identity: NexusIdentity = {
      project_id: "nexus-brain",
      task_id: "task-17",
      agent_id: "agent-codex-1",
    };
    const task: NexusTask = {
      project_id: "nexus-brain",
      task_id: "task-17",
      objective: "Define canonical task contract",
      risk: "R1",
      complexity: "NORMAL",
      acceptance_criteria: ["Contract validates task scope and risk"],
    };
    const project: NexusProject = {
      project_id: "project-1",
      repo: "opaque repository locator",
      default_branch: "main",
      workspace_policy: {},
      lifecycle: "active",
      stack: [],
      permissions: {},
      policies: {},
      approvals: {},
      budgets: {},
      memory_namespace: "memory:project-1",
      task_scope: "task:project-1",
      session_scope: "session:project-1",
      evidence_scope: "evidence:project-1",
      git_bindings: [],
      ci_bindings: [],
      deployment_bindings: [],
      provider_constraints: [],
    };
    const goal: NexusGoal = {
      goal_id: "goal-1",
      project_id: project.project_id,
      objective: "Implement a bounded capability",
      scope: ["contracts package"],
      out_of_scope: [],
      requirements: [],
      constraints: [],
      assumptions: [],
      acceptance_criteria: ["Contract validates"],
      risk: "R2",
      required_gates: [],
      definition_of_done: ["Required checks pass"],
    };
    const goalRisk: GoalRisk = "R4";
    // @ts-expect-error Goal risk is limited to R0–R4.
    const invalidGoalRisk: GoalRisk = "R5";
    const memory: NexusCanonicalMemoryRecord = {
      memory_id: "memory-1",
      project_id: "nexus-brain",
      scope: "PROJECT",
      scope_id: "nexus-brain",
      status: "CANDIDATE",
      content: "Candidate facts need supporting evidence.",
      content_hash: "sha256:content-1",
      evidence_ids: [],
      provenance: { source_type: "task", source_id: "task-17", actor_id: "agent-codex-1" },
      temporal: {
        observed_at: "2026-09-27T00:00:00.000Z",
        recorded_at: "2026-09-27T00:00:00.000Z",
        valid_from: "2026-09-27T00:00:00.000Z",
      },
      acl: { policy_id: "default-deny", read_permission_ids: [], write_permission_ids: [] },
      data_classification: "SYNTHETIC",
      version: 1,
    };
    const memoryEvent: NexusMemoryEvent = {
      event_id: "memory-event-1",
      memory_id: memory.memory_id,
      project_id: memory.project_id,
      scope: memory.scope,
      scope_id: memory.scope_id,
      event_type: "OBSERVED",
      recorded_at: "2026-09-27T00:00:00.000Z",
      actor: { actor_id: "agent-codex-1", actor_type: "agent" },
      provenance: { source_type: "task", source_id: "task-17" },
      payload: {},
    };
    const sighting: NexusEvidenceSighting = {
      sighting_id: "sighting-1",
      evidence_id: "evidence-1",
      project_id: "nexus-brain",
      run_id: "run-1",
      observed_at: "2026-09-27T00:00:00.000Z",
      source: "https://example.test",
      content_hash: "sha256:sighting-1",
      provenance: { source_id: "source-1" },
    };
    const researchRun: NexusResearchRun = {
      project_id: "nexus-brain",
      task_id: "task-17",
      agent_id: "agent-codex-1",
      run_id: "run-1",
      status: "OK",
      started_at: "2026-09-27T00:00:00.000Z",
      completed_at: "2026-09-27T00:01:00.000Z",
      evidence_ids: [sighting.evidence_id],
      warnings: [],
      limits: { max_queries: 2, max_providers: 2, max_results_per_provider: 4, max_browser_escalations: 0, max_wall_time_seconds: 30 },
      budget: {},
      provenance: { source: "research-engine" },
    };
    // @ts-expect-error Risk is limited to R0–R4.
    const invalidRisk: EngineeringPlan["risk_level"] = "R5";

    expect(JOB_STATUSES).toContain(job.status);
    expect(JOB_EVENT_TYPES).toContain("job.queued");
    expect(RUNTIME_PROTOCOL_VERSION).toBe(1);
    expect(() => assertRuntimeCommand(command)).not.toThrow();
    expect(plan.agent_id).toBe("agent-codex-1");
    expect(identity.project_id).toBe("nexus-brain");
    expect(task.task_id).toBe("task-17");
    expect(goal.project_id).toBe(project.project_id);
    expect(goal.risk).toBe("R2");
    expect(goalRisk).toBe("R4");
    expect(memory.temporal.valid_from).toBe("2026-09-27T00:00:00.000Z");
    expect(memoryEvent.event_type).toBe("OBSERVED");
    expect(sighting.run_id).toBe(researchRun.run_id);
  });
});
