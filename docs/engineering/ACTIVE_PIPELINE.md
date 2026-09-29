# Nexus implementation pipeline

**Pipeline tracking:** ACTIVE
**Implementation execution:** ACTIVE — Task 1 is authorized through NB-23 completion.
**Updated:** 2026-09-29 03:36 Europe/Lisbon
**Canonical plan:** [`NEXUS_BRAIN_MASTER_IMPLEMENTATION_BLUEPRINT.md`](../blueprints/NEXUS_BRAIN_MASTER_IMPLEMENTATION_BLUEPRINT.md)
**Repository:** `trydavidqix/nexus-brain`

## Progress

- **Completed:** 12/25 work packages (48%)
- **Last completed:** NB-08
- **Current milestone:** NB-09 — Memory/event compiler, Skills and Maestri decision tiers, BLOCKED on local inference/calibration acceptance evidence
- **Blocked parallel milestone:** NB-11 — persistent snapshot encryption key provider is undefined; owner decision requested
- **NB-08 branch:** `codex/nb08-hybrid-retrieval`
- **NB-11 branch:** `codex/nb11-snapshot-restore` (no implementation changes)
- **NB-09 branch:** `codex/nb09-decision-tiers` (base `779d334ddacae82bdde4643c1a04d5d04c4240a2`)
- **Main base after NB-08 merge:** `25265fc7747614bc70db06f8a11db88161648e83` (before this documentation sync PR)
- **Pull request:** [#124](https://github.com/trydavidqix/nexus-brain/pull/124), squash-merged as `25265fc`

## Completed work packages

- [x] NB-00
- [x] NB-01
- [x] NB-02
- [x] NB-03
- [x] NB-04
- [x] NB-05
- [x] NB-06
- [x] NB-06A
- [x] NB-07
- [x] NB-08
- [x] NB-10
- [x] NB-19

## Remaining work packages

- [ ] NB-09 — BLOCKED; implementation is local and unmerged; concrete local adapter, versioned held-out calibration data, and project risk/approval false-negative gate are missing
- [ ] NB-11 — BLOCKED (persistent key provider decision)
- [ ] NB-12
- [ ] NB-13
- [ ] NB-14
- [ ] NB-15
- [ ] NB-16
- [ ] NB-17
- [ ] NB-18
- [ ] NB-20
- [ ] NB-21
- [ ] NB-22
- [ ] NB-23

## Current evidence and blocker

- NB-07 completed through PR #123. Final PR head `5d0be4228c084fe9858e671bae9fc84f52c5e979` passed the Windows fixture, MCG, OpenTofu, CodeQL, dependency review and security checks; merge `91ddfb40e00ef67b26330e861f1b7d337ba59666` is synchronized on `main`.
- NB-08 completed through PR #124. Final PR head `e4231f0128f69b83e9aa276957f0c577cf1fe37f` passed all listed GitHub checks, including Windows CBM, MCG, OpenTofu, CodeQL, dependency review, Gitleaks, Jazzer, Semgrep, ZAP and OSV. Independent review approved it. Local Brain/Contracts tests and typechecks, integration (26 tests), architecture (16 packages), sensitive-data scan (365 files), frozen-lockfile install and focused timeout tests passed. Merge `25265fc7747614bc70db06f8a11db88161648e83` is synchronized on `main`. Adapters that ignore `AbortSignal` can continue pending operations in background after the bounded response; details are in [`NB-08 progress`](NB-08_HYBRID_RETRIEVAL_PROGRESS.md).
- NB-11 discovery found no approved persistent key provider in the Blueprint or repo. The DoD requires encrypted snapshots that remain restorable after restart, so an injected ephemeral key alone cannot meet it. Owner decision was requested on Windows DPAPI CurrentUser (restore limited to the same Windows profile) versus another local provider. No NB-11 code was changed.
- NB-09 local implementation is in `codex/nb09-decision-tiers` and remains unmerged. Registry isolation, metadata-first resolution, lazy loading, budget enforcement, event lifecycle and deterministic Maestri contract have focused code/tests. Independent review required and received fixes for required dependencies, mutable returned state, concurrent budget loads, and resolver/load-event races. Final local checks after the latest regression test passed: Control Plane 24/24; Contracts Node 46/46 + Vitest 1/1; both package typechecks; `git diff --check`. Independent review of the final event-failure regression and GitHub Actions remain pending. The current benchmark is only an injected-adapter harness, not local inference. No versioned held-out Maestri dataset or project-defined risk/approval false-negative gate exists. See [`NB-09 progress`](NB-09_DECISION_TIERS_PROGRESS.md). This blocks NB-09 acceptance and therefore NB-12/13; scheduler authority migration remains NB-13 scope.
- NB-11 does not block the independent NB-09 chain. Continue eligible work while the key-provider decision is pending.

## Update and sync rules

- The canonical Blueprint owns milestone scope, order, acceptance, and completion status. This file is only the compact execution snapshot.
- Update this file and the NB-07 progress record on material state changes; keep the local `ACTIVE_PIPELINE.md` mirror aligned.
- Push the branch containing documentation changes to GitHub. Do not mark a work package `[x]` without fresh acceptance evidence.
- Progress is completed work packages divided by 25, rounded to the nearest whole percent.
