import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { writeOwnershipRegistry } from '../scripts/ownership-registry-store.mjs';

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
  assert.ok(['AVAILABLE', 'UNAVAILABLE'].includes(report.git_hygiene.ownership_registry));
  assert.ok(['AVAILABLE', 'UNAVAILABLE', 'INVALID', 'INCOMPLETE'].includes(report.git_hygiene.open_pull_request_inventory));
  assert.equal(typeof report.git_hygiene.open_pull_requests, 'number');
  assert.equal(typeof report.git_hygiene.orphaned_owner_records, 'number');
  assert.equal(typeof report.git_hygiene.equivalent_tree_groups, 'number');
  assert.equal(typeof report.git_hygiene.equivalent_tree_branches, 'number');
  assert.equal(report.git_hygiene.safe_retirement_proof, 'UNAVAILABLE');
  assert.ok('excluded_worktrees' in report.git_hygiene);
  assert.doesNotMatch(result.stdout, /lumenva/i);
  assert.equal(gitStatus(), before);
});

test('rejects event and summary paths outside the runner temporary directory', () => {
  const testRoot = mkdtempSync(join(tmpdir(), 'nexus-git-hygiene-'));
  const runnerTemp = join(testRoot, 'runner');
  const externalFile = join(testRoot, 'outside-runner.txt');
  mkdirSync(runnerTemp);
  writeFileSync(externalFile, 'preserve this file\n', 'utf8');

  try {
    const result = spawnSync(process.execPath, [reportScript], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        GITHUB_ACTIONS: 'true',
        RUNNER_TEMP: runnerTemp,
        GITHUB_EVENT_PATH: externalFile,
        GITHUB_STEP_SUMMARY: externalFile
      }
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).mode, 'REPORT_ONLY');
    assert.equal(readFileSync(externalFile, 'utf8'), 'preserve this file\n');
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

test('classifies a clean worktree ACTIVE only when local registry proves task and agent ownership', t => {
  const testRoot = mkdtempSync(join(tmpdir(), 'nexus-ownership-report-'));
  const temporaryRepo = join(testRoot, 'nexus-brain');
  mkdirSync(temporaryRepo);
  t.after(() => rmSync(testRoot, { recursive: true, force: true }));

  const runGitInTempRepo = (...args) => {
    const result = spawnSync('git', args, { cwd: temporaryRepo, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };

  runGitInTempRepo('init', '-b', 'main');
  runGitInTempRepo('config', 'user.name', 'Nexus Test');
  runGitInTempRepo('config', 'user.email', 'nexus-test@example.invalid');
  writeFileSync(join(temporaryRepo, 'README.md'), 'test repository\n', 'utf8');
  runGitInTempRepo('add', 'README.md');
  runGitInTempRepo('commit', '-m', 'docs: add temporary test repository');
  runGitInTempRepo('switch', '-c', 'codex/nb19-g7-owner');

  const commonDirectory = runGitInTempRepo('rev-parse', '--git-common-dir');
  writeOwnershipRegistry(resolve(temporaryRepo, commonDirectory, 'nexus-ownership', 'registry.json'), [{
    taskId: 'NB-19-G7',
    agentId: 'codex-root',
    branch: 'codex/nb19-g7-owner',
    worktree: temporaryRepo,
    status: 'ACTIVE'
  }]);

  const result = spawnSync(process.execPath, [reportScript], {
    cwd: temporaryRepo,
    encoding: 'utf8',
    env: { ...process.env, GITHUB_ACTIONS: '', GITHUB_EVENT_NAME: '', GITHUB_EVENT_PATH: '', GITHUB_HEAD_REF: '', GITHUB_REF_NAME: '', GITHUB_STEP_SUMMARY: '' }
  });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.git_hygiene.ownership_registry, 'AVAILABLE');
  assert.equal(report.git_hygiene.classifications.worktrees.ACTIVE, 1);
  assert.doesNotMatch(result.stdout, /codex\/nb19-g7-owner|nexus-ownership-report-/i);
});
