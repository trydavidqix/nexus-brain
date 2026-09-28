# NB-01 — Source ownership and local path audit

**Audit date:** 2026-09-25 (historical source inventory)
**Status:** Historical. Current cutover state and remaining NB-29 gates are in [`NB-29_CUTOVER_REVALIDATION_2026-09-28.md`](../engineering/NB-29_CUTOVER_REVALIDATION_2026-09-28.md). Do not execute the old rename sequence below; the canonical Nexus checkout is `%USERPROFILE%\Desktop\Projetos\nexus-brain`.

> All process/task/PID and `.mcg-state` observations below are time-sensitive. Use the latest dated audit section as authoritative; older entries are retained as history, not current state.
**Scope:** initial inspection was read-only. A later evidence-backed re-audit disabled only the obsolete duplicate Scheduled Task; it did not stop a process, alter a repository/worktree, change the Startup shortcut, or touch CRM/voice data.

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
| Global agent/editor config | Targeted search of Codex, Claude, Gemini and VS Code config roots found no active exact-path config entry; four matches are historical Codex sandbox log lines. | Keep historical logs; do not rewrite logs. |
| Windows PATH/registry | Process PATH and persistent user/system PATH have no old checkout entry. | No PATH update identified. |
| Scheduled tasks/services | Re-audit found the logon task `Maestri Context Gateway Daemon` targeting the separate Desktop legacy clone; it is now disabled (not deleted). No Windows service was found. | Prevent duplicate start from that non-canonical clone. |
| Symlinks/junctions | No reparse-point child was found in `%USERPROFILE%\.lumenva`. | None found. |
| Git worktrees | Nexus registers only the current old-path checkout. Other Lumenva worktrees are separate and include dirty/active work; a separate old-named clone, Codex worktree and Claude cache also exist elsewhere. | Do not rename or clean those unrelated paths. |
| Running processes / workspace | Re-audit on 2026-09-25: PID 9756 runs `node %USERPROFILE%\.lumenva\maestri-context-gateway\bin\mcg.mjs daemon`; parent chain is `conhost.exe → codex.exe`; owner is David. It is healthy through its authenticated loopback control endpoint and has an established TCP connection to `127.0.0.1:7434`. Two current `run-local-runtime-mcp.mjs` launcher roots (PIDs 10960 and 11800) are children of `codex.exe`; each launches the old-path MCP server. The current Codex task/workspace also uses the old checkout path. | Keep NB-01/NB-29 blocked until these consumers are redirected/reloaded and the folder is unused. |
| Open-handle inspection | `handle.exe` is unavailable; Windows `openfiles` local tracking is disabled and its query returned access denied. | Cannot prove the directory is otherwise unused. |

## Blocker protocol and safe resume

1. Do not move, rename, stop, or kill the checkout’s daemon/MCP consumers from this task; their owning sessions and purpose are not established, and other agent sessions must not be disrupted.
2. Resume only after the owner has safely stopped the MCG daemon and all three MCP sessions, and reopened/moved the Codex task so its workspace root is the new canonical folder (or confirmed an app-supported workspace relocation). Re-run the process and handle audit first.
3. Then rename from the parent directory, preserve `.git`, and update only verified active references. Do not create a compatibility junction as a workaround without an explicit decision; that would leave an old-path alias and bypass the requested clean rename.
4. Validate `git status`, branch, `git remote -v`, `git worktree list`, GitHub repo/default branch, active config/hooks, app startup, daemon and MCP health, then run the applicable MCG test/syntax/security checks. Mark NB-01 `DONE` only if the path move and every check pass.

Until those preconditions are met, NB-01 remains `BLOCKED`; this is not completion of the branch/path ownership map or local folder migration.

## MCG daemon / Wire re-audit — 2026-09-25

This section supersedes the earlier “purpose not established” assessment; it does not authorize a broad cleanup of the legacy clone or its data.

| Report field | Verified result |
|---|---|
| PROCESSO | PID 9756, Node.js `bin/mcg.mjs daemon`; authenticated MCG health probe returns online. |
| ORIGEM | Executable code is from the Nexus checkout at `%USERPROFILE%\.lumenva\maestri-context-gateway`; `HKCU\Environment\MCG_ROOT` points its state to `%USERPROFILE%\Desktop\Projetos\maestri-context-gateway\.mcg-state`. |
| QUEM INICIA | The current PID’s parent chain is `conhost.exe → codex.exe`, under David’s Windows account. It was not started by the Maestri process or by the Scheduled Task. The exact Codex conversation/terminal that issued the start is not recoverable from process metadata alone. |
| FUNÇÃO | Watches the MCG `events/inbox` task queue. When `<MCG_ROOT>\config\wire.json` exists, it also subscribes to Maestri Wire’s workspace feed, tracks mutation/snapshot cursors, and writes a compact feed state. It is a Wire client/bridge, not the Wire server. |
| WIRE | Maestri’s running `Maestri.exe` process (PID 11208) owns loopback port 7434; its child CLI `--serve` is PID 14272. MCG Wire status succeeds for workspace `Lumenva`, role `guest`, protocol 1 and 42 advertised capabilities. PID 9756 has an established connection to that port. |
| NECESSÁRIO? | Needed to preserve the currently configured MCG task-inbox and MCG↔Maestri-Wire behavior; not required for a standalone Brain API. Retain as a compatibility Edge/bridge capability until its replacement is implemented and validated. Do not leave two authoritative daemons. |
| AÇÃO | Keep PID 9756 and the Wire feed running during code migration. Preserve all state. Disable only the obsolete duplicate Scheduled Task; keep the Startup shortcut as the single current autostart until it can be atomically redirected to the canonical path. |

### Autostart, state and MCP evidence

- The disabled task had a logon trigger and launched `%USERPROFILE%\Desktop\Projetos\maestri-context-gateway`, a separate clone whose Git remote is still `https://github.com/trydavidqix/maestri-context-gateway.git`; it is not the canonical Nexus checkout. Its last recorded result was exit code 1 while the live daemon already held the shared PID lock. The duplicate-lock explanation is consistent with the daemon’s lock code, but the task’s stdout/stderr was not captured, so it is not claimed as proven.
- The Startup-folder shortcut `MCG-Daemon.lnk` runs `wscript.exe` → `%USERPROFILE%\.local\bin\start-mcg-daemon.vbs`, which points to the current Nexus checkout’s old directory name. It remains enabled so disabling the task does not remove all logon startup. It must be redirected or replaced during NB-29.
- The Desktop `.mcg-state` is live, separately located data: inventory found 417 files under `state/`, 116 task files, 64 legacy-source files, and 3 backup files. No files were moved or deleted. Its contents must be backed up and migrated with hash/count verification before changing `MCG_ROOT`.
- The project `.codex/config.toml` starts `scripts/run-local-runtime-mcp.mjs`. The current snapshot shows two independent Codex launcher roots (PIDs 10960 and 11800), not three; the earlier count of three is historical and the third is no longer present in this snapshot. Each session owns its stdio MCP child, so Maestri being closed would not itself stop those Codex-hosted MCPs. Current process metadata cannot map a PID to a Codex task ID.
- The Maestri app is not fully stopped in the inspected Windows session: `Maestri.exe` and its `--serve` child are running. This contradicts the assumption that it is closed; it may be running in the background/tray.
- The active Nexus checkout’s remote is `trydavidqix/nexus-brain`; the Desktop clone remains a different repository and is not to be merged, renamed, or cleaned as part of NB-01. Only its live `.mcg-state` data is a migration input.

### Safe migration decision

1. The daemon itself is **not** terminated because live evidence proves its Wire and inbox role is active.
2. The duplicate Scheduled Task is disabled (not deleted); the currently used autostart shortcut remains the one launch mechanism until NB-29 can update it to the new path.
3. Before path cutover: inventory/hash the state tree without printing task contents; choose the new state location; copy and verify data; update `MCG_ROOT` and the VBS/shortcut to the canonical Nexus path; wait for MCP/Codex consumers to exit or reload; gracefully stop PID 9756 through the authenticated daemon control API; then start and verify exactly one replacement daemon and Wire feed.
4. Only after that controlled cutover may the old Desktop `.mcg-state` be retired. Preserve the Desktop clone itself; it is a separate Git repository and is not in scope for deletion.

## Current Windows and checkout audit — 2026-09-26

This section supersedes the 2026-09-25 process/state conclusions above. Read-only Windows process, task, environment, path and Git-worktree checks were rerun before any shutdown or rename.

| PROCESSO | ORIGEM | QUEM INICIA | FUNÇÃO | NECESSÁRIO? | AÇÃO |
|---|---|---|---|---|---|
| MCG daemon / Maestri.exe / Maestri Wire server | No matching process is currently running. | None observed. | No active inbox watcher or Wire connection exists to preserve right now. | Not required for standalone Nexus Brain; Edge keeps an optional Wire bridge. | Do not start it. Disable its remaining autostart artifacts. |
| Local Runtime MCP session 1 (PID 10960 with child command chain) | `%USERPROFILE%\.lumenva\maestri-context-gateway\scripts/run-local-runtime-mcp.mjs` → old `packages/local-runtime/src/mcp-server.ts`. | Codex host PID 7348; exact Codex task ID is not exposed by process metadata. | Old stdio MCP process for the legacy Local Runtime. | Not required after project config points to `apps/edge` and the standalone `mcg_read_batch` capability is verified there. | Stop only this identified MCP process tree, then relaunch from canonical config for validation. |
| Local Runtime MCP session 2 (PID 11800 with child command chain) | Same old checkout and launcher as session 1. | Same Codex host PID 7348; exact task ID not recoverable. | Second old stdio MCP process; not a separate daemon. | Same as session 1. | Stop only this identified MCP process tree; do not stop Codex host or unrelated agents. |
| Codex host/workspace processes (PIDs 13188/15676/10784) | Current task workspace is still the old checkout path; implementation edits are isolated in a separate Git worktree. | Codex desktop task runtime. | Owns the active task and paths used by the current turn. | Needed until migration work and final Git operations are complete. | Keep running during implementation; attempt physical rename only after old MCPs stop and all remaining commands can use the new path. |

### Finalization update — 2026-09-26

- Both identified Local Runtime MCP process trees were stopped by targeting their launcher roots; the Codex host and unrelated processes were not stopped. A fresh Node-process check found no MCG daemon, Maestri/Wire, or old MCP launcher.
- The Startup shortcut and VBS launcher were moved, not deleted, to the user profile archive folder legacy-mcg-windows-2026-09-26. The disabled Scheduled Task XML was exported there and the stale task was unregistered. The stale user MCG_ROOT was cleared after confirming its configured Desktop folder and the exact old/new state locations are absent.
- Global Codex trust entries for the absent Desktop clone and old checkout were replaced with the canonical nexus-brain path in config.toml and cto.config.toml; both parse as TOML. The user PATH launchers now dispatch CLI and graceful daemon stop through the future canonical checkout path; validate after rename. The project-scoped Edge MCP config will be exercised after GitHub integration and local worktree rename.
- The earlier audit claim of 417 state files could not be reproduced. During this turn, an eval smoke command was stopped after it launched a real Codex provider call; it had created only a baseline JSONL and stderr file (18,571 bytes total) under the configured state path. Both files were copied into the checkout's ignored .nexus-state and verified by relative path and SHA-256; source files remain untouched. No other historical state was found, so the old 417-file inventory remains unexplained and cannot be claimed recovered.
- No Desktop clone was found. The dirty mcg-finalization worktree remains preserved pending a complete delta comparison. The unregistered Codex folder named mcg-token-firewall-f3 contained no Git metadata or source files, only an empty marker, empty package directories and dependency links; no live thread/process referenced it. It was moved intact to the user-profile archive for recovery.

### Current legacy controls and data evidence (pre-cleanup snapshot)

- Startup shortcut: `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\MCG-Daemon.lnk` → `wscript.exe` → `%USERPROFILE%\.local\bin\start-mcg-daemon.vbs`, which launches the old checkout’s `bin/mcg.mjs daemon`. The shortcut is enabled; the VBS is present. Neither was changed yet.
- Scheduled Task `\Maestri Context Gateway Daemon`: state `Disabled`; its stored action points to the former Desktop `Projetos\maestri-context-gateway\bin\mcg.mjs`. Leave disabled; it is not running. No matching Windows service was found.
- User `MCG_ROOT` is `%USERPROFILE%\Desktop\Projetos\maestri-context-gateway\.mcg-state`; that directory and its parent Desktop project are currently absent. No `.mcg-state` or `.nexus-state` was found at the exact old checkout, configured Desktop path, or new canonical path. An earlier 2026-09-25 inventory reported 417 files under that state root; this conflicts with the present filesystem. No data was deleted by this migration, and those historical files cannot currently be copied or hash-verified. Keep this discrepancy explicit; do not claim the old data is migrated or recovered.
- Git recognizes exactly three worktrees for this repository: old-path `main` (clean), isolated `codex/nexus-canonical-architecture`, and `codex/mcg-finalization` (dirty, preserved). The Desktop legacy clone path is absent. `%USERPROFILE%\.codex\worktrees\mcg-token-firewall-f3` exists as a directory but is not a Git checkout and must be inspected before cleanup. Do not erase the dirty MCG worktree; its launcher, Wire pinning and registry changes were compared with this branch and the substantive code/test changes are already present here, while its documentation changes remain uncommitted there.
- `%USERPROFILE%\.codex\config.toml` has no old MCG server registration. Project config on this migration branch points to `nexus_local_runtime` and `tooling/scripts/run-edge-mcp.mjs`; live Codex sessions were started from the old checkout before that change and must be restarted to load it.
- The Nexus Edge preserves bounded read-only batch/redaction/context capabilities. The optional Wire client is not the Maestri Wire server and is not needed for the standalone Nexus context gateway.

### Safe finalization sequence (superseded by finalization update above)

1. Complete code/docs/config validation and integrate the migration branch via PR; do not modify `main` directly or force-push.
2. Stop the two identified old Local Runtime MCP process trees only. Preserve Codex host PID 7348 and unrelated processes.
3. Reversibly rename the Startup shortcut and VBS launcher to `.disabled`; keep the Scheduled Task disabled. Remove the stale user `MCG_ROOT` only after retaining its exact value in this audit and confirming no state source exists.
4. Reload/validate the project MCP from `tooling/scripts/run-edge-mcp.mjs`; verify the bounded batch tool and dashboard/CLI with the canonical state default.
5. Confirm current Codex task processes no longer require the old path; rename the original checkout from its parent directory to `%USERPROFILE%\.lumenva\nexus-brain`, preserving `.git` and the `origin` remote.
6. Re-run Git/worktree/path/process/hook/MCP checks and a scoped scan of active configs/scripts. Historical documents may retain the old name with this migration explanation.
