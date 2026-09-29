import { describe, expect, it } from "vitest";
import { AntigravityAdapter } from "@nexus-brain/providers/antigravity/adapter";
import { CodexAdapter } from "@nexus-brain/providers/codex/adapter";
import type { ProviderEngineeringContext, TaskContract } from "@nexus-brain/contracts/execution/port";

const contract: TaskContract = {
  task_id: "task-1",
  goal: "run a bounded task",
  scope: "unit",
  allowed_paths: ["packages/execution/src/cloud-fabric"],
  constraints: ["no secrets"],
  capabilities: ["read_file"],
  risk: "low",
  base_sha: "abc123",
  context_budget: { input_tokens: 1000, output_tokens: 500, context_percent: 25 },
  tool_budget: { definitions: 5, calls: 2 },
  execution_budget: { seconds: 30, cost_usd: 0.1 },
  preferred_provider: "codex",
  evidence_required: ["tests"],
};

const engineeringContext: ProviderEngineeringContext = {
  engineering_plan: {
    task_id: contract.task_id,
    agent_id: "agent-execution-port-test",
    task_type: "TEST_ONLY",
    risk_level: "R1",
    scope_size: "small",
    expected_files: ["packages/execution/src/cloud-fabric/execution-port.test.ts"],
    expected_tests: ["ExecutionPort contract"],
    contract_impact: [],
    testability: "unit",
    execution_mode: "write",
    autonomy_level: "A1",
    skill_policy: { required: [], optional: [], forbidden: [], loaded: [], completed: [] },
    context_budget: { ...contract.context_budget },
    tool_profile: ["read_file"],
    verification_gates: ["unit tests"],
    delivery_policy: { commit: false },
  },
  task_skill_set: {
    task_id: contract.task_id,
    agent_id: "agent-execution-port-test",
    required: [],
    optional: [],
    forbidden: [],
    loaded: [],
    completed: [],
    context_budget: { ...contract.context_budget },
  },
  tool_profile: ["read_file"],
  loaded_skills: [],
};

describe("ExecutionPort contract", () => {
  it("does not report simulated success when Codex is unavailable", async () => {
    const result = await new CodexAdapter().execute(contract);

    expect(result.status).toBe("unavailable");
    expect(result.error?.code).toBe("provider_unavailable");
    expect(result.files_changed).toEqual([]);
  });

  it("exposes health and capabilities without pretending to execute", async () => {
    const adapter = new AntigravityAdapter();

    expect(await adapter.health()).toMatchObject({ ok: false, status: "unavailable" });
    expect(await adapter.capabilities()).toEqual([]);
    await expect(adapter.resume("task-1")).resolves.toMatchObject({ status: "unavailable" });
    await expect(adapter.cancel("task-1")).resolves.toMatchObject({ status: "cancelled" });
  });

  it("normalizes a structured Codex result returned by an injected runner", async () => {
    const adapter = new CodexAdapter({
      run: async () => ({
        finalResponse: JSON.stringify({
          status: "success",
          summary: "implemented",
          files_changed: ["src/example.ts"],
          commands: ["pnpm test"],
          tests: [{ passed: true, report: "1 passed" }],
          evidence: ["test-report"],
        }),
      }),
    });

    await expect(adapter.execute(contract, engineeringContext)).resolves.toMatchObject({
      task_id: "task-1",
      status: "success",
      files_changed: ["src/example.ts"],
    });
  });

  it("reports the injected provider health and capabilities instead of assuming them", async () => {
    const adapter = new CodexAdapter({
      run: async () => ({ finalResponse: "{}" }),
      health: async () => ({ ok: true, status: "healthy" }),
      capabilities: async () => ["execute", "structured_output"],
    });

    await expect(adapter.health()).resolves.toEqual({ ok: true, status: "healthy" });
    await expect(adapter.capabilities()).resolves.toEqual(["execute", "structured_output"]);
  });

  it("preserves exact Codex usage from the provider turn", async () => {
    const adapter = new CodexAdapter({
      run: async () => ({
        finalResponse: JSON.stringify({ status: "success", summary: "measured", files_changed: [], commands: [], tests: [], evidence: [] }),
        usage: { input_tokens: 10, cached_tokens: 4, output_tokens: 6, duration_ms: 25, cost_usd: 0 },
      }),
    });

    const result = await adapter.execute(contract, engineeringContext);
    expect(result.usage).toEqual({ input_tokens: 10, cached_tokens: 4, output_tokens: 6, duration_ms: 25, cost_usd: 0 });
    await expect(adapter.usage()).resolves.toEqual(result.usage);
  });
});
