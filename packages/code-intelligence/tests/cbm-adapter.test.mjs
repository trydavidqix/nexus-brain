import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { CodebaseMemoryAdapter } from '../src/cbm-adapter.mjs';

function fakeSpawn(calls, output = '{"status":"indexed"}', version = 'codebase-memory-mcp 0.11.0') {
  return (executable, args, options) => {
    calls.push({ executable, args, options });
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => {};
    const response = args.length === 1 && args[0] === '--version' ? version : output;
    setImmediate(() => {
      child.stdout.end(response, () => {
        child.stderr.end();
        child.emit('close', 0);
      });
    });
    return child;
  };
}

test('uses pinned one-shot CLI flags, project alias, and per-workspace allowed root', async () => {
  const calls = [];
  const adapter = new CodebaseMemoryAdapter({ executable: 'C:\\tools\\codebase-memory-mcp.exe', spawnImpl: fakeSpawn(calls) });
  await adapter.index({ repoPath: 'C:\\work space\\repo', projectAlias: 'nexus-project-hash' });
  await adapter.invoke('trace_path', { project: 'nexus-project-hash', function_name: 'runTask', direction: 'inbound' });

  assert.deepEqual(calls[0].args, ['--version']);
  assert.deepEqual(calls[1].args, ['cli', '--quiet', 'index_repository', '--repo-path', 'C:\\work space\\repo', '--name', 'nexus-project-hash']);
  assert.equal(calls[1].options.shell, false);
  assert.equal(calls[1].options.env.CBM_ALLOWED_ROOT, 'C:\\work space\\repo');
  assert.deepEqual(calls[2].args, ['--version']);
  assert.deepEqual(calls[3].args, ['cli', '--quiet', 'trace_path', '--project', 'nexus-project-hash', '--function-name', 'runTask', '--direction', 'inbound', '--format', 'json']);
});

test('fails closed before an operation when the executable version is not the exact pin', async () => {
  const calls = [];
  const adapter = new CodebaseMemoryAdapter({ executable: 'C:\\tools\\codebase-memory-mcp.exe', spawnImpl: fakeSpawn(calls, '{"status":"indexed"}', 'codebase-memory-mcp 0.11.01') });
  await assert.rejects(adapter.index({ repoPath: 'C:\\repo', projectAlias: 'nexus-project' }), /does not match pinned 0.11.0/);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].args, ['--version']);
  assert.equal((await adapter.health()).ok, false);
});

test('rejects package-manager runners instead of launching or downloading CBM', async () => {
  let calls = 0;
  const adapter = new CodebaseMemoryAdapter({ executable: 'npx.cmd', spawnImpl: () => { calls += 1; throw new Error('must not spawn'); } });
  await assert.rejects(adapter.invoke('search_graph', { project: 'nexus' }), /package-manager runners are disabled/);
  assert.equal(calls, 0);
});
