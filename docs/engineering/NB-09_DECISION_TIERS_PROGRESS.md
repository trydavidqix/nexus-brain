# NB-09 Decision Tiers Progress

**Status:** READY FOR FINAL CI AND INTEGRATION — independent review approved; external CI for the final head is pending.
**Branch:** `codex/nb09-decision-tiers`
**Base:** `779d334ddacae82bdde4643c1a04d5d04c4240a2`
**Updated:** 2026-09-29

## Implemented locally

- Metadata-only Skill Registry with deterministic search, task/risk filtering, version-drift detection, candidate handling, dependency resolution, conflicts, and context-budget checks.
- Resolver-issued selections scoped by `task_id + agent_id`; skill bodies load only after selection. Returned metadata and task state are detached from internal state.
- Scoped load/completion/compaction events, serialized body loads, and guarded event/state commit behavior.
- Typed deterministic `maestri.decide()` policy baseline. Denial, approval, and R4 gates outrank classifier suggestions; unresolved cases abstain to a typed `strong_model` fallback outcome.
- Local decision benchmark harness compares an injected local adapter with deterministic baseline and reports route accuracy, correctness Brier score, expected calibration error, policy override attempts, and no production authority. `correctness_brier_score` measures squared error for confidence in route correctness; it is not multiclass route Brier because candidates do not expose per-route probabilities.
- Versioned `maestri-decision-contract-v1` corpus with 24 deterministic contract-derived cases: 14 train, 4 calibration, and 6 held-out. Cases are labeled by `maestri.decide()`; feature-signature groups are kept inside one split.
- Nexus-native categorical Naive Bayes classifier fitted on typed contract features; temperature and the global abstention threshold are selected from calibration rows supported by the training feature domains. Of 4 calibration rows, 3 are effective fit rows; the OOD row is skipped and reported via `calibration_fit_count`. It excludes identity/evidence and route-string values from learned features, abstains on conflicts, unsupported/non-exact inputs and unseen route domains, and preserves risk/approval/CEO flags on fallback.
- Held-out benchmark (6 cases): route accuracy 0.667 vs deterministic baseline 1.000 (delta -0.333), correctness Brier 0.3601, ECE 0.4180, 4 abstentions, 0 policy override attempts, 0 risk false negatives, and 0 approval false negatives. Safety gate passed for this small corpus only; production authority remains false.
- Safety false-negative counts inspect returned fallback flags even when a candidate abstains; an abstention that drops a required review or approval flag fails the gate.
- Expected review/approval positives are derived from the deterministic `decide(input)` contract, not caller-provided labels. The safety gate also requires at least one positive example for each dimension. Abstaining candidates must route to `fallback`; hard-policy route mismatches count even if abstaining.

`maestri.decide()` remains a contract/benchmark capability, not the active scheduler routing authority. NB-13 owns project identity resolution and production integration across route, risk, priority, retry, review, and approval.

## Verification evidence

Fresh local verification after classifier, corpus and safety-fallback changes:

- Focused Maestri decision suite: 9/9 passed.
- Control Plane unit suite: 27/27 passed.
- Contracts unit suite: Node 46/46 and Vitest types 1/1 passed.
- Control Plane and Contracts typechecks passed.
- `git diff --check` passed; Git printed line-ending conversion warnings for changed Windows text files.
- Fresh root verification confirmed the above local checks. External CI for the final head remains pending.
- Regression coverage confirms deterministic corpus labels/splits, no feature-signature group crossing splits, held-out risk/approval safety gate, fallback on conflicts/unsupported/OOD, and benchmark-only authority.
- RED/GREEN regressions cover missing/candidate/out-of-scope required skills and dependencies, metadata/state mutation, concurrent load budget, selection revocation during body read, resolver attempts while the `LOADED` event is pending, and event-writer failure with lock release and successful retry.
- Independent review approved the implementation and the final event-writer failure test.
- Draft PR [#126](https://github.com/trydavidqix/nexus-brain/pull/126), code head `8958c01`: all GitHub Actions passed, including CodeQL, Dependency Review, Gitleaks, Semgrep, OSV, ZAP, MCG, OpenTofu, and the Windows CBM fixture. First MCG attempt failed because the PR title violated the Git naming contract; a policy-compliant title was set and the MCG rerun passed without a code change.

The standard frozen install initially failed while building the existing `better-sqlite3` native addon because Visual Studio C++ Build Tools are unavailable. `pnpm install --frozen-lockfile --ignore-scripts` linked the already-declared JS dependencies without tracked-file or lockfile changes. NB-09 tests do not use the native addon.

## Limits

1. Owner accepted this versioned contract-derived corpus and the gate of zero observed risk/approval false negatives for NB-09. The corpus is small; the held-out safety counts apply only to these six cases.
2. `MaestriDecisionInput` contains no task text. The classifier categorizes structured policy/risk/signal features and cannot infer semantic similarity across natural-language tasks.
3. Held-out route accuracy is below the deterministic baseline. Keep the classifier benchmark/shadow-only; do not promote its suggestions to production authority.
4. Only 3 of 4 calibration rows contribute to fitting because one is outside the training feature domains. The abstention threshold is global and shadow-only; no per-risk or per-approval threshold is inferred.

Representative decision traces and semantic inference evidence remain later production evidence; under the Owner's acceptance of this corpus, they are not NB-09 milestone blockers. The Blueprint lists `multilingual-e5-small` as the default embedding candidate and BGE-M3 as a challenger. No pinned model artifact was available and no model/framework was downloaded.

NB-09 is ready for final CI and integration. Scheduler integration remains owned by NB-13.
