import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { validateContract } from '@nexus-brain/contracts';
import { openStateDatabaseConnection } from './sqlite-database.mjs';

const STATE_STORE_MIGRATIONS = [
  {
    version: 1,
    name: 'state-store-project-goal-v1',
    sql: `
      CREATE TABLE projects (
        project_id TEXT PRIMARY KEY,
        snapshot_json TEXT NOT NULL,
        version INTEGER NOT NULL CHECK (version > 0)
      );

      CREATE TABLE goals (
        project_id TEXT NOT NULL,
        goal_id TEXT NOT NULL,
        snapshot_json TEXT NOT NULL,
        version INTEGER NOT NULL CHECK (version = 1),
        PRIMARY KEY (project_id, goal_id),
        FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE RESTRICT
      );

      CREATE TABLE events (
        event_id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL CHECK (event_type IN ('PROJECT_CREATED', 'PROJECT_UPDATED', 'GOAL_CREATED')),
        occurred_at TEXT NOT NULL,
        aggregate_type TEXT NOT NULL,
        aggregate_id TEXT NOT NULL,
        aggregate_version INTEGER NOT NULL CHECK (aggregate_version > 0),
        project_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE RESTRICT
      );

      CREATE TABLE outbox (
        event_id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE RESTRICT
      );

      CREATE TRIGGER events_reject_update
      BEFORE UPDATE ON events
      BEGIN
        SELECT RAISE(ABORT, 'events are append-only');
      END;

      CREATE TRIGGER events_reject_delete
      BEFORE DELETE ON events
      BEGIN
        SELECT RAISE(ABORT, 'events are append-only');
      END;

      CREATE TRIGGER outbox_reject_update
      BEFORE UPDATE ON outbox
      BEGIN
        SELECT RAISE(ABORT, 'outbox rows are immutable');
      END;

      CREATE TRIGGER outbox_reject_delete
      BEFORE DELETE ON outbox
      BEGIN
        SELECT RAISE(ABORT, 'outbox rows are immutable');
      END;
    `,
  },
];

function validateInput(type, value) {
  assertJsonCompatible(value);
  const result = validateContract(type, value);
  if (!result.valid) {
    throw new Error(`${type} contract invalid (${result.schema_id}): ${result.errors.join(', ')}`);
  }
}

function assertJsonCompatible(value) {
  const ancestors = new WeakSet();

  function fail(path, detail) {
    throw new TypeError(`State snapshot must be JSON serializable: ${path} ${detail}`);
  }

  function visit(current, path) {
    if (current === null || typeof current === 'string' || typeof current === 'boolean') return;
    if (typeof current === 'number') {
      if (!Number.isFinite(current) || Object.is(current, -0)) {
        fail(path, 'must be a finite JSON number without lossy -0 encoding');
      }
      return;
    }
    if (typeof current !== 'object') fail(path, `has unsupported ${typeof current} value`);
    if (ancestors.has(current)) fail(path, 'contains a cycle');

    ancestors.add(current);
    if (Array.isArray(current)) {
      if (Object.getPrototypeOf(current) !== Array.prototype) {
        fail(path, 'must use the native array prototype');
      }
      const keys = Reflect.ownKeys(current);
      if (keys.some((key) => typeof key === 'symbol')) fail(path, 'contains a symbol key');
      const length = current.length;
      for (const key of keys) {
        if (key === 'length') continue;
        if (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length) {
          fail(path, `contains unsupported array property ${key}`);
        }
      }
      for (let index = 0; index < length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(current, String(index));
        if (!descriptor) fail(`${path}[${index}]`, 'is a sparse array entry');
        if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
          fail(`${path}[${index}]`, 'must be an enumerable data property');
        }
        visit(descriptor.value, `${path}[${index}]`);
      }
    } else {
      const prototype = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) {
        fail(path, 'must be a plain object record');
      }
      for (const key of Reflect.ownKeys(current)) {
        if (typeof key === 'symbol') fail(path, 'contains a symbol key');
        const descriptor = Object.getOwnPropertyDescriptor(current, key);
        if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
          fail(`${path}.${key}`, 'must be an enumerable data property');
        }
        visit(descriptor.value, `${path}.${key}`);
      }
    }
    ancestors.delete(current);
  }

  try {
    visit(value, '$');
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('must be JSON serializable')) throw error;
    throw new TypeError('State snapshot must be JSON serializable', { cause: error });
  }
}

function snapshotJson(value) {
  const json = JSON.stringify(value);
  if (json === undefined) throw new TypeError('State snapshot must be JSON serializable');
  return json;
}

function readSnapshot(row, property) {
  return { [property]: JSON.parse(row.snapshot_json), version: row.version };
}

function stateConflict(message) {
  const error = new Error(`STATE_CONFLICT: ${message}`);
  error.code = 'STATE_CONFLICT';
  return error;
}

function writeEvent(database, { eventType, aggregateType, aggregateId, aggregateVersion, projectId, payload }) {
  const eventId = randomUUID();
  const occurredAt = new Date().toISOString();
  database.prepare(`
    INSERT INTO events (
      event_id, event_type, occurred_at, aggregate_type, aggregate_id,
      aggregate_version, project_id, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(eventId, eventType, occurredAt, aggregateType, aggregateId, aggregateVersion, projectId, payload);
  database.prepare('INSERT INTO outbox (event_id, created_at) VALUES (?, ?)').run(eventId, occurredAt);
}

export function openSqliteStateStore(options = {}) {
  const database = openStateDatabaseConnection({
    path: options.path,
    migrations: STATE_STORE_MIGRATIONS,
  });

  const findProject = database.prepare('SELECT snapshot_json, version FROM projects WHERE project_id = ?');
  const findGoal = database.prepare('SELECT snapshot_json, version FROM goals WHERE project_id = ? AND goal_id = ?');

  const createProject = database.transaction((project) => {
    validateInput('project', project);
    const json = snapshotJson(project);
    const existing = findProject.get(project.project_id);
    if (existing) {
      const previous = JSON.parse(existing.snapshot_json);
      if (isDeepStrictEqual(previous, JSON.parse(json))) return { project: previous, version: existing.version };
      throw stateConflict(`project_id ${project.project_id} already exists with different contents`);
    }

    database.prepare('INSERT INTO projects (project_id, snapshot_json, version) VALUES (?, ?, 1)')
      .run(project.project_id, json);
    writeEvent(database, {
      eventType: 'PROJECT_CREATED',
      aggregateType: 'project',
      aggregateId: project.project_id,
      aggregateVersion: 1,
      projectId: project.project_id,
      payload: json,
    });
    return { project: JSON.parse(json), version: 1 };
  }).immediate;

  const updateProject = database.transaction((projectId, project, { expectedVersion }) => {
    validateInput('project', project);
    if (project.project_id !== projectId) {
      throw stateConflict(`project_id is immutable; received ${project.project_id} for ${projectId}`);
    }
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      throw stateConflict('expectedVersion must match the current project version');
    }

    const existing = findProject.get(projectId);
    if (!existing || existing.version !== expectedVersion) {
      throw stateConflict(`project_id ${projectId} has a stale expectedVersion`);
    }

    const json = snapshotJson(project);
    const previous = JSON.parse(existing.snapshot_json);
    if (isDeepStrictEqual(previous, JSON.parse(json))) {
      return { project: previous, version: existing.version };
    }

    const nextVersion = existing.version + 1;
    const result = database.prepare(`
      UPDATE projects SET snapshot_json = ?, version = ?
      WHERE project_id = ? AND version = ?
    `).run(json, nextVersion, projectId, expectedVersion);
    if (result.changes !== 1) {
      throw stateConflict(`project_id ${projectId} changed during update`);
    }
    writeEvent(database, {
      eventType: 'PROJECT_UPDATED',
      aggregateType: 'project',
      aggregateId: projectId,
      aggregateVersion: nextVersion,
      projectId,
      payload: json,
    });
    return { project: JSON.parse(json), version: nextVersion };
  }).immediate;

  const createGoal = database.transaction((goal) => {
    validateInput('goal', goal);
    const json = snapshotJson(goal);
    const existing = findGoal.get(goal.project_id, goal.goal_id);
    if (existing) {
      const previous = JSON.parse(existing.snapshot_json);
      if (isDeepStrictEqual(previous, JSON.parse(json))) return { goal: previous, version: existing.version };
      throw stateConflict(`goal ${goal.goal_id} already exists for project ${goal.project_id} with different contents`);
    }

    const parent = findProject.get(goal.project_id);
    if (!parent) throw new Error(`Project not found: ${goal.project_id}`);

    database.prepare('INSERT INTO goals (project_id, goal_id, snapshot_json, version) VALUES (?, ?, ?, 1)')
      .run(goal.project_id, goal.goal_id, json);
    writeEvent(database, {
      eventType: 'GOAL_CREATED',
      aggregateType: 'goal',
      aggregateId: goal.goal_id,
      aggregateVersion: 1,
      projectId: goal.project_id,
      payload: json,
    });
    return { goal: JSON.parse(json), version: 1 };
  }).immediate;

  return {
    createProject,
    getProject(projectId) {
      const row = findProject.get(projectId);
      return row ? readSnapshot(row, 'project') : null;
    },
    updateProject,
    createGoal,
    getGoal(projectId, goalId) {
      const row = findGoal.get(projectId, goalId);
      return row ? readSnapshot(row, 'goal') : null;
    },
    close() {
      database.close();
    },
  };
}
