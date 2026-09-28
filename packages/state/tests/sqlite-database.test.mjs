import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import { openStateDatabase } from '@nexus-brain/state';

async function makeTempDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), 'nexus-state-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

const migration = (version, sql, name = `migration-${version}`) => ({ version, name, sql });

test('default database path resolves under the Nexus workspace and creates its parent directory', async (t) => {
  const directory = await makeTempDirectory(t);
  const originalDirectory = process.cwd();
  process.chdir(directory);
  let database;
  try {
    database = openStateDatabase();
    assert.equal(database.getSchemaVersion(), 0);
    await database.close();
    database = undefined;
    const defaultPath = join(directory, '.nexus', 'state.db');
    assert.equal((await stat(defaultPath)).isFile(), true);
    assert.equal(resolve(defaultPath), resolve(directory, '.nexus', 'state.db'));
    assert.equal(resolve(join(originalDirectory, '.nexus', 'state.db')) === resolve(defaultPath), false);
  } finally {
    if (database) await database.close();
    process.chdir(originalDirectory);
  }
});

test('applies sequential checksummed migrations and persists the latest schema version after reopen', async (t) => {
  const directory = await makeTempDirectory(t);
  const path = join(directory, 'nested', 'state.db');
  const migrations = [
    migration(1, 'CREATE TABLE bootstrap_probe (version INTEGER NOT NULL); INSERT INTO bootstrap_probe VALUES (1);'),
    migration(2, 'INSERT INTO bootstrap_probe VALUES (2);'),
  ];

  const firstOpen = openStateDatabase({ path, migrations });
  assert.equal(firstOpen.getSchemaVersion(), 2);
  await firstOpen.close();

  const secondOpen = openStateDatabase({ path, migrations });
  assert.equal(secondOpen.getSchemaVersion(), 2);
  await secondOpen.close();

  const inspection = new Database(path, { readonly: true });
  try {
    assert.deepEqual(inspection.prepare('SELECT version FROM bootstrap_probe ORDER BY version').all(), [{ version: 1 }, { version: 2 }]);
  } finally {
    inspection.close();
  }
});

test('rejects migrations with a version gap', async (t) => {
  const directory = await makeTempDirectory(t);
  assert.throws(
    () => openStateDatabase({
      path: join(directory, 'state.db'),
      migrations: [migration(1, 'SELECT 1;'), migration(3, 'SELECT 3;')],
    }),
    /sequential|version|migration/i,
  );
});

test('rejects migrations with an empty name or SQL text', () => {
  const invalidMigrations = [
    migration(1, 'SELECT 1;', ''),
    migration(1, 'SELECT 1;', '   '),
    migration(1, ''),
    migration(1, ' \n\t '),
  ];

  for (const invalidMigration of invalidMigrations) {
    assert.throws(() => openStateDatabase({ path: ':memory:', migrations: [invalidMigration] }));
  }
});

test('rejects a changed checksum for an already applied migration', async (t) => {
  const directory = await makeTempDirectory(t);
  const path = join(directory, 'state.db');
  const original = migration(1, 'CREATE TABLE checksum_probe (value INTEGER);');
  const database = openStateDatabase({ path, migrations: [original] });
  await database.close();

  assert.throws(
    () => openStateDatabase({ path, migrations: [migration(1, 'CREATE TABLE checksum_probe (value TEXT);')] }),
    /checksum|migration/i,
  );
});

test('integrityCheck reports SQLite quick_check success without changing database contents', async (t) => {
  const directory = await makeTempDirectory(t);
  const path = join(directory, 'state.db');
  const database = openStateDatabase({ path });
  const result = database.integrityCheck();

  assert.deepEqual(result, { ok: true, details: ['ok'] });
  await database.close();
});

test('file-backed database persists WAL mode', async (t) => {
  const directory = await makeTempDirectory(t);
  const path = join(directory, 'state.db');
  const database = openStateDatabase({ path });
  await database.close();

  const inspection = new Database(path, { readonly: true });
  try {
    assert.equal(inspection.pragma('journal_mode', { simple: true }), 'wal');
  } finally {
    inspection.close();
  }
});

test('enforces foreign keys while applying migrations', async (t) => {
  const directory = await makeTempDirectory(t);
  const path = join(directory, 'state.db');
  const foreignKeyMigration = migration(1, [
    'CREATE TABLE fk_parent (id INTEGER PRIMARY KEY);',
    'CREATE TABLE fk_child (parent_id INTEGER REFERENCES fk_parent(id));',
    'INSERT INTO fk_child (parent_id) VALUES (404);',
  ].join('\n'));

  assert.throws(() => openStateDatabase({ path, migrations: [foreignKeyMigration] }), /foreign key|constraint|migration/i);
});

test('rolls back a failed migration and leaves the prior version usable', async (t) => {
  const directory = await makeTempDirectory(t);
  const path = join(directory, 'state.db');
  const applied = migration(1, 'CREATE TABLE rollback_probe (value INTEGER NOT NULL); INSERT INTO rollback_probe VALUES (1);');
  const failing = migration(2, [
    'CREATE TABLE failed_migration_probe (value INTEGER NOT NULL);',
    "INSERT INTO failed_migration_probe VALUES ('wrong-type-for-integer');",
    'THIS IS INVALID SQL;',
  ].join('\n'));

  assert.throws(() => openStateDatabase({ path, migrations: [applied, failing] }), /migration|sql|syntax/i);

  const reopened = openStateDatabase({ path, migrations: [applied] });
  assert.equal(reopened.getSchemaVersion(), 1);
  await reopened.close();

  const inspection = new Database(path, { readonly: true });
  try {
    const tables = inspection.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'failed_migration_probe'").all();
    assert.deepEqual(tables, []);
  } finally {
    inspection.close();
  }
});
