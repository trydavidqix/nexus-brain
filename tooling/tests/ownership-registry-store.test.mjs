import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { readOwnershipRegistry, writeOwnershipRegistry } from '../scripts/ownership-registry-store.mjs';
import * as ownershipStore from '../scripts/ownership-registry-store.mjs';

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

test('serializes concurrent ownership updates without losing a distinct owner', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'nexus-ownership-concurrency-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = join(directory, 'registry.json');
  const startFile = join(directory, 'start');
  const storeUrl = new URL('../scripts/ownership-registry-store.mjs', import.meta.url).href;
  const workerSource = `
    import * as store from ${JSON.stringify(storeUrl)};
    import { existsSync, writeFileSync } from 'node:fs';
    const waitCell = new Int32Array(new SharedArrayBuffer(4));
    writeFileSync(process.env.NEXUS_READY_FILE, 'ready');
    while (!existsSync(process.env.NEXUS_START_FILE)) Atomics.wait(waitCell, 0, 0, 5);
    store.updateOwnershipRegistry(process.env.NEXUS_REGISTRY_FILE, records => {
      Atomics.wait(waitCell, 0, 0, 250);
      return [...records, JSON.parse(process.env.NEXUS_OWNER_RECORD)];
    });
  `;
  const runWorker = ownerRecord => new Promise((resolve, reject) => {
    const readyFile = join(directory, `${ownerRecord.taskId}.ready`);
    const child = spawn(process.execPath, ['--input-type=module', '-e', workerSource], {
      env: {
        ...process.env,
        NEXUS_REGISTRY_FILE: file,
        NEXUS_START_FILE: startFile,
        NEXUS_READY_FILE: readyFile,
        NEXUS_OWNER_RECORD: JSON.stringify(ownerRecord)
      },
      windowsHide: true
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', code => resolve({ code, stdout, stderr, readyFile }));
  });
  const owners = [
    { ...record, taskId: 'NB-19-G10-A', branch: 'codex/nb19-g10-a', worktree: join(directory, 'worktree-a') },
    { ...record, taskId: 'NB-19-G10-B', agentId: 'codex-reviewer', branch: 'codex/nb19-g10-b', worktree: join(directory, 'worktree-b') }
  ];

  const first = runWorker(owners[0]);
  const second = runWorker(owners[1]);
  const deadline = Date.now() + 5000;
  while ((!existsSync(join(directory, `${owners[0].taskId}.ready`)) || !existsSync(join(directory, `${owners[1].taskId}.ready`))) && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.ok(existsSync(join(directory, `${owners[0].taskId}.ready`)), 'first worker did not become ready');
  assert.ok(existsSync(join(directory, `${owners[1].taskId}.ready`)), 'second worker did not become ready');
  writeFileSync(startFile, 'start');

  const results = await Promise.all([first, second]);
  assert.deepEqual(results.map(result => result.code), [0, 0], results.map(result => result.stderr).join('\n'));
  assert.deepEqual(readOwnershipRegistry(file).records.map(owner => owner.taskId).sort(), ['NB-19-G10-A', 'NB-19-G10-B']);
});

test('fails closed on an existing ownership lock without replacing it', () => {
  const directory = mkdtempSync(join(tmpdir(), 'nexus-ownership-lock-'));
  try {
    const file = join(directory, 'registry.json');
    const lockFile = `${file}.lock`;
    writeFileSync(lockFile, 'held by another writer');
    assert.throws(
      () => ownershipStore.updateOwnershipRegistry(file, records => records, { lockWaitMs: 0 }),
      /ownership registry is locked/
    );
    assert.equal(readFileSync(lockFile, 'utf8'), 'held by another writer');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
