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
- The Owner approved the Nexus Edge gateway as the sole trusted identity source. The gateway adapter supplies its verified principal through server-owned MCP transport context; request identity fields remain claims and must match that principal. No bearer-token format or remote deployment is introduced by NB-05.
- Maestri is the sole trusted Reach budget authority. `resolveReachBudget` returns a task-bound decision with query/provider/result/browser/time limits and an integer USD-micros cost ceiling. Missing, malformed, mismatched, or exceeded budgets fail closed before adapter dispatch; caller-supplied budget fields are removed.
- Reach adapters receive the verified Maestri budget separately from caller input. No external Reach provider is wired until Maestri budget resolution is integrated and provider enforcement is verified.

## Validation evidence

- Brain unit: 42 Node tests and 1 Vitest test passed.
- Edge unit: 46 tests across 9 files passed.
- Workspace integration: 26/26 passed.
- Typecheck: 13 projects passed.
- Architecture checks: 13 packages passed.
- Syntax: 153 modules parsed.
- Sensitive-data scan: 324 files passed.
- Targeted review found that task/session candidates could name a different storage partition despite authenticated provenance. Regression tests reproduced both cases before the fix; the API now rejects mismatched task/session partition IDs before calling the memory adapter.
- Final Codex Security diff review: 0 reportable findings across the reviewed NB-05 change set. The review covered the contract boundary; it does not claim a live gateway deployment or external Reach provider. Those integrations remain gated on their later Blueprint packages.

## Approved trust decisions

1. **Identity issuer and transport:** Nexus Edge gateway is the trusted issuer. Only its server-verified principal may enter through trusted transport context. Client-provided project/task/agent/session fields never establish identity; the authenticator must bind and match them to the verified principal.
2. **Reach hard limits:** Maestri supplies task-bound, capability-specific hard limits and cost ceiling. Brain API validates the source decision, scope, and limits, rejects requests above the limits, strips caller-supplied budget fields, and passes the verified budget to the adapter.

Provider agents cannot self-assert identity, capabilities, or resource budgets through this API. Maestri and gateway runtime wiring remain follow-on integration work; until those adapters are connected, missing trust inputs fail closed.

## Current validation evidence (2026-09-28)

- Brain unit: 45 Node tests and 1 Vitest test passed.
- Edge MCP unit: 46 tests across 9 files passed.
- Workspace integration: 26/26 passed.
- Brain and Edge typechecks passed; workspace architecture check passed for 13 packages.
- Syntax/import smoke: 153 modules parsed. Sensitive-data scan: 324 files passed. `git diff --check` passed.
- Codex Security diff scan `d1c2adc4-282f-4fe1-9834-ba590885a7f5`: complete coverage of both changed implementation files; 0 findings. The test file received additional assertions after the scan snapshot; those assertions passed in the final local test run. This is not a live gateway or provider integration test.

## Security review scope

The final diff review covered the Brain API, MCP bridge, declarations, package manifests, lockfile, new Brain/Edge tests, and progress docs against baseline `1cbdf841bbe91e333280bf9c4c612f1255064116`. It found no reportable issue after the task/session partition fix. The Owner's trust decisions are now represented as fail-closed contracts and tests; this is not a repository-wide audit or live gateway/provider verification.
