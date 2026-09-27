# Edge — current code

Canonical owner: `apps/edge`.

The app contains the existing Local Runtime MCP bridge, bounded read-only `mcg_read_batch` tool, Git read adapter, daemon control, and optional Maestri Wire client. The MCP launcher is `tooling/scripts/run-edge-mcp.mjs`; project Codex configuration points to this launcher. The standalone Nexus gateway and dashboard do not require Wire or the Maestri application.

The legacy Windows MCG daemon is not part of the required standalone runtime and is being disabled. No active daemon was observed in the latest Windows audit; the startup shortcut and stale MCP sessions still require cleanup/reload. The reusable Edge bridge and Token Firewall code remain in the repository.

## Everything Journal adapter (NB-10)

`@nexus-brain/edge/everything` provides a bounded Windows filesystem-change source using the Everything 1.5 Index Journal. Journal polling reads event metadata only; it does not read changed file contents. Its optional read-only Git fallback may return diff content (bounded to 512 KiB), so callers must treat that output as workspace data and apply context policy before forwarding it. Configure explicit project roots and keep the cursor under `%LOCALAPPDATA%\Nexus\EverythingEdge`, outside every indexed root. The first poll stores a baseline and emits no historical events. Journal resets also create a new baseline instead of replaying unrelated history.

The adapter excludes `.git`, `node_modules`, build/cache folders, logs, and temporary files by default. It bounds each journal response and falls back to read-only Git status/diff snapshots when the 1.5 Journal is unavailable. `BurstAggregator` groups rapid events per project for four seconds and coalesces repeated changes.

`infra/local/everything/start.ps1` starts a hidden, named, portable Everything instance scoped only to the supplied Nexus project root. It disables automatic volume indexing, does not register a startup task, verifies the official archive SHA-256 and executable signature, and stores installation/database/cursor state under the local user profile. This local adapter adds no recurring cloud cost.
