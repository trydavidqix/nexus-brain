# NB-06 GitHub indexer progress

**Status:** IN_PROGRESS. Local implementation and validation are present on `codex/nb06-github-project-sync`; required PR checks and review have not run yet.

## Scope delivered locally

- Added `@nexus-brain/github-indexer`: bounded, read-only GitHub REST client; HMAC-verified push ingestion; loopback-only HTTP endpoint; non-overlapping reconciliation scheduler; PostgreSQL/pg0 durable store and additive migration.
- Records branch heads, commit provenance, and branch/commit relationships. Delivery IDs are idempotent; snapshots guard against stale webhook/reconciliation writes.
- Branch deletion webhooks write tombstones. Complete scheduled inventories tombstone missing branches and preserve newer concurrent observations. A missing default branch or duplicate inventory fails closed before tombstoning.
- This package does not register external webhooks, expose a public listener, create cloud resources, or change billing. Local scheduled reconciliation remains available; reachable ingress requires a separately approved endpoint/configuration.

## Validation evidence (local)

- `pnpm --dir packages/github-indexer test:unit`: 15 passed.
- `pnpm --dir packages/github-indexer test:pg0-integration`: 1 passed against a temporary isolated schema in existing local pg0; covers migration idempotency, delivery reuse protection, HTTP webhook persistence/idempotency, stale head guard, deletion tombstone, branch reactivation, and missing-branch reconciliation. The test drops only its own randomly named schema.
- `pnpm test:integration`: 26 passed.
- `pnpm test:git-naming`: 16 passed.
- `pnpm test:engineering-gates`: 47 passed.
- `pnpm check:architecture`: passed for 14 packages.
- `pnpm check:syntax`: 162 modules parsed.
- `pnpm scan:sensitive`: passed across 348 files.
- `pnpm -r --if-present typecheck`: all applicable package typechecks passed.
- Live GitHub REST read-only smoke using the new client: 10 branches observed; `main` head matched the fetched latest commit. One branch-list request and one head-commit request; no token supplied.
- Codex Security diff scan `96598676-e48f-45da-8bb6-4650e74ef35e`: complete coverage of seven changed source/control files, zero candidates/findings. Scan snapshot `codex-security-snapshot/v1:sha256:4d65614a56f25177a9ec6d8417087bb7e0a9ada22dee790478683a6e13004ed3`. Parent-only review followed the no-subagent instruction.
- `git diff --check`: passed before documentation finalization; rerun before commit.

## Remaining acceptance gates

1. Final diff and security review on the exact PR snapshot.
2. Required GitHub CI/security checks and review on a PR; no direct main changes.
3. Merge only when repository rules pass, then synchronize local main and verify a clean working tree.

NB-06 remains IN_PROGRESS until those gates pass. NB-06A must not start before NB-06 is accepted.
