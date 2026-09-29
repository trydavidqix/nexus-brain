import { describe, expect, it } from "vitest";
import type { ExecutionPort } from "./execution-port.js";
import { QuotaRouter } from "./quota-router.js";
import { ResourceRouter } from "./resource-router.js";
import { ModelRegistry, type ModelProfile } from "./model-registry.js";

function provider(name: string, input: { healthy?: boolean; capabilities?: string[]; operations?: string[]; remaining?: number; remainingPercent?: number; available?: boolean } = {}): ExecutionPort {
  const healthy = input.healthy ?? true;
  return {
    name,
    execute: async () => { throw new Error("not used"); },
    resume: async () => { throw new Error("not used"); },
    cancel: async () => { throw new Error("not used"); },
    health: async () => ({ ok: healthy, status: healthy ? "healthy" : "unavailable" }),
    capabilities: async () => input.operations ?? ["execute", "read_only", ...(input.capabilities ?? [])],
    usage: async () => ({ input_tokens: 0, cached_tokens: 0, output_tokens: 0, duration_ms: 0, cost_usd: 0 }),
    quota: async () => ({ provider: name, tokens_used: 0, cost_usd: 0, remaining_budget: input.remaining, remaining_percent: input.remainingPercent, available: input.available ?? true }),
    checkQuota: async () => ({ provider: name, tokens_used: 0, cost_usd: 0, remaining_budget: input.remaining, remaining_percent: input.remainingPercent, available: input.available ?? true }),
  };
}

describe("ResourceRouter V2", () => {
  it("selects only healthy providers with required capabilities and verified quota", async () => {
    const router = new QuotaRouter();
    const unavailable = provider("unavailable", { available: false, remaining: undefined });
    const missingCapability = provider("missing", { operations: ["execute"], remaining: 100 });
    const selected = provider("selected", { operations: ["execute", "read_only"], remaining: 100 });

    await expect(router.selectProviderBasedOnQuota([unavailable, missingCapability, selected], ["read_only"])).resolves.toBe(selected);
  });

  it("does not select an unhealthy provider even when quota is positive", async () => {
    const router = new QuotaRouter();

    await expect(router.selectProviderBasedOnQuota([provider("bad", { healthy: false, remaining: 100 })])).rejects.toThrow("No healthy providers");
  });

  it("routes independent review away from the implementation provider", async () => {
    const codex = provider("codex", { capabilities: ["coding", "review"], remaining: 100 });
    const claude = provider("claude", { capabilities: ["coding", "review"], remaining: 100 });
    const router = new ResourceRouter({ codex, claude, antigravity: provider("antigravity", { capabilities: ["review"], remaining: 100 }) });

    const target = await router.route({
      capability: ["review"],
      priority: 1,
      risk_level: "medium",
      phase: "verify",
      exclude_providers: ["codex", "antigravity"],
    });

    expect(target.provider).toBe("claude");
  });

  it("selects provider/model by phase, risk, capability, quota, and profile score", async () => {
    const profiles: ModelProfile[] = [
      { id: "claude-review", provider: "claude", model: "claude-configured", tier: 2, capabilities: ["review"], preferred_for: ["review"], max_risk: "R3", max_complexity: "HEAVY", subscription_backed: true, gateway_backed: false, enabled: true, relative_cost: 1, relative_latency: 2, reliability: 0.9 },
      { id: "codex-review", provider: "codex", model: "codex-configured", tier: 1, capabilities: ["review"], preferred_for: [], max_risk: "R2", max_complexity: "NORMAL", subscription_backed: true, gateway_backed: false, enabled: true, relative_cost: 2, relative_latency: 2, reliability: 0.8 },
    ];
    const router = new ResourceRouter({
      codex: provider("codex", { remaining: 100, remainingPercent: 80 }),
      claude: provider("claude", { remaining: 100, remainingPercent: 80 }),
      modelRegistry: new ModelRegistry(profiles),
    });

    const target = await router.route({ capability: ["review"], priority: 1, risk: "R2", complexity: "NORMAL", phase: "verify" });

    expect(target.provider).toBe("claude");
    expect(target.model).toBe("claude-configured");
  });

  it("honors the exact Maestri model profile and never substitutes another candidate", async () => {
    const codex = provider("codex", { remaining: 100, remainingPercent: 80 });
    const claude = provider("claude", { remaining: 100, remainingPercent: 80 });
    const router = new ResourceRouter({ codex, claude, modelRegistry: new ModelRegistry([
      { id: "codex-default", provider: "codex", model: "codex-default-model", tier: 3, capabilities: ["coding"], preferred_for: ["coding"], max_risk: "R4", max_complexity: "EXCLUSIVE", subscription_backed: true, gateway_backed: false, enabled: true, relative_cost: 1, relative_latency: 1, reliability: 1 },
      { id: "claude-selected", provider: "claude", model: "claude-exact-model", tier: 1, capabilities: ["coding"], preferred_for: [], max_risk: "R2", max_complexity: "NORMAL", subscription_backed: true, gateway_backed: false, enabled: true, relative_cost: 9, relative_latency: 9, reliability: 0.5 },
    ]) });

    const selected = await router.route({ capability: ["coding"], priority: 1, risk: "R1", complexity: "LIGHT", phase: "execute", model_profile: "claude-selected" });
    const unavailable = await router.route({ capability: ["coding"], priority: 1, risk: "R1", complexity: "LIGHT", phase: "execute", model_profile: "missing-profile" });

    expect(selected.model_id).toBe("claude-selected");
    expect(selected.model).toBe("claude-exact-model");
    expect(selected.provider).toBe("claude");
    expect(unavailable.adapter).toBeUndefined();
    expect(unavailable.reason).toBe("required_model_profile_unavailable");
  });

  it("keeps the default router from treating unavailable adapters as executable", async () => {
    const target = await new ResourceRouter().route({ capability: ["read_only"], priority: 1 });

    expect(target.adapter).toBeUndefined();
    expect(target.provider).toBe("OPENAI_CLOUD");
    expect(target.reason).toBe("no_healthy_provider_with_verified_quota");
  });
});
