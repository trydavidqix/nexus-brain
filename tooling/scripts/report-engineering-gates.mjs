import { appendFileSync, existsSync, lstatSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { classifyBranch, classifyWorktree, countOrphanedOwnershipRecords, findEquivalentTreeGroups, GIT_HYGIENE_CLASSIFICATIONS, isInProjectWorktreeScope } from './engineering-gates-core.mjs';
import { parseOpenPullRequestBranches } from './github-pr-inventory.mjs';
import { provesActiveWorktreeOwnership } from './ownership-registry-core.mjs';
import { readOwnershipRegistry } from './ownership-registry-store.mjs';

const repositoryName = 'nexus-brain';
const namingValidator = resolve(dirname(fileURLToPath(import.meta.url)), 'check-git-naming.mjs');

function runGit(args, cwd) {
  try {
    return spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  } catch {
    return { status: null, stdout: '', stderr: '' };
  }
}

function gitValue(args, cwd) {
  const result = runGit(args, cwd);
  return result.status === 0 ? result.stdout.trim() : undefined;
}

function validateName(flag, value, cwd) {
  if (!value) return 'UNKNOWN';
  const result = spawnSync(process.execPath, [namingValidator, flag, value], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1024 * 1024
  });
  if (result.status === 0) return 'PASS';
  if (result.status === 1) return 'FAIL';
  return 'UNKNOWN';
}

function readEvent() {
  if (process.env.GITHUB_ACTIONS !== 'true' || !process.env.GITHUB_EVENT_PATH) return undefined;
  try {
    const eventPath = resolveRunnerFile(process.env.GITHUB_EVENT_PATH);
    if (!eventPath) return undefined;
    return JSON.parse(readFileSync(eventPath, 'utf8'));
  } catch {
    return undefined;
  }
}

function resolveRunnerFile(candidatePath) {
  const runnerTemp = process.env.RUNNER_TEMP;
  if (!runnerTemp || !candidatePath || !isAbsolute(candidatePath)) return undefined;

  const root = resolve(runnerTemp);
  const candidate = resolve(candidatePath);
  const relativePath = relative(root, candidate);
  if (!relativePath || relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    return undefined;
  }
  return candidate;
}

function parseWorktrees(output) {
  const rows = [];
  let row;
  const finish = () => {
    if (row?.path) rows.push(row);
    row = undefined;
  };

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line) {
      finish();
      continue;
    }
    if (line.startsWith('worktree ')) {
      finish();
      row = { path: line.slice('worktree '.length), branch: undefined, prunable: false };
    } else if (row && line.startsWith('branch refs/heads/')) {
      row.branch = line.slice('branch refs/heads/'.length);
    } else if (row && line === 'prunable') {
      row.prunable = true;
    }
  }
  finish();
  return rows;
}

function emptyCounts() {
  return Object.fromEntries(GIT_HYGIENE_CLASSIFICATIONS.map(classification => [classification, 0]));
}

function worktreeInspection(row, root, eventBranch, ownershipRecords, ownershipRegistryStatus, pullRequestInventory) {
  if (!isInProjectWorktreeScope(row.path, root, repositoryName)) return { skipped: true };

  const symlink = !row.prunable && (() => {
    try {
      return lstatSync(row.path).isSymbolicLink();
    } catch {
      return false;
    }
  })();
  if (symlink) return { skipped: true };

  if (row.prunable) return { skipped: false, branch: row.branch, status: classifyWorktree({ prunable: true }) };

  const status = gitValue(['status', '--porcelain', '--untracked-files=all'], row.path);
  const dirty = status === undefined ? undefined : status.length > 0;
  const branch = row.branch ?? (resolve(row.path).toLowerCase() === resolve(root).toLowerCase() ? eventBranch : undefined);
  const isActiveTask = Boolean(branch && provesActiveWorktreeOwnership(ownershipRecords, { branch, worktree: row.path }));
  const pullRequestStatus = pullRequestInventory.status !== 'AVAILABLE' ? 'UNKNOWN'
    : pullRequestInventory.branches.has(branch) ? 'OPEN' : 'NONE';
  return {
    skipped: false,
    branch,
    dirty,
    status: classifyWorktree({
      dirty,
      activeTaskProven: isActiveTask,
      ownershipRegistryAvailable: ownershipRegistryStatus === 'AVAILABLE',
      pullRequestStatus
    }),
    activeTaskProven: isActiveTask
  };
}

function repositorySlug(root) {
  const configured = process.env.GITHUB_REPOSITORY;
  if (/^[^/]+\/[^/]+$/.test(configured || '')) return configured.replace(/\.git$/i, '');
  const remote = gitValue(['remote', 'get-url', 'origin'], root);
  const match = remote?.match(/(?:github\.com[:/])([^/]+\/[^/]+?)(?:\.git)?$/i);
  return match?.[1];
}

function readOpenPullRequestInventory(root) {
  const slug = repositorySlug(root);
  if (!slug) return { status: 'UNAVAILABLE', branches: new Set(), count: 0 };
  const result = spawnSync('gh', ['pr', 'list', '--repo', slug, '--state', 'open', '--json', 'headRefName,headRepositoryOwner', '--limit', '1000'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 15000,
    maxBuffer: 2 * 1024 * 1024,
    env: process.env
  });
  if (result.status !== 0) return { status: 'UNAVAILABLE', branches: new Set(), count: 0 };
  let rows;
  try { rows = JSON.parse(result.stdout); } catch { return { status: 'INVALID', branches: new Set(), count: 0 }; }
  const branches = parseOpenPullRequestBranches(result.stdout, slug.split('/')[0]);
  if (!branches) return { status: 'INCOMPLETE', branches: new Set(), count: Array.isArray(rows) ? rows.length : 0 };
  return { status: 'AVAILABLE', branches, count: rows.length };
}

function inspectHygiene(root, eventBranch) {
  const worktreeOutput = gitValue(['worktree', 'list', '--porcelain'], root);
  const worktreeCounts = emptyCounts();
  const branchCounts = emptyCounts();
  const skippedBranches = new Set();
  const branchWorktreeStatus = new Map();
  const activeBranches = new Set();
  let excludedWorktrees = 0;
  let inspectedWorktrees = 0;
  let ownershipRegistryStatus = 'UNAVAILABLE';
  let ownershipRecords = [];
  let orphanedOwnerRecords = 0;
  const pullRequestInventory = readOpenPullRequestInventory(root);

  const commonDirectory = gitValue(['rev-parse', '--git-common-dir'], root);
  if (commonDirectory) {
    const ownershipRegistryPath = resolve(root, commonDirectory, 'nexus-ownership', 'registry.json');
    if (existsSync(ownershipRegistryPath)) {
      try {
        ownershipRecords = readOwnershipRegistry(ownershipRegistryPath).records;
        ownershipRegistryStatus = 'AVAILABLE';
      } catch {
        ownershipRegistryStatus = 'INVALID';
      }
    }
  }
  if (worktreeOutput === undefined) {
    worktreeCounts.UNKNOWN += 1;
  } else {
    const worktreeRows = parseWorktrees(worktreeOutput);
    for (const row of worktreeRows) {
      const inspection = worktreeInspection(row, root, eventBranch, ownershipRecords, ownershipRegistryStatus, pullRequestInventory);
      if (inspection.skipped) {
        excludedWorktrees += 1;
        if (row.branch) skippedBranches.add(row.branch);
        continue;
      }

      inspectedWorktrees += 1;
      worktreeCounts[inspection.status] += 1;
      if (inspection.branch) {
        branchWorktreeStatus.set(inspection.branch, inspection.dirty);
        if (inspection.activeTaskProven) activeBranches.add(inspection.branch);
        if (row.branch) branchWorktreeStatus.set(row.branch, inspection.dirty);
      }
    }
    if (ownershipRegistryStatus === 'AVAILABLE') {
      const scopedOwners = ownershipRecords.filter(record => record.status === 'ACTIVE'
        && isInProjectWorktreeScope(record.worktree, root, repositoryName)
        && !lstatIsSymlink(record.worktree));
      orphanedOwnerRecords = countOrphanedOwnershipRecords(scopedOwners, worktreeRows) ?? 0;
      worktreeCounts.ORPHANED_METADATA += orphanedOwnerRecords;
    }
  }

  const mainSha = gitValue(['rev-parse', '--verify', 'origin/main^{commit}'], root);
  const refs = gitValue(['for-each-ref', '--format=%(refname:short)%09%(objectname)', 'refs/heads'], root);
  const branchEntries = [];
  if (!refs || !mainSha) {
    branchCounts.UNKNOWN += 1;
  } else {
    for (const entry of refs.split(/\r?\n/)) {
      const separator = entry.indexOf('\t');
      if (separator < 1) continue;
      const branch = entry.slice(0, separator);
      if (branch === 'main') continue;
      if (skippedBranches.has(branch)) {
        branchCounts.UNKNOWN += 1;
        continue;
      }

      const aheadText = gitValue(['rev-list', '--count', `origin/main..${branch}`], root);
      const ahead = aheadText === undefined ? undefined : Number(aheadText);
      const ancestry = runGit(['merge-base', '--is-ancestor', branch, 'origin/main'], root);
      const merged = ancestry.status === 0 ? true : ancestry.status === 1 ? false : undefined;
      const treeOid = gitValue(['rev-parse', '--verify', `${branch}^{tree}`], root);
      const branchClean = branchWorktreeStatus.has(branch) ? branchWorktreeStatus.get(branch) === false : true;
      branchEntries.push({
        id: branch,
        treeOid,
        clean: branchClean,
        commitsAhead: ahead,
        merged,
        cleanForClassification: branchWorktreeStatus.get(branch),
        activeTaskProven: activeBranches.has(branch),
        pullRequestOpen: pullRequestInventory.status === 'AVAILABLE' && pullRequestInventory.branches.has(branch),
        pullRequestInventoryComplete: pullRequestInventory.status === 'AVAILABLE'
      });
    }
  }

  const equivalentTreeGroups = findEquivalentTreeGroups(branchEntries);
  const duplicateBranches = new Set(equivalentTreeGroups.flatMap(group => group.ids ?? []));
  const duplicateTreeOids = new Set();
  for (const group of equivalentTreeGroups) {
    for (const branch of group.ids ?? []) {
      const entry = branchEntries.find(candidate => candidate.id === branch);
      if (entry?.treeOid) duplicateTreeOids.add(entry.treeOid.toLowerCase());
    }
  }
  for (const entry of branchEntries) {
    branchCounts[classifyBranch({
      commitsAhead: entry.commitsAhead,
      merged: entry.merged,
      clean: entry.cleanForClassification,
      activeTaskProven: entry.activeTaskProven,
      pullRequestOpen: entry.pullRequestOpen,
      pullRequestInventoryComplete: entry.pullRequestInventoryComplete,
      duplicateCandidate: duplicateBranches.has(entry.id) && duplicateTreeOids.has(entry.treeOid?.toLowerCase())
    })] += 1;
  }

  return {
    classifications: { worktrees: worktreeCounts, branches: branchCounts },
    inspected_worktrees: inspectedWorktrees,
    excluded_worktrees: excludedWorktrees,
    ownership_registry: ownershipRegistryStatus,
    orphaned_owner_records: orphanedOwnerRecords,
    open_pull_request_inventory: pullRequestInventory.status,
    open_pull_requests: pullRequestInventory.count,
    equivalent_tree_groups: equivalentTreeGroups.length,
    equivalent_tree_branches: equivalentTreeGroups.reduce((total, group) => total + group.count, 0),
    safe_retirement_proof: 'UNAVAILABLE',
    mutations_performed: 0
  };
}

function lstatIsSymlink(candidatePath) {
  try { return lstatSync(candidatePath).isSymbolicLink(); } catch { return false; }
}

function firstLine(value) {
  return typeof value === 'string' ? value.split(/\r?\n/, 1)[0] : undefined;
}

function collectDelivery(root, event) {
  const eventName = process.env.GITHUB_EVENT_NAME || 'local';
  const branch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || gitValue(['branch', '--show-current'], root);
  const isPullRequest = eventName === 'pull_request';
  const branchStatus = branch === 'main' ? 'NOT_APPLICABLE' : validateName('--branch', branch, root);
  const prTitle = isPullRequest ? event?.pull_request?.title : undefined;
  const pullRequestTitleStatus = isPullRequest ? validateName('--pr-title', prTitle, root) : 'NOT_APPLICABLE';
  const commitSubject = isPullRequest
    ? undefined
    : eventName === 'push' && branch === 'main'
      ? firstLine(event?.head_commit?.message)
      : gitValue(['log', '-1', '--format=%s'], root);
  const commitSubjectStatus = isPullRequest ? 'NOT_APPLICABLE' : validateName('--subject', commitSubject, root);
  const worktreeStatus = gitValue(['status', '--porcelain', '--untracked-files=all'], root);

  return {
    branch_name: branchStatus,
    pull_request_title: pullRequestTitleStatus,
    commit_subject: commitSubjectStatus,
    working_tree: worktreeStatus === undefined ? 'UNKNOWN' : worktreeStatus.length === 0 ? 'PASS' : 'DIRTY'
  };
}

function buildReport() {
  const root = gitValue(['rev-parse', '--show-toplevel'], process.cwd());
  if (!root) {
    return {
      mode: 'REPORT_ONLY',
      blocking: false,
      cleanup_enabled: false,
      delivery: { branch_name: 'UNKNOWN', pull_request_title: 'UNKNOWN', commit_subject: 'UNKNOWN', working_tree: 'UNKNOWN' },
      git_hygiene: {
        classifications: { worktrees: { UNKNOWN: 1 }, branches: { UNKNOWN: 1 } },
        inspected_worktrees: 0,
        excluded_worktrees: 0,
        ownership_registry: 'UNAVAILABLE',
        orphaned_owner_records: 0,
        open_pull_request_inventory: 'UNAVAILABLE',
        open_pull_requests: 0,
        equivalent_tree_groups: 0,
        equivalent_tree_branches: 0,
        safe_retirement_proof: 'UNAVAILABLE',
        mutations_performed: 0
      }
    };
  }

  const event = readEvent();
  const eventBranch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || gitValue(['branch', '--show-current'], root);
  const delivery = collectDelivery(root, event);

  return {
    mode: 'REPORT_ONLY',
    blocking: false,
    cleanup_enabled: false,
    delivery,
    git_hygiene: inspectHygiene(root, eventBranch)
  };
}

function writeSummary(report) {
  const worktrees = report.git_hygiene.classifications.worktrees;
  const branches = report.git_hygiene.classifications.branches;
  const statusLine = counts => GIT_HYGIENE_CLASSIFICATIONS
    .filter(classification => counts[classification] > 0)
    .map(classification => `${classification}: ${counts[classification]}`)
    .join(', ') || 'UNKNOWN: 0';
  return [
    '## Engineering delivery and Git hygiene',
    '',
    '**Mode:** report-only; results do not block delivery and no cleanup runs.',
    '',
    `- Branch name: ${report.delivery.branch_name}`,
    `- Pull request title: ${report.delivery.pull_request_title}`,
    `- Commit subject: ${report.delivery.commit_subject}`,
    `- Working tree: ${report.delivery.working_tree}`,
    `- Worktree classifications: ${statusLine(worktrees)}`,
    `- Branch classifications: ${statusLine(branches)}`,
    `- Out-of-scope worktrees skipped: ${report.git_hygiene.excluded_worktrees}`,
    `- Ownership registry: ${report.git_hygiene.ownership_registry}`,
    `- Orphaned active owner records: ${report.git_hygiene.orphaned_owner_records}`,
    `- Open PR inventory: ${report.git_hygiene.open_pull_request_inventory} (${report.git_hygiene.open_pull_requests} PRs)`,
    `- Equivalent tree groups: ${report.git_hygiene.equivalent_tree_groups} (${report.git_hygiene.equivalent_tree_branches} branches; review only)`,
    `- Mutations performed: ${report.git_hygiene.mutations_performed}`,
    ''
  ].join('\n');
}

const report = buildReport();
const summary = writeSummary(report);
if (process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_STEP_SUMMARY) {
  try {
    const summaryPath = resolveRunnerFile(process.env.GITHUB_STEP_SUMMARY);
    if (!summaryPath) throw new Error('GitHub step summary path is outside the runner temporary directory');
    appendFileSync(summaryPath, summary, 'utf8');
  } catch {
    console.log(JSON.stringify(report));
  }
} else {
  console.log(JSON.stringify(report));
}
