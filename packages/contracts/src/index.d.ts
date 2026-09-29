export type ContractType =
  | "task" | "event" | "trace" | "telemetry" | "agent" | "runtime"
  | "tool" | "plugin" | "mcp" | "alert" | "eval" | "artifact" | "engineering-plan" | "identity" | "nexus-task" | "memory" | "evidence" | "permission" | "browser-plan" | "browser-task" | "browser-session" | "browser-observation" | "browser-action" | "browser-backend" | "browser-host" | "browser-profile" | "browser-recipe" | "brain-request" | "brain-response" | "research-request" | "research-result" | "reach-request" | "reach-outcome" | "skill-registry-entry" | "task-skill-set" | "skill-event" | "project-factory-request" | "project-factory-plan" | "maestri-decision-input" | "maestri-decision-result" | "project" | "project-v2" | "goal";

export type { EngineeringAutonomyLevel, EngineeringPlan, EngineeringSkillPolicy, EngineeringTaskType } from "./engineering/plan.js";
export type { NexusIdentity } from "./identity.js";
export type { NexusTask } from "./nexus-task.js";
export type { NexusEvidence } from "./evidence.js";
export type { NexusMemoryRecord, NexusCanonicalMemoryRecord, NexusMemoryEvent, NexusEvidenceSighting, MemoryScope, MemoryStatus, MemoryLifecycleEventType, MemoryRecordProvenance, MemoryTemporalFacts, MemoryAccessControl } from "./memory.js";
export type { NexusResearchRun } from "./research.js";
export type { NexusPermission, PermissionState } from "./permission.js";
export type { BrowserAction, BrowserBackend, BrowserHost, BrowserObservation, BrowserPlan, BrowserProfile, BrowserRecipe, BrowserRecipeAction, BrowserSession, BrowserTask } from "./browser.js";
export type { BrainCoverage, BrainOperation, BrainRequest, BrainResponse, ReachStatus } from "./brain.js";
export type { ResearchLimits, ResearchRequest, ResearchResult, ResearchStatus } from "./research.js";
export type { ReachOutcome, ReachRequest } from "./reach.js";
export type { SkillEvent, SkillRegistryEntry, TaskSkillSet } from "./skills.js";
export type { LoadedEngineeringSkill, ProviderEngineeringContext } from "./execution/port.js";
export type { ProjectFactoryDiscoveryBudget, ProjectFactoryDisposition, ProjectFactoryPlan, ProjectFactoryRequest, ProjectFactoryResourceDecision, ProjectFactoryRisk, ProjectFactoryStatus, ProjectFactoryTaskSeed } from "./project-factory.js";
export type { MaestriDecisionInput, MaestriDecisionPolicy, MaestriDecisionResult, MaestriDecisionRisk, MaestriDecisionSignals, MaestriDecisionSource } from "./maestri-decision.js";
export type { NexusLocalWorkspaceBinding, NexusProject, NexusProjectV2 } from "./project.js";
export type { GoalRisk, NexusGoal } from "./goal.js";

export interface ContractValidationResult {
  valid: boolean;
  errors: string[];
  schema_id: string | null;
}

export function contractSchema(type: ContractType | string): Record<string, unknown> | null;
export function validateContract(type: ContractType | string, value: unknown): ContractValidationResult;
export function assertContract<T>(type: ContractType | string, value: T): T;
export function normalizeLegacy<T extends Record<string, unknown>>(value: T, type: ContractType | string): T & {
  source: string;
  measurement_type: string;
  timestamp: string;
};
export function contractTypes(): ContractType[];
