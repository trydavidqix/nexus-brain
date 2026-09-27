# NB-05 Brain API and MCP progress

**Status:** IN_PROGRESS
**Branch:** `codex/nb05-brain-api-mcp-contract`
**Base:** `main` at `1cbdf841bbe91e333280bf9c4c612f1255064116`

## Implemented boundary

- `packages/brain/src/brain-api.mjs` routes provider-neutral Brain operations to injected context, memory, code-search, and Reach adapters.
- API construction requires an injected trusted authenticator. Missing, failed, or mismatched authentication fails closed; capability checks happen before adapter calls.
- Requests bind project/task/agent/session identity. Global memory access and global remember require separate grants. Remember accepts only OBSERVED/CANDIDATE records and checks project/task/agent provenance.
- Before retain, TASK records must match the authenticated task in both `task_id` and `scope_id`; SESSION records must match the authenticated session in both `session_id` and `scope_id`.
- Search and Reach require explicit SYNTHETIC or NON_SENSITIVE classification. External Reach results remain UNTRUSTED. Input, query, result, top-k, edit-context path, and output sizes are bounded.
- `apps/edge/src/bridge/brain-mcp-server.ts` exposes only `nexus_brain` and `nexus_reach`, validates strict tool schemas, forwards MCP context to the authenticator, and emits sanitized errors.

## Validation evidence

- Brain unit: 42 Node tests and 1 Vitest test passed.
- Edge unit: 46 tests across 9 files passed.
- Workspace integration: 26/26 passed.
- Typecheck: 13 projects passed.
- Architecture checks: 13 packages passed.
- Syntax: 153 modules parsed.
- Sensitive-data scan: 324 files passed.
- Targeted review found that task/session candidates could name a different storage partition despite authenticated provenance. Regression tests reproduced both cases before the fix; the API now rejects mismatched task/session partition IDs before calling the memory adapter.
- Final Codex Security diff review: 0 reportable findings across the reviewed NB-05 change set. Coverage is partial because trusted identity issuance and Reach hard-budget policy remain unresolved. No live API deployment or external Reach provider is in scope.

## Unresolved gates

1. **Trusted identity issuer/transport:** current contracts define identity and permission shapes without selecting a trusted issuer, token format, or MCP transport binding. The API seam fails closed and accepts an authenticator only as a trusted injected dependency. Do not wire a production or remote MCP server until the existing Maestri/service identity path is identified or the Owner selects one.
2. **Reach hard limits:** the Blueprint requires bounded research/web work and assigns budgets to Maestri, but no canonical server-enforced maxima for queries, providers, results/provider, wall time, or cost are defined. No external Reach provider is wired. Define or identify the trusted policy source and enforce its caps before connecting a provider.

These gates prevent claiming NB-05 DONE. Provider agents cannot self-assert identity, capabilities, or resource budgets through this API.

## Security review scope

The final diff review covered the Brain API, MCP bridge, declarations, package manifests, lockfile, new Brain/Edge tests, and progress docs against baseline `1cbdf841bbe91e333280bf9c4c612f1255064116`. It found no reportable issue after the task/session partition fix. Coverage is partial for the unresolved integration gates above. This is not a repository-wide audit.
