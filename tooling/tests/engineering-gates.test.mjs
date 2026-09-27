import assert from 'node:assert/strict';
import { join } from 'node:path';
import test from 'node:test';
import { classifyBranch, classifyWorktree, countOrphanedOwnershipRecords, findEquivalentTreeGroups, isInProjectWorktreeScope } from '../scripts/engineering-gates-core.mjs';
import { parseOpenPullRequestBranches } from '../scripts/github-pr-inventory.mjs';

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

test('classifies unowned clean worktree as stale only with complete ownership and PR inventories', () => {
  assert.equal(classifyWorktree({ dirty: false, ownershipRegistryAvailable: true, pullRequestStatus: 'NONE' }), 'STALE_REVIEW_REQUIRED');
  assert.equal(classifyWorktree({ dirty: false, ownershipRegistryAvailable: true, pullRequestStatus: 'OPEN' }), 'UNMERGED');
  assert.equal(classifyWorktree({ dirty: false, ownershipRegistryAvailable: false, pullRequestStatus: 'NONE' }), 'UNKNOWN');
  assert.equal(classifyWorktree({ dirty: false, ownershipRegistryAvailable: true, pullRequestStatus: 'UNKNOWN' }), 'UNKNOWN');
});

test('keeps owned or dirty resources out of stale classifications', () => {
  assert.equal(classifyWorktree({ dirty: false, activeTaskProven: true, ownershipRegistryAvailable: true, pullRequestStatus: 'NONE' }), 'ACTIVE');
  assert.equal(classifyWorktree({ dirty: true, ownershipRegistryAvailable: true, pullRequestStatus: 'NONE' }), 'DIRTY');
});

test('classifies branches with no commits beyond main as empty', () => {
  assert.equal(classifyBranch({ commitsAhead: 0, merged: true, clean: true }), 'EMPTY');
  assert.equal(classifyBranch({ commitsAhead: 0, merged: true, clean: false }), 'DIRTY');
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

test('requires complete PR inventory before calling merged branches stale', () => {
  assert.equal(classifyBranch({ commitsAhead: 1, merged: true, clean: true, pullRequestInventoryComplete: false }), 'UNKNOWN');
  assert.equal(classifyBranch({ commitsAhead: 1, merged: true, clean: true, pullRequestOpen: true, pullRequestInventoryComplete: true }), 'UNMERGED');
  assert.equal(classifyBranch({ commitsAhead: 1, merged: true, clean: true, activeTaskProven: true, pullRequestInventoryComplete: true }), 'ACTIVE');
});

test('detects equivalent trees from object IDs, not similar resource names', () => {
  const oid = 'a'.repeat(40);
  assert.deepEqual(findEquivalentTreeGroups([
    { id: 'branch-one', treeOid: oid, clean: true },
    { id: 'different-name', treeOid: oid.toUpperCase(), clean: true },
    { id: 'similar-branch-one', treeOid: 'b'.repeat(40), clean: true },
    { id: 'dirty-copy', treeOid: oid, clean: false }
  ]), [{ count: 2, ids: ['branch-one', 'different-name'] }]);
  assert.deepEqual(findEquivalentTreeGroups([{ id: 'not-an-object-id', treeOid: 'main', clean: true }]), []);
});

test('detects active owner metadata whose branch and worktree are absent', () => {
  const records = [
    { taskId: 'NB-19-G8', branch: 'codex/current', worktree: 'C:/Projects/nexus-brain', status: 'ACTIVE' },
    { taskId: 'NB-19-G7', branch: 'codex/old', worktree: 'C:/Projects/nexus-brain-old', status: 'RELEASED' }
  ];
  assert.equal(countOrphanedOwnershipRecords(records, [{ branch: 'codex/current', path: 'c:\\projects\\nexus-brain' }]), 0);
  assert.equal(countOrphanedOwnershipRecords(records, []), 1);
  assert.equal(countOrphanedOwnershipRecords(undefined, []), undefined);
});

test('accepts only complete GitHub open PR inventories', () => {
  assert.deepEqual([...parseOpenPullRequestBranches('[{"headRefName":"feature/a","headRepositoryOwner":{"login":"trydavidqix"}},{"headRefName":"feature/fork","headRepositoryOwner":{"login":"fork-user"}}]', 'trydavidqix')], ['feature/a']);
  assert.equal(parseOpenPullRequestBranches('not-json'), undefined);
  assert.equal(parseOpenPullRequestBranches('[{"headRefName":"","headRepositoryOwner":{"login":"trydavidqix"}}]', 'trydavidqix'), undefined);
  assert.equal(parseOpenPullRequestBranches('[{"headRefName":"branch","headRepositoryOwner":null}]', 'trydavidqix'), undefined);
  assert.equal(parseOpenPullRequestBranches(JSON.stringify(Array.from({ length: 1000 }, (_, i) => ({ headRefName: `branch-${i}`, headRepositoryOwner: { login: 'trydavidqix' } }))), 'trydavidqix'), undefined);
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
