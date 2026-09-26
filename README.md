# Nexus Brain

Nexus Brain is the canonical project and repository. The Maestri Context
Gateway (MCG), Maestri Wire, and Local Runtime are legacy names for capabilities
being migrated into Nexus packages; compatibility aliases remain only while
their consumers are being cut over.

The single active implementation plan is
[`docs/blueprints/NEXUS_BRAIN_MASTER_IMPLEMENTATION_BLUEPRINT.md`](docs/blueprints/NEXUS_BRAIN_MASTER_IMPLEMENTATION_BLUEPRINT.md).
Original source plans are preserved in `docs/blueprints/sources/` and historical
project documentation remains archived. [`docs/STATUS.md`](docs/STATUS.md)
tracks verified MCG component evidence; it is not a second project plan.
The [documentation sync policy](docs/DOCUMENTATION_SYNC_POLICY.md) requires
important project state to be committed and pushed on its corresponding branch.

## Runtime data

Nexus stores runtime data in ignored `.nexus-state/` by default. Set
`NEXUS_BRAIN_STATE` to override it. `MCG_ROOT` remains a temporary compatibility
override during migration. Runtime state, tasks, logs, event inbox data, PID
files, Wire credentials, and backups are excluded from Git.

## CLI

```powershell
$env:NEXUS_BRAIN_STATE = Join-Path (Get-Location) '.nexus-state'
node apps/cli/src/mcg.mjs doctor
node apps/cli/src/mcg.mjs status --json
node apps/cli/src/mcg.mjs mcp discover --project-root C:\path\to\project
node apps/cli/src/mcg.mjs mcp probe --project-root C:\path\to\project
node apps/cli/src/mcg.mjs result <task-id>
node apps/cli/src/mcg.mjs evidence <task-id> --type result --lines 80 --offset 0
```

`result` returns a compact completion digest. When more detail is needed, `evidence --type result` reads the locally retained, secret-redacted result on demand; use `--offset` to continue through long output in chunks of up to 200 lines.

Wire is an optional compatibility bridge; the standalone Nexus Brain does not require Maestri. When needed, create local runtime state at `.nexus-state/config/wire.json` using `config/environments/wire.example.json` as the template, then provide credentials outside Git. Never commit credentials or runtime data.

## Usage and evaluation evidence

Codex usage reports keep `context_tokens` separate from total input/output tokens. Context usage is unavailable unless both input and cached-input fields are observed; missing fields are never treated as zero. Historical evaluation records may recover context usage from their local raw JSONL evidence.

The dashboard's **Execuções** view is read-only. An execution feed can be injected by the host; the optional Core HTTP adapter accepts loopback URLs only. Missing execution or usage evidence remains `UNAVAILABLE` with `null` measurements.

Run the expanded 30-case paired validation corpus with `npm run eval:validation-v2`. This invokes the configured Codex CLI with read-only sandboxing and may consume provider quota; the dataset itself is local and can be inspected without running the provider.

## Windows daemon lifecycle

Start the daemon with `node apps/cli/src/mcg.mjs daemon` and stop it gracefully with `node apps/cli/src/mcg.mjs daemon stop`. The dashboard reports the daemon online only when its authenticated loopback health endpoint responds. A stale PID lock is recovered on the next start; the daemon never terminates an unrelated process by PID.

The dashboard defaults to `http://127.0.0.1:7435`; use `node apps/cli/src/mcg.mjs dashboard --port 7436 --no-open` if another Nexus checkout already owns that port.

Autostart is not required for Nexus Brain. Start and stop the optional Edge
daemon manually with the CLI above; the migration does not install a Windows
Scheduled Task or VBS launcher.

`mcp discover` reads the global and project MCP catalogs for Claude Code, Codex, and Antigravity and prints metadata only (never auth values). `mcp probe` starts configured stdio MCP servers and sends only MCP discovery/list requests; it does not call tools. It records observed health and tool names in local `state/registry/mcps.json`. Use `--provider claude|codex|antigravity` or `--scope global|project` to limit a probe. HTTP endpoints require HTTPS, except loopback.

## Local Runtime MCP batch tool

The optional Nexus Edge stdio server exposes the compatibility tool `mcg_read_batch` for bounded read-only workspace inspection. It accepts up to 20 typed file-read, read-if-changed, search, or log-read operations in one request. Workspace paths are confined to `NEXUS_BRAIN_ROOT` (`MAESTRI_RUNTIME_WORKSPACE_ROOT` remains an input alias); the server exposes no shell, write, network, or git operation. This provides a single-call batching boundary, but does not by itself prove fewer model turns or token savings.

Requirements: Node.js 20+ and dependencies installed from the repository lockfile. To launch it manually from PowerShell:

```powershell
$env:NEXUS_BRAIN_ROOT = (Resolve-Path 'C:\path\to\workspace').Path
pnpm --dir 'C:\path\to\nexus-brain' --filter @nexus-brain/edge mcp:stdio
```

The process speaks MCP over stdin/stdout; diagnostics go to stderr. A client must launch it as a local stdio process and provide the workspace environment variable. Claude Code supports project-scoped stdio registration (`claude mcp add --scope project --transport stdio ...`); Codex supports project-local MCP configuration in a trusted repository. **No provider/global configuration is installed or changed by this package.** Registering it in a host, approving the project server, and testing inside the user’s Claude/Codex session remain explicit host-side setup steps. Use the [Claude Code MCP reference](https://code.claude.com/docs/en/mcp) and [Codex MCP configuration documentation](https://developers.openai.com/codex/mcp) for the host’s current syntax. Do not copy credentials into the MCP configuration; this server requires only the workspace-root path.

Example project-scoped launch (replace both absolute paths; this only illustrates host configuration and is not run by the repository tests):

```powershell
# Claude Code: writes only this repository's .mcp.json when run from its root.
claude mcp add --scope project --transport stdio nexus-edge --env "NEXUS_BRAIN_ROOT=C:\path\to\workspace" -- pnpm --dir C:\path\to\nexus-brain --filter @nexus-brain/edge mcp:stdio
```

Codex project-local equivalent for a trusted repository, in that repository’s `.codex/config.toml` (not the user profile):

```toml
[mcp_servers.nexus_local_runtime]
command = "pnpm"
args = ["--dir", "C:\\path\\to\\nexus-brain", "--filter", "@nexus-brain/edge", "mcp:stdio"]
cwd = "C:\\path\\to\\nexus-brain"
env = { NEXUS_BRAIN_ROOT = "C:\\path\\to\\workspace" }
enabled_tools = ["mcg_read_batch"]
```

Both examples require the repository dependencies to be installed first. After registration, verify tool discovery and a read-only call in the client. Claude project servers require workspace trust/approval; Codex loads project `.codex/` configuration only for trusted projects. Neither client configuration is checked into this repository because the workspace root is machine-specific.

## Tests

```powershell
pnpm test:integration
node tooling/scripts/check-syntax.mjs
node tooling/scripts/scan-sensitive.mjs
```
