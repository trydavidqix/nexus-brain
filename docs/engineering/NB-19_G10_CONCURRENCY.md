# NB-19 G10: Ownership and Merge-Queue Concurrency

**Status:** Complete on 2026-09-27. Ownership updates are serialized, required checks pass through the advanced CodeQL workflow, and the active protected-main ruleset remains strict. GitHub merge queue is unavailable for the repository's current account ownership and was not enabled.

## Observed concurrent delivery

- GitHub recorded six PR merges in a 105-minute window on 2026-09-27 (PRs #67–#72).
- PR #73 became `BEHIND` after PR #72 merged while the protected-main ruleset required strict up-to-date status checks.
- The volume justified a merge-queue evaluation. The ruleset API rejected adding `merge_queue` with HTTP 422, `Invalid rule 'merge_queue'`.
- The repository is public and its owner type is `User`. [GitHub documents merge queues for public repositories owned by organizations, or private repositories owned by organizations with Enterprise Cloud](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue).
- No queue rule was added to either the active ruleset or the versioned policy. Strict status checks and squash-only delivery remain active.

## Ownership registry serialization

Concurrent registration/release operations acquire an exclusive sibling lock before reading, validating, and atomically replacing the ownership registry. Writers wait up to 10 seconds; the lock is created with exclusive-create semantics, synced before use, and removed only when its token still matches. A writer that cannot obtain the lock fails closed. Stale locks are never deleted automatically because the lock owner may still be active; inspect the recorded process before any manual recovery.

The test starts two independent Node processes at the same time and proves both distinct owner records survive. A separate test proves a pre-existing lock is preserved and the update fails closed.

## Required checks and dormant merge-group support

- MCG/OpenTofu, Dependency Review, Gitleaks, and CodeQL workflows accept `merge_group` checks in preparation for a future supported owner type.
- Gitleaks uses its pinned action on pull requests and a SHA-256-pinned official CLI archive on merge-group commits.
- Dependency Review receives base and head SHA values from the merge-group event.
- CodeQL uses the committed advanced workflow because the default managed setup blocks advanced result uploads. The active `CodeQL` check is bound to GitHub Actions integration `15368`.
- Until GitHub supports queues for the current owner type, the merge-group trigger path is dormant. No queue events were generated or claimed.

## Active protected-main evidence

The active ruleset `24075255` is `active`, has no bypass actors, requires strict status checks, squash-only PRs, linear history, and blocks force pushes and branch deletion. Its five required checks all use GitHub Actions integration `15368`: `mcg`, `tofu`, `CodeQL`, `Gitleaks secrets scan`, and `dependency-review`. The active ruleset readback contains no `merge_queue` rule and matches the versioned policy.

On PR #74 head `50cdec0bf3e61a8888156e27bbdbf05ac3478406`, all five required checks passed. The first advanced CodeQL run failed because managed default setup was still enabled; after changing the default setup to `not-configured`, the advanced CodeQL rerun succeeded and uploaded results. No required gate was removed.

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

If repository ownership later changes to an organization, re-evaluate merge-queue eligibility, enable the queue only after all five checks pass on a real merge-group commit, and update the active and versioned rulesets together.
