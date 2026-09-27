# NB-19 G9: Safe Local Branch Retirement

**Status:** Implementation under validation. No user project work branch or worktree was retired.

## Workflow

- `pnpm task:hygiene:retire -- --branch <name>` runs a read-only plan. The workflow refreshes `origin/main`, checks GitHub's complete open-PR inventory, reads the local task ownership registry, checks branch ancestry, and inspects matching in-scope worktrees.
- A branch is eligible only when it has released ownership evidence, no active owner, no open PR, complete inventories, clean state, no checked-out worktree, proven ancestry to `origin/main`, and an explicit operator attestation that no recovery/migration gate protects it. The workflow cannot discover external recovery gates.
- The only eligible classes are `EMPTY` and `SAFE_MERGED_CLEAN`. Dirty, active, checked-out, open-PR, unmerged, unknown, incomplete, or recovery-protected resources fail closed.
- `--apply` requires both `--confirm-branch <exact-name>` and `--recovery-clear`. It repeats proof and compares the branch head before calling ordinary `git branch -d`.
- Retirement scope is one local branch. The remote branch remains untouched. The workflow never removes a worktree, force-deletes a branch, runs `git clean`, or resets files.
- The command prints the proof fields and mutation count. Default plan mode performs zero mutations.

## Validation

- `pnpm test:engineering-gates`: 43/43 passed, including four retirement-proof tests.
- `pnpm -r --if-present test:unit`: passed across 13 configured workspace packages.
- `pnpm test:integration`: 20/20 passed.
- `pnpm -r --if-present typecheck`: passed across configured packages.
- `pnpm check:architecture`: passed; 13 packages.
- `node tooling/scripts/check-syntax.mjs`: passed; 140 modules parsed.
- `node tooling/scripts/scan-sensitive.mjs`: passed; 293 files scanned.
- `actionlint` passed for all four workflow files.
- `pnpm task:hygiene:retire -- --branch codex/nb19-g9-safe-retirement --recovery-clear` classified the active, checked-out task branch as `ACTIVE`, returned `eligible=false`, and performed 0 mutations.
- No user project work branch or worktree was retired. The source branch is pushed; PR/CI integration is still pending.

## Latest local revalidation (2026-09-27)

- `pnpm test:engineering-gates`: 43/43 passed, including all G8 ownership/inventory checks and four G9 retirement-proof tests.
- `node --test tooling/tests/git-retirement.test.mjs`: 4/4 passed.
- The read-only retirement plan again classified this active, checked-out branch as `ACTIVE`, `eligible=false`, and `mutations_performed=0`; the fail-closed CLI exited with its unsafe-plan status.
- `pnpm report:engineering-gates`: `REPORT_ONLY`, `cleanup_enabled=false`, complete open-PR inventory, 0 orphan owner records, 0 equivalent tree groups, and 0 mutations.
- `actionlint` passed for all four workflow files.
- The implementation has no PR CI or integration result yet. G9 remains under validation and is not `DONE`.

## Synthetic empty-branch retirement proof (2026-09-27)

- Created local branch `codex/nb19-g9-retirement-probe` from `origin/main`; it had zero commits ahead, a clean tree, no open PR, released task ownership, and was not checked out at apply time.
- Dry run classified it `EMPTY`, `eligible=true`, with complete ownership/PR inventories and zero mutations.
- Applied only the exact local branch retirement with `--confirm-branch codex/nb19-g9-retirement-probe --recovery-clear`; the result was `retired=true`, `scope=LOCAL_BRANCH_ONLY`, `mutations_performed=1`.
- Verified the probe branch no longer exists and the existing worktrees were not removed or changed. The post-retirement report found six open PRs, zero empty branches, zero orphan owner records, zero equivalent tree groups, and zero mutations in report-only mode.
- This exercises the cleanup path only on an empty synthetic branch. No user project branch or remote branch was retired.
