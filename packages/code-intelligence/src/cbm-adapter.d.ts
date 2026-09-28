import type { CodeIntelligenceAdapter } from './index.js';

export interface CodebaseMemoryAdapterOptions {
  executable?: string;
  spawnImpl?: typeof import('node:child_process').spawn;
  timeoutMs?: number;
  indexTimeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

export declare class CodebaseMemoryAdapter implements CodeIntelligenceAdapter {
  readonly version: string;
  constructor(options?: CodebaseMemoryAdapterOptions);
  index(input: { repoPath: string; projectAlias: string; mode?: string; target_projects?: string[] }): Promise<unknown>;
  invoke(tool: string, params?: Record<string, string | number | boolean | undefined>): Promise<unknown>;
  health(): Promise<{ ok: boolean; version?: string; message?: string }>;
}

export declare function createCodebaseMemoryAdapter(options?: CodebaseMemoryAdapterOptions): CodebaseMemoryAdapter;
