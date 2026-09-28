import type { NexusGoal, NexusProject, NexusProjectV2 } from '@nexus-brain/contracts';

export interface StateDatabaseMigration {
  version: number;
  name: string;
  sql: string;
}

export interface StateDatabaseOptions {
  path?: string;
  migrations?: readonly StateDatabaseMigration[];
}

export interface StateDatabaseIntegrityCheck {
  ok: boolean;
  details: string[];
}

export interface StateDatabase {
  getSchemaVersion(): number;
  integrityCheck(): StateDatabaseIntegrityCheck;
  close(): void;
}

export function openStateDatabase(options?: StateDatabaseOptions): StateDatabase;

export interface VersionedProject {
  project: NexusProject | NexusProjectV2;
  version: number;
}

export interface VersionedGoal {
  goal: NexusGoal;
  version: number;
}

export interface SqliteStateStoreOptions {
  path?: string;
}

export interface SqliteStateStore {
  createProject(project: NexusProject): VersionedProject;
  registerProject(project: NexusProjectV2): VersionedProject;
  getProject(project_id: string): VersionedProject | null;
  updateProject(project_id: string, project: NexusProject | NexusProjectV2, options: { expectedVersion: number }): VersionedProject;
  createGoal(goal: NexusGoal): VersionedGoal;
  getGoal(project_id: string, goal_id: string): VersionedGoal | null;
  close(): void;
}

export function openSqliteStateStore(options?: SqliteStateStoreOptions): SqliteStateStore;
