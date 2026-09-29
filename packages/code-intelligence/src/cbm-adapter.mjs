import { spawn } from 'node:child_process';

const DEFAULT_TIMEOUT_MS = 30_000;
const INDEX_TIMEOUT_MS = 5 * 60_000;
const BLOCKED_EXECUTABLES = new Set(['npx', 'npx.cmd', 'npm', 'npm.cmd', 'pnpm', 'pnpm.cmd', 'bunx', 'bunx.exe', 'uvx', 'uvx.exe']);

function flagName(name) {
  return `--${name.replace(/_/g, '-').replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`;
}

function commandArgs(tool, params) {
  const args = ['cli', '--quiet', tool];
  for (const [name, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    const flag = flagName(name);
    if (Array.isArray(value)) {
      for (const entry of value) args.push(flag, String(entry));
    } else if (typeof value === 'boolean') {
      args.push(flag, value ? 'true' : 'false');
    } else {
      args.push(flag, String(value));
    }
  }
  if (tool !== 'index_repository') args.push('--format', 'json');
  return args;
}

function collect(child, timeoutMs) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let settled = false;
    const timer = setTimeout(() => {
      child.kill();
      finish(new Error('code intelligence process timed out'));
    }, timeoutMs);
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      error ? reject(error) : resolve(result);
    };
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      stdout += chunk;
      if (stdout.length > 16 * 1024 * 1024) {
        child.kill();
        finish(new Error('code intelligence output exceeded the configured limit'));
      }
    });
    child.stderr.on('data', () => {});
    child.on('error', error => finish(error));
    child.on('close', code => {
      if (code !== 0) return finish(new Error(`code intelligence process exited ${code}`));
      try { finish(null, JSON.parse(stdout)); }
      catch { finish(new Error('code intelligence process returned invalid JSON')); }
    });
  });
}

export class CodebaseMemoryAdapter {
  constructor({ executable = process.env.CBM_BINARY || 'codebase-memory-mcp', spawnImpl = spawn, timeoutMs = DEFAULT_TIMEOUT_MS, indexTimeoutMs = INDEX_TIMEOUT_MS, env = process.env } = {}) {
    this.executable = executable;
    this.spawnImpl = spawnImpl;
    this.timeoutMs = timeoutMs;
    this.indexTimeoutMs = indexTimeoutMs;
    this.env = env;
    this.expectedVersion = '0.11.0';
    this.version = 'codebase-memory-mcp@0.11.0';
  }

  async #verifyVersion() {
    const executableName = this.executable.split(/[\\/]/).at(-1).toLowerCase();
    if (BLOCKED_EXECUTABLES.has(executableName)) throw new Error('package-manager runners are disabled for CBM');
    const child = this.spawnImpl(this.executable, ['--version'], {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...this.env },
    });
    let output = '';
    const result = await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error, observed) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        error ? reject(error) : resolve(observed);
      };
      const timer = setTimeout(() => { child.kill(); finish(new Error('CBM version check timed out.')); }, this.timeoutMs);
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', chunk => { output += chunk; });
      child.on('error', error => finish(error));
      child.on('close', code => code === 0 ? finish(null, output.trim()) : finish(new Error(`CBM version check exited ${code}.`)));
    });
    const tokens = result.split(/\s+/).map(token => token.replace(/^v/, '').replace(/[^0-9A-Za-z.+-].*$/, ''));
    if (!tokens.includes(this.expectedVersion)) throw new Error(`CBM executable version does not match pinned ${this.expectedVersion}.`);
    return this.version;
  }

  async #execute(tool, params, timeoutMs = this.timeoutMs, environment = {}) {
    const executableName = this.executable.split(/[\\/]/).at(-1).toLowerCase();
    if (BLOCKED_EXECUTABLES.has(executableName)) throw new Error('package-manager runners are disabled for CBM');
    const backendVersion = await this.#verifyVersion();
    const child = this.spawnImpl(this.executable, commandArgs(tool, params), {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...this.env, ...environment },
    });
    return { ...(await collect(child, timeoutMs)), backend_version: backendVersion };
  }

  async index({ repoPath, projectAlias, mode, target_projects: targetProjects }) {
    const result = await this.#execute('index_repository', { repo_path: repoPath, name: projectAlias, mode, target_projects: targetProjects }, this.indexTimeoutMs, { CBM_ALLOWED_ROOT: repoPath });
    return { data: result, backend_version: result.backend_version, coverage: { state: 'unknown', complete: false } };
  }

  async invoke(tool, params = {}) {
    const result = await this.#execute(tool, params);
    return { data: result, backend_version: result.backend_version, coverage: { state: 'unknown', complete: false } };
  }

  async health() {
    try { return { ok: true, version: await this.#verifyVersion() }; }
    catch (error) { return { ok: false, message: error instanceof Error ? error.message : 'CBM version check failed.' }; }
  }
}

export function createCodebaseMemoryAdapter(options) {
  return new CodebaseMemoryAdapter(options);
}
