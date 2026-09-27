import assert from 'node:assert/strict';
import { join } from 'node:path';
import test from 'node:test';
import { classifyBranch, classifyWorktree, isInProjectWorktreeScope } from '../scripts/engineering-gates-core.mjs';

test('includes the Nexus root and sibling Nexus worktrees only', () => {
  const projects = join('C:', 'Users', 'David', 'Desktop', 'Projetos');
  const currentRoot = join(projects, 'nexus-brain-nb10-worktree');
  assert.equal(isInProjectWorktreeScope(join(projects, 'nexus-brain'), currentRoot, 'nexus-brain'), true);
  assert.equal(isInProjectWorktreeScope(join(projects, 'nexus-brain-feature'), currentRoot, 'nexus-brain'), true);
  assert.equal(isInProjectWorktreeScope(join(projects, 'lumenva'), currentRoot, 'nexus-brain'), false);
});

test('excludes paths outside the checkout parent and symbolic links', () => {
  const currentRoot = join('C:', 'Users', 'David', 'Desktop', 'Projetos', 'nexus-brain');
  assert.equal(isInProjectWorktreeScope(join('C:', 'Users', 'David', '.lumenva', 'worktrees', 'nexus-brain-task'), currentRoot, 'nexus-brain'), false);
  assert.equal(isInProjectWorktreeScope(join('C:', 'Users', 'David', 'Desktop', 'Projetos', 'nexus-brain-link'), currentRoot, 'nexus-brain', true), false);
});

test('classifies prunable Git metadata without inspecting its worktree path', () => {
  assert.equal(classifyWorktree({ prunable: true, dirty: false }), 'ORPHANED_METADATA');
});

test('classifies a dirty worktree before clean or merged state', () => {
  assert.equal(classifyWorktree({ dirty: true, activeTaskProven: true }), 'DIRTY');
});

test('calls a worktree active only when task ownership is proven', () => {
  assert.equal(classifyWorktree({ dirty: false, activeTaskProven: true }), 'ACTIVE');
  assert.equal(classifyWorktree({ dirty: false, activeTaskProven: false }), 'UNKNOWN');
});

test('classifies branches with no commits beyond main as empty', () => {
  assert.equal(classifyBranch({ commitsAhead: 0, merged: true, clean: true }), 'EMPTY');
});

test('classifies unmerged branch work as unmerged', () => {
  assert.equal(classifyBranch({ commitsAhead: 2, merged: false, clean: true }), 'UNMERGED');
});

test('does not call a merged clean branch safe without ownership and preservation proof', () => {
  assert.equal(classifyBranch({ commitsAhead: 3, merged: true, clean: true }), 'STALE_REVIEW_REQUIRED');
});

test('classifies a duplicate candidate without treating it as safe to retire', () => {
  assert.equal(classifyBranch({ commitsAhead: 1, merged: true, clean: true, duplicateCandidate: true }), 'DUPLICATE_CANDIDATE');
});

test('requires ownership, preservation, and redundancy proof before safe classification', () => {
  const evidence = {
    commitsAhead: 2,
    merged: true,
    clean: true,
    ownerProven: true,
    preservationProven: true,
    redundancyProven: true
  };
  assert.equal(classifyBranch(evidence), 'SAFE_MERGED_CLEAN');
  assert.equal(classifyBranch({ ...evidence, recoveryProtected: true }), 'RECOVERY_PROTECTED');
});
