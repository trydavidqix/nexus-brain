import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { findActiveOwnership, releaseOwnership, upsertOwnership } from './ownership-registry-core.mjs';
import { readOwnershipRegistry, writeOwnershipRegistry } from './ownership-registry-store.mjs';

function gitValue(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true, maxBuffer: 1024 * 1024 });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

function repositoryContext() {
  const rootValue = gitValue(['rev-parse', '--show-toplevel'], process.cwd());
  const root = rootValue ? resolve(rootValue) : undefined;
  const packagePath = root && resolve(root, 'package.json');
  if (!root || !gitValue(['rev-parse', '--git-common-dir'], root)) throw new Error('run this command inside a Nexus Git worktree');

  let packageJson;
  try { packageJson = JSON.parse(readFileSync(packagePath, 'utf8')); } catch {}
  if (packageJson?.name !== '@nexus-brain/workspace') throw new Error('ownership registry only supports Nexus Brain worktrees');

  const branch = gitValue(['branch', '--show-current'], root);
  const commonDirectory = gitValue(['rev-parse', '--git-common-dir'], root);
  if (!branch || !commonDirectory) throw new Error('unable to identify current Git ownership');
  return {
    root,
    branch,
    registryPath: resolve(root, commonDirectory, 'nexus-ownership', 'registry.json')
  };
}

function parseOptions(args) {
  const options = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!['--task-id', '--agent-id'].includes(flag) || !value || value.startsWith('--') || options.has(flag)) {
      throw new Error('usage: task-ownership <register|list|release> [--task-id ID] [--agent-id ID]');
    }
    options.set(flag, value);
  }
  return options;
}

function sanitizedRecord(record) {
  return { taskId: record.taskId, agentId: record.agentId, branch: record.branch, status: record.status };
}

function main(args) {
  const [command, ...optionArgs] = args;
  if (!['register', 'list', 'release'].includes(command)) {
    throw new Error('usage: task-ownership <register|list|release> [--task-id ID] [--agent-id ID]');
  }
  const options = parseOptions(optionArgs);
  const context = repositoryContext();
  const registry = readOwnershipRegistry(context.registryPath);

  if (command === 'list') {
    if (options.size > 0) throw new Error('list does not accept identity options');
    console.log(JSON.stringify({ version: registry.version, records: registry.records.map(sanitizedRecord) }, null, 2));
    return;
  }

  const taskId = options.get('--task-id');
  const agentId = options.get('--agent-id');
  if (options.size !== 2 || !taskId || !agentId) {
    throw new Error(`usage: task-ownership ${command} --task-id ID --agent-id ID`);
  }

  if (command === 'register') {
    const record = { taskId, agentId, branch: context.branch, worktree: context.root, status: 'ACTIVE' };
    const records = upsertOwnership(registry.records, record);
    writeOwnershipRegistry(context.registryPath, records);
    console.log(JSON.stringify({ result: 'ACTIVE', ownership: sanitizedRecord(record) }));
    return;
  }

  const existing = registry.records.find(record => record.taskId === taskId && record.agentId === agentId && record.status === 'ACTIVE');
  if (!existing || !findActiveOwnership(registry.records, {
    ...existing,
    branch: context.branch,
    worktree: context.root
  })) {
    throw new Error('current task and agent do not own this branch and worktree');
  }
  const records = releaseOwnership(registry.records, taskId, agentId);
  writeOwnershipRegistry(context.registryPath, records);
  console.log(JSON.stringify({ result: 'RELEASED', ownership: sanitizedRecord({ ...existing, status: 'RELEASED' }) }));
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'ownership registry operation failed');
  process.exitCode = 1;
}
