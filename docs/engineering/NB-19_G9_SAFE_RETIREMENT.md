# NB-19 G9: Safe Local Branch Retirement

**Status:** Implementation under validation. No project branch or worktree was retired.

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
- Project cleanup has not been applied. PR creation and integration remain subject to the existing instruction not to work on PR #72.
