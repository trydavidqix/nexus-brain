import { CloudProvider } from './cloud-job.js';
import { ExecutionPort } from './execution-port.js';
import { CodexAdapter, createCodexSdkRunner } from '@nexus-brain/providers/codex/adapter';
import { AntigravityAdapter } from '@nexus-brain/providers/antigravity/adapter';
import { ClaudeAdapter, createClaudeCliRunner } from '@nexus-brain/providers/claude/adapter';
import { QuotaRouter } from './quota-router.js';
import { quotaState } from './quota-router.js';
import { ModelRegistry } from './model-registry.js';
import { scoreModel } from './routing-policy.js';
import type { RiskLevel, TaskComplexity } from './workforce-types.js';

export interface ExecutionTarget {
  provider: CloudProvider | string;
  reason?: string;
  region?: string;
  capacity?: string;
  adapter?: ExecutionPort;
  model?: string;
  model_id?: string;
  score?: number;
}

export interface TaskRequirements {
  capability: string[];
  requires_gpu?: boolean;
  priority: number;
  risk_level?: 'low' | 'medium' | 'high';
  risk?: RiskLevel;
  complexity?: TaskComplexity;
  /** Exact model profile issued by Maestri; when set, no profile substitution is allowed. */
  model_profile?: string;
  phase?: 'plan' | 'execute' | 'verify';
  historical_success?: Record<string, number>;
  exclude_providers?: string[];
}

export class ResourceRouter {
  private codex: ExecutionPort;
  private claude: ExecutionPort;
  private antigravity: ExecutionPort;
  private quotaRouter: QuotaRouter;
  private modelRegistry: ModelRegistry;

  constructor(input: { codex?: ExecutionPort; claude?: ExecutionPort; antigravity?: ExecutionPort; quotaRouter?: QuotaRouter; modelRegistry?: ModelRegistry } = {}) {
    this.codex = input.codex ?? new CodexAdapter(createCodexSdkRunner());
    this.claude = input.claude ?? new ClaudeAdapter(createClaudeCliRunner());
    this.antigravity = input.antigravity ?? new AntigravityAdapter();
    this.quotaRouter = input.quotaRouter ?? new QuotaRouter();
    this.modelRegistry = input.modelRegistry ?? new ModelRegistry();
  }

  async route(requirements: TaskRequirements): Promise<ExecutionTarget> {
    if (!requirements.model_profile && requirements.requires_gpu) {
      return { provider: CloudProvider.GOOGLE_CLOUD, capacity: 'high' };
    }
    
    if (!requirements.model_profile && requirements.capability.includes('windows')) {
      return { provider: CloudProvider.LOCAL_WINDOWS };
    }
    
    if (!requirements.model_profile && requirements.capability.includes('linux')) {
      return { provider: CloudProvider.LOCAL_LINUX };
    }

    const excluded = new Set((requirements.exclude_providers ?? []).map((provider) => provider.toLowerCase()));
    const risk = requirements.risk ?? (requirements.risk_level === 'high' ? 'R3' : requirements.risk_level === 'medium' ? 'R2' : 'R1');
    const complexity = requirements.complexity ?? 'NORMAL';
    const phase = requirements.phase ?? 'execute';
    const adapters = [this.codex, this.claude, this.antigravity].filter((adapter) => !excluded.has(adapter.name.toLowerCase()));
    const candidates = this.modelRegistry.candidates({ capabilities: requirements.capability, risk, complexity })
      .filter((profile) => !requirements.model_profile || profile.id === requirements.model_profile);
    if (requirements.model_profile && candidates.length === 0) {
      return { provider: CloudProvider.OPENAI_CLOUD, reason: 'required_model_profile_unavailable' };
    }
    const providerQuota: Record<string, ReturnType<typeof quotaState>> = {};
    await Promise.all(adapters.map(async (adapter) => {
      try {
        providerQuota[adapter.name] = quotaState(await adapter.quota());
      } catch {
        providerQuota[adapter.name] = 'UNKNOWN';
      }
    }));

    const ranked = candidates
      .filter((profile) => !excluded.has(profile.provider.toLowerCase()) && adapters.some((adapter) => adapter.name === profile.provider))
      .map((profile) => ({ profile, decision: scoreModel(profile, {
        capabilities: requirements.capability,
        risk,
        complexity,
        phase,
        providerQuota,
        historicalSuccess: requirements.historical_success,
      }) }))
      .sort((left, right) => right.decision.score - left.decision.score || (left.profile.id < right.profile.id ? -1 : 1));

    const requiredPortCapabilities = phase === 'verify' ? ['read_only'] : ['execute'];
    for (const candidate of ranked) {
      const adapter = adapters.find((port) => port.name === candidate.profile.provider);
      if (!adapter) continue;
      try {
        await this.quotaRouter.selectProviderBasedOnQuota([adapter], requiredPortCapabilities);
        return {
          provider: candidate.profile.provider,
          model: candidate.profile.model,
          model_id: candidate.profile.id,
          score: candidate.decision.score,
          reason: candidate.decision.reasons.join(',') || 'eligible_model_profile',
          adapter,
        };
      } catch {
        // Continue to the next scored, capability-compatible profile.
      }
    }

    return {
      provider: CloudProvider.OPENAI_CLOUD,
      reason: requirements.model_profile ? 'required_model_profile_unavailable' : 'no_healthy_provider_with_verified_quota',
    };
  }
}
