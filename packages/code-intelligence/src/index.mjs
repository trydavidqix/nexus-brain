import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, sep } from 'node:path';
import { promisify } from 'node:util';
import { assertContract } from '@nexus-brain/contracts';
import { CodebaseMemoryAdapter } from './cbm-adapter.mjs';

const execFileAsync = promisify(execFile);
const ADVISORY_COVERAGE = Object.freeze({ state: 'unknown', complete: false });
const MAX_SOURCE_FILES = 3000;
const MAX_SOURCE_BYTES = 24 * 1024 * 1024;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_MATCHES = 200;
const MAX_CROSS_REPO_TARGETS = 3;
const CROSS_REPO_EDGE_QUERY = "MATCH (s)-[e:CROSS_HTTP_CALLS|CROSS_ASYNC_CALLS|CROSS_CHANNEL|CROSS_GRPC_CALLS|CROSS_GRAPHQL_CALLS|CROSS_TRPC_CALLS]->(t) RETURN type(e) AS relation, e.target_project AS target_project, e.target_function AS target_function, e.target_file AS target_file, e.url_path AS url_path LIMIT 200";
const SOURCE_EXTENSIONS = new Set(['.c', '.cc', '.cpp', '.cs', '.go', '.h', '.hpp', '.java', '.js', '.jsx', '.mjs', '.mts', '.php', '.py', '.rb', '.rs', '.ts', '.tsx', '.vue']);
const SOURCE_IGNORES = new Set(['.git', '.nexus', '.codebase-memory', 'build', 'coverage', 'dist', 'node_modules', 'target', 'vendor']);

function unavailable(projectId, code, message) {
  return {
    status: 'UNAVAILABLE',
    project_id: projectId,
    source: 'unavailable',
    commit: null,
    index_version: null,
    coverage: ADVISORY_COVERAGE,
    confidence: null,
    data: null,
    warnings: [{ code, message }],
  };
}

function validateProject(project) {
  const type = Object.hasOwn(project, 'workspace_bindings') ? 'project-v2' : 'project';
  assertContract(type, project);
  return project;
}

function aliasFor(projectId, bindingLocation) {
  return `nexus-${createHash('sha256').update(projectId).update('\0').update(bindingLocation).digest('hex')}`;
}

function sameBinding(left, right) {
  return left?.kind === 'local' && right?.kind === 'local' && left.location === right.location;
}

function chooseBinding(project, selected) {
  if (!Array.isArray(project.workspace_bindings) || project.workspace_bindings.length === 0) return null;
  if (!selected || selected.kind !== 'local' || typeof selected.location !== 'string') return null;
  const matches = project.workspace_bindings.filter(binding => sameBinding(binding, selected));
  return matches.length === 1 ? matches[0] : null;
}

function normalizeResult(projectId, operation, adapterResult, { commit, indexVersion }) {
  const warnings = [];
  const backendStatus = adapterResult?.status;
  if (backendStatus === 'error' || backendStatus === 'unavailable') {
    return unavailable(projectId, 'BACKEND_UNAVAILABLE', String(adapterResult.message || 'Code intelligence backend is unavailable'));
  }
  if (backendStatus === 'partial' || backendStatus === 'degraded') {
    warnings.push({ code: 'BACKEND_PARTIAL', message: 'Backend marked this result partial or degraded.' });
  }
  if (typeof adapterResult?.index_commit !== 'string') {
    warnings.push({ code: 'INDEX_PROVENANCE_UNVERIFIED', message: 'The backend did not report the commit associated with this index result.' });
  } else if (commit && adapterResult.index_commit !== commit) {
    warnings.push({ code: 'INDEX_FRESHNESS_UNVERIFIED', message: 'The backend index commit differs from the current workspace commit.' });
  }
  if (Array.isArray(adapterResult?.warnings)) warnings.push(...adapterResult.warnings);
  return {
    status: warnings.length ? 'PARTIAL' : 'OK',
    project_id: projectId,
    source: 'codebase-memory-mcp',
    commit: typeof adapterResult?.index_commit === 'string' ? adapterResult.index_commit : null,
    workspace_commit: commit,
    index_version: typeof adapterResult?.index_version === 'string' ? adapterResult.index_version : indexVersion,
    backend_version: adapterResult?.backend_version || null,
    related_targets: adapterResult?.related_targets,
    coverage: { state: adapterResult?.coverage?.state || 'unknown', complete: false },
    confidence: typeof adapterResult?.confidence === 'number' ? adapterResult.confidence : null,
    data: adapterResult?.data ?? adapterResult,
    warnings,
    operation,
  };
}

function explicitTargetId(value) {
  for (const key of ['target_project', 'target_project_id', 'target_alias', 'target_id', 'target']) {
    const candidate = value?.[key];
    if (typeof candidate === 'string') return candidate;
    if (candidate && typeof candidate === 'object') {
      for (const nestedKey of ['project_id', 'alias', 'id']) if (typeof candidate[nestedKey] === 'string') return candidate[nestedKey];
    }
  }
  return null;
}

function relationType(value, inherited) {
  if (typeof inherited === 'string' && /^CROSS_[A-Z_]+$/i.test(inherited)) return inherited;
  for (const key of ['edge_type', 'relation', 'relationship', 'type', 'kind']) {
    if (typeof value?.[key] === 'string' && /^CROSS_[A-Z_]+$/i.test(value[key])) return value[key];
  }
  return null;
}

function collectCrossRepoLinks(value, targets, parentKey = null, links = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectCrossRepoLinks(item, targets, parentKey, links);
    return links;
  }
  if (!value || typeof value !== 'object') return links;
  const relation = relationType(value, parentKey);
  if (relation) {
    const targetIdentifier = explicitTargetId(value);
    const target = targets.find(candidate => targetIdentifier === candidate.alias || targetIdentifier === candidate.project_id);
    if (target) links.push({ target_project_id: target.project_id, relation, evidence: value });
  }
  for (const [key, item] of Object.entries(value)) {
    if (item && typeof item === 'object') collectCrossRepoLinks(item, targets, key, links);
  }
  return links;
}

function crossRepoRows(result) {
  const payload = result?.data ?? result;
  if (!Array.isArray(payload?.rows)) return [];
  if (payload.rows.every(row => row && typeof row === 'object' && !Array.isArray(row))) return payload.rows;
  const columns = payload.columns;
  if (!Array.isArray(columns) || !payload.rows.every(Array.isArray)) return [];
  const names = columns.map(column => typeof column === 'string' ? column : column?.name);
  if (names.some(name => typeof name !== 'string')) return [];
  return payload.rows.map(row => Object.fromEntries(names.map((name, index) => [name, row[index]])));
}

function backendIndexCommit(...results) {
  for (const result of results) {
    const payload = result?.data ?? result;
    if (typeof payload?.index_commit === 'string') return payload.index_commit;
  }
  return null;
}

function backendGeneration(result) {
  const payload = result?.data ?? result;
  const generation = payload?.metadata?.generation
    ?? payload?.coverage?.metadata?.generation;
  if (typeof generation === 'string' && generation.length > 0) return generation;
  return typeof payload?.index_version === 'string' && payload.index_version.length > 0 ? payload.index_version : null;
}

function redactWorkspacePath(value, rootPath) {
  if (typeof value === 'string') {
    const variants = new Set([rootPath, rootPath.replace(/\\/g, '/'), rootPath.replace(/\//g, '\\')]);
    let redacted = value;
    for (const variant of variants) if (variant) redacted = redacted.split(variant).join('<workspace>');
    return redacted;
  }
  if (Array.isArray(value)) return value.map(item => redactWorkspacePath(item, rootPath));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactWorkspacePath(item, rootPath)]));
}

function symbolNeedle(request) {
  const raw = request.name || request.function_name || request.qualified_name || '';
  const symbol = String(raw).split(/[.:/\\]/).at(-1);
  const signatureStart = symbol.indexOf('(');
  return signatureStart === -1 ? symbol : symbol.slice(0, signatureStart);
}

function isWordCharacter(character = '') {
  const code = character.charCodeAt(0);
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95;
}

function hasWordBoundaryMatch(text, needle) {
  if (!needle) return false;
  let position = text.indexOf(needle);
  while (position !== -1) {
    const before = position === 0 ? '' : text[position - 1];
    const after = text[position + needle.length] ?? '';
    const startsAtBoundary = isWordCharacter(before) !== isWordCharacter(text[position]);
    const endsAtBoundary = isWordCharacter(text[position + needle.length - 1]) !== isWordCharacter(after);
    if (startsAtBoundary && endsAtBoundary) return true;
    position = text.indexOf(needle, position + 1);
  }
  return false;
}

function boundedInteger(value, fallback, maximum) {
  if (!Number.isInteger(value) || value < 1) return fallback;
  return Math.min(value, maximum);
}

async function sourceFiles(rootPath, limits = { count: MAX_SOURCE_FILES, bytes: MAX_SOURCE_BYTES }) {
  const files = [];
  let bytes = 0;
  let truncated = false;
  const pending = [rootPath];
  while (pending.length) {
    const directory = pending.pop();
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); }
    catch { continue; }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!SOURCE_IGNORES.has(entry.name)) pending.push(join(directory, entry.name));
        continue;
      }
      if (!entry.isFile() || !SOURCE_EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase())) continue;
      if (files.length >= limits.count) { truncated = true; break; }
      const filePath = join(directory, entry.name);
      let details;
      try { details = await stat(filePath); } catch { continue; }
      if (!details.isFile() || details.size > MAX_FILE_BYTES || bytes + details.size > limits.bytes) { truncated = true; continue; }
      let content;
      try { content = await readFile(filePath); } catch { continue; }
      if (content.length > MAX_FILE_BYTES || bytes + content.length > limits.bytes) { truncated = true; continue; }
      bytes += content.length;
      files.push({ path: filePath, relativePath: relative(rootPath, filePath).split(sep).join('/'), content: content.toString('utf8') });
    }
    if (truncated) break;
  }
  return { files, bytes, truncated };
}

async function directSourceEvidence(operation, request, rootPath, commit) {
  if (operation === 'analyzeImpact' || operation === 'getChanges') {
    try {
      const [status, diff] = await Promise.all([
        execFileAsync('git', ['-C', rootPath, 'status', '--short'], { timeout: 5000, windowsHide: true }),
        execFileAsync('git', ['-C', rootPath, 'diff', '--name-only', 'HEAD'], { timeout: 5000, windowsHide: true }),
      ]);
      return { kind: 'git-working-tree', commit, status: status.stdout.trim().split(/\r?\n/).filter(Boolean), changed_paths: diff.stdout.trim().split(/\r?\n/).filter(Boolean) };
    } catch {
      return { kind: 'git-working-tree', commit, available: false };
    }
  }
  const snapshot = await sourceFiles(rootPath);
  if (operation === 'index') {
    return { kind: 'direct-source-file-list', commit, indexed: false, files: snapshot.files.map(file => file.relativePath), scanned_files: snapshot.files.length, scanned_bytes: snapshot.bytes, truncated: snapshot.truncated };
  }
  const needle = symbolNeedle(request);
  if (!needle) return { kind: 'direct-source', available: false, reason: 'A symbol or file target is required.' };
  const matches = [];
  for (const file of snapshot.files) {
    const lines = file.content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      if (!hasWordBoundaryMatch(lines[index], needle)) continue;
      matches.push({ file_path: file.relativePath, line: index + 1, text: lines[index].slice(0, 500), relation: 'unclassified-text-match' });
      if (matches.length >= MAX_MATCHES) break;
    }
    if (matches.length >= MAX_MATCHES) break;
  }
  if (operation === 'getTests') {
    const related = matches.filter(match => /(^|[/._-])(test|tests|spec|specs)([/._-]|$)/i.test(match.file_path));
    return { kind: 'direct-source-text-search', commit, evidence: 'unclassified-text-match', matches: related, scanned_files: snapshot.files.length, scanned_bytes: snapshot.bytes, truncated: snapshot.truncated };
  }
  return { kind: 'direct-source-text-search', commit, evidence: 'unclassified-text-match', matches, scanned_files: snapshot.files.length, scanned_bytes: snapshot.bytes, truncated: snapshot.truncated };
}

async function combineWithDirectSource(operation, request, scope, graphResult, commit) {
  const source = await directSourceEvidence(operation, request, scope.rootPath, commit);
  const graphAvailable = graphResult !== null;
  const graphData = graphResult?.data ?? graphResult;
  return {
    status: 'partial',
    data: { code_graph: graphAvailable ? graphData : null, direct_source: source },
    coverage: { state: 'unknown', complete: false },
    confidence: null,
    index_commit: graphResult?.index_commit || graphData?.index_commit,
    index_version: graphResult?.index_version || graphData?.index_version,
    backend_version: graphResult?.backend_version || graphData?.backend_version,
    related_targets: graphResult?.related_targets,
    warnings: graphResult?.warnings,
  };
}

async function currentCommit(rootPath) {
  try {
    const { stdout } = await execFileAsync('git', ['-C', rootPath, 'rev-parse', 'HEAD'], { timeout: 5000, windowsHide: true });
    const commit = stdout.trim();
    return /^[0-9a-f]{40,64}$/i.test(commit) ? commit : null;
  } catch {
    return null;
  }
}

export class CodeIntelligenceEngine {
  constructor({ stateStore, resolveWorkspace, adapter = new CodebaseMemoryAdapter() } = {}) {
    if (!stateStore || typeof stateStore.getProject !== 'function') throw new TypeError('stateStore.getProject is required');
    if (typeof resolveWorkspace !== 'function') throw new TypeError('resolveWorkspace capability is required');
    if (!adapter || typeof adapter.health !== 'function' || typeof adapter.invoke !== 'function') throw new TypeError('adapter with health() and invoke() is required');
    this.stateStore = stateStore;
    this.resolveWorkspace = resolveWorkspace;
    this.adapter = adapter;
  }

  async #scope(request = {}) {
    const { project_id: projectId, workspace_binding: selectedBinding } = request || {};
    if (typeof projectId !== 'string' || projectId.length === 0) return { error: unavailable(projectId ?? null, 'PROJECT_ID_REQUIRED', 'project_id is required.') };
    let stored;
    try { stored = this.stateStore.getProject(projectId); }
    catch { return { error: unavailable(projectId, 'STATESTORE_UNAVAILABLE', 'Project could not be read from StateStore.') }; }
    if (!stored) return { error: unavailable(projectId, 'PROJECT_NOT_FOUND', 'Project is not registered in StateStore.') };
    let project;
    try { project = validateProject(stored.project); }
    catch { return { error: unavailable(projectId, 'PROJECT_CONTRACT_INVALID', 'Stored Project does not validate against its contract.') }; }
    if (!Array.isArray(project.workspace_bindings)) {
      return { error: unavailable(projectId, 'WORKSPACE_NOT_REGISTERED', 'Project v1 has no registered local workspace binding.') };
    }
    const binding = chooseBinding(project, selectedBinding);
    if (!binding) return { error: unavailable(projectId, 'WORKSPACE_SELECTION_REQUIRED', 'Select exactly one registered local workspace binding.') };
    let rootPath;
    try { rootPath = await this.resolveWorkspace({ project_id: projectId, binding }); }
    catch { rootPath = null; }
    if (typeof rootPath !== 'string' || rootPath.length === 0 || !isAbsolute(rootPath)) {
      return { error: unavailable(projectId, 'WORKSPACE_UNRESOLVED', 'The local workspace resolver did not resolve this registered binding.') };
    }
    return { project, binding, rootPath, alias: aliasFor(projectId, binding.location) };
  }

  async #run(operation, request, invoke) {
    const scope = await this.#scope(request);
    if (scope.error) return scope.error;
    const commit = await currentCommit(scope.rootPath);
    let graphResult = null;
    try {
      graphResult = await invoke(scope);
    } catch { /* direct source below remains an independent fallback */ }
    const backendStatus = graphResult?.data?.status || graphResult?.data?.indexing?.status || graphResult?.status;
    if (['error', 'failed', 'unavailable'].includes(String(backendStatus).toLowerCase())) graphResult = null;
    try {
      if (graphResult) graphResult = redactWorkspacePath(graphResult, scope.rootPath);
      const combined = await combineWithDirectSource(operation, request, scope, graphResult, commit);
      const normalized = normalizeResult(request.project_id, operation, combined, { commit, indexVersion: null });
      normalized.source = graphResult ? 'codebase-memory-mcp+direct-source' : 'direct-source';
      normalized.status = 'PARTIAL';
      normalized.warnings.unshift({ code: graphResult ? 'ADVISORY_GRAPH' : 'BACKEND_UNAVAILABLE', message: graphResult ? 'Code graph evidence is advisory and is accompanied by direct-source evidence.' : 'CBM is unavailable; only direct-source fallback evidence is returned.' });
      return normalized;
    } catch {
      return unavailable(request.project_id, graphResult ? 'DIRECT_SOURCE_UNAVAILABLE' : 'BACKEND_AND_SOURCE_UNAVAILABLE', 'Neither code graph nor direct-source evidence is available for this operation.');
    }
  }

  async index(request) {
    const requestedTargets = request?.target_projects ?? [];
    if (!Array.isArray(requestedTargets) || requestedTargets.length > MAX_CROSS_REPO_TARGETS) {
      return unavailable(request?.project_id ?? null, 'CROSS_REPO_TARGET_LIMIT', `target_projects must contain at most ${MAX_CROSS_REPO_TARGETS} registered workspaces.`);
    }
    const targetIds = requestedTargets.map(target => target?.project_id);
    if (targetIds.some(id => typeof id !== 'string' || id.length === 0)) {
      return unavailable(request?.project_id ?? null, 'CROSS_REPO_TARGET_INVALID', 'Each target_projects entry requires project_id and workspace_binding.');
    }
    if (targetIds.includes(request?.project_id)) return unavailable(request.project_id, 'CROSS_REPO_SELF_TARGET', 'The source project cannot also be a cross-repository target.');
    if (new Set(targetIds).size !== targetIds.length) return unavailable(request?.project_id ?? null, 'CROSS_REPO_TARGET_DUPLICATE', 'Each target project may be selected only once.');
    const targetScopes = [];
    for (const target of requestedTargets) {
      if (!target.workspace_binding || typeof target.workspace_binding !== 'object') {
        return unavailable(request?.project_id ?? null, 'CROSS_REPO_TARGET_INVALID', 'Each target_projects entry requires project_id and workspace_binding.');
      }
      const targetScope = await this.#scope(target);
      if (targetScope.error) return unavailable(request?.project_id ?? null, 'CROSS_REPO_TARGET_UNAVAILABLE', `Selected target project ${target.project_id} is not an unambiguous registered workspace.`);
      targetScopes.push({ project_id: target.project_id, ...targetScope });
    }
    return this.#run('index', request, async scope => {
      const indexed = await this.adapter.index({ repoPath: scope.rootPath, projectAlias: scope.alias });
      const targetIndexes = [];
      const targetIndexResults = [];
      for (const target of targetScopes) {
        const workspaceCommitBefore = await currentCommit(target.rootPath);
        const targetIndex = await this.adapter.index({ repoPath: target.rootPath, projectAlias: target.alias });
        targetIndexResults.push({ target, workspaceCommitBefore, targetIndex });
        targetIndexes.push(target.alias);
      }
      let crossRepo = null;
      let crossRepoFailed = false;
      if (targetIndexes.length) {
        try { crossRepo = await this.adapter.index({ repoPath: scope.rootPath, projectAlias: scope.alias, mode: 'cross-repo-intelligence', target_projects: targetIndexes }); }
        catch { crossRepoFailed = true; }
      }
      let crossEdges = null;
      let crossQueryFailed = false;
      if (targetIndexes.length && crossRepo) {
        try { crossEdges = await this.adapter.invoke('query_graph', { project: scope.alias, query: CROSS_REPO_EDGE_QUERY }); }
        catch { crossQueryFailed = true; }
      }
      const crossPayload = crossRepoRows(crossEdges);
      const candidateLinks = collectCrossRepoLinks(crossPayload, targetScopes);
      const relatedTargets = [];
      const targetWarnings = [];
      for (const indexedTarget of targetIndexResults) {
        let targetStatus = null;
        try { targetStatus = await this.adapter.invoke('index_status', { project: indexedTarget.target.alias }); } catch { /* target commit remains unverified */ }
        let targetCoverage = null;
        try {
          targetCoverage = await this.adapter.invoke('check_index_coverage', {
            project: indexedTarget.target.alias,
            scopes: ['.'],
          });
        } catch { /* post-link generation remains unknown */ }
        const workspaceCommit = await currentCommit(indexedTarget.target.rootPath);
        const indexCommit = backendIndexCommit(targetStatus, indexedTarget.targetIndex);
        const generation = backendGeneration(targetCoverage);
        const workspaceStable = Boolean(indexedTarget.workspaceCommitBefore && workspaceCommit && indexedTarget.workspaceCommitBefore === workspaceCommit);
        const freshness = indexCommit && workspaceCommit && indexCommit !== workspaceCommit
          ? 'stale'
          : (indexCommit && workspaceStable ? 'verified' : 'unverified');
        const warnings = [];
        if (!indexCommit) warnings.push({ code: 'TARGET_INDEX_PROVENANCE_UNVERIFIED', message: 'CBM did not report a Git commit for this target index.' });
        if (!indexedTarget.workspaceCommitBefore || !workspaceCommit) warnings.push({ code: 'TARGET_WORKSPACE_COMMIT_UNKNOWN', message: 'Git could not establish the target workspace commit both before and after indexing.' });
        if (indexedTarget.workspaceCommitBefore && workspaceCommit && indexedTarget.workspaceCommitBefore !== workspaceCommit) warnings.push({ code: 'TARGET_WORKSPACE_CHANGED_DURING_INDEXING', message: 'The target workspace HEAD changed while its graph was being indexed.' });
        if (indexCommit && workspaceCommit && indexCommit !== workspaceCommit) warnings.push({ code: 'TARGET_INDEX_STALE', message: 'The target index commit differs from the current target workspace commit.' });
        if (!generation) warnings.push({ code: 'TARGET_INDEX_GENERATION_UNKNOWN', message: 'CBM did not report the target index generation after cross-repository linking.' });
        relatedTargets.push({
          project_id: indexedTarget.target.project_id,
          source: 'codebase-memory-mcp',
          workspace_commit_before: indexedTarget.workspaceCommitBefore,
          workspace_commit: workspaceCommit,
          index_commit: indexCommit,
          index_version: generation || 'unknown',
          freshness,
          workspace_stable: workspaceStable,
          evidence_associated: false,
          warnings,
        });
        targetWarnings.push(...warnings);
        if (crossRepoFailed) {
          const warning = { code: 'CROSS_REPO_INDEX_UNAVAILABLE', message: 'CBM did not complete the cross-repository indexing pass; no target links are returned.' };
          relatedTargets.at(-1).warnings.push(warning);
          targetWarnings.push(warning);
        } else if (crossQueryFailed) {
          const warning = { code: 'CROSS_REPO_QUERY_UNAVAILABLE', message: 'CBM did not return cross-repository relationship rows; no target links are returned.' };
          relatedTargets.at(-1).warnings.push(warning);
          targetWarnings.push(warning);
        }
      }
      const links = candidateLinks.filter(link => relatedTargets.some(target => target.project_id === link.target_project_id && target.index_version !== 'unknown' && target.workspace_stable && target.freshness !== 'stale'));
      for (const relatedTarget of relatedTargets) {
        relatedTarget.evidence_associated = links.some(link => link.target_project_id === relatedTarget.project_id);
        if (!relatedTarget.evidence_associated) {
          const warning = { code: 'CROSS_REPO_TARGET_UNATTRIBUTED', message: 'CBM did not associate cross-repository evidence with this selected target; no target link is returned.' };
          relatedTarget.warnings.push(warning);
          targetWarnings.push(warning);
        }
      }
      let architecture = null;
      let indexStatus = null;
      let indexCoverage = null;
      try { architecture = await this.adapter.invoke('get_architecture', { project: scope.alias, aspects: ['routes'] }); } catch { /* architecture is advisory */ }
      try { indexStatus = await this.adapter.invoke('index_status', { project: scope.alias }); } catch { /* index status is advisory */ }
      try { indexCoverage = await this.adapter.invoke('check_index_coverage', { project: scope.alias, scopes: ['.'] }); } catch { /* index generation remains unknown */ }
      return {
        data: {
          indexing: indexed?.data ?? indexed,
          cross_repo: links.length ? {
            links: links.map(link => ({
              ...link,
              evidence: targetScopes.reduce((value, target) => redactWorkspacePath(value, target.rootPath), link.evidence),
            })),
          } : null,
          architecture: architecture?.data ?? architecture,
          index_status: indexStatus?.data ?? indexStatus,
        },
        coverage: { state: 'unknown', complete: false },
        index_version: backendGeneration(indexCoverage),
        index_commit: crossRepo?.data?.index_commit || crossRepo?.index_commit || indexed?.data?.index_commit || indexed?.index_commit,
        backend_version: crossRepo?.backend_version || indexed?.backend_version || indexed?.data?.backend_version || null,
        related_targets: relatedTargets,
        warnings: targetWarnings,
      };
    });
  }

  async searchSymbol(request) {
    const name = request?.name;
    if (typeof name !== 'string' || name.length === 0 || name.length > 256) return unavailable(request?.project_id ?? null, 'SYMBOL_NAME_REQUIRED', 'name must contain 1 to 256 characters.');
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.#run('searchSymbol', request, scope => this.adapter.invoke('search_graph', {
      project: scope.alias,
      name_pattern: `^${escaped}$`,
      label: request.kind || 'Function',
      limit: boundedInteger(request.limit, 25, 100),
    }));
  }

  async getContext(request) {
    if (typeof request?.qualified_name !== 'string' || request.qualified_name.length === 0 || request.qualified_name.length > 1024) {
      return unavailable(request?.project_id ?? null, 'QUALIFIED_NAME_REQUIRED', 'qualified_name must contain 1 to 1024 characters.');
    }
    return this.#run('getContext', request, scope => this.adapter.invoke('get_code_snippet', {
      project: scope.alias,
      qualified_name: request?.qualified_name,
    }));
  }

  async getCallers(request) {
    return this.#trace('getCallers', request, 'inbound');
  }

  async getCallees(request) {
    return this.#trace('getCallees', request, 'outbound');
  }

  async #trace(operation, request, direction) {
    if (typeof request?.function_name !== 'string' || request.function_name.length === 0 || request.function_name.length > 512) {
      return unavailable(request?.project_id ?? null, 'FUNCTION_NAME_REQUIRED', 'function_name must contain 1 to 512 characters.');
    }
    return this.#run(operation, request, scope => this.adapter.invoke('trace_path', {
      project: scope.alias,
      function_name: request.function_name,
      direction,
      depth: boundedInteger(request.depth, 3, 5),
    }));
  }

  async getTests(request) {
    if (typeof request?.function_name !== 'string' || request.function_name.length === 0 || request.function_name.length > 512) {
      return unavailable(request?.project_id ?? null, 'FUNCTION_NAME_REQUIRED', 'function_name must contain 1 to 512 characters.');
    }
    return this.#run('getTests', request, scope => this.adapter.invoke('trace_path', {
      project: scope.alias,
      function_name: request.function_name,
      direction: 'both',
      include_tests: true,
      depth: boundedInteger(request.depth, 3, 5),
    }));
  }

  async analyzeImpact(request) {
    return this.#run('analyzeImpact', request, scope => this.adapter.invoke('detect_changes', { project: scope.alias }));
  }

  async getChanges(request) {
    return this.#run('getChanges', request, scope => this.adapter.invoke('detect_changes', { project: scope.alias }));
  }

  async health(request = {}) {
    const projectId = request.project_id ?? null;
    try {
      const result = await this.adapter.health();
      return {
        status: result.ok ? 'OK' : 'UNAVAILABLE',
        project_id: projectId,
        source: 'codebase-memory-mcp',
        commit: null,
        index_version: null,
        backend_version: result.ok ? result.version : null,
        coverage: ADVISORY_COVERAGE,
        confidence: null,
        data: result,
        warnings: result.ok ? [] : [{ code: 'BACKEND_UNAVAILABLE', message: result.message || 'CBM executable is unavailable.' }],
      };
    } catch (error) {
      return unavailable(projectId, 'BACKEND_UNAVAILABLE', error instanceof Error ? error.message : 'CBM health check failed.');
    }
  }
}

export function createCodeIntelligenceEngine(options) {
  return new CodeIntelligenceEngine(options);
}

export { CodebaseMemoryAdapter } from './cbm-adapter.mjs';
