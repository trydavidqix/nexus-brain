# NB-04: Canonical Memory Integration

**Status:** NB-04 `DONE`, merged into `main` by PR #73 as `12997f220dff5a5540411d1c7af5ae03de5fbbde` on 2026-09-27. Acceptance evidence and required PR checks passed.

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

NB-04 acceptance is backed by code, tests, live integration, scope/ACL invariants, security scans, restore/import evidence, and passing required GitHub checks. PR #73 is merged. NB-05 remains gated until Migration Readiness is fully validated.

## Supplemental live E2E revalidation — 2026-09-28 01:48 Europe/Lisbon

- `createLocalHindsightMemoryEngine()` connected to the local pg0 store and Hindsight API; health, synthetic canonical retain, permission-scoped recall, and reflect all passed.
- Recall returned the exact synthetic candidate after canonical project/scope/ACL filtering. Reflect returned an unpersisted `CANDIDATE`; `NB04_REFLECT_CODEX_PASS` was checked in memory. Response content was not printed or saved.
- Hindsight `llm_requests` recorded the reflect operation as `openai-codex` / `gpt-6-luna` / `success`; three successful `reflect_tool_call` entries were recorded at 01:48:37, 01:48:39, and 01:48:42 Europe/Lisbon.
- The canonical synthetic test record had a ten-minute validity window. No Gemini key/request, Google project or billing setting, cloud resource, or production data changed.

## Fresh integrated E2E — 2026-09-28

- One local run passed Hindsight and pg0 health, synthetic canonical retain, project recall of that exact record with the explicit `read:nexus-brain` ACL, and reflect.
- Reflect returned the expected synthetic token `NB04_REFLECT_CODEX_PASS`; the response body stayed in memory and was not printed or saved. The reflect result remained an unpersisted `CANDIDATE`.
- The Hindsight `llm_requests` registry recorded `provider=openai-codex`, `model=gpt-6-luna`, `status=success`, `operation=reflect`, and `scope=reflect_tool_call`.
- The retained test record is synthetic, task-scoped, and expires for retrieval after ten minutes. No Gemini credential/request, Google project or billing setting, cloud resource, or production data was involved.

## TASK-scope lifecycle fix and fresh E2E — 2026-09-28

- A fresh task-isolated E2E exposed a PostgreSQL retention failure before Hindsight indexing. The canonical lifecycle event omitted `agent_id`; the applied TASK-scope constraint requires both `task_id` and `agent_id`, so the transaction rolled back without partial writes.
- The regression test `persisted task lifecycle event carries originating agent binding` first failed with `null !== 'agent-1'`. `PostgresMemoryStore.persistRecord()` now copies `record.provenance.actor_id` into `agent_id` for TASK-scope lifecycle events. The focused store suite passes 7/7; Brain unit tests and typecheck pass.
- A fresh local E2E then passed: Hindsight/pg0 health, canonical TASK retain and indexing, one extracted memory unit, exact raw tag-scoped recall, canonical recall constrained by task, originating agent, and explicit ACL, then an unpersisted `CANDIDATE` reflect.
- The reflect marker matched in memory and was not printed or persisted. Hindsight `llm_requests` recorded successful `openai-codex` / `gpt-6-luna` traces for `retain` (`retain_extract_facts`) and `reflect` (`reflect`). The test record expires for retrieval after ten minutes.
- The first placeholder test sentence produced zero extracted memory units; the final synthetic assertion produced one. No Gemini call/key, Google project or billing change, cloud resource, or production data was involved.
