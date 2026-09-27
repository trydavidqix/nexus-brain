import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateBranchRetirement } from '../scripts/git-retirement-core.mjs';

const proven = {
  registryAvailable: true,
  ownerProven: true,
  activeOwner: false,
  pullRequestInventoryComplete: true,
  pullRequestOpen: false,
  clean: true,
  checkedOut: false,
  recoveryProtected: false,
  preservationProven: true,
  redundancyProven: true
};

test('allows retirement planning only for proven empty or merged-clean branches', () => {
  assert.deepEqual(evaluateBranchRetirement({ ...proven, commitsAhead: 0, merged: true }), {
    classification: 'EMPTY', eligible: true
  });
  assert.deepEqual(evaluateBranchRetirement({ ...proven, commitsAhead: 2, merged: true }), {
    classification: 'SAFE_MERGED_CLEAN', eligible: true
  });
});

test('fails closed when ownership or PR inventory is unavailable', () => {
  assert.equal(evaluateBranchRetirement({ ...proven, registryAvailable: false, commitsAhead: 0, merged: true }).classification, 'UNKNOWN');
  assert.equal(evaluateBranchRetirement({ ...proven, pullRequestInventoryComplete: false, commitsAhead: 1, merged: true }).classification, 'UNKNOWN');
  assert.equal(evaluateBranchRetirement({ ...proven, ownerProven: false, commitsAhead: 1, merged: true }).eligible, false);
});

test('refuses dirty, checked-out, active, open-PR, unmerged, or recovery-protected branches', () => {
  assert.equal(evaluateBranchRetirement({ ...proven, clean: false, commitsAhead: 0, merged: true }).classification, 'DIRTY');
  assert.equal(evaluateBranchRetirement({ ...proven, checkedOut: true, commitsAhead: 0, merged: true }).eligible, false);
  assert.equal(evaluateBranchRetirement({ ...proven, activeOwner: true, commitsAhead: 0, merged: true }).classification, 'ACTIVE');
  assert.equal(evaluateBranchRetirement({ ...proven, pullRequestOpen: true, commitsAhead: 1, merged: true }).classification, 'UNMERGED');
  assert.equal(evaluateBranchRetirement({ ...proven, commitsAhead: 1, merged: false }).classification, 'UNMERGED');
  assert.equal(evaluateBranchRetirement({ ...proven, recoveryProtected: true, commitsAhead: 0, merged: true }).classification, 'RECOVERY_PROTECTED');
});

test('requires explicit preservation and redundancy evidence for merged branches', () => {
  assert.equal(evaluateBranchRetirement({ ...proven, preservationProven: false, commitsAhead: 1, merged: true }).eligible, false);
  assert.equal(evaluateBranchRetirement({ ...proven, redundancyProven: false, commitsAhead: 1, merged: true }).eligible, false);
});
