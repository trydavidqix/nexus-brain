# NB-14 Agent Factory progress

**Status:** BLOCKED before code changes
**Branch:** `codex/nb14-agent-factory`
**Base:** `main` at `aed758fcdc15f1a0f238e9ef8b3392f5edea0c8a`
**Dependency:** NB-13, integrated through PR #129 at the base commit above

## Discovery evidence

- The canonical acceptance contract is the NB-14 row in [`NEXUS_BRAIN_MASTER_IMPLEMENTATION_BLUEPRINT.md`](../blueprints/NEXUS_BRAIN_MASTER_IMPLEMENTATION_BLUEPRINT.md). It requires validated AgentDefinitions; mandatory Engineering Control and Skill Resolver enforcement; per-task/per-agent skill policy and context budgets; pre-backend browser effect, origin, credential, file, transmission and approval gates; risk, scope, contract, dependency, verification and bounded-loop gates; evidence hooks; and prevention of runtime self-declared completion or policy bypass.
- NB-13 provides Maestri context preparation, exact authenticated capability, the Resolver-selected TaskSkillSet and integrated execution preparation. Existing policy pieces include `packages/execution/src/cloud-fabric/runtime-policy.ts`, `approval-gate.ts`, `scope-guard.ts`, `evidence-gate.ts` and `workforce-orchestrator.ts`.
- Existing coverage includes `packages/control-plane/tests/skills-runtime.test.mjs`, `packages/control-plane/tests/engineering-orchestration.test.ts`, `packages/execution/src/cloud-fabric/workforce-orchestrator.test.ts`, and contract tests for browser plans/runtime.
- Read-only search found no Nexus-native AgentDefinition/Agent Factory wired into the execution flow. `packages/contracts/schemas/agent/agent.v1.schema.json` identifies itself as `lumenva.agent.v1`; it is not a suitable Nexus authority contract.
- Browser host/backend execution is NB-15. NB-14 scope is limited to policy and approval enforcement before backend execution.

## Blocker

The repository's mandatory `core-discipline` requires an EngineeringPlan emitted by Maestri and the Resolver-selected TaskSkillSet for this exact task and agent before any code changes. The Maestri CLI cannot connect from this Codex terminal: both `maestri list` and the required diagnostic `maestri debug` return `maestri: only available inside Maestri terminals (MAESTRI_PIPE not set).` No local plan or TaskSkillSet was fabricated, and no code was changed.

## Exact action needed

Resume this task from a Maestri-connected terminal that can issue the NB-14 EngineeringPlan and resolve the exact task/agent SkillSet. After that dispatch is available, continue implementation on this branch and update this record with fresh tests, review, CI and integration evidence.

## Validation state

- NB-13 final-head checks and merge evidence: [`NB-13 progress`](NB-13_MAESTRI_CONTROL_PLANE_PROGRESS.md).
- NB-14 code/tests/typechecks: not started; blocked before code changes.
