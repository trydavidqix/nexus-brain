import type { RiskLevel } from '@nexus-brain/contracts/workforce/types';
import type { EngineeringTaskType, SkillEvent, SkillRegistryEntry, TaskSkillSet } from '@nexus-brain/contracts';

export interface SkillResolutionInput {
  task_id: string;
  agent_id: string;
  task_type: EngineeringTaskType;
  risk_level: RiskLevel;
  required?: string[];
  optional?: string[];
  forbidden?: string[];
  context_budget: Record<string, unknown> & { input_tokens: number };
}

export interface SkillResolution {
  skill_set: TaskSkillSet;
  selection_id: string;
  diagnostics: string[];
}

export interface SkillRegistry {
  searchSkills(input?: { query?: string; task_type?: EngineeringTaskType; risk_level?: RiskLevel; limit?: number }): SkillRegistryEntry[];
  resolveSkills(input: SkillResolutionInput): SkillResolution;
  loadSkill(input: { task_id: string; agent_id: string; skill_id: string; selection_id: string }): Promise<{ skill_id: string; version: string; body: string }>;
  unloadSkill(input: { task_id: string; agent_id: string; skill_id: string }): Promise<boolean>;
  completeSkill(input: { task_id: string; agent_id: string; skill_id: string }): Promise<TaskSkillSet>;
  getActiveSkills(input: { task_id: string; agent_id: string }): Array<{ skill_id: string; version: string; body: string }>;
}

export function createSkillRegistry(options: {
  entries: SkillRegistryEntry[];
  readSkillBody(input: { skill_id: string; version: string; task_id: string; agent_id: string }): Promise<string> | string;
  recordEvent(event: SkillEvent): Promise<unknown> | unknown;
  now?: () => Date;
}): SkillRegistry;
