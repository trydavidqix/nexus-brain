# NB-06 GitHub indexer progress

**Status:** DONE through squash merge PR #114, merge commit `a9c0e519071d3f7ed4b9bc09d9cc8433ccf2dbc3` on 2026-09-28. Canonical `main` is synchronized to this commit. Next eligible milestone: NB-06A.

## Scope delivered locally

- Added `@nexus-brain/github-indexer`: bounded, read-only GitHub REST client; HMAC-verified push ingestion; loopback-only HTTP endpoint; non-overlapping reconciliation scheduler; PostgreSQL/pg0 durable store and additive migration.
- Records branch heads, commit provenance, and branch/commit relationships. Delivery IDs are idempotent; snapshots guard against stale webhook/reconciliation writes.
- Branch deletion webhooks write tombstones. Complete scheduled inventories tombstone missing branches and preserve newer concurrent observations. A missing default branch or duplicate inventory fails closed before tombstoning.
- This package does not register external webhooks, expose a public listener, create cloud resources, or change billing. Local scheduled reconciliation remains available; reachable ingress requires a separately approved endpoint/configuration.

## Validation evidence (local)

- `pnpm --dir packages/github-indexer test:unit`: 15 passed.
- `pnpm --dir packages/github-indexer test:pg0-integration`: 1 passed against a temporary isolated schema in existing local pg0; covers migration idempotency, delivery reuse protection, HTTP webhook persistence/idempotency, stale head guard, deletion tombstone, branch reactivation, and missing-branch reconciliation. The test drops only its own randomly named schema.
- The aggregate final validation run once returned HTTP 503 for one concurrent webhook request. The isolated pg0 integration then passed eight consecutive runs (one isolated rerun, six-run sequence, and final run); no persistent reproduction or exact internal exception was captured. GitHub required CI and security checks also passed. Keep the sanitized service response and store error boundary in place; investigate if this recurs.
- `pnpm test:integration`: 26 passed.
- `pnpm test:git-naming`: 16 passed.
- `pnpm test:engineering-gates`: 47 passed.
- `pnpm check:architecture`: passed for 14 packages.
- `pnpm check:syntax`: 162 modules parsed.
- `pnpm scan:sensitive`: passed across 348 files.
- `pnpm -r --if-present typecheck`: all applicable package typechecks passed.
- Live GitHub REST read-only smoke using the new client: 10 branches observed; `main` head matched the fetched latest commit. One branch-list request and one head-commit request; no token supplied.
- Codex Security diff scan `96598676-e48f-45da-8bb6-4650e74ef35e`: complete coverage of seven changed source/control files, zero candidates/findings. Scan snapshot `codex-security-snapshot/v1:sha256:4d65614a56f25177a9ec6d8417087bb7e0a9ada22dee790478683a6e13004ed3`. Parent-only review followed the no-subagent instruction.
- `git diff --check`: passed before commit.

## Acceptance gates completed

- Final diff and security review completed; Codex Security scan recorded zero findings with complete coverage of seven changed source/control files.
- All 14 GitHub check runs passed, including CodeQL, Gitleaks, Jazzer, Semgrep, dependency review, OSV, ZAP, MCG, and OpenTofu.
- PR #114 merged by squash; local canonical `main` fast-forwarded to the merge commit and was clean.

The package intentionally does not register an external webhook or expose public ingress. Local scheduling and loopback webhook primitives are implemented; a reachable external endpoint remains out of scope under the zero-cost boundary. NB-06A may proceed after this evidence update lands.
