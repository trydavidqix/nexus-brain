# NB-19 G10: Ownership and Merge-Queue Concurrency

**Status:** In progress. Local ownership serialization, merge-group workflow support, and the CodeQL setup transition are validated. PR integration and a real merge-queue run remain outstanding; the live queue is not enabled yet.

## Observed concurrent delivery

- GitHub recorded six PR merges in a 105-minute window on 2026-09-27 (PRs #67–#72).
- PR #73 was `BEHIND` immediately after PR #72 merged while the protected-main ruleset required strict up-to-date status checks.
- This activity justified preparing a conservative queue: two concurrent builds, one squash merge at a time, `ALLGREEN`, and a five-minute minimum-group wait.
- The repository is public. No cloud resource or billing setting is involved.

## Ownership registry serialization

Concurrent registration/release operations now acquire an exclusive sibling lock before reading, validating, and atomically replacing the ownership registry. Writers wait up to 10 seconds; the lock is created with exclusive-create semantics, synced before use, and removed only when its token still matches. A writer that cannot obtain the lock fails closed. Stale locks are never deleted automatically because the lock owner may still be active; inspect the recorded process before any manual recovery.

The test starts two independent Node processes at the same time and proves both distinct owner records survive. A separate test proves a pre-existing lock is preserved and the update fails closed.

## Merge-group gate preparation

- MCG/OpenTofu, Dependency Review, Gitleaks, and CodeQL workflows accept `merge_group` checks.
- Gitleaks uses its pinned action for pull requests and a SHA-256-pinned official CLI archive for the queue commit range because the action does not emit a merge-group check.
- Dependency Review receives the base and head SHA from the merge-group event.
- The queue uses squash, matching the repository's only allowed merge method.
- CodeQL advanced setup is checked in so the required `CodeQL` Actions status can run on merge-group commits. PR #74 confirmed that managed default setup rejects advanced uploads (`CodeQL analyses from advanced configurations cannot be processed when the default setup is enabled`). The repository setting is now `not-configured`, and the advanced workflow rerun passed. Keep the queue disabled until a real queued PR reports all required checks.

### CodeQL and required-check transition

- The first advanced CodeQL run on PR #74 failed with the managed-setup conflict above; the managed `Analyze (javascript-typescript)` scan itself passed.
- The repository's default CodeQL setup was changed to `not-configured` using GitHub's repository configuration API. No Actions permissions or required check were removed.
- Rerunning the advanced CodeQL workflow on PR #74 succeeded and uploaded results.
- The active protected-main ruleset now binds `CodeQL` to the GitHub Actions integration (`15368`), preserving all five required contexts and all other rules.
- On PR #74 head `f9d4e2e610922a2a6c8c47e18d88a9e15928f041`, `mcg`, `tofu`, `CodeQL`, `Gitleaks secrets scan`, and `dependency-review` all passed. The merge queue remains disabled pending merge-group proof.

## Local validation

- Ownership store and CLI tests: 8/8 passed, including two-process contention and fail-closed lock handling.
- `pnpm test:engineering-gates`: 47/47 passed.
- Workspace unit tests: passed across 13 packages.
- `pnpm test:integration`: 20/20 passed.
- Workspace typechecks: passed across configured packages.
- `pnpm check:architecture`: passed for 13 packages.
- `node tooling/scripts/check-syntax.mjs`: 140 modules parsed.
- `node tooling/scripts/scan-sensitive.mjs`: 295 files scanned.
- `actionlint` passed for all five workflow files; `git diff --check` passed.

## Remaining acceptance evidence

1. Integrate the tested workflow and lock changes through a pull request.
2. Apply the versioned merge-queue policy to the active ruleset.
3. Queue an existing eligible PR and confirm all five required contexts (`mcg`, `tofu`, `CodeQL`, `Gitleaks secrets scan`, and `dependency-review`) succeed on its merge-group commit.
4. Confirm the main ruleset readback matches `.github/rulesets/main.json` and the repository has no `BEHIND` merge condition caused by strict status checks.

Until those steps pass, NB-19 remains `IN_PROGRESS`.
