export function evaluateBranchRetirement(evidence) {
  if (!evidence || typeof evidence !== 'object'
    || !Number.isInteger(evidence.commitsAhead) || evidence.commitsAhead < 0
    || typeof evidence.merged !== 'boolean'
    || ['recoveryProtected', 'clean', 'activeOwner', 'ownerProven', 'registryAvailable', 'pullRequestInventoryComplete', 'pullRequestOpen', 'checkedOut', 'preservationProven', 'redundancyProven']
      .some(key => typeof evidence[key] !== 'boolean')) return { classification: 'UNKNOWN', eligible: false };
  if (evidence.recoveryProtected === true) return { classification: 'RECOVERY_PROTECTED', eligible: false };
  if (evidence.clean === false) return { classification: 'DIRTY', eligible: false };
  if (evidence.clean !== true) return { classification: 'UNKNOWN', eligible: false };
  if (evidence.activeOwner === true) return { classification: 'ACTIVE', eligible: false };
  if (evidence.pullRequestOpen === true) return { classification: 'UNMERGED', eligible: false };
  if (evidence.registryAvailable !== true || evidence.pullRequestInventoryComplete !== true) {
    return { classification: 'UNKNOWN', eligible: false };
  }
  if (evidence.checkedOut !== false) return { classification: 'STALE_REVIEW_REQUIRED', eligible: false };
  if (evidence.ownerProven !== true) return { classification: 'STALE_REVIEW_REQUIRED', eligible: false };
  if (evidence.merged !== true) return { classification: 'UNMERGED', eligible: false };
  if (evidence.preservationProven !== true || evidence.redundancyProven !== true) {
    return { classification: 'STALE_REVIEW_REQUIRED', eligible: false };
  }
  if (evidence.commitsAhead === 0) return { classification: 'EMPTY', eligible: true };
  return { classification: 'SAFE_MERGED_CLEAN', eligible: true };
}
