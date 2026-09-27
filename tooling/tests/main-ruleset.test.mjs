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
      ['CodeQL', 57789],
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
