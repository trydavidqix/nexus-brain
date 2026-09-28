import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';

const DEFAULT_DATABASE_PATH = '.nexus/state.db';
const MIGRATION_TABLE = '_nexus_schema_migrations';
const BUSY_TIMEOUT_MS = 5000;

function migrationChecksum(sql) {
  return createHash('sha256').update(sql, 'utf8').digest('hex');
}

function validateMigrations(migrations) {
  if (!Array.isArray(migrations)) {
    throw new TypeError('migrations must be an array');
  }

  let expectedVersion = 1;
  for (const migration of migrations) {
    if (!migration || typeof migration !== 'object') {
      throw new TypeError(`Migration ${expectedVersion} must be an object`);
    }
    if (!Number.isInteger(migration.version) || migration.version <= 0) {
      throw new TypeError(`Migration version must be a positive integer`);
    }
    if (migration.version !== expectedVersion) {
      throw new Error(`Migrations must use sequential versions; expected ${expectedVersion}, received ${migration.version}`);
    }
    if (typeof migration.name !== 'string' || migration.name.trim().length === 0) {
      throw new TypeError(`Migration ${migration.version} must have a non-empty name`);
    }
    if (typeof migration.sql !== 'string' || migration.sql.trim().length === 0) {
      throw new TypeError(`Migration ${migration.version} must have non-empty SQL text`);
    }
    expectedVersion += 1;
  }
}

function ensureMigrationTable(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL
    )
  `);
}

function applyMigrations(database, migrations) {
  ensureMigrationTable(database);

  const rows = database.prepare(
    `SELECT version, checksum FROM ${MIGRATION_TABLE} ORDER BY version`,
  ).all();

  let currentVersion = 0;
  for (const row of rows) {
    const expectedVersion = currentVersion + 1;
    if (row.version !== expectedVersion) {
      throw new Error(`Migration ledger is not sequential at version ${expectedVersion}`);
    }
    currentVersion = row.version;
  }

  const findApplied = database.prepare(
    `SELECT checksum FROM ${MIGRATION_TABLE} WHERE version = ?`,
  );
  const recordMigration = database.prepare(
    `INSERT INTO ${MIGRATION_TABLE} (version, name, checksum) VALUES (?, ?, ?)`,
  );

  for (const migration of migrations) {
    const checksum = migrationChecksum(migration.sql);
    if (migration.version <= currentVersion) {
      const applied = findApplied.get(migration.version);
      if (!applied || applied.checksum !== checksum) {
        throw new Error(`Migration checksum changed for applied version ${migration.version}`);
      }
      continue;
    }

    if (migration.version !== currentVersion + 1) {
      throw new Error(`Migration versions must be sequential; expected ${currentVersion + 1}, received ${migration.version}`);
    }

    try {
      database.transaction(() => {
        database.exec(migration.sql);
        recordMigration.run(migration.version, migration.name, checksum);
      }).immediate();
    } catch (error) {
      throw new Error(`Migration ${migration.version} (${migration.name}) failed: ${error.message}`, { cause: error });
    }
    currentVersion = migration.version;
  }

  return currentVersion;
}

export function openStateDatabase(options = {}) {
  const { path = DEFAULT_DATABASE_PATH, migrations = [] } = options;
  if (typeof path !== 'string' || path.length === 0) {
    throw new TypeError('path must be a non-empty string');
  }
  validateMigrations(migrations);

  const inMemory = path === ':memory:';
  const databasePath = inMemory ? path : resolve(path);
  if (!inMemory) {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const database = new Database(databasePath, { timeout: BUSY_TIMEOUT_MS });
  try {
    database.pragma('foreign_keys = ON');
    database.pragma(`busy_timeout = ${BUSY_TIMEOUT_MS}`);
    if (!inMemory) database.pragma('journal_mode = WAL');
    applyMigrations(database, migrations);
  } catch (error) {
    database.close();
    throw error;
  }

  return {
    getSchemaVersion() {
      const row = database.prepare(`SELECT MAX(version) AS version FROM ${MIGRATION_TABLE}`).get();
      return row.version ?? 0;
    },
    integrityCheck() {
      const rows = database.pragma('quick_check');
      const details = rows.map((row) => String(row.quick_check ?? Object.values(row)[0] ?? ''));
      return { ok: details.length === 1 && details[0] === 'ok', details };
    },
    close() {
      database.close();
    },
  };
}
