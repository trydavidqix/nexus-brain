import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const codeowners = readFileSync(resolve(repositoryRoot, '.github/CODEOWNERS'), 'utf8');
const oidcAction = readFileSync(resolve(repositoryRoot, '.github/actions/google-cloud-oidc/action.yml'), 'utf8').replace(/\r\n/g, '\n');
const gitignore = readFileSync(resolve(repositoryRoot, '.gitignore'), 'utf8');

test('assigns repository owner to sensitive paths without a global wildcard', () => {
  for (const path of [
    '/.github/CODEOWNERS',
    '/.github/rulesets/',
    '/.github/workflows/',
    '/.github/actions/',
    '/.gitignore',
    '/.gitleaksignore',
    '/infra/',
    '/packages/contracts/',
    '/docs/blueprints/',
    '/docs/engineering/'
  ]) {
    assert.match(codeowners, new RegExp(`^${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+@trydavidqix$`, 'm'));
  }
  assert.doesNotMatch(codeowners, /^\*\s/m);
});

test('OIDC action requires explicit project, provider, and service account inputs', () => {
  for (const input of ['project_id', 'workload_identity_provider', 'service_account']) {
    assert.match(oidcAction, new RegExp(`^  ${input}:\\n(?:.*\\n){0,2}    required: true$`, 'm'));
  }
  assert.match(oidcAction, /google-github-actions\/auth@[0-9a-f]{40} # v3\.0\.0/);
  assert.match(oidcAction, /create_credentials_file: true/);
  assert.match(oidcAction, /cleanup_credentials: true/);
  assert.doesNotMatch(oidcAction, /credentials_json|service_account_key/i);
  assert.match(gitignore, /^gha-creds-\*\.json$/m);
});
