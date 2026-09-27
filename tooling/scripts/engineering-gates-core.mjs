import { basename, dirname, resolve } from 'node:path';

export const GIT_HYGIENE_CLASSIFICATIONS = Object.freeze([
  'ACTIVE',
  'EMPTY',
  'SAFE_MERGED_CLEAN',
  'DIRTY',
  'UNMERGED',
  'ORPHANED_METADATA',
  'DUPLICATE_CANDIDATE',
  'STALE_REVIEW_REQUIRED',
  'RECOVERY_PROTECTED',
  'UNKNOWN'
]);

function normalizedPath(value) {
  return resolve(value).replaceAll('\\', '/').toLowerCase();
}

export function isInProjectWorktreeScope(candidatePath, currentRoot, repositoryName, isSymbolicLink = false) {
  if (isSymbolicLink || !candidatePath || !currentRoot || !repositoryName) return false;

  const root = resolve(currentRoot);
  const candidate = resolve(candidatePath);
  const candidateName = basename(candidate).toLowerCase();
  const repository = repositoryName.toLowerCase();
  const sameCheckout = normalizedPath(candidate) === normalizedPath(root);
  const sibling = normalizedPath(dirname(candidate)) === normalizedPath(dirname(root));
  const repositoryNamed = candidateName === repository || candidateName.startsWith(`${repository}-`);

  return sameCheckout || (sibling && repositoryNamed);
}

export function classifyWorktree({
  prunable = false,
  recoveryProtected = false,
  dirty,
  activeTaskProven = false,
  ownershipRegistryAvailable = false,
  pullRequestStatus = 'UNKNOWN'
} = {}) {
  if (recoveryProtected) return 'RECOVERY_PROTECTED';
  if (prunable) return 'ORPHANED_METADATA';
  if (dirty === true) return 'DIRTY';
  if (dirty !== false) return 'UNKNOWN';
  if (activeTaskProven) return 'ACTIVE';
  if (!ownershipRegistryAvailable || !['OPEN', 'NONE'].includes(pullRequestStatus)) return 'UNKNOWN';
  if (pullRequestStatus === 'OPEN') return 'UNMERGED';
  return 'STALE_REVIEW_REQUIRED';
}

export function classifyBranch({
  commitsAhead,
  merged,
  clean,
  ownerProven = false,
  preservationProven = false,
  redundancyProven = false,
  duplicateCandidate = false,
  activeTaskProven = false,
  pullRequestOpen = false,
  pullRequestInventoryComplete,
  recoveryProtected = false
} = {}) {
  if (recoveryProtected) return 'RECOVERY_PROTECTED';
  if (!Number.isInteger(commitsAhead) || commitsAhead < 0 || typeof merged !== 'boolean') return 'UNKNOWN';
  if (clean === false) return 'DIRTY';
  if (activeTaskProven) return 'ACTIVE';
  if (pullRequestOpen) return 'UNMERGED';
  if (pullRequestInventoryComplete === false && merged && commitsAhead > 0) return 'UNKNOWN';
  if (!merged) return 'UNMERGED';
  if (commitsAhead === 0) return clean === true ? 'EMPTY' : 'UNKNOWN';
  if (duplicateCandidate && !redundancyProven) return 'DUPLICATE_CANDIDATE';
  if (clean !== true) return 'UNKNOWN';
  if (ownerProven && preservationProven && redundancyProven) return 'SAFE_MERGED_CLEAN';
  return 'STALE_REVIEW_REQUIRED';
}

export function findEquivalentTreeGroups(entries) {
  if (!Array.isArray(entries)) return [];
  const groups = new Map();
  for (const entry of entries) {
    if (!entry || entry.clean !== true || typeof entry.treeOid !== 'string' || !/^[a-f0-9]{40,64}$/i.test(entry.treeOid)) continue;
    const key = entry.treeOid.toLowerCase();
    const group = groups.get(key) ?? [];
    group.push(entry.id);
    groups.set(key, group);
  }
  return [...groups.values()].filter(group => group.length > 1).map(ids => ({ count: ids.length, ids }));
}

export function countOrphanedOwnershipRecords(records, worktrees) {
  if (!Array.isArray(records) || !Array.isArray(worktrees)) return undefined;
  const activeRecords = records.filter(record => record?.status === 'ACTIVE' && typeof record.branch === 'string' && typeof record.worktree === 'string');
  return activeRecords.filter(record => !worktrees.some(worktree => worktree.branch === record.branch
    && typeof worktree.path === 'string'
    && resolve(worktree.path).replaceAll('\\', '/').toLowerCase() === resolve(record.worktree).replaceAll('\\', '/').toLowerCase())).length;
}
