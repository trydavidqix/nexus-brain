# NB-19 G8: Duplicate, Orphan, and Stale Detection

**Status:** Implementation PR #71 merged; all required PR checks passed. This evidence closeout is on the next NB-19 follow-up and remains pending integration. No hygiene cleanup ran.

## Detection behavior

- The report reads open pull requests with GitHub CLI. CI grants `pull-requests: read` only to the MCG job and exposes `GH_TOKEN` only to the report step.
- The report marks the PR inventory unavailable or incomplete when GitHub CLI fails, JSON is invalid, source ownership is missing, or the 1,000-item limit is reached. It does not claim a resource is stale without complete PR and local ownership inventories.
- Open pull requests match local branches only when the PR head owner matches the repository owner. Fork branches do not falsely claim same-repository branch ownership.
- A clean worktree without active ownership becomes `STALE_REVIEW_REQUIRED` only after complete inventories show no active task or open PR. Dirty worktrees remain `DIRTY`; open PR worktrees remain `UNMERGED`; exact active ownership remains `ACTIVE`.
- Merged branch candidates require a complete PR inventory. Branches with unavailable inventory remain `UNKNOWN`; dirty branches remain `DIRTY`; active task branches remain `ACTIVE`.
- Equivalent work is detected from identical clean Git tree object IDs. Names are not compared. The result is only a duplicate candidate for human review; no redundancy or safe-retirement proof is inferred.
- Active ownership records without a matching in-scope Git worktree are counted as orphaned metadata. Out-of-scope paths and symlinks remain excluded.
- Existing prunable Git worktree metadata remains classified as `ORPHANED_METADATA` without opening its missing path.
- The report stays `REPORT_ONLY`: `cleanup_enabled=false`, `safe_retirement_proof=UNAVAILABLE`, and `mutations_performed=0`.
- Task ownership conflicts invalidate the local registry through G7 validation. The report surfaces `ownership_registry=INVALID`; it does not infer a winner or rewrite ownership.

## Local validation

Observed on 2026-09-27 in the G8 worktree:

- `pnpm test:engineering-gates`: 39/39 passed.
- `pnpm -r --if-present test:unit`: passed across 13 configured workspace packages.
- `pnpm test:integration`: 20/20 passed.
- `pnpm -r --if-present typecheck`: passed across configured packages.
- `pnpm check:architecture`: passed; 13 packages.
- `node tooling/scripts/check-syntax.mjs`: passed; 137 modules parsed.
- `node tooling/scripts/scan-sensitive.mjs`: passed; 288 files scanned.
- `actionlint` passed for all four workflow files.
- `pnpm report:engineering-gates`: succeeded with an available local ownership registry and complete GitHub open-PR inventory (4 open PRs); 0 orphan owner records, 0 equivalent tree groups, and 0 mutations. The report intentionally classified the in-progress G8 worktree as dirty.

PR #71 (`engineering: Detect orphaned and duplicate Git work`) merged to `main` as `d5c22f9134d63dfd5d8dd1d6a71b0797a78c3894`. `gh pr checks 71` reports all required and security checks passed. G8 remains in progress until this evidence closeout is integrated.
