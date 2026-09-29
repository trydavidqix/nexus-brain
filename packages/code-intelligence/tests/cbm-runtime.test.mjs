import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { CodebaseMemoryAdapter, createCodeIntelligenceEngine } from '../src/index.mjs';

const execFileAsync = promisify(execFile);
const runtimeBinary = process.env.CBM_BINARY;

function queryFailureCategory(value) {
  const text = String(value || '').toLowerCase();
  if (!text) return 'no_diagnostic_text';
  if (text.includes('unsupported function') && text.includes('where')) return 'unsupported_where_function';
  if (text.includes('syntax') || text.includes('parse')) return 'query_syntax';
  if (text.includes('unsupported') && text.includes('query')) return 'unsupported_query';
  if (text.includes('project') && (text.includes('not found') || text.includes('unknown'))) return 'project_not_found';
  if (text.includes('index') && (text.includes('unavailable') || text.includes('missing'))) return 'index_unavailable';
  if (text.includes('lock') || text.includes('busy') || text.includes('admission')) return 'backend_busy';
  if (text.includes('database') || text.includes('sqlite') || text.includes('storage')) return 'backend_storage';
  if (text.includes('argument') || text.includes('required flag') || text.includes('invalid option')) return 'invalid_arguments';
  if (text.includes('error') || text.includes('failed') || text.includes('invalid') || text.includes('unsupported')) return 'backend_error';
  return 'unclassified';
}

function safeQueryFailure(stdout, stderr, code) {
  let diagnostic = stderr;
  try {
    const response = JSON.parse(stdout);
    const error = response?.structuredContent?.error ?? response?.error;
    if (typeof error === 'string') diagnostic = error;
    else if (typeof error?.message === 'string') diagnostic = error.message;
    else if (typeof error?.code === 'string') diagnostic = error.code;
  } catch { /* failed commands can emit non-JSON diagnostics */ }
  return {
    exit_code: code,
    stdout_bytes: Buffer.byteLength(stdout),
    stderr_bytes: Buffer.byteLength(stderr),
    error_category: queryFailureCategory(diagnostic),
  };
}

const project = {
  project_id: 'nb07-ci-fixture',
  repo: 'opaque://nb07-ci-fixture',
  default_branch: 'main',
  workspace_policy: {},
  lifecycle: 'active',
  stack: ['typescript'],
  permissions: {},
  policies: {},
  approvals: {},
  budgets: {},
  memory_namespace: 'project:nb07-ci-fixture',
  task_scope: 'task',
  session_scope: 'session',
  evidence_scope: 'project',
  git_bindings: [],
  ci_bindings: [],
  deployment_bindings: [],
  provider_constraints: [],
  workspace_bindings: [{ kind: 'local', location: 'opaque://ci/fixture' }],
};

test('pinned CBM CLI proves the Windows adapter mappings against an isolated local fixture', { skip: !runtimeBinary }, async t => {
  const scratch = await mkdtemp(join(tmpdir(), 'nexus-nb07-cbm-'));
  const repoPath = join(scratch, 'repo');
  const providerPath = join(scratch, 'provider');
  const cachePath = join(scratch, 'cbm-cache');
  await mkdir(join(repoPath, 'src'), { recursive: true });
  await mkdir(join(repoPath, 'tests'), { recursive: true });
  await mkdir(join(providerPath, 'src'), { recursive: true });
  await mkdir(cachePath, { recursive: true });
  t.after(() => rm(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  process.env.CBM_CACHE_DIR = cachePath;
  process.env.CBM_ALLOWED_ROOT = repoPath;

  await writeFile(join(repoPath, 'src', 'helper.ts'), 'export function helper() { return 1; }\n');
  await writeFile(join(repoPath, 'src', 'entry.ts'), 'import { helper } from "./helper.js";\nexport function runTask() { return helper(); }\n');
  await writeFile(join(repoPath, 'src', 'routes.ts'), 'import { runTask } from "./entry.js";\nexport function registerRoutes(app: any) { app.get("/health", runTask); }\n');
  await writeFile(join(repoPath, 'src', 'client.ts'), 'export async function checkProvider() { return fetch("http://provider.local/health"); }\n');
  await writeFile(join(repoPath, 'tests', 'helper.test.ts'), 'import { helper } from "../src/helper.js";\nexport function helperTest() { return helper(); }\nif (helperTest() !== 1) throw new Error("helper test failed");\n');
  await writeFile(join(providerPath, 'src', 'provider.ts'), 'export function health() { return "ok"; }\nexport function registerProvider(app: any) { app.get("/health", health); }\n');
  await execFileAsync('git', ['init', '-b', 'main', repoPath], { windowsHide: true });
  await execFileAsync('git', ['-C', repoPath, 'config', 'user.email', 'nexus-ci@example.invalid'], { windowsHide: true });
  await execFileAsync('git', ['-C', repoPath, 'config', 'user.name', 'Nexus CI'], { windowsHide: true });
  await execFileAsync('git', ['-C', repoPath, 'add', '.'], { windowsHide: true });
  await execFileAsync('git', ['-C', repoPath, 'commit', '-m', 'fixture'], { windowsHide: true });
  await execFileAsync('git', ['init', '-b', 'main', providerPath], { windowsHide: true });
  await execFileAsync('git', ['-C', providerPath, 'config', 'user.email', 'nexus-ci@example.invalid'], { windowsHide: true });
  await execFileAsync('git', ['-C', providerPath, 'config', 'user.name', 'Nexus CI'], { windowsHide: true });
  await execFileAsync('git', ['-C', providerPath, 'add', '.'], { windowsHide: true });
  await execFileAsync('git', ['-C', providerPath, 'commit', '-m', 'provider fixture'], { windowsHide: true });

  const providerProject = {
    ...project,
    project_id: 'nb07-ci-provider',
    repo: 'opaque://nb07-ci-provider',
    memory_namespace: 'project:nb07-ci-provider',
    workspace_bindings: [{ kind: 'local', location: 'opaque://ci/provider' }],
  };
  const projects = new Map([[project.project_id, project], [providerProject.project_id, providerProject]]);
  const providerAlias = `nexus-${createHash('sha256').update(providerProject.project_id).update('\0').update(providerProject.workspace_bindings[0].location).digest('hex')}`;
  const cbm = new CodebaseMemoryAdapter({
    spawnImpl: (...args) => {
      const child = spawn(...args);
      if (args[1]?.[2] === 'query_graph') {
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', chunk => { stdout = `${stdout}${chunk}`.slice(-65_536); });
        child.stderr.on('data', chunk => { stderr = `${stderr}${chunk}`.slice(-65_536); });
        child.on('close', code => {
          if (code !== 0) queryGraphDiagnostics.push(safeQueryFailure(stdout, stderr, code));
        });
      }
      return child;
    },
  });
  const queryGraphDiagnostics = [];
  const adapter = {
    index: (...args) => cbm.index(...args),
    health: (...args) => cbm.health(...args),
    async invoke(tool, params) {
      const result = await cbm.invoke(tool, params);
      if (tool === 'query_graph') {
        const payload = result?.data ?? result;
        const columns = Array.isArray(payload?.columns) ? payload.columns.map(column => typeof column === 'string' ? column : column?.name) : [];
        const rows = Array.isArray(payload?.rows) ? payload.rows.map(row => {
          if (!Array.isArray(row)) return row;
          return Object.fromEntries(columns.map((name, index) => [name, row[index]]));
        }) : [];
        queryGraphDiagnostics.push({
          payload_keys: Object.keys(payload || {}),
          columns,
          rows: rows.slice(0, 10).map(row => ({
            keys: Object.keys(row || {}),
            relation: row?.relation ?? row?.relationship ?? row?.edge_type ?? null,
            target_matches_allowlist: [row?.target_project, row?.target_project_id, row?.target_alias, row?.target_id, row?.target?.project_id, row?.target?.alias, row?.target?.id]
              .some(value => value === providerProject.project_id || value === providerAlias),
          })),
        });
      }
      return result;
    },
  };

  const engine = createCodeIntelligenceEngine({
    stateStore: { getProject: id => projects.has(id) ? { project: projects.get(id), version: 1 } : null },
    resolveWorkspace: async ({ project_id, binding }) => binding.location === projects.get(project_id)?.workspace_bindings[0].location ? (project_id === project.project_id ? repoPath : providerPath) : null,
    adapter,
  });
  const request = { project_id: project.project_id, workspace_binding: project.workspace_bindings[0] };

  const health = await engine.health();
  assert.equal(health.status, 'OK', JSON.stringify(health));
  assert.match(health.data.version, /0\.11\.0/);
  const indexed = await engine.index(request);
  assert.equal(indexed.status, 'PARTIAL');
  assert.equal(indexed.data.direct_source.indexed, false);
  assert.equal(indexed.backend_version, 'codebase-memory-mcp@0.11.0');
  assert.ok(JSON.stringify(indexed.data.code_graph).includes('indexed'));
  assert.ok(JSON.stringify(indexed.data.code_graph.architecture).includes('/health'));

  const symbol = await engine.searchSymbol({ ...request, name: 'helper' });
  assert.ok(JSON.stringify(symbol.data.code_graph).includes('helper'));
  const callers = await engine.getCallers({ ...request, function_name: 'helper' });
  assert.ok(JSON.stringify(callers.data.code_graph).includes('runTask'));
  const callees = await engine.getCallees({ ...request, function_name: 'runTask' });
  assert.ok(JSON.stringify(callees.data.code_graph).includes('helper'));
  const tests = await engine.getTests({ ...request, function_name: 'helper' });
  const callerLeg = tests.data.code_graph.callers;
  const testIndex = Array.isArray(callerLeg?.cols) ? callerLeg.cols.indexOf('test') : -1;
  const nameIndex = Array.isArray(callerLeg?.cols) ? callerLeg.cols.indexOf('name') : -1;
  const hasMarkedHelperTest = testIndex >= 0 && nameIndex >= 0 && Array.isArray(callerLeg?.groups)
    && callerLeg.groups.some(group => (group.rows || []).some(row => {
      if (!Array.isArray(row) || row[testIndex] !== true || typeof row[nameIndex] !== 'string') return false;
      const qualifiedName = [group.qn_prefix, row[nameIndex]].filter(Boolean).join('.').replace(/\.+/g, '.');
      return qualifiedName.endsWith('.helperTest');
    }));
  assert.equal(hasMarkedHelperTest, true);
  const directTestFile = tests.data.direct_source.matches.find(match => match.file_path === 'tests/helper.test.ts');
  assert.ok(directTestFile);
  assert.equal(directTestFile.relation, 'unclassified-text-match');

  const alias = `nexus-${createHash('sha256').update(project.project_id).update('\0').update(project.workspace_bindings[0].location).digest('hex')}`;
  const context = await engine.getContext({ ...request, qualified_name: `${alias}.src.helper.helper` });
  assert.ok(JSON.stringify(context.data.code_graph).includes('return 1'));

  await writeFile(join(repoPath, 'src', 'helper.ts'), 'export function helper() { return 2; }\n');
  const changes = await engine.getChanges(request);
  assert.ok(JSON.stringify(changes.data.code_graph).includes('helper.ts'));
  assert.ok(changes.data.direct_source.changed_paths.includes('src/helper.ts'));
  const impact = await engine.analyzeImpact(request);
  assert.ok(JSON.stringify(impact.data.code_graph).includes('helper'));

  const reindexed = await engine.index(request);
  assert.ok(JSON.stringify(reindexed.data.code_graph).includes('indexed'));
  assert.equal(reindexed.coverage.complete, false);
  assert.equal(reindexed.confidence, null);

  const crossRepo = await engine.index({
    ...request,
    target_projects: [{ project_id: providerProject.project_id, workspace_binding: providerProject.workspace_bindings[0] }],
  });
  const targetMetadata = crossRepo.related_targets.find(target => target.project_id === providerProject.project_id);
  assert.ok(targetMetadata);
  assert.equal(targetMetadata.source, 'codebase-memory-mcp');
  assert.match(targetMetadata.workspace_commit, /^[0-9a-f]{40,64}$/i);
  assert.equal(targetMetadata.index_commit, null);
  assert.notEqual(targetMetadata.index_version, 'unknown');
  assert.equal(targetMetadata.freshness, 'unverified');
  assert.equal(targetMetadata.workspace_stable, true);
  assert.equal(targetMetadata.evidence_associated, true, JSON.stringify({ warning_codes: targetMetadata.warnings.map(warning => warning.code), query_graph: queryGraphDiagnostics }));
  const linkedTarget = crossRepo.data.code_graph.cross_repo.links.find(link => link.target_project_id === providerProject.project_id);
  assert.ok(linkedTarget);
  assert.equal(linkedTarget.relation, 'CROSS_HTTP_CALLS');
  assert.ok([providerAlias, providerProject.project_id].includes(linkedTarget.evidence.target_project));
  assert.match(linkedTarget.evidence.url_path, /health/i);
  assert.equal(crossRepo.coverage.complete, false);
  assert.equal(JSON.stringify(crossRepo).includes(providerPath), false);
});
