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
