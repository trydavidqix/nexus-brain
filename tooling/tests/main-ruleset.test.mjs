import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const policy = JSON.parse(readFileSync(resolve(repositoryRoot, '.github/rulesets/main.json'), 'utf8'));
const rules = new Map(policy.rules.map(rule => [rule.type, rule.parameters]));

test('targets only main and has no ruleset bypass actors', () => {
  assert.equal(policy.target, 'branch');
  assert.deepEqual(policy.conditions.ref_name.include, ['refs/heads/main']);
  assert.deepEqual(policy.conditions.ref_name.exclude, []);
  assert.deepEqual(policy.bypass_actors, []);
});

test('requires squash-only PRs, resolved conversations, and current CI/security checks', () => {
  const pullRequest = rules.get('pull_request');
  assert.deepEqual(pullRequest.allowed_merge_methods, ['squash']);
  assert.equal(pullRequest.required_review_thread_resolution, true);
  assert.equal(pullRequest.require_code_owner_review, false);

  const statusChecks = rules.get('required_status_checks');
  assert.equal(statusChecks.strict_required_status_checks_policy, true);
  assert.deepEqual(
    statusChecks.required_status_checks
      .map(({ context, integration_id }) => [context, integration_id])
      .sort(([left], [right]) => left.localeCompare(right)),
    [
      ['CodeQL', 15368],
      ['dependency-review', 15368],
      ['Gitleaks secrets scan', 15368],
      ['mcg', 15368],
      ['tofu', 15368]
    ]
  );
});

test('blocks branch deletion, force push, and non-linear history', () => {
  assert.ok(rules.has('deletion'));
  assert.ok(rules.has('non_fast_forward'));
  assert.ok(rules.has('required_linear_history'));
});

test('uses a bounded squash merge queue when real concurrent PR activity exists', () => {
  assert.deepEqual(rules.get('merge_queue'), {
    check_response_timeout_minutes: 60,
    grouping_strategy: 'ALLGREEN',
    max_entries_to_build: 2,
    max_entries_to_merge: 1,
    merge_method: 'SQUASH',
    min_entries_to_merge: 1,
    min_entries_to_merge_wait_minutes: 5
  });
});

test('required CI, secret, dependency, and CodeQL workflows run for merge queue commits', () => {
  const workflows = ['ci.yml', 'security-scanning.yml', 'dependency-review.yml', 'codeql.yml'];
  for (const workflow of workflows) {
    const source = readFileSync(resolve(repositoryRoot, '.github/workflows', workflow), 'utf8');
    assert.match(source, /^  merge_group:/m, `${workflow} must handle merge_group`);
  }

  const security = readFileSync(resolve(repositoryRoot, '.github/workflows/security-scanning.yml'), 'utf8');
  assert.match(security, /github\.event_name\s*==\s*'merge_group'/, 'merge queue secret scans must use the pinned CLI path');
});
