# NB-09 Decision Tiers Progress

**Status:** BLOCKED — implementation is in progress; acceptance evidence is incomplete.
**Branch:** `codex/nb09-decision-tiers`
**Base:** `779d334ddacae82bdde4643c1a04d5d04c4240a2`
**Updated:** 2026-09-29 03:47 Europe/Lisbon

## Implemented locally

- Metadata-only Skill Registry with deterministic search, task/risk filtering, version-drift detection, candidate handling, dependency resolution, conflicts, and context-budget checks.
- Resolver-issued selections scoped by `task_id + agent_id`; skill bodies load only after selection. Returned metadata and task state are detached from internal state.
- Scoped load/completion/compaction events, serialized body loads, and guarded event/state commit behavior.
- Typed deterministic `maestri.decide()` policy baseline. Denial, approval, and R4 gates outrank classifier suggestions; unresolved cases abstain to a typed `strong_model` fallback outcome.
- Local decision benchmark harness compares an injected local adapter with deterministic baseline and reports accuracy, Brier score, expected calibration error, policy override attempts, and no production authority.

`maestri.decide()` remains a contract/benchmark capability, not the active scheduler routing authority. NB-13 owns project identity resolution and production integration across route, risk, priority, retry, review, and approval.

## Verification evidence

Final local verification after the event-failure regression test:

- Control Plane unit suite: 24/24 passed.
- Contracts unit suite: Node 46/46 and Vitest types 1/1 passed.
- Control Plane and Contracts typechecks passed.
- `git diff --check` passed; Git printed line-ending conversion warnings for changed Windows text files.
- RED/GREEN regressions cover missing/candidate/out-of-scope required skills and dependencies, metadata/state mutation, concurrent load budget, selection revocation during body read, resolver attempts while the `LOADED` event is pending, and event-writer failure with lock release and successful retry.
- Independent review approved the implementation and the final event-writer failure test.
- Draft PR [#126](https://github.com/trydavidqix/nexus-brain/pull/126), code head `8958c01`: all GitHub Actions passed, including CodeQL, Dependency Review, Gitleaks, Semgrep, OSV, ZAP, MCG, OpenTofu, and the Windows CBM fixture. First MCG attempt failed because the PR title violated the Git naming contract; a policy-compliant title was set and the MCG rerun passed without a code change.

The standard frozen install initially failed while building the existing `better-sqlite3` native addon because Visual Studio C++ Build Tools are unavailable. `pnpm install --frozen-lockfile --ignore-scripts` linked the already-declared JS dependencies without tracked-file or lockfile changes. NB-09 tests do not use the native addon.

## Acceptance blockers

1. `local-decision-benchmark.ts` defines an injected adapter contract and metric harness. It does not implement or exercise a concrete local embedding/classifier model.
2. No versioned held-out Maestri decision dataset exists in the repository. Current unit fixtures are not calibration evidence.
3. No project-defined maximum for risk or approval false-negative rate exists. Do not select a numeric production safety threshold without project data and owner policy.

The Blueprint lists `multilingual-e5-small` as the default embedding candidate and BGE-M3 as a challenger, but does not provide a pinned model artifact or Maestri evaluation corpus. The harness accepts caller-provided calibrated confidence; it does not fit calibration from raw scores or prove held-out dataset provenance. Therefore NB-09 cannot be marked DONE from current tests.

## Required next decision

Provide or approve a versioned held-out decision dataset source and the project-defined risk/approval false-negative gate. Then implement and benchmark the concrete local adapter against that data. Keep it in benchmark/shadow mode until later Blueprint gates authorize production authority.
