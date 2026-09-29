# NB-13 Maestri control plane progress

**Status:** DONE — final-head GitHub Actions and independent review passed; PR #129 squash-merged and `main` synchronized
**Branch:** `codex/nb13-maestri-control-plane`
**Final branch head:** `0f3f2636b29ce4283fbf7e79825d3be6ac058a58`
**PR:** [#129](https://github.com/trydavidqix/nexus-brain/pull/129), squash merge `aed758fcdc15f1a0f238e9ef8b3392f5edea0c8a` on 2026-09-29
**Synchronized main:** `aed758fcdc15f1a0f238e9ef8b3392f5edea0c8a`
**Owner decisions (2026-09-29):** EngineeringPlan v2 and the task-scoped bootstrap were approved. The production contract requires authenticated `engineering.execute`, typed `Project.policies.engineering`, exact registered `EngineeringPlanV2.model_profile`, ResourceRouter validation without profile substitution, mandatory `prepareEngineeringContext` before coding dispatch, and Maestri as sole authority for plan/decision/SkillSet/dispatch. The Owner also approved optional `policies.engineering.fallback_model_profile`: exact existing ModelRegistry ID, usable only after Maestri abstain/fallback authorization, at most one attempt, fail closed when absent, no router substitution, with use evidence recorded.

## Implemented locally

- Added strict EngineeringPlan v2 contract while preserving v1 validation and compatibility.
- Updated provider adapters to accept validated v1 or v2 plans.
- Added a Maestri engineering-context preparation component using the existing NB-09 Skill Resolver.
- The component binds the request to the authenticated project/task/agent identity and registered Project and Goal.
- Effective risk is the highest level from the registered Goal, task, candidate plan and Maestri decision input. R4 blocks before skill resolution.
- Candidate plans validate before Resolver mutation. The Resolver selects task/agent-scoped skills; only required bodies load, in Resolver dependency order.
- Required task capabilities must be included in the trusted principal's capabilities. Denied, approval, CEO, abstain and fallback decisions do not resolve/load skills or emit provider context.
- `WorkforceOrchestrator.runPlan()` now requires prepared Maestri context before dispatch. It enforces the exact ModelRegistry ID and fails closed when policy, profile, capability, quota, or review authorization is missing.
- Effective risk from Goal/task/plan/decision drives implementation routing, evidence gates, review authorization/routing, and observations. A Goal R3 + task R1 regression proves lower-risk model profiles are blocked while retaining the task's declared R1 claim.
- Optional `fallback_model_profile` is typed in Project v1/v2 policy. Maestri emits a fallback plan only when its typed decision abstains to `strong_model`; otherwise the task remains blocked.
- The ResourceRouter validates that exact configured profile, task capability, availability and quota. It never selects or promotes a replacement. A configured but invalid/unavailable profile blocks before provider dispatch.
- Fallback permits one provider attempt. Its profile-qualified idempotency key prevents replay across profiles; cache reuse is `used:false`, while actual dispatch is `used:true`. The persisted routing trace records the exact profile, Maestri decision ID and reason codes.
- The native plan + Resolver SkillSet path was locally revalidated. The temporary exception is disabled; [`NB-13_BOOTSTRAP_PLAN.v2.json`](NB-13_BOOTSTRAP_PLAN.v2.json) and [`NB-13_BOOTSTRAP_SKILLSET.json`](NB-13_BOOTSTRAP_SKILLSET.json) remain historical audit evidence only.

## Local validation evidence

Fresh checks on the current branch passed on 2026-09-29 after fallback and idempotency remediation:

- Contracts: 53 Node tests + 1 Vitest test; typecheck passed, including legacy Project v1/v2 records without engineering policy.
- Providers: 3 Node tests + 59 Vitest tests; typecheck passed.
- Control plane: 43 tests; typecheck passed.
- Execution: 4 Node tests + 66 Vitest tests; typecheck passed.
- Providers: 3 Node tests + 59 Vitest tests; typecheck passed.
- Integration: 26/26; architecture: 16 packages; syntax/import: 178 modules; sensitive-data scan: 378 files; `git diff --check` passed.
- Independent read-only review approved the fallback gate, exact profile, one-attempt limit, cache semantics, persistent trace, risk propagation, capability gate and legacy schema compatibility.
- Final PR-head GitHub Actions passed: CBM Windows, MCG, OpenTofu, CodeQL, dependency review, Gitleaks, Jazzer, Semgrep OSS/SAST, ZAP baseline, and OSV Scanner.

## Integration evidence

- PR #129 was merged using the repository's squash-only flow after all final-head checks passed.
- Canonical `main` was fast-forwarded from `9aa6547b68475b62d41c4fb491fb8d90cfd4c9f8` to `aed758fcdc15f1a0f238e9ef8b3392f5edea0c8a`; `HEAD` matched `origin/main` and the worktree was clean.
