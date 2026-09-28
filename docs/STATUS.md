# Repository status

This repository is the canonical home for Nexus Brain (`trydavidqix/nexus-brain`). Maestri Context Gateway (MCG), extracted from Lumenva on 2026-09-23, is one internal module. This repository contains its current source, contracts, configuration templates, registries, tests, evaluation datasets, and CI; other Nexus modules remain tracked in the active blueprint until transferred and verified.

## Current authoritative snapshot — 2026-09-28

- PR #96 records the fresh NB-04 E2E and NB-29 forensic findings; it merged by squash with all required and report-only checks successful. Local `main` was clean and synchronized with `origin/main` after that merge. Migration PRs #43, #49, #73–#75, #79–#86, and #88–#96 are merged with successful recorded checks. PR #87 was closed after its naming-gate failures and superseded by merged PR #88. PR #81 remains a draft with passing checks and `mergeStateStatus=DIRTY`; it is gated and unchanged.
- NB-03 is `DONE` under the Owner decision: existing Codex OAuth satisfies the provider gate; Gemini Free Tier is optional. Live Hindsight evidence confirms `/health=200`, reflect HTTP 200, and `openai-codex` / `gpt-6-luna` / `success`. No Gemini key, Google billing, or cloud resource changed. See [`NB-03 revalidation`](engineering/NB-03_CODEX_OAUTH_REVALIDATION_2026-09-27.md).
- NB-04 is `DONE`. Fresh local E2E passed health, synthetic retain, project recall with ACL filtering, reflect token, and Hindsight provider trace (`openai-codex` / `gpt-6-luna` / `success`). The response content was not printed. Code, restore, append-only, ACL/scope, and PostgreSQL compatibility evidence remains in [`NB-04 preparation`](engineering/NB-04_PREPARATION.md).
- NB-19 G0–G10 is `DONE`; active protected-main ruleset `24075255` is enforced with no bypass actors, PR-only squash, linear history, non-fast-forward/deletion blocks, and the required CI/security checks. NB-24–NB-28 remain complete.
- NB-29 is `PENDING_VALIDATION`. The preserved Nexus worktree gate is reconciled. The historical 417-file inventory is still unaccounted for: current `.mcg-state` has 2 files, current `.nexus-state` has 8, and only the two eval artifacts match by path, size, and SHA-256. Everything/`es.exe` and `Get-FileHash` work. USN journal metadata is readable, but `fsutil usn readjournal` and VSS enumeration require an elevated token; journal period coverage is therefore unverified. Evidence and the partial current-file manifest are in [`NB-29 cutover revalidation`](engineering/NB-29_CUTOVER_REVALIDATION_2026-09-28.md).
- Do not start NB-05 or later Blueprint implementation until the 417-file state is reconciled. Dependabot PRs #61 and #62 and plan PR #78 are outside this closeout and remain unchanged. DEV remains local-first and zero-additional-cost; no PROD, paid cloud provisioning, billing change, Gemini API key, or paid fallback is authorized.

## Historical migration snapshot — 2026-09-26

Migration PR #44 merged to `main` as `e5f3b14f6a2cb36a4830d5b9d8e9767557713bed`; the local `main` is fast-forwarded and clean at the same commit. All post-merge MCG, CodeQL analysis, security-scanning and fuzz workflow runs succeeded. The PR-only CodeQL alert annotation had flagged findings on moved legacy paths; none were dismissed, and the existing alert inventory remains visible. Live Codex eval commands are intentionally excluded because they execute real provider requests; runner behavior is covered by unit/integration tests.

- **Scope:** Migration readiness only. Do not start Blueprint implementation. The reconciled plan has 24 future implementation work packages (`NB-00`–`NB-23`) plus 6 migration-readiness packages (`NB-24`–`NB-29`); six additional migration gates explain the earlier 24-vs-30 count. Only the Master Blueprint is an active tracker.
- **Local code:** 10 packages and 3 apps are organized under canonical owners. Compatibility shims are explicit and optional. MCG/Token Firewall capability remains; Maestri and Wire are not required for standalone Nexus operation. SQL is a schema artifact only, not deployed infrastructure.
- **Windows:** No MCG daemon, Maestri app, Wire process, or old MCP launcher is running. The obsolete Scheduled Task was exported and removed; its Startup shortcut and VBS launcher were moved to the user-profile archive; stale user `MCG_ROOT` was removed. The earlier 417-file inventory could not be reproduced. Two files from an interrupted live eval were copied to ignored `.nexus-state` and SHA-256 verified; originals remain. No other historical state was found or declared migrated.
- **Local path:** The canonical Nexus checkout is `%USERPROFILE%\Desktop\Projetos\nexus-brain`; MCG launchers and project MCP resolve to this checkout. Do not rename it into a Lumenva path or access Lumenva-owned worktrees. The exact `codex/mcg-finalization` Nexus worktree was inspected read-only and accounted for; only the historical MCG state inventory remains an unresolved NB-29 preservation gate.
- **Remote:** PR #44 is merged. Post-merge MCG, CodeQL, Gitleaks, Semgrep, OSV, ZAP and fuzz workflows succeeded. The PR diff alert check had surfaced legacy findings at renamed paths; they remain undismissed and broader security remediation is not claimed. Repository is public, `main` is default, and no branch protection/ruleset was observed; preserve those settings unless separately approved.

The sections below are dated historical snapshots. They are not current instructions when they conflict with this migration snapshot or the Master Blueprint.

## Historical snapshot — 2026-09-25

- Repository: `trydavidqix/nexus-brain` (renamed from `trydavidqix/maestri-context-gateway` on 2026-09-25); local `main` and `origin/main` are synchronized after the blueprint/source consolidation updates.
- PRs #38 (dashboard title/accessibility regression), #39 (security triage/release-gate documentation), #40 (hostile-input redaction fuzz coverage), and #41 (blueprint status consolidation) are historical merged PRs. The rename preserves those records. Recorded MCG gates, security scanning and fuzz workflows passed for product-code SHA `97ccad2`: [MCG](https://github.com/trydavidqix/nexus-brain/actions/runs/36147387550), [security](https://github.com/trydavidqix/nexus-brain/actions/runs/36147387653), [fuzz](https://github.com/trydavidqix/nexus-brain/actions/runs/36147387658). PR #41 checks passed before merge.
- A fresh remote inventory shows only `main`; the open-PR list is empty. Seven exact source emails are in Gmail Trash; their source files remain versioned under `docs/blueprints/sources/`.
- NB-01 branch/ownership and local-path audit found 53 branches in the Lumenva source repository and only `main` in Nexus Brain. The local rename is **BLOCKED**: one MCG daemon and three Local Runtime MCP sessions are running from the old checkout, and the active Codex workspace is rooted there. No source sessions or worktrees were stopped or changed. Details and safe unblock gate: [`blueprints/NB-01_SOURCE_OWNERSHIP_AND_LOCAL_PATH_AUDIT.md`](blueprints/NB-01_SOURCE_OWNERSHIP_AND_LOCAL_PATH_AUDIT.md).
- MCG completion remains **4/7 accepted = 57%**: F0–F2 and F4 accepted; F3, F5 and F6 partial. This percentage is MCG-only, not the Maestri mega-blueprint.
- F3: broader hostile-input fuzz tests are merged; live Codex `mcg_read_batch` use, router checkpoint-hash adoption and provider-backed token/round-trip benchmark remain open. No token savings are claimed.
- F5: PR #38 adds dynamic document-title updates plus a regression test. Reference-image fidelity, screen-reader acceptance and physical touch-device acceptance remain open.
- F6: latest workflow runs passed, but this does not mean zero findings or enforced protection. Fresh read-only GitHub API checks after `97ccad2` show 107 open code-scanning alerts, 0 open Dependabot alerts, 0 rulesets, and `main` unprotected (HTTP 404). Gitleaks 0, OSV 0, and the unconfirmed ZAP possible XSS plus missing headers are findings from the artifact review at `42385fa`, not re-reviewed artifacts for `97ccad2`.
- The sole active plan and Nexus-wide denominator are in [`blueprints/NEXUS_BRAIN_MASTER_IMPLEMENTATION_BLUEPRINT.md`](blueprints/NEXUS_BRAIN_MASTER_IMPLEMENTATION_BLUEPRINT.md). `MASTER_BLUEPRINT_CANONICAL.md` is a historical Maestri source, not a tracker. MCG’s 4/7 (57%) remains component-only.

## Initial extraction snapshot (historical)

- Source snapshot: Lumenva PR #26, commit `0901c57c`.
- Unit tests: 36/36 pass.
- Dashboard smoke tests: 14/14 pass.
- Contract smoke: pass.
- Syntax/import smoke: 30 modules pass.
- Sensitive-data/path scan: pass on the extracted tree.
- New repository CI: pass on the initial extraction commit.

## Dashboard and daemon lifecycle — 2026-09-23

- Daemon integration tests exercise inbox processing, restart recovery, dashboard health, duplicate-start rejection, stale PID recovery, and graceful stop on Windows.
- Graceful stop uses an authenticated loopback control endpoint; the daemon does not kill arbitrary processes by PID.
- Windows current-user autostart is installed as a limited-privilege Scheduled Task at logon. The dashboard itself remains manually launched.
- Dashboard CLI accepts `--port` so this checkout can run beside an older MCG dashboard instance without replacing it.
- Validation (latest branch run, 2026-09-23): 44/44 tests pass; syntax/import smoke parses 33 modules; PowerShell parser and sensitive-data scan pass. The Scheduled Task is registered and verified for the current user with an at-logon trigger, Interactive logon, Limited run level, IgnoreNew duplicate policy, and three restart attempts.

## Historical dashboard reports and Token Firewall snapshot — 2026-09-24 (superseded by current snapshot above)

- Single active cross-blueprint plan: [`blueprints/NEXUS_BRAIN_MASTER_IMPLEMENTATION_BLUEPRINT.md`](blueprints/NEXUS_BRAIN_MASTER_IMPLEMENTATION_BLUEPRINT.md). MCG evidence remains tracked in this status file and its MCG work package.
- Consolidated progress: **3/7 phases accepted = 43%**. This uses a broader denominator than the former 2/6 dashboard-only tracker; it is a scope reconciliation, not newly completed work.
- Phases 0–2 are accepted. Phase 3 Token Firewall is partial and not accepted; PR #19 adds secret-redacted task-result drill-through, PR #22 extends redaction to replay/evaluation artifacts, PR #23 adds normalized process status/output provenance, PR #25 adds a bounded typed Local Runtime batch API, PR #26 adds symlink/removal/oversize boundary tests, PR #28 adds SHA-256 `read-if-changed`, and PR #29 exposes one bounded `mcg_read_batch` stdio MCP tool. MCP client integration tests verify discovery and a batched read, but no provider session has been registered or tested, and no reduction in model round-trips/tokens is claimed. Git checkpoint reuse and provider-backed comparative benchmark remain open. Phases 4–6 (14 reports, reference-faithful dual theme/accessibility, final eval/benchmark/release) remain open.
- Jules drafts/session `6700594731787502098` remain paused/unaccepted and are not part of the accepted branch. Do not count them as implementation evidence.
- `superpowers/plans/2026-09-23-dashboard-reports-token-firewall.md` is retained as historical detail and superseded by the master plan; it is not a second active tracker.

## Historical security instrumentation snapshot — 2026-09-25 (superseded by current snapshot above)

- This work is an additive part of MCG release/evaluation readiness, not a separate denominator. Current MCG status: **4/7 accepted phases = 57%** (F0–F2 and F4 accepted; F3, F5 and F6 partial).
- Security tooling merged to this repository's `main`: PR #31 adds CodeQL, Semgrep, Gitleaks, OSV-Scanner and Dependabot; PR #36 adds isolated passive ZAP; PR #37 adds Jazzer.js redaction fuzzing. Recorded Actions runs for base commit `249cb391cd51c235f2489ffbb6f858c82774c336` passed; those historical runs do not validate the new local commits until pushed CI completes. Scanner workflows remain report-only; ZAP is passive-only.
- The latest verified GitHub code-scanning snapshot available during this reconciliation had 106 open alerts (CodeQL/Semgrep); individual findings still require triage. Dependabot security-alert count remains unverified because the API denied the required permission. Four Dependabot update PRs were open; they are update proposals, not the security-alert count, and are being closed at the owner's direction.
- PR #37 adds Jazzer.js credential-redaction fuzzing. The Token Firewall follow-up and tracked Git diff checkpoint are integrated into the local `main` history. Verification now passes: MCG 53/53 tests; Local Runtime 30/30 and strict typecheck; 35 syntax/import modules; sensitive scan across 203 files; Jazzer 62,897 executions in 9 seconds without a crash. The project Codex config registers only `mcg_read_batch` with per-tool approval; CLI sees the registration and the official MCP client tests cover discovery plus bounded reads. No live Codex model/tool turn or token savings from this code path are claimed. F4 reports are accepted; F5 screen-reader/touch/reference checks and F6 scanner triage/release gates remain open.
- Historical sync note at `2398bc1e`: it recorded a main-only branch inventory at that time. PRs #38–40 were merged afterward and recreated three remote head refs; see the current authoritative snapshot above. No PRs are currently open.

## Lumenva branch extraction reconciliation — 2026-09-23

- Ported the portable MCG changes found on Lumenva `vps`: deterministic duplicate-fragment removal before budgeting; separately measured context tokens; context-savings qualification in paired evals; historical context-usage recovery from local raw Codex JSONL; W3C `traceparent` persistence; the 30-case `validation-v2` corpus; and a read-only dashboard **Execuções** view with optional loopback-only Core feed.
- Missing usage fields remain `null`/`unavailable`; this port deliberately does not copy the source branch's assumption that absent cached usage equals zero.
- `npm test`: 46/46 pass. `npm run check:syntax`: 33 modules pass. `npm run scan:sensitive`: PASS (91 files). `validation-v2.jsonl`: 30 valid unique cases across 30 categories; provider execution was not started.
- The original MCG implementation plan and design are preserved as historical snapshots in [`archive/`](archive/).
- The consolidated Nexus Brain plan is [`blueprints/NEXUS_BRAIN_MASTER_IMPLEMENTATION_BLUEPRINT.md`](blueprints/NEXUS_BRAIN_MASTER_IMPLEMENTATION_BLUEPRINT.md). MCG is an internal context/gateway module; CRM and voice code remain outside this repository.
- The Lumenva-only rollout guard and Maestri V3 plans remain in Lumenva; they are not part of the standalone MCG product. Both VPS branches no longer track the embedded MCG source package or its dedicated old plan/spec; those plan/design snapshots are archived in this repository. Lumenva Core consumes the standalone package through typed exports pinned to merge `b3b5c8808b6f476654cce266f9d2cafd93a99193`. Lumenva Core validation passed: 44/44 tests and typecheck. The separate Lumenva PR #25 still contains only two `operating-core` paths.

## Local runtime-root candidate — 2026-09-23

- The current local checkout still uses the legacy folder name `maestri-context-gateway`; the GitHub repository is `nexus-brain`. Runtime data defaults to the ignored `.mcg-state/` directory. `MCG_ROOT` remains the explicit override. The local folder has not been renamed to avoid breaking configured tools.
- Candidate branch `codex/project-local-runtime-root`, commit `99ffa31`, is pushed to origin and is not merged into `main`.
- Candidate verification: unit suite 40/40, syntax/import 31 modules, sensitive-data/path scan PASS.
- Existing `.mcg-state/` data was preserved; no state migration or deletion was performed.
- A legacy empty directory outside the Projects checkout is not the repository and is not used as the default runtime path.

## Remaining work

- Benchmark the provider discovery/probe path across additional Windows user profiles and current official client releases.
- Add richer telemetry for MCP request errors and protocol-level capability sets when servers expose them.
- Keep rates, latency, and usage unavailable until backed by observed telemetry.

## Cross-repository Maestri branch migration audit — 2026-09-24

- Historical branch inventory and path boundaries remain in `MASTER_BLUEPRINT_CANONICAL.md`; the active Nexus scope and transfer gates are in [`blueprints/NEXUS_BRAIN_MASTER_IMPLEMENTATION_BLUEPRINT.md`](blueprints/NEXUS_BRAIN_MASTER_IMPLEMENTATION_BLUEPRINT.md) and [`migration/LUMENVA_SOURCE_TRANSFER_LEDGER.md`](migration/LUMENVA_SOURCE_TRANSFER_LEDGER.md).
- Selective Maestri transfer was merged to standalone `main` via PR #5, merge `4195fea8cde0edbd6b59e284a18141dab62701af`. PRs #6–29 subsequently synchronized/reconciled status, added dashboard report scope/evidence/accessibility and Token Firewall work, and verified the migration pointer. After PR #29, `main`, `origin/main`, and `origin/migration/lumenva-maestri-import-20260924` resolve to `e07d6a8b20781d25aa9535ce22720763b2b9f7f7`; local `main` and the migration compatibility pointer were fast-forwarded to that same commit. Contents of PR #5: VPS operating-core + Session Engine delta, Local Runtime, 61 unique TOKENS Cloud Fabric modules, selected Council docs, sanitized Codex Cloud plan, project Jules skill, non-active CEO/CIO templates, and disabled workflow snapshots. No whole Lumenva branch was merged.
- Validation (2026-09-24, after PR #29): MCG `pnpm test` 51/51; syntax/import smoke 34 modules; sensitive scan PASS (128 files); Local Runtime strict typecheck and tests 26/26; Core/Cloud Fabric strict typecheck and tests 69/69, with 2 integration tests skipped. Frozen-lockfile installation passes. Both PR #29 GitHub CI runs pass. No Docker tests were run. Real provider use, durable database and full release/browser QA remain pending.
- TOKENS Cloud Fabric acceptance remains OPEN. This branch now integrates model scoring/routing and model handoff, validated-only learning, independent reviewer exclusion, allowed-path propagation/scope guards, approval persistence seam and orchestrator integration tests. Provider cost stays null when unknown. Still pending: concrete worktree driver, durable evidence resolving artifacts, real subscription quota/usage, provider E2E within existing quotas, and >=30 validated benchmark observations. The detailed evidence/status table is in `migration/LUMENVA_SOURCE_TRANSFER_LEDGER.md`.
- Dashboard report renderer covers the 14 registered views with readable fields/lists, source/timestamp/measurement quality, explicit data scope/limitations and unavailable values. Light/dark/system preference, persistence, palette tokens and matching browser theme-color metadata are implemented. Isolated Chromium verified all 14 report views, skip-link keyboard activation, light theme selection and 320px mobile without horizontal overflow; no page errors. PRs #8–9 added report-title focus, keyboard-scrollable table semantics, polite loading/success/error announcements, stale-response protection and fresh no-store report data on each visit. PR #12 added declared ALL_TIME/5,000-record bounds for Cache/History and real validation-sample coverage against the 30-pair minimum. PR #14 added all-time task scope and exact result-file coverage against observed tasks. PR #16 distinguishes report query time from last observed Cache/History data time. Automated CSS-token contrast and reduced-motion checks now pass. Remaining: screen-reader verification, physical touch behavior and screenshot-level reference fidelity.
- PR #5 transferred the selected payload, PR #6 synchronized the initial migration status, PR #7 reconciled the source audit, PRs #8–16 advanced dashboard reports/accessibility/freshness; PR #17 synchronized the ledger; PR #18 added per-view scope/limitations; PR #19 added result evidence drill-through/redaction; PR #20 added automated theme contrast/reduced-motion checks; PRs #21–29 synchronized status and extended Token Firewall redaction, operation evidence, bounded read-only batching, boundary tests, SHA-based read reuse, the one-tool MCP stdio bridge and workspace TypeScript CI gates. All are merged to target `main`. No Lumenva source branch deletion or source-worktree modification occurred.
- Cleanup remains unsafe: Command Center is 50 commits ahead/21 behind with dirty CRM and Maestri files; F1 Cloud has dirty CRM/Codex Cloud files; several source refs remain attached to worktrees.
- Branch creation timestamps are not exposed by Git refs; the plan records first unique commit/tip dates as evidence rather than claiming exact creation dates.
- Both source and destination GitHub repositories are public. The current imported set passed a sensitive/path scan; any additional file transfer still needs an exact-path audit before push.
- MCG remains standalone inside the Maestri project. Overall migration progress is not a valid percentage yet: unresolved Cloud Fabric/runtime gates and Command Center/source-branch ownership remain; no objective equal-weight completion denominator exists.

## Provider discovery and MCP probes

- `mcg mcp discover` reads global and project MCP configuration for Claude Code, Codex, and Antigravity and returns metadata only; secret values are never serialized.
- `mcg mcp probe` makes read-only `server/discover` and `tools/list` requests, with legacy initialization fallback for stdio and Streamable HTTP. It never invokes `tools/call`.
- Package download/runner commands (`npx`, `npm`, `pnpm`, `uvx`, etc.) are reported as unprobed by default; they are not executed and cannot install packages during a health check.
- OAuth managed inside a provider client is not exported or read by MCG; a remote endpoint that needs such auth remains unverified here rather than having credentials copied into MCG.
- HTTP endpoints require HTTPS except loopback. Probe results are persisted locally in the ignored `state/registry/mcps.json` file.
- Health and tool names are observed; usage and success/failure rates stay unavailable until telemetry exists.
