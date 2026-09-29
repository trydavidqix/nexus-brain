# NB-13 Maestri control plane progress

**Status:** IN_PROGRESS — native task entry is wired; fallback profile policy remains unresolved
**Branch:** `codex/nb13-maestri-control-plane`
**Base:** `main` at `9aa6547b68475b62d41c4fb491fb8d90cfd4c9f8`
**Owner decisions (2026-09-29):** EngineeringPlan v2 and the task-scoped bootstrap were approved. The production contract requires authenticated `engineering.execute`, typed `Project.policies.engineering`, exact registered `EngineeringPlanV2.model_profile`, ResourceRouter validation without profile substitution, mandatory `prepareEngineeringContext` before coding dispatch, and Maestri as sole authority for plan/decision/SkillSet/dispatch.

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
- The native plan + Resolver SkillSet path was locally revalidated. The temporary exception is disabled; [`NB-13_BOOTSTRAP_PLAN.v2.json`](NB-13_BOOTSTRAP_PLAN.v2.json) and [`NB-13_BOOTSTRAP_SKILLSET.json`](NB-13_BOOTSTRAP_SKILLSET.json) remain historical audit evidence only.

## Local validation evidence

Fresh checks on the current branch passed on 2026-09-29 after risk propagation:

- Contracts: 53 Node tests + 1 Vitest test; typecheck passed, including legacy Project v1/v2 records without engineering policy.
- Providers: 3 Node tests + 59 Vitest tests; typecheck passed.
- Control plane: 7 files, 41 tests; typecheck passed.
- Execution: 4 Node tests + 62 Vitest tests; typecheck passed.
- Integration: 26/26; architecture: 16 packages; syntax/import: 178 modules; sensitive-data scan: 378 files; `git diff --check` passed.
- Sensitive-data scan passed for 378 files after replacing local skill-file paths with stable skill identifiers; no absolute user-machine path is persisted.
- Independent review confirmed the risk propagation, exact-profile behavior, capability gate and legacy schema compatibility. It blocks NB-13 on the missing bounded strong-model fallback dispatch contract.

## Remaining acceptance gap

The Blueprint requires bounded strong-model fallback for unresolved decisions. Current code returns a typed fallback decision and blocks dispatch safely. No canonical fallback profile ID or policy mapping exists. ResourceRouter must not substitute `model_profile`; selecting a fallback profile affects provider and cost. Do not invent this mapping or mark NB-13 done without an explicit project policy/Owner decision.

## Remaining acceptance work

1. Define a bounded fallback profile policy that preserves Maestri authority and exact-profile validation without automatic provider substitution.
2. Implement and test fallback dispatch only after that policy is defined.
3. Obtain independent approval and green required GitHub Actions on final PR head.
4. Update evidence, integrate PR #129, and synchronize `main`.
