import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { CodeIntelligenceEngine } from '../src/index.mjs';

const execFileAsync = promisify(execFile);
const project = (projectId, bindings = [{ kind: 'local', location: `opaque://${projectId}` }]) => ({
  project_id: projectId,
  repo: 'same-opaque-repo-locator',
  default_branch: 'main',
  workspace_policy: {},
  lifecycle: 'active',
  stack: [],
  permissions: {},
  policies: {},
  approvals: {},
  budgets: {},
  memory_namespace: `project:${projectId}`,
  task_scope: 'task',
  session_scope: 'session',
  evidence_scope: 'project',
  git_bindings: [],
  ci_bindings: [],
  deployment_bindings: [],
  provider_constraints: [],
  workspace_bindings: bindings,
});

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'nexus-code-intelligence-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'src'));
  await writeFile(join(root, 'src', 'helper.ts'), 'export function helper() { return 1; }\n');
  return root;
}

async function initializeGit(rootPath) {
  await execFileAsync('git', ['init', rootPath], { windowsHide: true });
  await execFileAsync('git', ['-C', rootPath, 'config', 'user.email', 'nexus-test@example.invalid'], { windowsHide: true });
  await execFileAsync('git', ['-C', rootPath, 'config', 'user.name', 'Nexus Test'], { windowsHide: true });
  await execFileAsync('git', ['-C', rootPath, 'add', '.'], { windowsHide: true });
  await execFileAsync('git', ['-C', rootPath, 'commit', '-m', 'fixture'], { windowsHide: true });
  const { stdout } = await execFileAsync('git', ['-C', rootPath, 'rev-parse', 'HEAD'], { windowsHide: true });
  return stdout.trim();
}

function fakeAdapter({ fail = false, onIndex, indexStatusOverride, coverageGeneration = true } = {}) {
  const calls = [];
  const workspacePaths = new Map();
  let crossPassComplete = false;
  return {
    calls,
    version: 'fake@1',
    async index(input) {
      calls.push(['index', input]);
      if (fail) throw new Error('expected failure');
      workspacePaths.set(input.projectAlias, input.repoPath);
      await onIndex?.(input);
      const data = { status: 'indexed', path: input.repoPath, target_paths: (input.target_projects || []).map(alias => workspacePaths.get(alias)), params: input };
      if (input.mode === 'cross-repo-intelligence') {
        crossPassComplete = true;
        data.cross_http_calls = input.target_projects.map(alias => ({ edge_type: 'CROSS_HTTP_CALLS', target_project: alias, target_path: workspacePaths.get(alias) }));
      }
      return { data };
    },
    async invoke(tool, params) {
      calls.push([tool, params]);
      if (fail) throw new Error('expected failure');
      if (tool === 'index_status') return { data: { ...(indexStatusOverride?.(params) || {}) }, backend_version: 'fake@1' };
      if (tool === 'check_index_coverage') return {
        data: { ...(coverageGeneration ? { metadata: { generation: crossPassComplete ? 'post-cross-generation-8' : 'pre-cross-generation-7' } } : {}) },
        backend_version: 'fake@1',
      };
      if (tool === 'query_graph') {
        const rows = [...workspacePaths.entries()]
          .filter(([alias]) => alias !== params.project)
          .map(([alias, target_path]) => ({ relation: 'CROSS_HTTP_CALLS', target_project: alias, target_file: target_path }));
        return { data: { rows }, backend_version: 'fake@1' };
      }
      return { data: { tool, params } };
    },
    async health() { return { ok: !fail }; },
  };
}

test('loads only the selected Project v2 workspace and isolates equal repo locators by project ID', async t => {
  const root = await fixture(t);
  const projects = new Map([
    ['alpha', project('alpha', [{ kind: 'local', location: 'opaque://alpha/one' }, { kind: 'local', location: 'opaque://alpha/two' }])],
    ['beta', project('beta')],
  ]);
  const adapter = fakeAdapter();
  const resolved = [];
  const engine = new CodeIntelligenceEngine({
    stateStore: { getProject: id => projects.has(id) ? { project: projects.get(id), version: 1 } : null },
    resolveWorkspace: async input => { resolved.push(input); return root; },
    adapter,
  });

  const binding = projects.get('alpha').workspace_bindings[0];
  const result = await engine.searchSymbol({ project_id: 'alpha', workspace_binding: binding, name: 'helper(value)' });
  assert.equal(result.status, 'PARTIAL');
  assert.equal(result.project_id, 'alpha');
  assert.equal(result.coverage.complete, false);
  assert.equal(result.confidence, null);
  assert.equal(JSON.stringify(result).includes(binding.location), false);
  assert.equal(result.data.direct_source.matches[0].file_path, 'src/helper.ts');
  assert.equal(result.commit, null);
  assert.equal(result.workspace_commit, null);
  assert.ok(result.warnings.some(warning => warning.code === 'INDEX_PROVENANCE_UNVERIFIED'));
  assert.match(adapter.calls[0][1].project, /^nexus-[a-f0-9]{64}$/);

  const alphaSecondBinding = projects.get('alpha').workspace_bindings[1];
  await engine.searchSymbol({ project_id: 'alpha', workspace_binding: alphaSecondBinding, name: 'helper' });
  const betaBinding = projects.get('beta').workspace_bindings[0];
  await engine.searchSymbol({ project_id: 'beta', workspace_binding: betaBinding, name: 'helper' });
  assert.notEqual(adapter.calls[0][1].project, adapter.calls[1][1].project);
  assert.notEqual(adapter.calls[1][1].project, adapter.calls[2][1].project);
  assert.equal(resolved.length, 3);
});

test('indexes only explicitly selected registered cross-repository targets and redacts their paths', async t => {
  const sourceRoot = await fixture(t);
  const targetRoot = await fixture(t);
  await initializeGit(sourceRoot);
  await initializeGit(targetRoot);
  const source = project('source');
  const target = project('target');
  const projects = new Map([['source', source], ['target', target]]);
  const adapter = fakeAdapter();
  const engine = new CodeIntelligenceEngine({
    stateStore: { getProject: id => projects.has(id) ? { project: projects.get(id), version: 1 } : null },
    resolveWorkspace: async ({ project_id }) => project_id === 'source' ? sourceRoot : targetRoot,
    adapter,
  });
  const result = await engine.index({
    project_id: 'source',
    workspace_binding: source.workspace_bindings[0],
    target_projects: [{ project_id: 'target', workspace_binding: target.workspace_bindings[0] }],
  });
  const indexCalls = adapter.calls.filter(([name]) => name === 'index');
  assert.equal(indexCalls.length, 3);
  assert.equal(indexCalls[0][1].projectAlias.startsWith('nexus-'), true);
  assert.equal(indexCalls[1][1].projectAlias.startsWith('nexus-'), true);
  assert.notEqual(indexCalls[0][1].projectAlias, indexCalls[1][1].projectAlias);
  assert.equal(indexCalls[2][1].mode, 'cross-repo-intelligence');
  assert.deepEqual(indexCalls[2][1].target_projects, [indexCalls[1][1].projectAlias]);
  assert.equal(result.related_targets[0].project_id, 'target');
  assert.equal(result.related_targets[0].index_version, 'post-cross-generation-8');
  assert.equal(result.related_targets[0].index_commit, null);
  assert.equal(result.related_targets[0].freshness, 'unverified');
  assert.equal(result.related_targets[0].workspace_commit_before, result.related_targets[0].workspace_commit);
  assert.equal(result.related_targets[0].workspace_stable, true);
  assert.equal(result.related_targets[0].evidence_associated, true);
  assert.equal(result.index_version, 'post-cross-generation-8');
  assert.equal(result.commit, null);
  assert.equal(result.data.code_graph.cross_repo.links[0].target_project_id, 'target');
  assert.equal(result.data.code_graph.cross_repo.links[0].evidence.target_file, '<workspace>');
  const crossIndexPosition = adapter.calls.findIndex(([name, input]) => name === 'index' && input.mode === 'cross-repo-intelligence');
  const graphQueryPosition = adapter.calls.findIndex(([name]) => name === 'query_graph');
  const targetStatusPosition = adapter.calls.findIndex(([name, params]) => name === 'index_status' && params.project === indexCalls[1][1].projectAlias);
  const targetCoveragePosition = adapter.calls.findIndex(([name, params]) => name === 'check_index_coverage' && params.project === indexCalls[1][1].projectAlias);
  const architectureCall = adapter.calls.find(([name]) => name === 'get_architecture');
  assert.deepEqual(architectureCall[1].aspects, ['routes']);
  assert.ok(crossIndexPosition < graphQueryPosition && graphQueryPosition < targetStatusPosition && targetStatusPosition < targetCoveragePosition);
  assert.deepEqual(adapter.calls[targetCoveragePosition][1].scopes, ['.']);
  assert.equal(adapter.calls[graphQueryPosition][1].query.endsWith('LIMIT 200'), true);
  assert.ok(result.related_targets[0].warnings.some(warning => warning.code === 'TARGET_INDEX_PROVENANCE_UNVERIFIED'));
  assert.equal(JSON.stringify(result).includes(targetRoot), false);
  assert.equal(result.coverage.complete, false);
});

test('withholds target links when CBM does not provide a target index generation', async t => {
  const sourceRoot = await fixture(t);
  const targetRoot = await fixture(t);
  await initializeGit(sourceRoot);
  await initializeGit(targetRoot);
  const source = project('source-generation-missing');
  const target = project('target-generation-missing');
  const projects = new Map([[source.project_id, source], [target.project_id, target]]);
  const adapter = fakeAdapter({ coverageGeneration: false });
  const engine = new CodeIntelligenceEngine({
    stateStore: { getProject: id => projects.has(id) ? { project: projects.get(id), version: 1 } : null },
    resolveWorkspace: async ({ project_id }) => project_id === source.project_id ? sourceRoot : targetRoot,
    adapter,
  });
  const result = await engine.index({
    project_id: source.project_id,
    workspace_binding: source.workspace_bindings[0],
    target_projects: [{ project_id: target.project_id, workspace_binding: target.workspace_bindings[0] }],
  });
  assert.equal(result.related_targets[0].index_version, 'unknown');
  assert.equal(result.related_targets[0].evidence_associated, false);
  assert.equal(result.data.code_graph.cross_repo, null);
  assert.ok(result.related_targets[0].warnings.some(warning => warning.code === 'TARGET_INDEX_GENERATION_UNKNOWN'));
});

test('withholds target links when workspace HEAD changes during indexing', async t => {
  const sourceRoot = await fixture(t);
  const targetRoot = await fixture(t);
  await initializeGit(sourceRoot);
  const targetCommitBefore = await initializeGit(targetRoot);
  const source = project('source-race');
  const target = project('target-race');
  const projects = new Map([['source-race', source], ['target-race', target]]);
  const targetAlias = `nexus-${createHash('sha256').update(target.project_id).update('\0').update(target.workspace_bindings[0].location).digest('hex')}`;
  let changed = false;
  const adapter = fakeAdapter({
    onIndex: async input => {
      if (input.projectAlias !== targetAlias || changed) return;
      changed = true;
      await writeFile(join(targetRoot, 'src', 'helper.ts'), 'export function helper() { return 2; }\n');
      await execFileAsync('git', ['-C', targetRoot, 'add', '.'], { windowsHide: true });
      await execFileAsync('git', ['-C', targetRoot, 'commit', '-m', 'move target HEAD'], { windowsHide: true });
    },
  });
  const engine = new CodeIntelligenceEngine({
    stateStore: { getProject: id => projects.has(id) ? { project: projects.get(id), version: 1 } : null },
    resolveWorkspace: async ({ project_id }) => project_id === source.project_id ? sourceRoot : targetRoot,
    adapter,
  });
  const result = await engine.index({
    project_id: source.project_id,
    workspace_binding: source.workspace_bindings[0],
    target_projects: [{ project_id: target.project_id, workspace_binding: target.workspace_bindings[0] }],
  });
  assert.notEqual(result.related_targets[0].workspace_commit_before, result.related_targets[0].workspace_commit);
  assert.equal(result.related_targets[0].workspace_commit_before, targetCommitBefore);
  assert.equal(result.related_targets[0].workspace_stable, false);
  assert.equal(result.related_targets[0].freshness, 'unverified');
  assert.equal(result.related_targets[0].evidence_associated, false);
  assert.equal(result.data.code_graph.cross_repo, null);
  assert.ok(result.related_targets[0].warnings.some(warning => warning.code === 'TARGET_WORKSPACE_CHANGED_DURING_INDEXING'));
});

test('withholds target links when CBM reports an index commit behind the workspace HEAD', async t => {
  const sourceRoot = await fixture(t);
  const targetRoot = await fixture(t);
  await initializeGit(sourceRoot);
  const workspaceCommit = await initializeGit(targetRoot);
  const source = project('source-stale');
  const target = project('target-stale');
  const projects = new Map([['source-stale', source], ['target-stale', target]]);
  const targetAlias = `nexus-${createHash('sha256').update(target.project_id).update('\0').update(target.workspace_bindings[0].location).digest('hex')}`;
  const adapter = fakeAdapter({ indexStatusOverride: params => params.project === targetAlias ? { index_commit: 'a'.repeat(40) } : {} });
  const engine = new CodeIntelligenceEngine({
    stateStore: { getProject: id => projects.has(id) ? { project: projects.get(id), version: 1 } : null },
    resolveWorkspace: async ({ project_id }) => project_id === source.project_id ? sourceRoot : targetRoot,
    adapter,
  });
  const result = await engine.index({
    project_id: source.project_id,
    workspace_binding: source.workspace_bindings[0],
    target_projects: [{ project_id: target.project_id, workspace_binding: target.workspace_bindings[0] }],
  });
  const metadata = result.related_targets[0];
  assert.equal(metadata.workspace_commit, workspaceCommit);
  assert.equal(metadata.index_commit, 'a'.repeat(40));
  assert.equal(metadata.freshness, 'stale');
  assert.equal(metadata.evidence_associated, false);
  assert.equal(result.data.code_graph.cross_repo, null);
  assert.ok(metadata.warnings.some(warning => warning.code === 'TARGET_INDEX_STALE'));
});

test('rejects self, duplicate, unknown, and over-limit cross-repository targets before indexing', async t => {
  const root = await fixture(t);
  const source = project('source');
  const target = project('target');
  const projects = new Map([['source', source], ['target', target]]);
  const adapter = fakeAdapter();
  const engine = new CodeIntelligenceEngine({
    stateStore: { getProject: id => projects.has(id) ? { project: projects.get(id), version: 1 } : null },
    resolveWorkspace: async () => root,
    adapter,
  });
  const sourceTarget = { project_id: 'source', workspace_binding: source.workspace_bindings[0] };
  const targetSelection = { project_id: 'target', workspace_binding: target.workspace_bindings[0] };
  for (const target_projects of [[sourceTarget], [targetSelection, targetSelection], [{ project_id: 'missing', workspace_binding: target.workspace_bindings[0] }], [targetSelection, targetSelection, targetSelection, targetSelection]]) {
    const result = await engine.index({ project_id: 'source', workspace_binding: source.workspace_bindings[0], target_projects });
    assert.equal(result.status, 'UNAVAILABLE');
  }
  assert.equal(adapter.calls.length, 0);
});

test('fails closed for unregistered, absent, ambiguous, and Project v1 workspaces', async t => {
  const root = await fixture(t);
  const v1 = { ...project('legacy') };
  delete v1.workspace_bindings;
  const projects = new Map([
    ['none', project('none', [])],
    ['ambiguous', project('ambiguous', [{ kind: 'local', location: 'opaque://same' }, { kind: 'local', location: 'opaque://same' }])],
    ['legacy', v1],
  ]);
  let resolveCount = 0;
  const adapter = fakeAdapter();
  const engine = new CodeIntelligenceEngine({
    stateStore: { getProject: id => projects.has(id) ? { project: projects.get(id), version: 1 } : null },
    resolveWorkspace: async () => { resolveCount += 1; return root; },
    adapter,
  });
  const binding = { kind: 'local', location: 'opaque://same' };

  for (const [projectId, selected] of [['missing-id', binding], ['none', binding], ['ambiguous', binding], ['legacy', binding]]) {
    const result = await engine.index({ project_id: projectId, workspace_binding: selected });
    assert.equal(result.status, 'UNAVAILABLE');
    assert.equal(result.data, null);
  }
  assert.equal(resolveCount, 0);
  assert.equal(adapter.calls.length, 0);
});

test('returns direct-source evidence if CBM is unavailable without claiming graph coverage', async t => {
  const root = await fixture(t);
  const selected = project('alpha').workspace_bindings[0];
  const engine = new CodeIntelligenceEngine({
    stateStore: { getProject: () => ({ project: project('alpha'), version: 1 }) },
    resolveWorkspace: async () => root,
    adapter: fakeAdapter({ fail: true }),
  });
  const result = await engine.getCallers({ project_id: 'alpha', workspace_binding: selected, function_name: 'helper' });
  assert.equal(result.status, 'PARTIAL');
  assert.equal(result.source, 'direct-source');
  assert.equal(result.commit, null);
  assert.equal(result.coverage.state, 'unknown');
  assert.equal(result.data.direct_source.matches.length, 1);
  assert.equal(result.data.direct_source.matches[0].relation, 'unclassified-text-match');
});

test('indexes only through the injected CBM adapter and includes bounded direct file evidence', async t => {
  const root = await fixture(t);
  const selected = project('alpha').workspace_bindings[0];
  const adapter = fakeAdapter();
  const engine = new CodeIntelligenceEngine({
    stateStore: { getProject: () => ({ project: project('alpha'), version: 1 }) },
    resolveWorkspace: async () => root,
    adapter,
  });
  const result = await engine.index({ project_id: 'alpha', workspace_binding: selected });
  assert.equal(adapter.calls[0][0], 'index');
  assert.equal(adapter.calls[1][0], 'get_architecture');
  assert.equal(result.status, 'PARTIAL');
  assert.deepEqual(result.data.direct_source.files, ['src/helper.ts']);
  assert.equal(result.data.direct_source.indexed, false);
});
