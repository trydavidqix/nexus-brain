# Nexus implementation pipeline

**Pipeline tracking:** ACTIVE
**Implementation execution:** ACTIVE — Task 1 is authorized through NB-23 completion.
**Updated:** 2026-09-29
**Canonical plan:** [`NEXUS_BRAIN_MASTER_IMPLEMENTATION_BLUEPRINT.md`](../blueprints/NEXUS_BRAIN_MASTER_IMPLEMENTATION_BLUEPRINT.md)
**Repository:** `trydavidqix/nexus-brain`

## Progress

- **Completed:** 14/25 work packages (56%)
- **Last completed:** NB-11
- **Current milestone:** NB-12 — provider adapters and project integrations, IN_PROGRESS under the Owner-approved adapter boundary; PR [#128](https://github.com/trydavidqix/nexus-brain/pull/128)
- **NB-11 Owner decision:** DPAPI CurrentUser approved; key restore is limited to the same Windows user profile and machine
- **NB-08 branch:** `codex/nb08-hybrid-retrieval`
- **NB-11 branch:** `codex/nb11-snapshot-restore`, PR [#127](https://github.com/trydavidqix/nexus-brain/pull/127)
- **NB-09:** PR [#126](https://github.com/trydavidqix/nexus-brain/pull/126), squash-merged as `f528849`
- **Current main after NB-11:** `da816af1de6da55dffd56519d9adb933497a6d6f`
- **Earlier integration:** PR [#124](https://github.com/trydavidqix/nexus-brain/pull/124), squash-merged as `25265fc`

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

- [x] NB-09
- [x] NB-11
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
- NB-11 Owner decision approved Windows DPAPI CurrentUser for the persistent key, limited to the same profile/machine. PR [#127](https://github.com/trydavidqix/nexus-brain/pull/127) contains the implementation, 14/14 focused and 60/60 Edge unit tests, typecheck, independent review approval, and final GitHub Actions; queue-cap locking is tested across two processes at the real cap of 100.
- NB-09 completed through PR [#126](https://github.com/trydavidqix/nexus-brain/pull/126), head `96fe754`, squash merge `f528849`. The Owner-approved corpus has 24 deterministic cases (14/4/6); the 6-case held-out set observed 0 risk false negatives and 0 approval false negatives. Focused Maestri tests 9/9, Control Plane 27/27, Contracts Node 46/46 + Vitest 1/1, both typechecks, independent review, and all final-head GitHub checks including Windows CBM, MCG, OpenTofu and security passed. The classifier remains benchmark/shadow-only because held-out route accuracy is below the deterministic baseline.
- Owner decision received for NB-12: preserve NB-12 → NB-13 → NB-14. Provider adapters accept an existing `EngineeringPlan`, the NB-09 Resolver-selected task/agent `TaskSkillSet`, and tool profile; adapters do not resolve identity, route, schedule, or dispatch. Maestri wiring and plan creation remain NB-13. Implementation and local validation are in progress on PR [#128](https://github.com/trydavidqix/nexus-brain/pull/128); see [`NB-12 progress`](NB-12_PROVIDER_ADAPTERS_PROGRESS.md).

## Update and sync rules

- The canonical Blueprint owns milestone scope, order, acceptance, and completion status. This file is only the compact execution snapshot.
- Update this file and the NB-07 progress record on material state changes; keep the local `ACTIVE_PIPELINE.md` mirror aligned.
- Push the branch containing documentation changes to GitHub. Do not mark a work package `[x]` without fresh acceptance evidence.
- Progress is completed work packages divided by 25, rounded to the nearest whole percent.
