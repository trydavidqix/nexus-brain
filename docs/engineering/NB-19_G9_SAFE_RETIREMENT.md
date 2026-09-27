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

- `tooling/scripts/git-retirement-core.mjs` requires every proof field to be present and boolean; missing evidence is `UNKNOWN`.
- `tooling/tests/git-retirement.test.mjs` covers eligible empty/merged classes and fail-closed behavior for unavailable evidence, dirty/active/checked-out/open-PR/unmerged/recovery-protected branches, and missing preservation/redundancy proof.
- Project cleanup has not been applied. PR creation and integration remain subject to the existing instruction not to work on PR #72.
