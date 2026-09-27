import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const reportScript = resolve(repositoryRoot, 'tooling/scripts/report-engineering-gates.mjs');

function gitStatus() {
  const result = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], {
    cwd: repositoryRoot,
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

test('emits a report-only summary without mutating the repository or exposing worktree paths', () => {
  const before = gitStatus();
  const result = spawnSync(process.execPath, [reportScript], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: { ...process.env, GITHUB_ACTIONS: '', GITHUB_EVENT_NAME: '', GITHUB_EVENT_PATH: '', GITHUB_HEAD_REF: '', GITHUB_REF_NAME: '', GITHUB_STEP_SUMMARY: '' }
  });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.mode, 'REPORT_ONLY');
  assert.equal(report.blocking, false);
  assert.equal(report.cleanup_enabled, false);
  assert.equal(report.git_hygiene.mutations_performed, 0);
  assert.equal(report.git_hygiene.ownership_registry, 'UNAVAILABLE');
  assert.ok('excluded_worktrees' in report.git_hygiene);
  assert.doesNotMatch(result.stdout, /lumenva/i);
  assert.equal(gitStatus(), before);
});
