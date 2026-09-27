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

export function classifyWorktree({ prunable = false, recoveryProtected = false, dirty, activeTaskProven = false } = {}) {
  if (recoveryProtected) return 'RECOVERY_PROTECTED';
  if (prunable) return 'ORPHANED_METADATA';
  if (dirty === true) return 'DIRTY';
  if (dirty !== false) return 'UNKNOWN';
  if (activeTaskProven) return 'ACTIVE';
  return 'UNKNOWN';
}

export function classifyBranch({
  commitsAhead,
  merged,
  clean,
  ownerProven = false,
  preservationProven = false,
  redundancyProven = false,
  duplicateCandidate = false,
  recoveryProtected = false
} = {}) {
  if (recoveryProtected) return 'RECOVERY_PROTECTED';
  if (!Number.isInteger(commitsAhead) || commitsAhead < 0 || typeof merged !== 'boolean') return 'UNKNOWN';
  if (commitsAhead === 0) return 'EMPTY';
  if (clean === false) return 'DIRTY';
  if (!merged) return 'UNMERGED';
  if (duplicateCandidate && !redundancyProven) return 'DUPLICATE_CANDIDATE';
  if (clean !== true) return 'UNKNOWN';
  if (ownerProven && preservationProven && redundancyProven) return 'SAFE_MERGED_CLEAN';
  return 'STALE_REVIEW_REQUIRED';
}
