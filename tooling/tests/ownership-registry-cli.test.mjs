import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
const ownershipScript = join(repositoryRoot, 'tooling/scripts/task-ownership.mjs');

function createTemporaryNexus(t) {
  const parent = mkdtempSync(join(tmpdir(), 'nexus-ownership-cli-'));
  const root = join(parent, 'nexus-brain');
  mkdirSync(root);
  t.after(() => rmSync(parent, { recursive: true, force: true }));

  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git('init', '-b', 'main');
  git('config', 'user.name', 'Nexus Test');
  git('config', 'user.email', 'nexus-test@example.invalid');
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: '@nexus-brain/workspace' }));
  git('add', 'package.json');
  git('commit', '-m', 'build: initialize temporary test repository');
  git('switch', '-c', 'codex/nb19-g7-owner');
  return { root, git };
}

function runOwnership(root, ...args) {
  return spawnSync(process.execPath, [ownershipScript, ...args], { cwd: root, encoding: 'utf8' });
}

test('registers and lists ownership without exposing local worktree path', t => {
  const { root } = createTemporaryNexus(t);
  const registered = runOwnership(root, 'register', '--task-id', 'NB-19-G7', '--agent-id', 'codex-root');
  assert.equal(registered.status, 0, registered.stderr);
  assert.match(registered.stdout, /"status":"ACTIVE"/);
  assert.doesNotMatch(registered.stdout, /nexus-ownership-cli-|worktree/i);

  const listed = runOwnership(root, 'list');
  assert.equal(listed.status, 0, listed.stderr);
  assert.match(listed.stdout, /NB-19-G7/);
  assert.match(listed.stdout, /codex\/nb19-g7-owner/);
  assert.doesNotMatch(listed.stdout, /nexus-ownership-cli-|"worktree"/i);

  const commonDirectory = spawnSync('git', ['rev-parse', '--git-common-dir'], { cwd: root, encoding: 'utf8' }).stdout.trim();
  const registry = JSON.parse(readFileSync(resolve(root, commonDirectory, 'nexus-ownership', 'registry.json'), 'utf8'));
  assert.equal(registry.records[0].worktree, root);
});

test('refuses main ownership and releases metadata without removing it', t => {
  const { root, git } = createTemporaryNexus(t);
  git('switch', 'main');
  const rejected = runOwnership(root, 'register', '--task-id', 'NB-19-G7', '--agent-id', 'codex-root');
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /non-main branch/i);

  git('switch', 'codex/nb19-g7-owner');
  const registered = runOwnership(root, 'register', '--task-id', 'NB-19-G7', '--agent-id', 'codex-root');
  assert.equal(registered.status, 0, registered.stderr);
  const released = runOwnership(root, 'release', '--task-id', 'NB-19-G7', '--agent-id', 'codex-root');
  assert.equal(released.status, 0, released.stderr);
  assert.match(released.stdout, /RELEASED/);

  const listed = runOwnership(root, 'list');
  assert.equal(listed.status, 0, listed.stderr);
  assert.match(listed.stdout, /RELEASED/);
  assert.doesNotMatch(listed.stdout, /nexus-ownership-cli-/i);
});

test('refuses a second active owner for a task without a Maestri task split', t => {
  const { root } = createTemporaryNexus(t);
  const first = runOwnership(root, 'register', '--task-id', 'NB-19-G7', '--agent-id', 'codex-root');
  assert.equal(first.status, 0, first.stderr);

  const second = runOwnership(root, 'register', '--task-id', 'NB-19-G7', '--agent-id', 'codex-reviewer');
  assert.notEqual(second.status, 0);
  assert.match(second.stderr, /Maestri subtask\/owner split required/i);
});
