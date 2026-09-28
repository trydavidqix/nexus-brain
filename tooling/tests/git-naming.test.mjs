import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const validator = resolve(repositoryRoot, 'tooling/scripts/check-git-naming.mjs');

function runValidator(...args) {
  return spawnSync(process.execPath, [validator, ...args], {
    cwd: repositoryRoot,
    encoding: 'utf8'
  });
}

test('accepts a concrete imperative commit subject', () => {
  const result = runValidator('--subject', 'memory: Prevent cross-project context leakage');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /git naming: PASS/);
});

test('rejects vague commit areas and subjects', () => {
  const result = runValidator('--subject', 'misc: Update files');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /vague/);
});

test('rejects a subject that does not start with an imperative action', () => {
  const result = runValidator('--subject', 'github: repository baseline');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /imperative/);
});

test('requires an action target so the subject describes a concrete change', () => {
  const result = runValidator('--subject', 'github: Build');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /target/);
});

test('rejects commit subjects without the area and action contract', () => {
  const result = runValidator('--subject', 'final');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /format/);
});

test('applies the commit subject contract to pull request titles', () => {
  const valid = runValidator('--pr-title', 'github: Record repository security baseline');
  const invalid = runValidator('--pr-title', 'update');
  assert.equal(valid.status, 0, valid.stderr);
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /format|vague/);
});

test('accepts task branches with an allowed kind, task ID, and kebab-case slug', () => {
  const result = runValidator('--branch', 'feature/NB-03-zero-cost-local');
  assert.equal(result.status, 0, result.stderr);
});

test('accepts the Codex branch prefix with a compact task ID', () => {
  const result = runValidator('--branch', 'codex/nb19-g1-naming-contracts');
  assert.equal(result.status, 0, result.stderr);
});

test('accepts a Dependabot branch only for the bot on the same repository', () => {
  const result = runValidator(
    '--branch', 'dependabot/npm_and_yarn/production-dependencies-39d93a22fb',
    '--pr-author', 'dependabot[bot]',
    '--pr-head-repo', 'trydavidqix/nexus-brain',
    '--repository', 'trydavidqix/nexus-brain'
  );
  assert.equal(result.status, 0, result.stderr);
});

test('rejects a Dependabot branch for any other pull request author', () => {
  const result = runValidator(
    '--branch', 'dependabot/npm_and_yarn/production-dependencies-39d93a22fb',
    '--pr-author', 'attacker',
    '--pr-head-repo', 'trydavidqix/nexus-brain',
    '--repository', 'trydavidqix/nexus-brain'
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /branch format/);
});

test('rejects a Dependabot branch from a different repository', () => {
  const result = runValidator(
    '--branch', 'dependabot/npm_and_yarn/production-dependencies-39d93a22fb',
    '--pr-author', 'dependabot[bot]',
    '--pr-head-repo', 'external/fork',
    '--repository', 'trydavidqix/nexus-brain'
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /branch format/);
});

test('rejects malformed Dependabot branch names even for the bot', () => {
  const result = runValidator(
    '--branch', 'dependabot/unknown/surprise',
    '--pr-author', 'dependabot[bot]',
    '--pr-head-repo', 'trydavidqix/nexus-brain',
    '--repository', 'trydavidqix/nexus-brain'
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /branch format/);
});

test('defers Dependabot push validation to the authenticated pull request event', () => {
  const workflow = readFileSync(resolve(repositoryRoot, '.github/workflows/ci.yml'), 'utf8');
  assert.match(
    workflow,
    /elif \[\[ "\$NEXUS_EVENT_NAME" == 'push' && "\$NEXUS_BRANCH" == dependabot\/\* \]\]; then\s+echo "Dependabot branches are validated in pull_request context\."/
  );
  assert.match(workflow, /--pr-author "\$NEXUS_PR_AUTHOR"/);
  assert.match(workflow, /--pr-head-repo "\$NEXUS_PR_HEAD_REPO"/);
});

test('rejects branches without a task ID and descriptive slug', () => {
  const result = runValidator('--branch', 'feature/nexus-refactor');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /task ID/);
});

test('rejects branch kinds outside the explicit project allowlist', () => {
  const result = runValidator('--branch', 'misc/NB-03-zero-cost-local');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /kind/);
});

test('rejects uppercase or non-kebab branch slugs', () => {
  const result = runValidator('--branch', 'feature/NB-03-Zero_Cost');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /branch slug:/);
});
