# NB-19 G3: Delivery and Git Hygiene Report Evidence

**Captured:** 2026-09-27
**Branch:** `codex/nb19-g3-delivery-git-hygiene`
**Scope:** read-only delivery and Git hygiene reporting. No cleanup, GitHub settings, cloud resources, or secrets changed.

## Changes

- Added delivery checks for task branch, pull request title, commit subject, and working-tree cleanliness.
- Added report-only hygiene classifications for worktrees and branches. Unknown ownership remains `UNKNOWN`; merged/clean branches remain `STALE_REVIEW_REQUIRED` until ownership, preservation, and redundancy proofs exist.
- Constrained GitHub event and step-summary file paths to the runner temporary directory, with a regression test that verifies outside files stay unchanged.
- Excluded paths outside the Nexus checkout parent and repository-named Nexus siblings before inspecting worktree paths. Symlink candidates are skipped. The report exposes only an excluded-worktree count, never paths or branch names.
- Kept ownership and safe-retirement proof explicitly `UNAVAILABLE`. The reporter performs zero mutations and never enables cleanup.
- Added a non-blocking, always-run CI summary step. MCG checkout fetches full history so `origin/main` comparisons can be made in CI.
- Added package scripts and regression tests for classifications, output privacy, and no repository mutation.

## Validation

| Gate | Result |
| --- | --- |
| Engineering-gate tests | Passed, 12/12 |
| Local report-only invocation | Passed; mode `REPORT_ONLY`, blocking false, cleanup false, mutations 0 |
| Reporter privacy and no-mutation regression | Passed; no `Lumenva` text or worktree paths in output; Git status unchanged |
| Workspace unit tests | Passed |
| Workspace integration tests | Passed, 20/20 |
| Architecture | Passed, 13 packages |
| TypeScript checks | Passed for configured workspace packages |
| Syntax/import smoke | Passed, 128 modules |
| Git naming tests | Passed, 11/11 |
| Sensitive-data scan | Passed, 271 files |
| `actionlint` | Passed for all workflow YAML files |
| `git diff --check` | Passed |

The local report counted out-of-scope worktrees without naming or inspecting them. Ownership-aware active classification remains unavailable until G7. This stage adds no automatic cleanup and does not claim that any resource is safe to retire.
