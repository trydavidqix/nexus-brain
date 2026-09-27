import { isAbsolute, resolve } from 'node:path';

const ACTIVE_STATUSES = new Set(['ACTIVE', 'RELEASED']);

function normalizedPath(value) {
  const normalized = resolve(value).replaceAll('\\', '/');
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

export function validateOwnershipRecord(record) {
  const errors = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return ['ownership record must be an object'];
  }
  if (typeof record.taskId !== 'string' || record.taskId.trim() === '' || record.taskId.trim() !== record.taskId) errors.push('taskId must be a non-empty string');
  if (typeof record.agentId !== 'string' || record.agentId.trim() === '' || record.agentId.trim() !== record.agentId) errors.push('agentId must be a non-empty string');
  if (typeof record.branch !== 'string' || record.branch.trim() === '' || record.branch.trim() !== record.branch || record.branch === 'main') {
    errors.push('branch must be a non-main branch');
  }
  if (typeof record.worktree !== 'string' || !isAbsolute(record.worktree)) errors.push('worktree must be an absolute path');
  if (!ACTIVE_STATUSES.has(record.status)) errors.push('status must be ACTIVE or RELEASED');
  return errors;
}

export function validateOwnershipRegistry(records) {
  if (!Array.isArray(records)) return ['ownership records must be an array'];

  const errors = [];
  const activeBranches = new Map();
  const activeWorktrees = new Map();
  const activeBindings = new Set();

  records.forEach((record, index) => {
    const recordErrors = validateOwnershipRecord(record);
    errors.push(...recordErrors.map(error => `record ${index + 1}: ${error}`));
    if (recordErrors.length || record.status !== 'ACTIVE') return;

    const binding = `${record.taskId}\u0000${record.agentId}`;
    if (activeBindings.has(binding)) errors.push(`active task/agent binding is already registered: ${record.taskId}/${record.agentId}`);
    activeBindings.add(binding);

    const branchOwner = activeBranches.get(record.branch);
    if (branchOwner && branchOwner !== binding) errors.push(`active branch is already owned: ${record.branch}`);
    activeBranches.set(record.branch, binding);

    const worktree = normalizedPath(record.worktree);
    const worktreeOwner = activeWorktrees.get(worktree);
    if (worktreeOwner && worktreeOwner !== binding) errors.push('active worktree is already owned');
    activeWorktrees.set(worktree, binding);
  });

  return errors;
}

export function findActiveOwnership(records, expected) {
  if (validateOwnershipRecord(expected).length > 0) return false;
  const worktree = normalizedPath(expected.worktree);
  return records.some(record => record.status === 'ACTIVE'
    && record.taskId === expected.taskId
    && record.agentId === expected.agentId
    && record.branch === expected.branch
    && normalizedPath(record.worktree) === worktree);
}

export function provesActiveWorktreeOwnership(records, { branch, worktree }) {
  if (!Array.isArray(records) || typeof branch !== 'string' || typeof worktree !== 'string' || !isAbsolute(worktree)) return false;
  return records.some(record => record.status === 'ACTIVE'
    && record.branch === branch
    && typeof record.worktree === 'string'
    && isAbsolute(record.worktree)
    && normalizedPath(record.worktree) === normalizedPath(worktree)
    && findActiveOwnership(records, record));
}

export function upsertOwnership(records, record) {
  const errors = validateOwnershipRecord(record);
  if (errors.length) throw new TypeError(errors.join('; '));

  const active = records.find(existing => existing.taskId === record.taskId
    && existing.agentId === record.agentId && existing.status === 'ACTIVE');
  if (active) {
    const sameBinding = active.branch === record.branch
      && normalizedPath(active.worktree) === normalizedPath(record.worktree);
    if (!sameBinding) throw new Error('active ownership cannot be reassigned');
    return records;
  }

  const next = [...records, record];

  const registryErrors = validateOwnershipRegistry(next);
  if (registryErrors.length) throw new TypeError(registryErrors.join('; '));
  return next;
}

export function releaseOwnership(records, taskId, agentId) {
  const existing = records.find(record => record.taskId === taskId && record.agentId === agentId && record.status === 'ACTIVE');
  if (!existing) throw new Error('active task/agent ownership not found');
  return records.map(record => record === existing ? { ...record, status: 'RELEASED' } : record);
}
