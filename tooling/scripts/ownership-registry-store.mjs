import { randomUUID } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { validateOwnershipRegistry } from './ownership-registry-core.mjs';

const DEFAULT_LOCK_WAIT_MS = 10_000;
const LOCK_POLL_MS = 25;

function rejectSymlink(path) {
  try {
    if (lstatSync(path).isSymbolicLink()) throw new Error('local ownership registry cannot use symbolic links');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

export function readOwnershipRegistry(filePath) {
  rejectSymlink(dirname(filePath));
  rejectSymlink(filePath);
  if (!existsSync(filePath)) return { version: 1, records: [] };

  let registry;
  try {
    registry = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    throw new Error('local ownership registry is unreadable');
  }
  if (!registry || registry.version !== 1 || !Array.isArray(registry.records)) {
    throw new Error('local ownership registry has unsupported format');
  }
  if (validateOwnershipRegistry(registry.records).length > 0) {
    throw new Error('local ownership registry contains invalid records');
  }
  return { version: 1, records: registry.records };
}

export function writeOwnershipRegistry(filePath, records) {
  if (!Array.isArray(records) || validateOwnershipRegistry(records).length > 0) {
    throw new TypeError('invalid ownership registry');
  }

  const directory = dirname(filePath);
  mkdirSync(directory, { recursive: true });
  rejectSymlink(directory);
  rejectSymlink(filePath);

  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  let temporaryCreated = false;
  try {
    writeFileSync(temporaryPath, `${JSON.stringify({ version: 1, records }, null, 2)}\n`, { flag: 'wx' });
    temporaryCreated = true;
    renameSync(temporaryPath, filePath);
    temporaryCreated = false;
  } catch {
    throw new Error('unable to update local ownership registry');
  } finally {
    if (temporaryCreated) {
      try { rmSync(temporaryPath, { force: true }); } catch {}
    }
  }
}

function acquireOwnershipRegistryLock(filePath, lockWaitMs) {
  const directory = dirname(filePath);
  mkdirSync(directory, { recursive: true });
  rejectSymlink(directory);
  rejectSymlink(filePath);

  const lockPath = `${filePath}.lock`;
  rejectSymlink(lockPath);
  const startedAt = Date.now();
  const waitCell = new Int32Array(new SharedArrayBuffer(4));

  while (true) {
    let fileDescriptor;
    try {
      fileDescriptor = openSync(lockPath, 'wx', 0o600);
    } catch (error) {
      if (error.code !== 'EEXIST') throw new Error('unable to lock local ownership registry');
      const remainingMs = lockWaitMs - (Date.now() - startedAt);
      if (remainingMs <= 0) throw new Error('local ownership registry is locked; refusing concurrent update');
      Atomics.wait(waitCell, 0, 0, Math.min(remainingMs, LOCK_POLL_MS));
      continue;
    }

    const token = randomUUID();
    try {
      writeFileSync(fileDescriptor, JSON.stringify({ pid: process.pid, token, startedAt: new Date().toISOString() }));
      fsyncSync(fileDescriptor);
      return { fileDescriptor, lockPath, token };
    } catch {
      try { closeSync(fileDescriptor); } catch {}
      try { unlinkSync(lockPath); } catch {}
      throw new Error('unable to lock local ownership registry');
    }
  }
}

export function updateOwnershipRegistry(filePath, update, { lockWaitMs = DEFAULT_LOCK_WAIT_MS } = {}) {
  if (typeof update !== 'function') throw new TypeError('ownership registry update must be a function');
  if (!Number.isInteger(lockWaitMs) || lockWaitMs < 0) throw new TypeError('ownership registry lock wait must be a non-negative integer');

  const lock = acquireOwnershipRegistryLock(filePath, lockWaitMs);
  try {
    const current = readOwnershipRegistry(filePath);
    const records = update(current.records);
    if (!Array.isArray(records)) throw new TypeError('ownership registry update must return records');
    writeOwnershipRegistry(filePath, records);
    return { version: 1, records };
  } finally {
    try { closeSync(lock.fileDescriptor); } catch {}
    try {
      const owner = JSON.parse(readFileSync(lock.lockPath, 'utf8'));
      if (owner.token === lock.token) unlinkSync(lock.lockPath);
    } catch {}
  }
}
