# NB-08 Hybrid Retrieval progress

**Status:** DONE — PR #124 was squash-merged into `main` as `25265fc7747614bc70db06f8a11db88161648e83`.
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

## GitHub Actions evidence

PR [#124](https://github.com/trydavidqix/nexus-brain/pull/124) final head `e4231f0128f69b83e9aa276957f0c577cf1fe37f` passed all listed checks: Windows CBM fixture, MCG, OpenTofu, CodeQL, dependency review, Gitleaks, Jazzer.js, Semgrep OSS/SAST, ZAP baseline, and OSV Scanner. Workflow runs: `36508311391`, `36508315226`, `36508315244`, `36508315250`, `36508315344`, and `36508315379`. PR #124 was squash-merged as `25265fc7747614bc70db06f8a11db88161648e83`; `main` was fast-forward-synchronized to that commit and clean.

## Acceptance

- Implementation, tests, independent review, final-head GitHub Actions, PR integration and `main` synchronization are complete.
