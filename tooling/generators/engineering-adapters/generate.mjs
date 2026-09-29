import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const generatorDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(generatorDirectory, "../../..");
const canonicalSkillPath = resolve(repositoryRoot, ".agents/skills/engineering/core-discipline/SKILL.md");
const pluginName = "nexus-engineering-control";

function parseOutputDirectory(args) {
  let outputDirectory;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== "--out-dir") throw new Error(`unknown_argument:${args[index]}`);
    if (outputDirectory !== undefined || !args[index + 1]) throw new Error("invalid_out_dir_argument");
    outputDirectory = args[index + 1];
    index += 1;
  }
  return resolve(outputDirectory ?? resolve(repositoryRoot, "dist/engineering-adapters"));
}

function renderArtifacts(skillText) {
  const body = skillText.trimEnd();
  const cursorRule = [
    "---",
    'description: "Nexus Engineering Control for coding tasks"',
    "alwaysApply: true",
    "---",
    "",
    body,
    "",
  ].join("\n");
  const pluginManifest = `${JSON.stringify({
    name: pluginName,
    version: "1.0.0",
    description: "Automatically applies Nexus Engineering Control to coding tasks.",
  }, null, 2)}\n`;

  return new Map([
    ["openai-plugin/plugin.json", pluginManifest],
    ["openai-plugin/skills/engineering-control/SKILL.md", `${body}\n`],
    ["codex/AGENTS.md", `${body}\n`],
    ["jules/AGENTS.md", `${body}\n`],
    ["claude-code/CLAUDE.md", `${body}\n`],
    ["gemini/GEMINI.md", `${body}\n`],
    ["cursor/.cursor/rules/engineering-control.mdc", cursorRule],
    ["copilot/.github/copilot-instructions.md", `${body}\n`],
    ["generic/.agents/skills/engineering-control/SKILL.md", `${body}\n`],
  ]);
}

export async function generateEngineeringAdapters(outputDirectory) {
  const outputRoot = resolve(outputDirectory);
  const skillText = await readFile(canonicalSkillPath, "utf8");
  const artifacts = renderArtifacts(skillText);
  for (const [relativePath, content] of artifacts) {
    const outputPath = resolve(outputRoot, relativePath);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content, "utf8");
  }
  return [...artifacts.keys()];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const files = await generateEngineeringAdapters(parseOutputDirectory(process.argv.slice(2)));
    process.stdout.write(`Generated ${files.length} Engineering Control adapter files.\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "engineering_adapter_generation_failed"}\n`);
    process.exitCode = 1;
  }
}
