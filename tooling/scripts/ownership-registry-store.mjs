import { randomUUID } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { validateOwnershipRegistry } from './ownership-registry-core.mjs';

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
