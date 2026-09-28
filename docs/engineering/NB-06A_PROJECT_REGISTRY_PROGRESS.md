# NB-06A Project Registry progress

**Status:** IN_PROGRESS on `codex/NB-06A-project-registry`, based on `main` at `f688a5c5815ccb90e7a7bf5d5590d74df0b8a74f`.
**Owner decision date:** 2026-09-28.
**Validation:** implementation and tests are present on this branch; static review passed. GitHub Actions are pending. No local tests or typechecks are run on this PC.

## Approved decisions

- SQLite StateStore is the sole authority for Nexus operational project records. Hindsight's PostgreSQL/pg0 remains private to its memory engine.
- Preserve the closed Project v1 contract. Add Project v2 for the typed workspace binding extension; keep existing v1 snapshots readable without rewriting them.
- Project v2 requires `workspace_bindings`; an empty list means no workspace. Entries use `{ kind: "local", location: <non-empty opaque string> }`. Multiple entries are allowed. Registration does not normalize or inspect a location, create a workspace, or move/copy repository data.
- `repo` stays opaque and unchanged. Different `project_id` values may reference the same exact repository locator. Registration and lookup use `project_id`; automatic repository lookup/deduplication is prohibited.
- Project v2 uses logical memory namespace `project:<project_id>`. The existing Hindsight adapter continues deriving its physical bank ID from `project_id` and enforcing NB-04 scope tags/ACL.
- Keep existing Project v1 policy, permission, budget, memory, Git, CI, deployment and provider-constraint containers. New code-index, research, source and provider-binding schemas belong to their owning milestones.
- No cloud resources, billing changes, paid providers, PROD, Lumenva, or PR #72.

## Acceptance gates

1. Project v2 schema, TypeScript type and validation enforce typed local workspace bindings and the logical memory namespace invariant.
2. StateStore records explicit contract version separately from optimistic record revision and preserves existing v1 JSON snapshots during migration.
3. Registry registration is idempotent by `project_id`; conflicting reuse fails closed. Updates cannot change `project_id` or silently downgrade v2 to v1.
4. Distinct projects can retain the same opaque `repo` locator without collision. Reads and Goal access remain project-scoped.
5. Workspace values are stored exactly as supplied; no filesystem mutation or path probing occurs.
6. Project state, append-only event and outbox row commit atomically. No partial writes after invalid contracts or failed writes.
7. Required GitHub Actions checks pass, independent review finds no blocker, branch is integrated by squash, and `main` is clean/synchronized.

## Current evidence

- Main includes NX-03 StateStore Project/Goal v1 from PR #118 (`f688a5c5815ccb90e7a7bf5d5590d74df0b8a74f`). Its GitHub checks passed.
- This branch adds the Project v2 schema and typed local workspace bindings, `registerProject`, the additive StateStore contract-version migration, and focused contract, state, and Hindsight isolation tests.
- Static review passed for the code and test diff. GitHub Actions have not run yet; no NB-06A validation gate is claimed complete until fresh CI evidence is recorded here.
