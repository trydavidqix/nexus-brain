import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const generator = join(repositoryRoot, 'tooling/generators/engineering-adapters/generate.mjs');
const canonicalSkill = join(repositoryRoot, '.agents/skills/engineering/core-discipline/SKILL.md');
const expectedFiles = [
  'claude-code/CLAUDE.md',
  'codex/AGENTS.md',
  'copilot/.github/copilot-instructions.md',
  'cursor/.cursor/rules/engineering-control.mdc',
  'gemini/GEMINI.md',
  'generic/.agents/skills/engineering-control/SKILL.md',
  'jules/AGENTS.md',
  'openai-plugin/plugin.json',
  'openai-plugin/skills/engineering-control/SKILL.md',
].sort();

function generate(outDir: string): void {
  const result = spawnSync(process.execPath, [generator, '--out-dir', outDir], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    windowsHide: true,
  });
  expect(result.error?.message).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
}

function listFiles(directory: string, prefix = ''): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = join(prefix, entry.name).replaceAll('\\', '/');
    return entry.isDirectory() ? listFiles(join(directory, entry.name), relativePath) : [relativePath];
  }).sort();
}

describe('Engineering Control adapter generator', () => {
  it('writes the declared provider/project instruction paths and is deterministic', () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), 'nexus-engineering-adapters-'));
    try {
      const first = join(temporaryRoot, 'first');
      const second = join(temporaryRoot, 'second');
      generate(first);
      generate(second);

      expect(listFiles(first)).toEqual(expectedFiles);
      expect(listFiles(second)).toEqual(expectedFiles);
      for (const file of expectedFiles) {
        expect(readFileSync(join(first, file))).toEqual(readFileSync(join(second, file)));
      }

      const manifest = JSON.parse(readFileSync(join(first, 'openai-plugin/plugin.json'), 'utf8')) as { name?: string };
      expect(manifest.name).toEqual(expect.any(String));
      expect(manifest.name?.trim().length).toBeGreaterThan(0);
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it('derives the single injected skill from the canonical source, without copying a catalog', () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), 'nexus-engineering-adapters-source-'));
    try {
      const output = join(temporaryRoot, 'out');
      generate(output);
      const source = readFileSync(canonicalSkill, 'utf8');
      const genericSkill = readFileSync(join(output, 'generic/.agents/skills/engineering-control/SKILL.md'), 'utf8');
      const pluginSkill = readFileSync(join(output, 'openai-plugin/skills/engineering-control/SKILL.md'), 'utf8');

      expect(source.trim().length).toBeGreaterThan(0);
      expect(genericSkill).toContain(source.trim());
      expect(pluginSkill).toContain(source.trim());
      expect(listFiles(output).filter((file) => file.endsWith('SKILL.md'))).toEqual([
        'generic/.agents/skills/engineering-control/SKILL.md',
        'openai-plugin/skills/engineering-control/SKILL.md',
      ]);
      expect(listFiles(output).some((file) => /registry|catalog/i.test(file))).toBe(false);
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it('permanently activates Engineering Control for coding tasks without granting routing authority', () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), 'nexus-engineering-adapters-policy-'));
    try {
      const output = join(temporaryRoot, 'out');
      generate(output);
      const instructionFiles = expectedFiles.filter((file) => file.endsWith('.md') || file.endsWith('.mdc'));
      const instructionText = instructionFiles
        .map((file) => readFileSync(join(output, file), 'utf8'))
        .join('\n');

      expect(instructionText).toMatch(/coding task/i);
      expect(instructionText).toMatch(/always|permanent|automatically/i);
      expect(instructionText).toMatch(/Maestri/i);
      expect(instructionText).toMatch(/does not|must not|never/i);
      expect(instructionText).toMatch(/route|dispatch|identity/i);
      expect(instructionText).not.toMatch(/(?:full|entire|complete)\s+(?:skill\s+)?catalog\s+(?:is\s+)?(?:loaded|injected|provided)/i);
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
});
