# NB-04: Canonical Memory Preparation

**Status:** Preparatory contracts and SQL draft in progress. Canonical DB integration, Hindsight adapter cutover, and restore verification remain `BLOCKED_ON_NB03_FINAL_VALIDATION`.

## Authority and scope

- Nexus owns canonical lifecycle, project/scope policy, provenance, ACL decisions, conflict handling, and context delivery.
- Hindsight remains the replaceable V1 engine for retrieval and indexing. Its output stays `OBSERVED` or `CANDIDATE` until Nexus validation and evidence gates pass.
- Existing `packages/brain/src/memory.mjs` remains the current JSONL authority under ADR 0002. New PostgreSQL contracts and migration do not replace it before adapter and migration/restore tests pass.
- The project bank and separate global bank stay distinct. Session/task scope requires a project ID and remains scoped inside that project; default cross-project retrieval stays denied.
- Web evidence remains `UNTRUSTED` and separate from canonical memory promotion.
- The draft uses portable PostgreSQL types and no vector column. Hindsight owns vector indexes; this avoids a second embedding/index authority and keeps pg0-to-PostgreSQL dump compatibility.

## Artifacts prepared

- `memory-record.v1` adds provenance, temporal facts, evidence, ACL permission references, scope, and lifecycle state.
- `memory-event.v1` records append-only lifecycle and use events: `RECALLED`, `SELECTED`, `INJECTED`, `USED`, `VALIDATED`, and `CONTRIBUTED`.
- `packages/brain/migrations/0001_canonical_memory.sql` drafts current-record projections and append-only event storage. It enforces scope/project, valid-time, evidence, and usage identity invariants.
- SQL includes append-only mutation guards. It defines no cloud database, project, region, role, provider, or vector store.

## Restore and external-PostgreSQL gate

Do not apply the SQL or run a restore test until NB-03 confirms the installed Hindsight/pg0 version, persistent data directory, supported local connection path, and backup format. Then use a unique create-only local dump, SHA-256 verification, isolated local scratch restore, row/content-hash and lifecycle checks, and a second dump comparison. Keep secrets out of the manifest and command output. No cloud resource is part of this rehearsal.

The current branch only validates schemas and SQL invariants statically. It does not claim PostgreSQL syntax validation, database connectivity, restore success, Hindsight integration, or NB-04 completion.

## Preparation validation (2026-09-27)

- Focused memory-contract and draft-schema tests: 7/7 passed.
- Workspace unit tests: all 13 packages passed, including the canonical memory and SQL guard tests.
- Workspace integration tests: 20/20 passed.
- Workspace typechecks: all 13 packages passed.
- Architecture check: passed for 13 packages; syntax/import smoke: 139 modules; sensitive-data scan: 296 files.
- These checks validate the preparatory code only. The SQL remains unapplied and static; live PostgreSQL/Hindsight integration and restore proof remain blocked on NB-03 final validation.
