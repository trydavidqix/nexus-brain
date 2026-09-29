# NB-13 Maestri control plane progress

**Status:** IN_PROGRESS — blocked on the production entry and authority contract
**Branch:** `codex/nb13-maestri-control-plane`
**Base:** `main` at `9aa6547b68475b62d41c4fb491fb8d90cfd4c9f8`
**Owner decision:** EngineeringPlan v2 and the task-scoped `BOOTSTRAP_ONLY` exception were approved on 2026-09-29.

## Implemented locally

- Added strict EngineeringPlan v2 contract while preserving v1 validation and compatibility.
- Updated provider adapters to accept validated v1 or v2 plans.
- Added a Maestri engineering-context preparation component using the existing NB-09 Skill Resolver.
- The component binds the request to the authenticated project/task/agent identity and registered Project and Goal.
- Effective risk is the highest level from the registered Goal, task, candidate plan and Maestri decision input. R4 blocks before skill resolution.
- Candidate plans validate before Resolver mutation. The Resolver selects task/agent-scoped skills; only required bodies load, in Resolver dependency order.
- Required task capabilities must be included in the trusted principal's capabilities. Denied, approval, CEO, abstain and fallback decisions do not resolve/load skills or emit provider context.
- Bootstrap plan and minimum Resolver-issued TaskSkillSet are recorded in [`NB-13_BOOTSTRAP_PLAN.v2.json`](NB-13_BOOTSTRAP_PLAN.v2.json) and [`NB-13_BOOTSTRAP_SKILLSET.json`](NB-13_BOOTSTRAP_SKILLSET.json). The bootstrap is not runtime authority and remains active until native integration is verified.

## Local validation evidence

Fresh checks on the current branch passed on 2026-09-29:

- Contracts: 51 Node tests + 1 Vitest test; typecheck passed.
- Providers: 3 Node tests + 59 Vitest tests; typecheck passed.
- Control plane after final security remediation: 7 files, 39 tests; typecheck passed.
- Sensitive-data scan passed for 378 files after replacing local skill-file paths with stable skill identifiers; no absolute user-machine path is persisted.
- `git diff --check` passed. Git emitted only LF-to-CRLF working-copy warnings.
- Independent read-only review approved the isolated component after fixes. It did not approve NB-13 as a whole.

## Blocking integration gap

Repository-wide search found no production caller of `prepareEngineeringContext`; only its definition and unit tests reference it. `WorkforceOrchestrator.runPlan()` accepts `MasterPlan` and `baseSha`, then calls `ResourceRouter.route()` directly. The execution task contract has no project/Goal/principal/agent plan envelope. The project stores `policies` as an opaque record, so the source and mapping for the typed `MaestriDecisionPolicy` cannot be derived safely. No existing execution capability grant or model-profile-to-dispatch contract closes this gap.

Until the authority and entry contract is defined and wired, the repository does not prove that all coding tasks require a Maestri-issued EngineeringPlan, that policy comes from the registered Project, or that only Maestri's decision reaches dispatch. Adding a new permission name, interpreting opaque policy fields, or choosing a provider mapping would invent behavior. Do not remove the bootstrap or mark NB-13 done before this integration is implemented and revalidated.

## Remaining acceptance work

1. Resolve the missing trusted task-entry, Project policy interpretation, and execution-profile contract from an existing canonical decision or Owner decision.
2. Wire the production task path so Maestri plan/decision and Resolver output are mandatory before dispatch; prove blocked decisions never reach execution and the selected model profile is enforced.
3. Re-run Contracts, Control Plane, Providers, Execution, and integration tests/typechecks after wiring.
4. Obtain independent review and green required GitHub Actions on final PR head.
5. Disable the task-only bootstrap, revalidate through the native path, update evidence, integrate the PR, and synchronize `main`.
