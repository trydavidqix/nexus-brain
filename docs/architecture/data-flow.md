# Current data flow

```text
Codex project MCP configuration
  → tooling/scripts/run-edge-mcp.mjs
  → apps/edge MCP bridge
  → bounded read-only batch / Git read adapter
  → packages/context-gateway, brain, contracts and evidence
  → local state under .nexus-state (not tracked by Git)
  → apps/control-center read-only API/UI on loopback
```

NB-04 canonical memory flow is a separate local package boundary. No public Brain API is exposed yet; that belongs to NB-05.

```text
Nexus Brain caller with explicit project/task/agent identity
  → @nexus-brain/brain/local-memory
  → MemoryEngine (contract, scope, ACL and lifecycle gates)
  → local PostgreSQL/pg0 canonical records and append-only provenance
  → loopback Hindsight adapter (derived project/global retrieval index)
  → authorized canonical records or unpersisted CANDIDATE reflection
```

Hindsight provider use defaults to existing Codex OAuth. Only `SYNTHETIC` or `NON_SENSITIVE` content reaches Hindsight. Project and global retrieval are separate; global retrieval requires explicit opt-in. Task retrieval includes both `task_id` and `agent_id`. Raw web evidence remains `UNTRUSTED` in canonical PostgreSQL and is never indexed automatically.

Optional Wire requests use the Edge bridge only when local Wire configuration and credentials are present. No Wire server, Maestri process, or cloud database is assumed available. Unknown measurements are reported as unavailable; estimated context/token metrics are not labeled exact. Cloud ingestion and the public Brain API remain later Blueprint work.
