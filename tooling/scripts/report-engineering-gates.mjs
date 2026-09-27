import { appendFileSync, lstatSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { classifyBranch, classifyWorktree, GIT_HYGIENE_CLASSIFICATIONS, isInProjectWorktreeScope } from './engineering-gates-core.mjs';

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
    return JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  } catch {
    return undefined;
  }
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

function worktreeInspection(row, root, eventBranch, activeTaskProven) {
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
  const isActiveTask = Boolean(activeTaskProven && branch && eventBranch && branch === eventBranch);
  return {
    skipped: false,
    branch,
    dirty,
    status: classifyWorktree({ dirty, activeTaskProven: isActiveTask })
  };
}

function inspectHygiene(root, eventBranch, activeTaskProven) {
  const worktreeOutput = gitValue(['worktree', 'list', '--porcelain'], root);
  const worktreeCounts = emptyCounts();
  const branchCounts = emptyCounts();
  const skippedBranches = new Set();
  const branchWorktreeStatus = new Map();
  let excludedWorktrees = 0;
  let inspectedWorktrees = 0;

  if (worktreeOutput === undefined) {
    worktreeCounts.UNKNOWN += 1;
  } else {
    for (const row of parseWorktrees(worktreeOutput)) {
      const inspection = worktreeInspection(row, root, eventBranch, activeTaskProven);
      if (inspection.skipped) {
        excludedWorktrees += 1;
        if (row.branch) skippedBranches.add(row.branch);
        continue;
      }

      inspectedWorktrees += 1;
      worktreeCounts[inspection.status] += 1;
      if (inspection.branch) {
        branchWorktreeStatus.set(inspection.branch, inspection.dirty);
        if (row.branch) branchWorktreeStatus.set(row.branch, inspection.dirty);
      }
    }
  }

  const mainSha = gitValue(['rev-parse', '--verify', 'origin/main^{commit}'], root);
  const refs = gitValue(['for-each-ref', '--format=%(refname:short)%09%(objectname)', 'refs/heads'], root);
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
      branchCounts[classifyBranch({
        commitsAhead: ahead,
        merged,
        clean: branchWorktreeStatus.get(branch)
      })] += 1;
    }
  }

  return {
    classifications: { worktrees: worktreeCounts, branches: branchCounts },
    inspected_worktrees: inspectedWorktrees,
    excluded_worktrees: excludedWorktrees,
    ownership_registry: 'UNAVAILABLE',
    safe_retirement_proof: 'UNAVAILABLE',
    mutations_performed: 0
  };
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
    git_hygiene: inspectHygiene(root, eventBranch, false)
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
    `- Mutations performed: ${report.git_hygiene.mutations_performed}`,
    ''
  ].join('\n');
}

const report = buildReport();
const summary = writeSummary(report);
if (process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_STEP_SUMMARY) {
  try {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary, 'utf8');
  } catch {
    console.log(JSON.stringify(report));
  }
} else {
  console.log(JSON.stringify(report));
}
