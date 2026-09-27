# NB-04: Canonical Memory Integration

**Status:** Acceptance evidence complete on `codex/nb04-temporal-provenance-prep`; PR #73 carries the integration. NB-04 is marked `DONE` in the Blueprint after the gates below. Main integration remains pending PR checks and merge.

## Authority and scope

- Nexus owns canonical memory lifecycle, identity, project/scope, ACL, provenance, validation, and context delivery.
- Local PostgreSQL on Hindsight's pg0 instance is authoritative for versioned Nexus memory, events, research runs, raw evidence, and sightings. Hindsight V1 is a replaceable derived retrieval/index engine.
- `createLocalHindsightMemoryEngine()` migrates the local schema and requires an explicit ACL read authorizer. Promotion to `VERIFIED` or `CANONICAL` fails closed unless an explicit validation authorizer approves it. `reflect` always returns an unpersisted `CANDIDATE`.
- Hindsight accepts only `SYNTHETIC` or `NON_SENSITIVE` content. Raw research evidence is stored separately with `UNTRUSTED` trust level and is never indexed automatically.
- Project and global banks are separate. Global retrieval is opt-in. Project retrieval does not inherit the current task or agent tags. `TASK` retrieval requires both `task_id` and `agent_id`; the canonical database checks project, scope, task, and originating agent again.
- `packages/brain/src/memory.mjs` remains the legacy MCG JSONL compatibility API. No production caller of its write/retrieval helpers was found. The default `.nexus-state/state/memory` directory did not exist on 2026-09-27; `NEXUS_BRAIN_STATE` and `MCG_ROOT` were unset, so no JSONL memory rows required import. Existing evaluation artifacts were not read or migrated.

## Implemented records and migrations

- `memory-record.v1` stores data classification with canonical scope, temporal facts, evidence references, provenance, ACL, lifecycle status, and version.
- `memory-event.v1` stores append-only lifecycle and use records. Hindsight recall results are resolved back to canonical rows before return; foreign, stale, conflicted, revoked, wrong-scope, or unauthorized rows are excluded.
- `0001_canonical_memory.sql` creates canonical memory, event, research-run, evidence, and sighting tables.
- `0002_memory_scope_bindings.sql` enforces scope/project/session/task/agent bindings.
- `0003_research_provenance.sql` enforces project-matched run/evidence foreign keys, preserves normalized evidence metadata, and blocks update/delete/truncate on append-only provenance and event tables.
- Raw evidence remains `UNTRUSTED`. Research runs, evidence, and sightings use separate typed insertion methods and do not invoke Hindsight.

## Validation evidence — 2026-09-27

- Brain unit tests: 26/26; Brain Vitest type test: 1/1.
- Contracts tests: 36/36; contract Vitest type test: 1/1.
- Workspace integration tests: 26/26.
- Workspace typechecks: 13 package projects passed. Architecture check: 13 packages passed. Syntax/import smoke: 151 modules. Sensitive-data scan: PASS (321 files).
- Live local E2E: pg0 migration 0003 applied; canonical database and Hindsight healthy; project/global retain and scoped recall passed; global retrieval required explicit opt-in; ACL checks passed; one reflect candidate returned without persisting response text.
- Hindsight LLM-request registry for the live reflect call recorded `provider=openai-codex`, `model=gpt-6-luna`, `status=success`, `operation=reflect`. No key was read or logged; no Gemini request was made.
- Real PostgreSQL checks inserted one synthetic research run, one `UNTRUSTED` evidence row, and one sighting. Cross-project evidence linkage was rejected. Update, delete, and truncate attempts against append-only data were rejected.
- Backup `nexus-hindsight-20260927-230823-147.dump`; SHA-256 `2db474fc18f289f83844049ee55ec0af0e72d233dafd0fa8df7869089566b0ae`. Isolated pg0 restore verified 30 public tables, all 6 NB-04 tables, all 3 migration versions, and matching source/restore row counts `5|10|1|1|1` for memory records, memory events, research runs, evidence, and sightings.
- The same backup restored into an isolated standalone PostgreSQL 18.1 server on loopback with pgvector enabled. The five canonical row counts matched. The standalone test used UTF-8 initialization to preserve UTF-8 data on Windows.
- No cloud resource, Google project, billing setting, or API key changed.

## Migration and restore boundary

The pg0 database uses PostgreSQL's logical dump/restore format. DEV migration to external PostgreSQL remains a local-only rehearsal in this milestone; production cutover and cloud resources are out of scope. Future cutover must retain the dump/checksum, validate row counts and scope invariants, preserve Hindsight schema and pgvector, and keep a rollback backup. Older PostgreSQL major versions require a separate compatibility review; no downgrade was attempted.

## Final gate

NB-04 acceptance is backed by code, tests, live integration, scope/ACL invariants, security scans, and restore/import evidence. PR #73 must pass required GitHub checks and merge before the next milestone starts.
