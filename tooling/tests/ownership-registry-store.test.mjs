import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { readOwnershipRegistry, writeOwnershipRegistry } from '../scripts/ownership-registry-store.mjs';

const record = Object.freeze({
  taskId: 'NB-19-G7',
  agentId: 'codex-root',
  branch: 'codex/nb19-g7-ownership-registry',
  worktree: join(tmpdir(), 'nexus-brain-g7'),
  status: 'ACTIVE'
});

test('missing local registry reads as an empty versioned registry', t => {
  const directory = mkdtempSync(join(tmpdir(), 'nexus-ownership-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  assert.deepEqual(readOwnershipRegistry(join(directory, 'registry.json')), { version: 1, records: [] });
});

test('writes and reads valid ownership registry atomically', t => {
  const directory = mkdtempSync(join(tmpdir(), 'nexus-ownership-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = join(directory, 'nested', 'registry.json');
  writeOwnershipRegistry(file, [record]);
  assert.deepEqual(readOwnershipRegistry(file), { version: 1, records: [record] });
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), { version: 1, records: [record] });
});

test('rejects malformed registries without accepting unvalidated ownership', t => {
  const directory = mkdtempSync(join(tmpdir(), 'nexus-ownership-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = join(directory, 'registry.json');
  assert.throws(() => writeOwnershipRegistry(file, [{ ...record, branch: 'main' }]), /invalid ownership registry/);
});
