import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { evaluateBranchRetirement } from './git-retirement-core.mjs';
import { parseOpenPullRequestBranches } from './github-pr-inventory.mjs';
import { isInProjectWorktreeScope } from './engineering-gates-core.mjs';
import { readOwnershipRegistry } from './ownership-registry-store.mjs';

function run(command, args, cwd, options = {}) {
  try {
    return spawnSync(command, args, {
      cwd,
      encoding: 'utf8',
      windowsHide: true,
      timeout: options.timeout ?? 15000,
      maxBuffer: 2 * 1024 * 1024,
      env: process.env
    });
  } catch {
    return { status: null, stdout: '', stderr: '' };
  }
}

function gitValue(args, cwd) {
  const result = run('git', args, cwd);
  return result.status === 0 ? result.stdout.trim() : undefined;
}

function parseOptions(args) {
  const options = { apply: false, recoveryClear: false };
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === '--apply' || flag === '--recovery-clear') {
      const key = flag === '--apply' ? 'apply' : 'recoveryClear';
      if (options[key]) throw new Error('duplicate option');
      options[key] = true;
      continue;
    }
    if (flag === '--branch' || flag === '--confirm-branch') {
      if (options[flag] !== undefined || !args[index + 1] || args[index + 1].startsWith('--')) throw new Error('invalid branch option');
      options[flag] = args[index + 1];
      index += 1;
      continue;
    }
    throw new Error('unknown option');
  }
  if (!options['--branch']) throw new Error('missing branch');
  if (options.apply && options['--confirm-branch'] !== options['--branch']) throw new Error('apply requires --confirm-branch with the exact branch name');
  if (!options.apply && options['--confirm-branch']) throw new Error('--confirm-branch requires --apply');
  if (options.apply && !options.recoveryClear) throw new Error('--apply requires --recovery-clear after checking project recovery and migration gates');
  return options;
}

function repositoryContext() {
  const rootValue = gitValue(['rev-parse', '--show-toplevel'], process.cwd());
  if (!rootValue) throw new Error('run this command inside a Nexus Git worktree');
  const root = resolve(rootValue);
  let packageJson;
  try { packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')); } catch {}
  if (packageJson?.name !== '@nexus-brain/workspace') throw new Error('retirement is restricted to Nexus Brain');
  const commonDirectory = gitValue(['rev-parse', '--git-common-dir'], root);
  if (!commonDirectory) throw new Error('unable to resolve the Git common directory');
  const remote = gitValue(['remote', 'get-url', 'origin'], root);
  const configuredSlug = process.env.GITHUB_REPOSITORY;
  const remoteMatch = remote?.match(/(?:github\.com[:/])([^/]+\/[^/]+?)(?:\.git)?$/i);
  const slug = /^[^/]+\/[^/]+$/.test(configuredSlug || '') ? configuredSlug : remoteMatch?.[1];
  if (!slug) throw new Error('unable to resolve the GitHub repository');
  return {
    root,
    slug,
    registryPath: resolve(root, commonDirectory, 'nexus-ownership', 'registry.json')
  };
}

function readPullRequestInventory(root, slug) {
  const result = run('gh', ['pr', 'list', '--repo', slug, '--state', 'open', '--json', 'headRefName,headRepositoryOwner', '--limit', '1000'], root);
  if (result.status !== 0) return { complete: false, branches: new Set() };
  const branches = parseOpenPullRequestBranches(result.stdout, slug.split('/')[0]);
  return { complete: branches !== undefined, branches: branches ?? new Set() };
}

function parseWorktrees(output) {
  const rows = [];
  let row;
  const finish = () => { if (row?.path) rows.push(row); row = undefined; };
  for (const line of output.split(/\r?\n/)) {
    if (!line) { finish(); continue; }
    if (line.startsWith('worktree ')) { finish(); row = { path: line.slice(9), branch: undefined, prunable: false }; }
    else if (row && line.startsWith('branch refs/heads/')) row.branch = line.slice('branch refs/heads/'.length);
    else if (row && line === 'prunable') row.prunable = true;
  }
  finish();
  return rows;
}

function branchEvidence(branch, context, options) {
  const fetch = run('git', ['fetch', '--quiet', 'origin', 'main'], context.root);
  if (fetch.status !== 0) throw new Error('unable to refresh origin/main; no retirement proof produced');
  const validName = run('git', ['check-ref-format', '--branch', branch], context.root);
  if (validName.status !== 0 || branch === 'main') throw new Error('branch name is invalid or protected');
  const branchSha = gitValue(['rev-parse', '--verify', `refs/heads/${branch}^{commit}`], context.root);
  if (!branchSha) throw new Error('local branch does not exist');
  const registryAvailable = existsSync(context.registryPath);
  let records = [];
  if (registryAvailable) {
    try { records = readOwnershipRegistry(context.registryPath).records; } catch { return { registryInvalid: true }; }
  }
  const ownerRecords = records.filter(record => record.branch === branch);
  const activeOwner = ownerRecords.some(record => record.status === 'ACTIVE');
  const ownerProven = ownerRecords.some(record => record.status === 'RELEASED');
  const inventory = readPullRequestInventory(context.root, context.slug);
  const rowsText = gitValue(['worktree', 'list', '--porcelain'], context.root);
  if (rowsText === undefined) throw new Error('unable to inspect Git worktrees');
  const matchingWorktrees = parseWorktrees(rowsText).filter(row => row.branch === branch);
  let clean = true;
  for (const row of matchingWorktrees) {
    if (!isInProjectWorktreeScope(row.path, context.root, 'nexus-brain')) { clean = undefined; break; }
    if (row.prunable) { clean = undefined; break; }
    const status = gitValue(['status', '--porcelain', '--untracked-files=all'], row.path);
    if (status === undefined) { clean = undefined; break; }
    if (status.length > 0) { clean = false; break; }
  }
  const aheadValue = gitValue(['rev-list', '--count', `origin/main..${branch}`], context.root);
  const commitsAhead = aheadValue === undefined ? undefined : Number(aheadValue);
  const ancestry = run('git', ['merge-base', '--is-ancestor', branch, 'origin/main'], context.root);
  const merged = ancestry.status === 0 ? true : ancestry.status === 1 ? false : undefined;
  return {
    result: evaluateBranchRetirement({
      commitsAhead,
      merged,
      clean,
      activeOwner,
      ownerProven,
      checkedOut: matchingWorktrees.length > 0,
      registryAvailable,
      pullRequestInventoryComplete: inventory.complete,
      pullRequestOpen: inventory.branches.has(branch),
      recoveryProtected: !options.recoveryClear,
      preservationProven: merged === true,
      redundancyProven: merged === true
    }),
    matchingWorktrees
  };
}

function main(args) {
  const options = parseOptions(args);
  const context = repositoryContext();
  const evidence = branchEvidence(options['--branch'], context, options);
  if (evidence.registryInvalid) throw new Error('ownership registry is invalid; no retirement proof produced');
  const { classification, eligible } = evidence.result;
  if (!eligible) {
    console.log(JSON.stringify({ branch: options['--branch'], classification, eligible: false, mutations_performed: 0 }));
    process.exitCode = 2;
    return;
  }
  if (!options.apply) {
    console.log(JSON.stringify({ branch: options['--branch'], classification, eligible: true, action: 'LOCAL_BRANCH_ONLY', apply_required: true, mutations_performed: 0 }));
    return;
  }
  if (evidence.matchingWorktrees.length > 0) throw new Error('checked-out branches cannot be retired; worktrees are never removed');
  const deleted = run('git', ['branch', '-d', options['--branch']], context.root);
  if (deleted.status !== 0) throw new Error('Git refused local branch retirement; no force delete was attempted');
  console.log(JSON.stringify({ branch: options['--branch'], classification, eligible: true, retired: true, scope: 'LOCAL_BRANCH_ONLY', mutations_performed: 1 }));
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'branch retirement failed');
  process.exitCode = 1;
}
