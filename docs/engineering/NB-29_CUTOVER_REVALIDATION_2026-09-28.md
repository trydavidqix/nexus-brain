# NB-29 Cutover Revalidation — 2026-09-28

**Status:** `PENDING_VALIDATION`. This report supersedes prior NB-29 completion claims until the unresolved preservation items below are reconciled.

## Verified state

- Canonical checkout: `%USERPROFILE%\Desktop\Projetos\nexus-brain`; remote `https://github.com/trydavidqix/nexus-brain.git`.
- Local `main` and `origin/main` are synchronized and clean at `9bfcdc0cb56607efc8933c975945f4e73ee1bd27`.
- Required checks passed for migration PRs #43, #49, #73–#75, #79–#80, and #82–#83. The active `Nexus protected main` ruleset has no bypass actors, requires strict status checks, squash-only merges, linear history, and blocks force-push and branch deletion.
- NB-03 Hindsight was healthy at `127.0.0.1:8888`; one synthetic reflect returned HTTP 200. The Hindsight LLM-request registry recorded `openai-codex`, `gpt-6-luna`, `success`, `reflect_tool_call`. No Gemini key was read; response text was not printed or persisted. See [NB-03 live revalidation](NB-03_CODEX_OAUTH_REVALIDATION_2026-09-27.md).
- NB-04 live integration, ACL/scope, append-only, backup/restore, and PostgreSQL compatibility evidence remains in [NB-04 preparation](NB-04_PREPARATION.md); workspace integration tests passed 26/26.
- The project Codex MCP probe returned `HEALTHY` for `nexus_local_runtime`, exposing only `mcg_read_batch` over stdio. The probe issued discovery/list requests only; it called no MCP tool.
- Global `mcg.cmd`, `mcg.ps1`, and `stop-mcg-daemon.cmd` were repointed from the obsolete `.lumenva\nexus-brain` target to the canonical Desktop checkout. Both `mcg.cmd doctor` and `mcg.ps1 doctor` returned the Nexus product and canonical state root. No Node process used the obsolete target. `doctor` reports optional Maestri Wire config missing; Nexus standalone operation does not require Wire.
- `.nexus-state` is ignored by Git. Its two current eval artifacts match the two files in `%USERPROFILE%\Desktop\Projetos\maestri-context-gateway\.mcg-state` by relative path, byte length, and SHA-256. Source files were not changed and their content was not printed:
  - `pair-smoke-context-recall-1-1790376343486-7da5f2dd-baseline.jsonl` — 4,591 bytes, SHA-256 `e8eb5b6ca96911bf613e6361f06403d37fdec74717dbd478799ae60be55473aa`.
  - `pair-smoke-context-recall-1-1790376343486-7da5f2dd-baseline.stderr.txt` — 13,980 bytes, SHA-256 `9da3de1409214ef33d0f2d02b1190f087a5c6bbfde59da6596bcf7491f578b47`.
- Local validation passed after a frozen-lockfile install: workspace unit tests, typechecks, integration tests, 47 engineering-gate tests, 11 Git naming tests, 13-package architecture check, 151-module syntax check, and sensitive-data scan (404 files). A Windows LF/CRLF test portability correction merged in PR #83.
- Git `core.hooksPath` is unset and `.git/hooks` contains only Git's sample hooks. The repository has no active local Git hook registration; GitHub's protected-main ruleset is the authoritative delivery gate.

## Unresolved preservation gates

1. A historical audit reported 417 files in an MCG state root. The current source/destination pair contains two matching files; the earlier 417-file inventory has no reproducible manifest or verified copy. This report does not claim those 417 files were recovered or never existed.
2. A preserved `codex/mcg-finalization` worktree is listed under the Lumenva-owned path. Earlier Nexus audit notes described it as dirty with uncommitted documentation. The user prohibited touching Lumenva, so this revalidation did not inspect or modify that worktree. Its current cleanliness, uniqueness, and remote preservation remain unverified.

Until both preservation gates have independent evidence or an explicit scope decision, keep NB-29 `PENDING_VALIDATION`; do not start NB-05 or later Blueprint implementation.

## Worktrees and open changes

- Nexus `main`, NB-04, and NB-05 worktrees remain present. The main worktree is clean; NB-04 and NB-05 worktrees are clean and synchronized with their branch remotes.
- PR #81 remains an open draft for future NB-05 work. PRs #50 and #78 remain open outside the migration closeout. They were not changed by this audit. PR #72 was not queried or modified.
- No worktree was deleted, reset, cleaned, or force-pushed. No billing, Google project, cloud resource, or Gemini setting changed.

## Supplemental Git metadata check

- The Nexus Git metadata records `codex/mcg-finalization` at commit `5d78258893cf25ce4c6038999a82e1e2be97e8a7`; that commit is an ancestor of `origin/main`.
- `origin` has no branch ref named `codex/mcg-finalization`. Thus the branch's committed history is present in `main`; this does not account for staged, unstaged, or untracked worktree changes.
- The protected worktree's index and files remain uninspected. This Git-object check does not resolve the prior dirty-worktree report or the 417-file state discrepancy.
