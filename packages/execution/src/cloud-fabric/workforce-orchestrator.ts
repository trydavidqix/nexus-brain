import {
  executionRiskFromPlanRisk,
} from './execution-port';
import type {
  ExecutionPort,
  ExecutionResult,
  TaskContract,
} from './execution-port';
import type { MasterPlan, MasterPlanTask, RiskLevel } from './workforce-types';
import { ResourceRouter } from './resource-router';
import type { ExecutionTarget } from './resource-router';
import { ContextEngine, type ContextBuildInput } from '@nexus-brain/brain/context-engine';
import { toResultDigest } from './result-digest';
import { evidenceGate } from './evidence-gate';
import type { WorkforcePersistence } from './durable-stores';
import { requiresOwnerApproval } from './approval-gate';
import { createApprovalRequest } from './approval-gate';
import type { ApprovalPersistence } from './approval-store';
import { IdempotencyStore, executionIdempotencyKey } from './idempotency';
import { CostLedger } from './cost-ledger';
import type { ContextResolver } from './context-resolver';
import type { LearningRouter } from './learning-router';
import type { ReviewResult } from './independent-review';
import { executeIndependentReview } from './reviewer-executor';
import { createRoutingTrace } from './trace-factory';
import { executeWithRetry, type ExecutionLoopResult } from './execution-loop';
import { nextEscalation, type EscalationState } from './escalation-engine';
import { readyTasks } from './master-plan';
import { scopeViolations } from './scope-guard';
import { prepareEngineeringContext } from '@nexus-brain/control-plane/engineering';
import type {
  EngineeringOrchestrationRequest,
  EngineeringOrchestratorDependencies,
} from '@nexus-brain/control-plane/engineering';
import type { ProviderEngineeringContext } from '@nexus-brain/contracts/execution/port';

export interface PortResolver {
  resolve(provider: string, model?: string): ExecutionPort | undefined;
}

export interface OrchestrationTaskResult {
  task: MasterPlanTask;
  contract: TaskContract;
  execution?: ExecutionResult;
  review?: ReviewResult;
  status: 'completed' | 'blocked' | 'failed';
  reason?: string;
}

export interface OrchestrationRun {
  plan_id: string;
  completed: string[];
  blocked: string[];
  failed: string[];
  results: OrchestrationTaskResult[];
}

export interface WorkforceEngineeringAuthorization {
  orchestration: EngineeringOrchestratorDependencies;
  /** Gateway-authenticated identity, Maestri-classified plan fields, and decision inputs per task ID. */
  tasks: Readonly<Record<string, Omit<EngineeringOrchestrationRequest, 'task'>>>;
  /** Separate Maestri-issued review task identity, plan, decision, and profile keyed by parent task ID. */
  review_tasks?: Readonly<Record<string, EngineeringOrchestrationRequest>>;
}

const riskRank: Record<RiskLevel, number> = { R0: 0, R1: 1, R2: 2, R3: 3, R4: 4 };

function maxRisk(...risks: RiskLevel[]): RiskLevel {
  return risks.reduce((highest, risk) => riskRank[risk] > riskRank[highest] ? risk : highest, 'R0');
}

function routingRiskLevel(risk: RiskLevel): 'low' | 'medium' | 'high' {
  return risk === 'R3' || risk === 'R4' ? 'high' : risk === 'R2' ? 'medium' : 'low';
}

export class WorkforceOrchestrator {
  constructor(
    private readonly router: ResourceRouter,
    private readonly ports: PortResolver,
    private readonly context: ContextEngine = new ContextEngine(),
    private readonly persistence?: WorkforcePersistence,
    private readonly idempotency = new IdempotencyStore<ExecutionLoopResult>(),
    private readonly costLedger = new CostLedger(),
    private readonly contextResolver?: ContextResolver,
    private readonly learning?: LearningRouter,
    private readonly approvals?: ApprovalPersistence,
  ) {}

  async runPlan(plan: MasterPlan, baseSha: string, engineering?: WorkforceEngineeringAuthorization): Promise<OrchestrationRun> {
    await this.persistence?.savePlan(plan);
    const completed = new Set<string>();
    const blocked = new Set<string>();
    const failed = new Set<string>();
    const results: OrchestrationTaskResult[] = [];

    while (completed.size + blocked.size + failed.size < plan.tasks.length) {
      const ready = readyTasks(plan, [...completed, ...blocked, ...failed]).filter((task) =>
        (task.depends_on ?? []).every((dependency) => completed.has(dependency)),
      );

      if (ready.length === 0) {
        for (const task of plan.tasks) {
          if (!completed.has(task.task_id) && !blocked.has(task.task_id) && !failed.has(task.task_id)) {
            blocked.add(task.task_id);
            results.push({
              task,
              contract: this.contractFor(plan, task, baseSha),
              status: 'blocked',
              reason: 'dependency_not_completed',
            });
          }
        }
        break;
      }

      for (const task of ready) {
        const contract = this.contractFor(plan, task, baseSha);
        const taskAuthorization = engineering?.tasks[task.task_id];
        if (!engineering || !taskAuthorization) {
          blocked.add(task.task_id);
          results.push({ task, contract, status: 'blocked', reason: 'engineering_plan_required' });
          continue;
        }
        let engineeringContext: ProviderEngineeringContext;
        let modelProfile: string;
        let effectiveRisk: RiskLevel;
        let reviewEngineeringContext: ProviderEngineeringContext | undefined;
        let reviewModelProfile: string | undefined;
        let reviewEffectiveRisk: RiskLevel | undefined;
        try {
          const prepared = await prepareEngineeringContext(engineering.orchestration, {
            ...taskAuthorization,
            task: { ...task, project_id: taskAuthorization.identity.project_id },
          });
          if (prepared.status !== 'ready' || !prepared.engineering_plan || !prepared.provider_context) {
            blocked.add(task.task_id);
            results.push({ task, contract, status: 'blocked', reason: 'maestri_decision_blocked' });
            continue;
          }
          engineeringContext = prepared.provider_context;
          modelProfile = prepared.engineering_plan.model_profile;
          effectiveRisk = prepared.engineering_plan.risk_level;
          if (prepared.decision.needs_review) {
            const reviewAuthorization = engineering.review_tasks?.[task.task_id];
            if (!reviewAuthorization) {
              blocked.add(task.task_id);
              results.push({ task, contract, status: 'blocked', reason: 'review_engineering_plan_required' });
              continue;
            }
            if (reviewAuthorization.task.task_id !== `${task.task_id}:review`
              || reviewAuthorization.task.project_id !== taskAuthorization.identity.project_id
              || reviewAuthorization.identity.project_id !== taskAuthorization.identity.project_id) {
              blocked.add(task.task_id);
              results.push({ task, contract, status: 'blocked', reason: 'review_engineering_identity_mismatch' });
              continue;
            }
            const authorizedReviewRisk = maxRisk(
              effectiveRisk,
              reviewAuthorization.task.risk,
              reviewAuthorization.plan_fields.risk_level,
              reviewAuthorization.decision_input.risk,
            );
            const reviewPrepared = await prepareEngineeringContext(engineering.orchestration, {
              ...reviewAuthorization,
              task: { ...reviewAuthorization.task, risk: authorizedReviewRisk },
              plan_fields: { ...reviewAuthorization.plan_fields, risk_level: authorizedReviewRisk },
              decision_input: { ...reviewAuthorization.decision_input, risk: authorizedReviewRisk },
            });
            if (reviewPrepared.status !== 'ready' || !reviewPrepared.engineering_plan || !reviewPrepared.provider_context) {
              blocked.add(task.task_id);
              results.push({ task, contract, status: 'blocked', reason: 'maestri_review_decision_blocked' });
              continue;
            }
            reviewEngineeringContext = reviewPrepared.provider_context;
            reviewModelProfile = reviewPrepared.engineering_plan.model_profile;
            reviewEffectiveRisk = reviewPrepared.engineering_plan.risk_level;
          }
        } catch (error) {
          blocked.add(task.task_id);
          results.push({ task, contract, status: 'blocked', reason: error instanceof Error ? error.message : 'engineering_context_invalid' });
          continue;
        }
        if (contract.execution_mode === 'write' && contract.allowed_paths.length === 0) {
          blocked.add(task.task_id);
          results.push({ task, contract, status: 'blocked', reason: 'allowed_paths_required' });
          continue;
        }
        if (requiresOwnerApproval(contract)) {
          await this.approvals?.save(createApprovalRequest(contract));
          blocked.add(task.task_id);
          results.push({ task, contract, status: 'blocked', reason: 'owner_approval_required' });
          continue;
        }

        const routed = await this.router.route({
          capability: task.capabilities ?? [],
          priority: 1,
          risk: effectiveRisk,
          complexity: task.complexity,
          model_profile: modelProfile,
          risk_level: routingRiskLevel(effectiveRisk),
          phase: 'execute',
        });

        if (routed.reason === 'required_model_profile_unavailable' || routed.model_id !== modelProfile) {
          blocked.add(task.task_id);
          results.push({ task, contract, status: 'blocked', reason: 'required_model_profile_unavailable' });
          continue;
        }

        let reviewTarget: ExecutionTarget | undefined;
        let reviewerPort: ExecutionPort | undefined;
        if (reviewEngineeringContext && reviewModelProfile) {
          const reviewAuthorization = engineering.review_tasks?.[task.task_id];
          if (!reviewAuthorization) {
            blocked.add(task.task_id);
            results.push({ task, contract, status: 'blocked', reason: 'review_engineering_plan_required' });
            continue;
          }
          reviewTarget = await this.router.route({
            capability: reviewAuthorization.task.capabilities ?? [],
            priority: 1,
            risk: reviewEffectiveRisk!,
            complexity: reviewAuthorization.task.complexity,
            model_profile: reviewModelProfile,
            risk_level: routingRiskLevel(reviewEffectiveRisk!),
            phase: 'verify',
            exclude_providers: [String(routed.provider)],
          });
          if (reviewTarget.reason === 'required_model_profile_unavailable' || reviewTarget.model_id !== reviewModelProfile) {
            blocked.add(task.task_id);
            results.push({ task, contract, status: 'blocked', reason: 'required_review_model_profile_unavailable' });
            continue;
          }
          const reviewerProvider = String(reviewTarget.provider);
          reviewerPort = reviewTarget.adapter ?? this.ports.resolve(reviewerProvider);
          if (!reviewerPort || reviewerProvider === String(routed.provider)) {
            blocked.add(task.task_id);
            results.push({ task, contract, status: 'blocked', reason: 'independent_reviewer_unavailable' });
            continue;
          }
        }

        const port = routed.adapter ?? this.ports.resolve(String(routed.provider));
        if (!port) {
          blocked.add(task.task_id);
          results.push({ task, contract, status: 'blocked', reason: 'execution_port_unavailable' });
          continue;
        }

        const resolvedContext = this.contextResolver?.resolve(contract) ?? { sources: [], allowed_tools: [], provenance: [] };
        const packetInput: ContextBuildInput = {
          contract,
          sources: resolvedContext.sources,
          allowed_tools: resolvedContext.allowed_tools,
          token_budget: 8000,
          expansion_level: 1,
          provenance: [`masterplan:${plan.plan_id}`, ...resolvedContext.provenance],
        };
        const packet = this.context.compilePacket(packetInput);
        contract.context_packet = packet;

        const executionKey = executionIdempotencyKey(plan.plan_id, task.task_id, baseSha, 1);
        await this.persistence?.saveRoutingTrace(createRoutingTrace({ task_id: task.task_id, phase: 'execute', execution_target: { provider: String(routed.provider), reason: routed.reason }, context_packet_id: packet.packet_id }));
        const loop = await this.idempotency.once(executionKey, () => executeWithRetry(port, contract, undefined, undefined, engineeringContext));
        let execution = loop.result;
        const scopeErrors = scopeViolations({
          mode: contract.execution_mode ?? 'write',
          allowedPaths: contract.allowed_paths,
          changedPaths: execution.files_changed,
        });
        if (scopeErrors.length > 0) {
          execution = {
            ...execution,
            status: 'blocked',
            risks: [...(execution.risks ?? []), 'execution_scope_violation'],
            error: { code: 'execution_scope_violation', message: `Changed paths outside task scope: ${scopeErrors.join(', ')}`, retryable: false },
          };
        }

        contract.preferred_provider = String(routed.provider);
        contract.preferred_model = routed.model;
        this.costLedger.record(execution);
        await this.persistence?.saveExecution(execution);
        const gate = evidenceGate(execution, effectiveRisk);
        if (execution.status !== 'success' || !gate.passed) {
          const target = execution.status === 'blocked' || execution.status === 'waiting_for_approval'
            ? blocked
            : failed;
          target.add(task.task_id);
          results.push({ task, contract, execution, status: target === blocked ? 'blocked' : 'failed', reason: gate.reasons.join(',') });
          continue;
        }

        let review: ReviewResult | undefined;
        if (reviewEngineeringContext && reviewModelProfile && reviewTarget && reviewerPort) {
          const reviewerProvider = String(reviewTarget.provider);
          await this.persistence?.saveRoutingTrace(createRoutingTrace({ task_id: task.task_id, phase: 'verify', execution_target: { provider: reviewerProvider, reason: reviewTarget.reason }, execution_id: execution.execution_id, context_packet_id: packet.packet_id }));
          const reviewed = await executeIndependentReview({
            implementation: execution,
            contract,
            risk: reviewEffectiveRisk ?? effectiveRisk,
            target: { provider: reviewerProvider, model: reviewTarget.model, port: reviewerPort },
            engineeringContext: reviewEngineeringContext,
          });
          await this.persistence?.saveExecution(reviewed.reviewExecution);
          review = reviewed.review;

          const observation = {
            model_id: execution.model ?? execution.provider ?? String(routed.provider),
            task_type: task.capabilities?.[0] ?? 'general',
            complexity: task.complexity,
            risk: effectiveRisk,
            success: execution.status === 'success',
            reviewer_accepted: review.accepted,
            deterministic_passed: execution.tests.length > 0 && execution.tests.every((test) => test.passed),
            retries: Math.max(0, loop.attempts.length - 1),
            latency_ms: execution.usage?.duration_ms,
            cost_usd: execution.usage?.cost_usd ?? undefined,
          };
          this.learning?.record(observation);
          await this.persistence?.saveObservation(observation);

          if (!review.accepted) {
            failed.add(task.task_id);
            results.push({ task, contract, execution, review, status: 'failed', reason: review.reasons.join(',') });
            continue;
          }
        }

        completed.add(task.task_id);
        const digest = toResultDigest(execution);
        await this.persistence?.saveDigest(digest);
        results.push({ task, contract, execution, ...(review ? { review } : {}), status: 'completed' });
      }
    }

    return {
      plan_id: plan.plan_id,
      completed: [...completed],
      blocked: [...blocked],
      failed: [...failed],
      results,
    };
  }

  private contractFor(plan: MasterPlan, task: MasterPlanTask, baseSha: string): TaskContract {
    return {
      task_id: task.task_id,
      goal: task.objective,
      scope: task.objective,
      allowed_paths: task.allowed_paths ?? [],
      execution_mode: task.read_only ? 'read_only' : 'write',
      constraints: plan.constraints,
      acceptance_criteria: task.acceptance_criteria,
      capabilities: task.capabilities ?? [],
      risk: executionRiskFromPlanRisk(task.risk),
      base_sha: baseSha,
      context_budget: { input_tokens: 8000 },
      tool_budget: { calls: 20 },
      execution_budget: { seconds: 1800 },
      evidence_required: task.evidence_requirements ?? [],
    };
  }
}
