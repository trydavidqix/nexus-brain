import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  findActiveOwnership,
  provesActiveWorktreeOwnership,
  releaseOwnership,
  upsertOwnership,
  validateOwnershipRecord,
  validateOwnershipRegistry
} from '../scripts/ownership-registry-core.mjs';

const first = Object.freeze({
  taskId: 'NB-19-G7',
  agentId: 'codex-root',
  branch: 'codex/nb19-g7-ownership-registry',
  worktree: resolve('nexus-brain-g7-a'),
  status: 'ACTIVE'
});

test('accepts an active task, agent, branch, and absolute worktree binding', () => {
  assert.deepEqual(validateOwnershipRecord(first), []);
});

test('rejects incomplete identity, main ownership, and relative paths', () => {
  assert.deepEqual(validateOwnershipRecord({ ...first, taskId: '', branch: 'main', worktree: 'relative' }), [
    'taskId must be a non-empty string',
    'branch must be a non-main branch',
    'worktree must be an absolute path'
  ]);
});

test('prevents two active owners from sharing a branch or worktree', () => {
  const second = { ...first, taskId: 'NB-19-G8', agentId: 'codex-child', worktree: resolve('nexus-brain-g7-b') };
  assert.deepEqual(validateOwnershipRegistry([first, second]), [
    'active branch is already owned: codex/nb19-g7-ownership-registry'
  ]);
});

test('prevents separate branches from sharing one active worktree', () => {
  const second = {
    ...first,
    taskId: 'NB-19-G8',
    branch: 'codex/nb19-g8-orphan-detection'
  };
  assert.deepEqual(validateOwnershipRegistry([first, second]), ['active worktree is already owned']);
});

test('allows separate agents on the same task only with separate branches and worktrees', () => {
  const second = {
    ...first,
    agentId: 'codex-reviewer',
    branch: 'codex/nb19-g7-ownership-review',
    worktree: resolve('nexus-brain-g7-review')
  };
  assert.deepEqual(validateOwnershipRegistry([first, second]), []);
});

test('proves active ownership only when task, agent, branch, and worktree all match', () => {
  const records = [first];
  assert.equal(findActiveOwnership(records, first), true);
  assert.equal(findActiveOwnership(records, { ...first, agentId: 'other-agent' }), false);
  assert.equal(findActiveOwnership([{ ...first, status: 'RELEASED' }], first), false);
});

test('does not silently move an active owner to a different branch or worktree', () => {
  assert.throws(() => upsertOwnership([first], {
    ...first,
    branch: 'codex/nb19-g7-other',
    worktree: resolve('nexus-brain-g7-other')
  }), /active ownership cannot be reassigned/);
});

test('release keeps ownership history and marks only matching task and agent released', () => {
  const second = { ...first, agentId: 'codex-reviewer', branch: 'codex/nb19-g7-review', worktree: resolve('nexus-brain-g7-review') };
  const released = releaseOwnership([first, second], first.taskId, first.agentId);
  assert.equal(released.length, 2);
  assert.equal(released[0].status, 'RELEASED');
  assert.equal(released[1].status, 'ACTIVE');
});

test('proves an active worktree only when branch and path match registry identity', () => {
  assert.equal(provesActiveWorktreeOwnership([first], first), true);
  assert.equal(provesActiveWorktreeOwnership([first], { ...first, branch: 'codex/other' }), false);
  assert.equal(provesActiveWorktreeOwnership([first], { ...first, worktree: resolve('nexus-brain-other') }), false);
  assert.equal(provesActiveWorktreeOwnership([{ ...first, status: 'RELEASED' }], first), false);
});
