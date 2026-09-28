# ADR 0001: Fronteiras dos pacotes do Nexus Brain

- **Status:** Accepted as migration constraints; code extraction remains pending.
- **Date:** 2026-09-25
- **Decision owner:** Nexus Brain project owner.
- **Tracker:** `docs/blueprints/NEXUS_BRAIN_MASTER_IMPLEMENTATION_BLUEPRINT.md` (NB-24–NB-29).

## Context

Nexus Brain has one canonical repository and one monorepo. Current domain code is under `packages/{brain,compat,context-gateway,contracts,control-plane,evidence,execution,governance,providers,routing}` and executable apps under `apps/{cli,control-center,edge}`. `packages/compat` preserves optional Maestri-facing exports; `src/` and `bin/` are compatibility shims, not alternate owners. The old MCG/Wire daemon is not currently running; its Windows autostart and MCP sessions are handled as migration cleanup. The `cloud-fabric` modules remain a cohesive existing execution subdomain where current import/test boundaries have not yet been decomposed. Moving files by folder name alone could create package cycles or duplicate task, scheduler, router, context, memory, or dashboard implementations.

The measured initial cloud-fabric import scan identified these future-boundary cycles: control-plane ↔ execution, evidence ↔ control-plane, brain → execution, routing ↔ control-plane, routing ↔ providers, providers → execution, execution ↔ evidence, infrastructure → control-plane/execution/evidence/routing, and brain → routing. Several shared types and ports are currently declared in domain packages (`execution-port.ts`, `context-packet.ts`, `workforce-types.ts`) and are central to those cycles.

## Decision

1. Preserve the user's top-level distinction: `apps/` contains runnable/deployable processes; `packages/` contains reusable libraries.
2. Treat `packages/contracts` as the dependency-neutral home for versioned shared schemas, ports, DTOs, and event envelopes. Domain packages may depend on contracts; contracts must not import domain implementations.
3. Use these package dependency directions as the architectural gate:

   ```text
   apps → packages
   control-plane → contracts, brain, execution, routing, providers, evidence, governance
   execution → contracts, providers, evidence, governance
   routing → contracts, providers
   providers → contracts
   brain → contracts
   evidence → contracts
   governance → contracts
   context-gateway → brain, contracts, evidence
   edge → contracts + context-gateway transport ports; no authoritative cloud stores
   ```

4. Extract shared `ExecutionPort`, context packet, and workforce/job DTOs into contracts before splitting dependent domain modules. Keep ports/DTOs separate from implementation.
5. Split concrete persistence adapters by owning domain (brain, control-plane, evidence). Keep SQL schema and deployment material under `infra/cloud/database`; do not create a shared persistence package or a new micro-package absent from the target tree.
6. Keep the local MCG gateway task store, in-memory operating-core job prototype, workforce shift scheduler, and provider-aware cloud orchestrator distinct until a canonical task/session contract and durable store pass compatibility tests. No second source of task truth is allowed after integration.
7. Keep the existing MCG control-center server/UI as the single dashboard app. Workforce dashboard service/snapshot are read-model capabilities consumed by it, not another server.
8. Keep legacy command/API/package identifiers as compatibility aliases only while an identified consumer needs them; remove an alias only after consumer search and tests prove the migration.
9. Do not create target-only apps/packages/infra directories without real owned code, executable configuration, or migration evidence.

## Consequences

- Package extraction is blocked until the real dependency graph is acyclic under these directions; relative imports across package boundaries are replaced by workspace package imports/exports.
- Import-boundary tests must fail on forbidden dependencies and cycles in CI.
- The first deliverable is a contracts/registry foundation; domain files move in dependency-topological waves, with tests and adapters in the same change.
- The mapping and implementation status stay in the single Master Blueprint; this ADR records stable boundary decisions only.
- **Superseded cutover note (2026-09-28):** the canonical Nexus checkout is `%USERPROFILE%\Desktop\Projetos\nexus-brain`; its launchers and project MCP are verified at that path. Do not rename it into a Lumenva path. NB-29 still gates final readiness on the unresolved historical MCG state inventory and preservation evidence for a protected worktree; see [`NB-29 cutover revalidation`](../engineering/NB-29_CUTOVER_REVALIDATION_2026-09-28.md).

## Alternatives rejected

- **Move whole `operating-core` to one target package:** rejected because it recreates a monolith under a new name and does not give the requested app/package ownership.
- **Split every source folder immediately by name:** rejected because current imports contain cycles and several similarly named modules implement different responsibilities.
- **Add a generic persistence or common-core package:** rejected because it is outside the requested target architecture and would become a dumping ground/micro-package boundary.
- **Delete or overwrite legacy MCG/Maestri identifiers:** rejected until active consumers and compatibility needs are tested.

## Validation required before implementation acceptance

- Re-run import and package dependency graph after each extraction; no unapproved cycle.
- Test public contracts and old aliases against fixtures and current callers.
- Run frozen PNPM install, unit tests, typecheck, integration/e2e, security/fuzz/evals and GitHub Actions for the migrated paths.
- Mark implementation work packages `DONE` only with test/CI evidence linked in the Master Blueprint.
