import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import { openSqliteStateStore } from '@nexus-brain/state';

async function makeTempDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), 'nexus-state-store-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

const project = (project_id = 'project-1') => ({
  project_id,
  repo: `opaque-repository-locator:${project_id}`,
  default_branch: 'main',
  workspace_policy: {},
  lifecycle: 'active',
  stack: [],
  permissions: {},
  policies: {},
  approvals: {},
  budgets: {},
  memory_namespace: `memory:${project_id}`,
  task_scope: `task:${project_id}`,
  session_scope: `session:${project_id}`,
  evidence_scope: `evidence:${project_id}`,
  git_bindings: [],
  ci_bindings: [],
  deployment_bindings: [],
  provider_constraints: [],
});

const goal = (project_id = 'project-1', goal_id = 'goal-1') => ({
  goal_id,
  project_id,
  objective: 'Implement a bounded capability',
  scope: ['state-store tests'],
  out_of_scope: [],
  requirements: [],
  constraints: [],
  assumptions: [],
  acceptance_criteria: ['State and event commit atomically'],
  risk: 'R1',
  required_gates: [],
  definition_of_done: ['Focused contract tests exist'],
});

function openStore(directory) {
  return openSqliteStateStore({ path: join(directory, 'nested', 'state.db') });
}

function inspectDatabase(directory) {
  return new Database(join(directory, 'nested', 'state.db'));
}

function rowCounts(database) {
  return Object.fromEntries(['projects', 'goals', 'events', 'outbox'].map((table) => [
    table,
    database.prepare(`SELECT count(*) AS count FROM ${table}`).get().count,
  ]));
}

function persistedWriteRows(directory) {
  const database = inspectDatabase(directory);
  try {
    return Object.fromEntries(['projects', 'goals', 'events', 'outbox'].map((table) => [
      table,
      database.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all(),
    ]));
  } finally {
    database.close();
  }
}

async function expectThrows(action, pattern) {
  let result;
  try {
    result = action();
  } catch (error) {
    assert.match(String(error), pattern);
    return;
  }
  if (result && typeof result.then === 'function') {
    await assert.rejects(result, pattern);
    return;
  }
  assert.fail(`expected operation to throw ${pattern}`);
}

test('validates Project and Goal contracts before writing state, events, or outbox rows', async (t) => {
  const directory = await makeTempDirectory(t);
  const store = openStore(directory);
  t.after(() => store.close());

  await expectThrows(() => store.createProject({ ...project(), stack: [''] }), /contract invalid|project/i);
  const validProject = await store.createProject(project());
  await expectThrows(() => store.createGoal({ ...goal(), objective: '' }), /contract invalid|goal/i);

  const database = inspectDatabase(directory);
  try {
    assert.deepEqual(rowCounts(database), { projects: 1, goals: 0, events: 1, outbox: 1 });
    assert.equal(validProject.version, 1);
  } finally {
    database.close();
  }
});

test('rejects non-JSON Project values and preserves snapshot, version, event, and outbox state', async (t) => {
  const directory = await makeTempDirectory(t);
  const store = openStore(directory);
  t.after(() => store.close());

  await expectThrows(
    () => store.createProject({ ...project('date-project'), workspace_policy: { created_at: new Date('2026-01-01T00:00:00.000Z') } }),
    /JSON.*serializable/i,
  );
  assert.deepEqual(persistedWriteRows(directory), { projects: [], goals: [], events: [], outbox: [] });

  await store.createProject(project());
  const beforeProject = await store.getProject('project-1');
  const beforeRows = persistedWriteRows(directory);
  await expectThrows(
    () => store.updateProject('project-1', { ...beforeProject.project, workspace_policy: { some_key: undefined } }, { expectedVersion: beforeProject.version }),
    /JSON.*serializable/i,
  );

  assert.deepEqual(await store.getProject('project-1'), beforeProject);
  assert.deepEqual(persistedWriteRows(directory), beforeRows);
});

test('rejects an array with a custom toJSON prototype without changing persisted state', async (t) => {
  const directory = await makeTempDirectory(t);
  const store = openStore(directory);
  t.after(() => store.close());
  await store.createProject(project());
  await store.createGoal(goal());

  const beforeProject = await store.getProject('project-1');
  const beforeGoal = await store.getGoal('project-1', 'goal-1');
  const beforeRows = persistedWriteRows(directory);
  const customArray = ['original-stack-entry'];
  const customArrayPrototype = Object.create(Array.prototype);
  customArrayPrototype.toJSON = () => ['rewritten-stack-entry'];
  Object.setPrototypeOf(customArray, customArrayPrototype);

  assert.deepEqual(JSON.parse(JSON.stringify(customArray)), ['rewritten-stack-entry']);
  await expectThrows(
    () => store.updateProject('project-1', { ...beforeProject.project, stack: customArray }, { expectedVersion: beforeProject.version }),
    /JSON.*serializable|prototype/i,
  );

  assert.deepEqual(await store.getProject('project-1'), beforeProject);
  assert.deepEqual(await store.getGoal('project-1', 'goal-1'), beforeGoal);
  assert.deepEqual(persistedWriteRows(directory), beforeRows);
});

test('rejects negative zero in a Project snapshot without changing persisted state', async (t) => {
  const directory = await makeTempDirectory(t);
  const store = openStore(directory);
  t.after(() => store.close());
  await store.createProject(project());
  await store.createGoal(goal());

  const beforeProject = await store.getProject('project-1');
  const beforeGoal = await store.getGoal('project-1', 'goal-1');
  const beforeRows = persistedWriteRows(directory);
  const negativeZeroProject = {
    ...beforeProject.project,
    workspace_policy: { numeric_setting: -0 },
  };
  assert.equal(JSON.stringify(negativeZeroProject.workspace_policy), '{"numeric_setting":0}');

  await expectThrows(
    () => store.updateProject('project-1', negativeZeroProject, { expectedVersion: beforeProject.version }),
    /JSON.*serializable|snapshot.*JSON/i,
  );

  assert.deepEqual(await store.getProject('project-1'), beforeProject);
  assert.deepEqual(await store.getGoal('project-1', 'goal-1'), beforeGoal);
  assert.deepEqual(persistedWriteRows(directory), beforeRows);
});

test('creates, reads, reopens, and retries an identical Project without duplicate events', async (t) => {
  const directory = await makeTempDirectory(t);
  let store = openStore(directory);
  const created = await store.createProject(project());
  assert.deepEqual(created, { project: project(), version: 1 });
  assert.deepEqual(await store.getProject('project-1'), created);
  await store.close();

  store = openStore(directory);
  t.after(() => store.close());
  assert.deepEqual(await store.getProject('project-1'), created);
  assert.deepEqual(await store.createProject(project()), created);

  await expectThrows(
    () => store.createProject({ ...project(), repo: 'different-opaque-repository-locator' }),
    /STATE_CONFLICT/,
  );
  const database = inspectDatabase(directory);
  try {
    assert.deepEqual(rowCounts(database), { projects: 1, goals: 0, events: 1, outbox: 1 });
  } finally {
    database.close();
  }
});

test('updates complete Project snapshots with expectedVersion, skips no-ops, and rejects stale versions', async (t) => {
  const directory = await makeTempDirectory(t);
  const store = openStore(directory);
  t.after(() => store.close());
  await store.createProject(project());
  await store.createProject(project('project-2'));

  await expectThrows(
    () => store.updateProject('project-1', project('project-2'), { expectedVersion: 1 }),
    /STATE_CONFLICT/,
  );
  assert.deepEqual(await store.getProject('project-1'), { project: project('project-1'), version: 1 });
  assert.deepEqual(await store.getProject('project-2'), { project: project('project-2'), version: 1 });

  const rebound = { ...project(), repo: 'new-opaque-repository-locator' };
  const updated = await store.updateProject('project-1', rebound, { expectedVersion: 1 });
  assert.deepEqual(updated, { project: rebound, version: 2 });
  assert.deepEqual(await store.updateProject('project-1', rebound, { expectedVersion: 2 }), updated);
  await expectThrows(
    () => store.updateProject('project-1', { ...rebound, lifecycle: 'paused' }, { expectedVersion: 1 }),
    /STATE_CONFLICT/,
  );
  assert.deepEqual(await store.getProject('project-1'), updated);
  assert.deepEqual(await store.getProject('project-2'), { project: project('project-2'), version: 1 });

  const database = inspectDatabase(directory);
  try {
    assert.deepEqual(rowCounts(database), { projects: 2, goals: 0, events: 3, outbox: 3 });
  } finally {
    database.close();
  }
});

test('requires Goal parent Project, scopes reads by both identifiers, and exposes no Goal update/delete', async (t) => {
  const directory = await makeTempDirectory(t);
  const store = openStore(directory);
  t.after(() => store.close());
  await expectThrows(() => store.createGoal(goal('missing-project')), /foreign key|constraint|project/i);

  await store.createProject(project('project-1'));
  await store.createProject(project('project-2'));
  const firstGoal = await store.createGoal(goal('project-1', 'shared-goal-id'));
  const secondGoal = await store.createGoal(goal('project-2', 'shared-goal-id'));
  assert.deepEqual(firstGoal, { goal: goal('project-1', 'shared-goal-id'), version: 1 });
  assert.deepEqual(secondGoal, { goal: goal('project-2', 'shared-goal-id'), version: 1 });
  assert.deepEqual(await store.createGoal(goal('project-1', 'shared-goal-id')), firstGoal);
  assert.deepEqual(await store.getGoal('project-1', 'shared-goal-id'), firstGoal);
  assert.deepEqual(await store.getGoal('project-2', 'shared-goal-id'), secondGoal);
  assert.equal(await store.getGoal('project-1', 'unknown-goal'), null);
  assert.equal(await store.getGoal('unknown-project', 'shared-goal-id'), null);
  assert.equal(typeof store.updateGoal, 'undefined');
  assert.equal(typeof store.deleteGoal, 'undefined');

  await expectThrows(
    () => store.createGoal({ ...goal('project-1', 'shared-goal-id'), objective: 'Conflicting contents' }),
    /STATE_CONFLICT/,
  );
  const database = inspectDatabase(directory);
  try {
    assert.deepEqual(rowCounts(database), { projects: 2, goals: 2, events: 4, outbox: 4 });
  } finally {
    database.close();
  }
});

test('commits Project and Goal snapshots with matching event and outbox records', async (t) => {
  const directory = await makeTempDirectory(t);
  const store = openStore(directory);
  t.after(() => store.close());
  await store.createProject(project());
  await store.createGoal(goal());

  const database = inspectDatabase(directory);
  try {
    assert.deepEqual(rowCounts(database), { projects: 1, goals: 1, events: 2, outbox: 2 });
    const events = database.prepare('SELECT event_id, event_type, occurred_at, aggregate_type, aggregate_id, aggregate_version, project_id, payload FROM events ORDER BY rowid').all();
    assert.deepEqual(events.map(({ event_type, aggregate_version, project_id }) => ({ event_type, aggregate_version, project_id })), [
      { event_type: 'PROJECT_CREATED', aggregate_version: 1, project_id: 'project-1' },
      { event_type: 'GOAL_CREATED', aggregate_version: 1, project_id: 'project-1' },
    ]);
    assert.ok(events.every((row) => typeof row.aggregate_type === 'string' && row.aggregate_type.length > 0));
    assert.ok(events.every((row) => typeof row.aggregate_id === 'string' && row.aggregate_id.length > 0));
    assert.ok(events.every((row) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.event_id)));
    assert.ok(events.every((row) => Number.isFinite(Date.parse(row.occurred_at))));
    assert.deepEqual(JSON.parse(events[0].payload), project());
    assert.deepEqual(JSON.parse(events[1].payload), goal());
    const outbox = database.prepare('SELECT event_id, created_at FROM outbox ORDER BY rowid').all();
    assert.deepEqual(outbox.map((row) => row.event_id), events.map((row) => row.event_id));
    assert.ok(outbox.every((row) => Number.isFinite(Date.parse(row.created_at))));
  } finally {
    database.close();
  }
});

test('rolls back Project and Goal state, events, and outbox when outbox insertion fails', async (t) => {
  const directory = await makeTempDirectory(t);
  let store = openStore(directory);
  await store.close();
  let database = inspectDatabase(directory);
  database.exec("CREATE TRIGGER force_outbox_failure BEFORE INSERT ON outbox BEGIN SELECT RAISE(ABORT, 'forced outbox failure'); END;");
  database.close();

  store = openStore(directory);
  await expectThrows(() => store.createProject(project()), /forced outbox failure|constraint/i);
  await store.close();

  database = inspectDatabase(directory);
  assert.deepEqual(rowCounts(database), { projects: 0, goals: 0, events: 0, outbox: 0 });
  database.exec('DROP TRIGGER force_outbox_failure;');
  database.close();
  store = openStore(directory);
  await store.createProject(project());
  await store.close();

  database = inspectDatabase(directory);
  database.exec("CREATE TRIGGER force_outbox_failure BEFORE INSERT ON outbox BEGIN SELECT RAISE(ABORT, 'forced outbox failure'); END;");
  database.close();
  store = openStore(directory);
  await expectThrows(() => store.createGoal(goal()), /forced outbox failure|constraint/i);
  await store.close();

  database = inspectDatabase(directory);
  try {
    assert.deepEqual(rowCounts(database), { projects: 1, goals: 0, events: 1, outbox: 1 });
  } finally {
    database.close();
  }
});

test('rejects direct event update and deletion', async (t) => {
  const directory = await makeTempDirectory(t);
  const store = openStore(directory);
  await store.createProject(project());
  await store.close();

  const database = inspectDatabase(directory);
  try {
    const { event_id: eventId } = database.prepare('SELECT event_id FROM events').get();
    assert.throws(() => database.prepare('UPDATE events SET payload = payload WHERE event_id = ?').run(eventId), /append-only|immutable|event/i);
    assert.throws(() => database.prepare('DELETE FROM events WHERE event_id = ?').run(eventId), /append-only|immutable|event/i);
    assert.deepEqual(rowCounts(database), { projects: 1, goals: 0, events: 1, outbox: 1 });
  } finally {
    database.close();
  }
});
