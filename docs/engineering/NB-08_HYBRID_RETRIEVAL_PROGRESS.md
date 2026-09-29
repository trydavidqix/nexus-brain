# NB-08 Hybrid Retrieval progress

**Status:** IN PROGRESS — local validation and independent review pass; final PR checks and integration remain pending.
**Dependencies:** NB-05 and NB-07 are accepted on `main`.
**Branch:** `codex/nb08-hybrid-retrieval`.
**Scope:** project memory, Code Intelligence and governed research-evidence retrieval; bounded research fanout; normalized, deduplicated and ranked evidence; grounded findings; scoped cross-project reuse; abstention and partial coverage.

## Implementation

- Project memory retrieval runs before optional global reuse. Global reuse requires explicit request and the configured reuse authorizer.
- Retrieval adapters receive project/task/agent identity; project memory remains project-scoped, task records enforce task and agent identity, and prior research evidence is explicitly filtered to project/task/agent. External evidence remains untrusted and is redacted before returning.
- Research calls use Maestri-owned zero-cost budgets and bound queries, providers, results and wall time.
- A shared deadline covers each retrieval stage, authorization, Reach, and persistence. At the deadline, completed evidence is returned as `PARTIAL`; when no evidence is available, the result is `TIMEOUT`.
- Existing adapters do not accept an abort signal. Calls already in progress may continue in background after the engine returns; this does not delay the bounded response.

## Local validation

Run on 2026-09-29 after the final code change:

| Check | Result |
|---|---|
| `pnpm --dir packages/brain test:unit` | PASS — 57 Node tests and 1 Vitest test |
| `pnpm --dir packages/brain typecheck` | PASS |
| `pnpm --dir packages/contracts test:unit` | PASS — 46 Node tests and 1 Vitest test |
| `pnpm --dir packages/contracts typecheck` | PASS |
| `pnpm test:integration` | PASS — 26 tests |
| `pnpm check:architecture` | PASS — 16 packages |
| `pnpm scan:sensitive` | PASS — 365 files |
| `pnpm install --frozen-lockfile --ignore-scripts` | PASS — pnpm 9.15.9 |
| `node --test packages/brain/tests/research-engine.test.mjs` | PASS — 8 tests, including stuck retrieval and partial provider timeout cases |
| `git diff --check` | PASS |

## Independent review

Final read-only review approved the implementation. It confirmed project/task/agent scope, opt-in authorized global reuse, untrusted evidence handling, the shared deadline, and preservation of provider results completed before timeout. No contract or security blocker remains. The background continuation limitation above is documented.

## Pending integration gates

- Create and push the NB-08 pull request.
- Pass required GitHub Actions on the final PR head.
- Complete integration and synchronize `main` before marking NB-08 DONE.
