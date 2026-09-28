# NB-01 — Source ownership and local path audit

**Audit date:** 2026-09-25
**Status:** BLOCKED — do not rename the local checkout while consumers are active.
**Scope:** read-only inspection of Nexus Brain, Lumenva source refs, Windows references and running consumers. No Lumenva branch, worktree, process, config or unrelated CRM/voice data was changed.

## Repository and branch inventory

- Canonical destination: public GitHub repository [`trydavidqix/nexus-brain`](https://github.com/trydavidqix/nexus-brain), default branch `main`; live API inventory contains exactly one branch: `main`.
- Source project: [`trydavidqix/Lumenva`](https://github.com/trydavidqix/Lumenva), default branch `main`; live GitHub API inventory contains **53 branches**. These are source refs, not permission to merge whole branches.
- The Nexus checkout at audit time was clean on `main`, with `origin` set to `https://github.com/trydavidqix/nexus-brain.git`; its registered Git worktree list contains only that checkout.
- The Lumenva root checkout was dirty on `chore/upstream-migrations-0347-0380`, with modified Claude rules and untracked Jules/config backup/test artifacts. Lumenva has numerous active worktrees, including `vps`, Command Center, MCG-CI, F1 and task-specific worktrees. They were inspected only as inventory and left untouched.
- Local-vs-remote comparison at audit time: **45 local heads**, **18 local-only**, **26 remote-only**, and **27 shared**. The source checkout has **34 registered worktrees**. No fetch/prune, branch deletion, or worktree cleanup was performed; the branch comparison uses the live GitHub branch API plus the existing local refs.

### Complete live source branch inventory

The 53 remote branch names are recorded here so ownership decisions can be revisited without treating a branch name as authorization to import it.

**Selective Nexus source candidates (12):**

`TOKENS`; `backup/lumenva-command-center-pre-cleanup-2026-09-22`; `codex/mcg-ci-integration`; `docs/jules-delegation-skill`; `feat/f1-identity-mapping`; `feat/maestri-engineering-council`; `feat/maestri-engineering-council-clean`; `lumenva-command-center`; `lumenva-command-center-blueprint-v2`; `lumenva-local-runtime`; `vps`; `vps-17455632840955604138`.

**Held or excluded source branches (41):**

`chore/package-ci-tests`; `chore/update-testing-doctrine`; `chore/upstream-migrations-0347-0380`; `chore/upstream-pull-01`; `docs/f6-f7-f8-handoff-2026-09-24`; `f7-j6-adapter-matrix-18043191461025142301`; `f8-j3-publish-workflow-2470113440388419535`; `f8-j4-gcp-logging-16419022131821244108`; `feat/f1-identity-mapping-v2`; `feat/f2-tenant-isolation`; `feat/f3-rbac`; `feat/f3-rbac-14201095918533104138`; `feat/f3-rbac-17111202584489541287`; `feat/f3-rbac-acl-audit-17806325391317863887`; `feat/f3-task4-human-role-separation`; `feat/f3-task6-final-matrix`; `feat/f3-task-1-platform-admin-api-12582833702745023097`; `feat/f4-firebase-auth`; `feat/f4-firebase-auth-6584745336670343089`; `feat/f4-firebase-auth-8431202958264026743`; `feat/f4-firebase-auth-api-routes-2853622509282931784`; `feat/f4-firebase-identity-bridge-5646239490154747231`; `feat/f5-storage-realtime-7459603192977202492`; `feat/f5-task1-gcs-11165633749417281418`; `feat/f5-task2-media-gcs-5082288770740349695`; `feat/f5-task4-sse-8705358404323605379`; `feat/f5-task5-realtime-client-14073667979986859526`; `feat/f5-task-3-aux-storage-15945593050366616123`; `feat/f7-j4-nuvemshop-resend-adapters-17233514225075684717`; `feat/meta-direct-social-login`; `feature/f7-j3-meta-adapter-368541147442802420`; `fix/f4-j1-lint`; `fix/f5-task5-lint`; `fix/f7-nuvemshop-webhook-fail-closed`; `fix/meta-provider-contracts`; `fix/orphan-packages-workspace-11502432029800832518`; `jules-auth-firebase-client-4940827573783815306`; `jules-f7-waha-adapter-7831325555235237843`; `main`; `security/mcp-auth-rate-limit`; `voz`.

**Local-only branches (18):**

`chore/f6-j3-shadow-messaging-17260995457662267953`; `codex/command-center-dashboard`; `codex/mcg-clean-reconstruction`; `f6-shadow-crm-3903949313584370746`; `feat/f4-mfa`; `feat/f5-task6-security-fixes`; `fix/f3-task1-lint`; `fix/f3-task3-lint`; `fix/f4-j2-lint`; `fix/f4-j4-ci-20260923`; `fix/f4-j4-lint`; `fix/f4-j5-ci-20260923`; `fix/f5-media-storage-test-mock`; `fix/f5-task2-gcs-test-contract`; `fix/f5-task3-aux-test`; `fix/f5-task5-sidebar-mock`; `fix/f6-c1-high-findings`; `jules/f7-j5-sentry-ratelimit-7369976782948795000`.

Local-only branch refs are inventory only. `codex/command-center-dashboard` is explicitly mixed with CRM/Meta work and has local changes/divergence; do not import, clean, or rewrite it as part of Nexus ownership work. `codex/mcg-clean-reconstruction` remains an unapproved candidate pending exact-path review.

### Ownership classification

“Nexus-owned” below means selective files/requirements only, not a wholesale branch merge. Previously transferred files/status are detailed in `../migration/LUMENVA_SOURCE_TRANSFER_LEDGER.md`.

| Lumenva branch(es) | Ownership | Transfer boundary / decision |
|---|---|---|
| `vps`, `vps-17455632840955604138` | Maestri V3 core and Session Engine | Select only Maestri-owned core/session files; exclude Lumenva product/business paths. |
| `TOKENS` | Advanced Cloud Fabric / Workforce | Select provider-neutral orchestration/contracts; retain Nexus canonical task/execution/context contracts. |
| `lumenva-local-runtime`, `codex/mcg-ci-integration` | Local Runtime and MCG | Internal runtime/gateway module; preserve package/API compatibility until tested migration. |
| `lumenva-command-center`, `lumenva-command-center-blueprint-v2` | Mixed dashboard source and design | Reuse existing Nexus dashboard; import only proven MCG/Maestri-only requirements. No whole-branch copy. |
| `feat/maestri-engineering-council`, `feat/maestri-engineering-council-clean` | Maestri Engineering Council | Clean Council documentation/roles only; no CRM handoff or new agent creation. |
| `feat/f1-identity-mapping` | Mixed; one Maestri/Codex Cloud plan is in scope | Transfer only the identified plan document. Exclude identity, tenant, customer, and CRM code. |
| `docs/jules-delegation-skill` | Jules delegation guidance | Keep only the sanitized generic skill and its safe execution/review rules. |
| `backup/lumenva-command-center-pre-cleanup-2026-09-22` | Mixed backup; selected profile templates only | The previously selected sanitized Antigravity/Claude role templates only; never restore the branch wholesale. |
| `chore/package-ci-tests`, `codex/mcg-clean-reconstruction` | Potential MCG support | Not yet approved for transfer; exact changed paths and duplicated behavior still require review. |
| `feat/f3-task4-human-role-separation`, `security/mcp-auth-rate-limit`, `fix/orphan-packages-workspace-11502432029800832518`, `chore/update-testing-doctrine`, `chore/upstream-pull-01`, `docs/f6-f7-f8-handoff-2026-09-24` | Unresolved / hold | Branch names do not prove Nexus ownership. Review exact paths and dependencies before any import. |
| `main`, `voz`, Meta/social branches, F2/F3/F4/F5 auth/storage/realtime families, F7 Nuvemshop/Waha/adapter families, F8 publish/logging branches, CRM shadow branches, upstream database migrations and their lint/test/Jules helper branches | Lumenva product/CRM/voice or mixed | Excluded from Nexus transfer by default. Only a later exact-path proof plus explicit scope decision can change this. |

The remaining branches not enumerated as approved selective sources are **not implicitly Nexus-owned**. In particular, feature prefixes such as F2–F8 and “security” are insufficient ownership evidence. Their source refs and worktrees were not deleted or rewritten.

## Local rename preflight

Requested local move: `%USERPROFILE%\.lumenva\maestri-context-gateway` → `%USERPROFILE%\.lumenva\nexus-brain`.

| Surface checked | Evidence at audit time | Result |
|---|---|---|
| Target path and Git metadata | Old directory exists; new directory does not. `.git` and history are in the existing checkout. `main` is clean and `origin` is the canonical Nexus URL. | Rename not attempted. |
| Project scripts/config/hooks | Exact old absolute path search across this repository found no matches. `core.hooksPath` is unset; only sample scripts exist in `.git/hooks`. | No repository hook/config rewrite identified yet. |
| Codex workspace config | `%USERPROFILE%\.codex\config.toml` contains trusted-project entries for both `%USERPROFILE%\.lumenva\maestri-context-gateway` and a separate `%USERPROFILE%\Desktop\Projetos\maestri-context-gateway` clone. The active Codex task is rooted at the first path. | Update the first entry only after reopening Codex at the canonical path. The Desktop clone needs ownership review before changing its entry. |
| Windows PATH/registry | Process PATH and persistent user/system PATH have no old checkout entry. | No PATH update identified. |
| Scheduled tasks/services | No Windows service points at the exact old checkout. Scheduled task `\Maestri Context Gateway Daemon` launches `%USERPROFILE%\Desktop\Projetos\maestri-context-gateway\bin\mcg.mjs daemon`; that separate clean `main` clone's `origin` URL redirects from `trydavidqix/maestri-context-gateway` to canonical `trydavidqix/nexus-brain`. | The task is Nexus/MCG-related, but points at a second clone. Do not repoint it until the active daemon's owner and intended single runtime are confirmed; avoid starting a duplicate daemon. |
| Symlinks/junctions | No reparse-point child was found in `%USERPROFILE%\.lumenva`. | None found. |
| Git worktrees | Nexus registers only the current old-path checkout. Other Lumenva worktrees are separate and include dirty/active work; a separate old-named clone, Codex worktree and Claude cache also exist elsewhere. | Do not rename or clean those unrelated paths. |
| Running processes / workspace | One `node ...\bin\mcg.mjs daemon` process and **three** Local Runtime MCP server instances (six Node/tsx processes in their process trees) resolve through the old checkout. The active Codex task itself is also opened with the old checkout as its workspace root. The new path fails process creation because it does not exist. | **BLOCKER:** active runtime clients and this workspace still depend on the old path. |
| Open-handle inspection | `handle.exe` is unavailable; Windows `openfiles` local tracking is disabled and its query returned access denied. | Cannot prove the directory is otherwise unused. |

## Blocker protocol and safe resume

1. Do not move, rename, stop, or kill the checkout’s daemon/MCP consumers from this task; their owning sessions and purpose are not established, and other agent sessions must not be disrupted.
2. Resume only after the owner has safely stopped the MCG daemon and all three MCP sessions, and reopened/moved the Codex task so its workspace root is the new canonical folder (or confirmed an app-supported workspace relocation). Confirm whether the separate Desktop clone's scheduled task is the intended daemon autostart; repoint it only if confirmed, and prevent duplicate daemon startup. Re-run the process and handle audit first.
3. Then rename from the parent directory, preserve `.git`, and update only verified active references. Do not create a compatibility junction as a workaround without an explicit decision; that would leave an old-path alias and bypass the requested clean rename.
4. Before and after the move, inventory active references to both the exact old path and `maestri-context-gateway` across owned Nexus scripts/configs/MCPs/hooks/services/Codex workspaces/launchers/env/PATH/tasks/editor integrations and dev tooling. Migrate only Nexus-owned active references; update package metadata/lockfiles only after verifying all workspace consumers. Preserve references in Git history and documents that explain the migration. Record every intentional surviving operational hit with its owner and reason; otherwise require zero active in-scope hits.
5. Validate `git status`, branch, `git remote -v`, `git worktree list`, GitHub repo/default branch, active config/hooks, app startup, daemon and MCP health, then run the applicable MCG test/syntax/security checks. Confirm the global old-name search has no active in-scope hits. Mark NB-01 `DONE` only if the path move, reference migration, process reopen and every check pass.

Until those preconditions are met, NB-01 remains `BLOCKED`; this is not completion of the branch/path ownership map or local folder migration.
