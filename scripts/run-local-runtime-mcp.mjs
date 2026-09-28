import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtimePackageRoot = resolve(workspaceRoot, "packages/local-runtime");
const child = spawn(process.execPath, ["--import", "tsx", "src/mcp-server.ts"], {
  cwd: runtimePackageRoot,
  env: { ...process.env, MAESTRI_RUNTIME_WORKSPACE_ROOT: workspaceRoot },
  shell: false,
  windowsHide: true,
  stdio: "inherit",
});

child.once("error", (error) => {
  process.stderr.write(`local_runtime_start_failed: ${error.code ?? "unknown"}\n`);
  process.exitCode = 1;
});
child.once("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
