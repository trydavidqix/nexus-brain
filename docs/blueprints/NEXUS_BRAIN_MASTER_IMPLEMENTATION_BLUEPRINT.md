# Nexus Brain — Master Implementation Blueprint

**Canonical project:** Nexus Brain (`trydavidqix/nexus-brain`)
**Default branch:** `main`
**Status:** NB-02 COMPLETE — NB-03 IN_PROGRESS; owner has canceled all recurring-cost cloud provisioning. DEV is local-first and zero-additional-monthly-cost; no PROD in this phase.
**Last reconciled:** 2026-09-26

This is the only active cross-project implementation tracker. Nexus Brain itself is one product and one monorepo. The ecosystem it manages is explicitly multi-project: many independent projects, repositories, workspaces, sessions and agents may be registered and governed by Nexus without being moved into the Nexus monorepo. “Maestri”, “Lumenva Brain”, “Context Gateway/MCG”, “Local Runtime”, “Cloud Fabric”, “Command Center” and “Everything Edge” name historical designs or internal modules—not separate products or repositories. CRM, voice, social-business/Meta integrations, tenant business data and unrelated Lumenva code remain out of scope unless a later explicit decision identifies an exact owned path.

## 1. Mission and completion rule

Build one durable, evidence-based agent platform that owns shared memory/context, project intelligence, task/session orchestration, safe execution, provider integrations, Windows edge sensing, governance, observability and recovery. Memory safety principle: **Agents produce observations; evidence produces knowledge.** Shared memory exists to distribute verified, scoped, source-backed knowledge—not to make multiple models repeat the same unsupported claim. GitHub is the source of truth for code and versioned policy; the local PostgreSQL/pgvector store is the DEV source of truth for canonical memory and operational records. Cloud hosting is deferred unless separately authorized.

Implementation order for every work package:

`scope and owner → failing test/evidence plan → implement → test → independent validation → update this blueprint → next package`

`DONE` requires the package acceptance criteria and evidence. A written design, skill, successful CI run, or agent claim alone is not implementation proof. Unknowns stay `UNRESOLVED`; no percentage is inferred from elapsed time or prose.

**Current operational phase:** `BLUEPRINT IMPLEMENTATION`. Migration readiness NB-24–NB-29 and implementation NB-02 are complete. NB-03 is the active package with a zero-cost local architecture. No billing link, paid resource, PROD deployment or automatic paid fallback is allowed. Existing partial MCG, dashboard and security work does not satisfy their full acceptance gates. Do not skip dependency order or mark a package `DONE` without its evidence.

## 2. Canonical system boundary

```text
NEXUS BRAIN — ONE PLATFORM / ONE BRAIN / ONE CONTROL PLANE
├── Nexus codebase: one product and one monorepo
├── Project Registry: project identity, repository/workspace binding, stack, policy, permissions and lifecycle
├── Control plane (Maestri): session/task state, DAG, routing, approvals, budgets, scheduler and project-aware orchestration
├── Brain services: global/project/session/task memory, temporal facts, provenance, context, retrieval and reusable capabilities
├── Memory runtime: local Hindsight API with its internal worker over embedded pg0 PostgreSQL/pgvector for DEV
├── Task Intelligence: task-boundary detection, task-scoped retrieval, validated reusable Skills/SOPs
├── Code Intelligence: replaceable structural-code backend for symbols, calls, dependencies, impact, tests, Git changes and cross-repo evidence
├── Research Intelligence: evidence-first multi-source planning, fanout, normalization, dedupe, rerank, clustering and grounded findings
├── Reach: capability/provider resolver across API/MCP/CLI/browser transports with health/quota/cost/fallback policy
├── BrowserMesh: browser host/session routing, versioned recipes, policy/approval gates and replaceable browser backends
├── Engineering Control Plane: mandatory task/risk/scope routing, methodology selection, verification and delivery gates for every coding agent
├── Execution: agent factory/supervisor, local runtime, Codex Cloud, Jules/provider adapters
├── Edge: Windows Everything 1.5 + Git + minimal Lumenva Edge/MCP bridge
├── Interfaces: Claude Code, Codex, Gemini CLI, Antigravity, Jules
├── Operations: multi-project dashboard/reports, traces, CI/security, backups and disaster recovery
└── Governance: contracts, evidence, project isolation, branch/PR gates and auditable cleanup

MANAGED ECOSYSTEM
├── MANY independent projects
├── MANY repositories
├── MANY local/cloud workspaces
├── MANY sessions/tasks
└── MANY agents/providers
```

Reuse the existing Nexus repository, tests, MCG dashboard, Local Runtime and transferred Maestri/Cloud Fabric files where ownership is proven. Managed projects remain in their own repositories/workspaces; registering a project must not require copying or vendoring that project's code into Nexus. Do not create a second memory engine, task store, router, dashboard, MCP surface, filesystem watcher or governance policy. Preserve old package/API names as compatibility identifiers until an individually tested migration changes them; renaming the GitHub repository does not authorize a blind code-wide rename.

## 3. Reconciled architecture decisions

| Concern | Canonical V1 decision | Preserved alternative / status |
|---|---|---|
| Product identity | Nexus Brain is the sole platform product; legacy systems become internal modules. The Nexus codebase remains one monorepo, while the managed ecosystem is many independent projects/repositories/workspaces. | Historical source documents retain their original names for provenance. |
| Deployment | Local-first DEV on existing Windows hardware: Hindsight API and its built-in worker start on demand in one process; embedded pg0 PostgreSQL/pgvector persists locally. No always-on service, cloud provisioning, billing link or PROD in this phase. | The approved GCP/OpenTofu design is retained only as an unapplied reference. Any future cloud deployment requires a new owner decision and cost approval. |
| Canonical stores | GitHub = code/config; local pg0 PostgreSQL + pgvector = DEV Brain state; local create-only backups = DEV recovery. | Cloud SQL, Cloud Storage and Firebase SQL Connect are deferred; do not create or apply them. |
| Local machine | Tiny Edge uses Everything 1.5 Journal + Git; queue/snapshots are bounded, encrypted, and non-authoritative. | Do not build a recursive scanner or parallel filesystem watcher. Fallback to Git status/diff if Everything is unavailable. |
| Memory/indexing | One Nexus-owned memory API and canonical provenance/temporal model; **Hindsight is the V1 memory engine behind a replaceable `MemoryEngine` adapter, not the authority**. Agent/model/Hindsight outputs are observations or candidates, never truth by assertion. Memory lifecycle is `OBSERVED → CANDIDATE → VERIFIED → CANONICAL`, with `SUPERSEDED`, `CONFLICTED` and `REVOKED` states. Canonical promotion remains Nexus-owned and requires provenance, scope and supporting evidence. | **Graphiti is deferred as a benchmark alternative**, not installed in V1. Evaluate it only if a concrete graph/temporal retrieval limitation is proven. |
| Retrieval/reuse | Hindsight V1 supplies semantic, lexical, graph/relationship and temporal retrieval over the PostgreSQL/pgvector memory stack; Nexus applies project/task scope, evidence/provenance/freshness policy and Context Compiler filtering before provider delivery. More memory is not automatically better context. | No Neo4j, Graphiti deployment, second vector DB, or second authoritative memory engine in V1. |
| Code Intelligence | Nexus owns a provider-neutral `CodeIntelligenceEngine`; **codebase-memory-mcp is the initial V1 adapter/backend candidate after pinned-version, security, Windows and correctness validation**. It provides structural code evidence (AST/LSP graph, callers/callees, imports, routes, tests, Git changes, impact and cross-repo relationships), not canonical truth. | Do not make any code-graph backend authoritative. If coverage/confidence is insufficient, fall back to direct Git/file/test/runtime evidence. The adapter must remain replaceable. |
| Task Intelligence | Nexus-native task-boundary detection separates multiple tasks inside a session, narrows retrieval to the active task, and can derive reusable Skills/SOP candidates only from evidenced successful work. | Patterns observed in TencentDB Agent Memory/community forks are implementation references, not a second memory/control plane. No automatic promotion of generated Skills to global/canonical status. |
| Context delivery | Nexus can assemble a bounded edit/context bundle combining current code structure, tests, blast radius, Git changes, verified memory and evidence; Maestri selects a minimal tool profile for the task. | Avoid exposing the full MCP/tool catalog or bulk repository/memory context to every agent by default. |
| Web Research / Reach | Nexus owns `ResearchEngine`, `ReachEngine` and the normalized `Evidence` contract. Agent Reach (`Panniantong/Agent-Reach`, validated against v1.5.0) is an optional bootstrap provider/reference for capability routing/doctor behavior; Last30Days (`mvanhorn/last30days-skill`, validated against v3.25.0) is an optional bootstrap provider/reference for multi-source research/fanout/scoring/watchlist patterns. | Neither external project becomes the control plane, evidence authority or permanent dependency. Native Nexus routes replace provider-specific behavior incrementally behind stable contracts. |
| BrowserMesh | Nexus owns browser intent, plan, host/session/lease/profile/policy/recipe/evidence lifecycle. **Playwright direct is the deterministic interaction core** behind a narrow Nexus `BrowserBackend`; **Scrapling is the Web Retrieval/Crawl backend** for HTTP/read/extract/crawl before Chromium; **Stagehand is an eval-gated semantic resolver**; visual computer-use providers are last-resort adapters; Direct CDP/Playwright Server are the first remote-host transports. Existing `trydavidqix/BrowserMesh`, Lumenva/Maestri Wave 4 BrowserMesh code and the Playwright CLI skill are harvested selectively before new implementation. | WebMCP/native API/MCP/CLI routes remain preferred when structured capability exists. Steel/managed browser infrastructure, Browser Use and Skyvern remain optional adapters/references until Nexus evals justify them. Browser backends never become policy or task-state authorities. |
| Engineering Control Plane | Every Nexus-governed coding task receives a deterministic `EngineeringPlan` before edits: task type, risk, scope, contracts, autonomy level, required methodology modules and verification gates. The framework is mandatory; individual modules are loaded only when relevant. | Skills alone are advisory and cannot guarantee enforcement across runtimes. Nexus/Maestri policy, runtime hooks where supported, and CI/merge gates provide enforcement; provider-specific plugins/adapters are distribution surfaces, not authority. |
| Engineering orchestration | Single-agent is default. Sequential, parallel fan-out, DAG, loop and hybrid orchestration are available only when task complexity/evidence justifies them. MegaBrain is a reference for orchestration patterns, self-healing, handoff and resume—not an autonomous authority. | No global zero-question rule, fixed coverage target or automatic dependency installation. Risk, project policy and evidence determine autonomy and gates. |
| Research memory | Raw web evidence and research runs live in canonical PostgreSQL/object storage with provenance; only governed findings/observations enter Hindsight memory. | Do **not** deploy Graphiti as V1 research memory. Graphiti remains the already-deferred benchmark alternative unless a proven Nexus workload gap justifies it. |
| MCP | One stable Brain MCP surface. V1 tools: `brain_context`, `brain_search`, `brain_reuse`, `brain_remember`, `local_search`, `brain_status`. | Earlier 8-tool variants remain in source archive; aliases may be added only for proven client compatibility. |
| Context compiler | Deterministic filtering, scope/provenance checks and token budgeting first; one provider-neutral compiler path in V1, with Gemini only where a model pass is objectively required. | Multiple compiler providers remain replaceable and benchmark-gated; context compilation is not the decision router. |
| Decision / Maestri Reflex | **One Nexus-owned `maestri.decide()` authority**: hard rules + Policy Engine first, then an optional local semantic/classification layer with calibrated confidence and explicit `abstain`, then strong-model fallback only for unresolved cases. **Jev is a reference pattern, not a dependency; no paid Jev runtime is required.** | V1 ships the typed decision contract, deterministic baseline and benchmarkable open-component adapters; learned/custom Maestri Reflex training is a later gated phase after sufficient evidenced traces/outcomes. No second Jev/Fast/Resource/Council router authority. |
| Agents/runtime | One task/session/event model; Agent Factory, policy, evidence and bounded loop are shared by local/cloud/Jules execution. | Council, C4, AutoImprove and learned Reflex are later gated modules, not duplicate control planes or V1 prerequisites. |
| Provider/native directories | Codex, Claude Code, Gemini/Antigravity and other provider runtimes keep their official global install/config/state directories under provider ownership. Nexus integrates only through supported interfaces such as MCP, API, CLI, hooks and project-level configuration; it must not relocate, fork, vendor, patch or convert provider home/install directories into Nexus-owned paths. | Project-scoped adapter/config files may live in Nexus when officially supported. Official provider updates must remain independently applicable without requiring Nexus directory migration. |
| Recovery | GitHub for committed code; unique create-only local pg_dump backups for DEV with checksum and restore verification. | Cloud SQL backup/PITR and GCS vault are future options only. Never use mutable `latest.zip`, auto-commit as backup, or irreversible retention locks before restore tests. |
| Scope | Only Nexus Brain-owned platform code enters this repo. External projects are registered, indexed and governed in place through project identity + repository/workspace bindings; they are not absorbed into the Nexus monorepo. | CRM, voice, Meta/social-business and tenant/business code remain outside this repo unless a later explicit migration decision changes ownership. |

## 3A. Multi-project platform model

Nexus is not a single-project brain. It is the permanent control and intelligence platform for present and future projects.

Core invariant:

`NEXUS ITSELF = one product + one monorepo`

`NEXUS-MANAGED ECOSYSTEM = many independent projects + repositories + workspaces + sessions + agents`

### Project Registry

Every managed project has a stable `project_id` and registry record binding at minimum:

- canonical repository and default branch;
- optional local/cloud workspace locations;
- project lifecycle/status;
- stack/runtime metadata;
- allowed agents/providers/tools;
- project policies, approvals and budgets;
- project memory/knowledge namespace;
- task/session/evidence namespace;
- Git/CI/deployment bindings where applicable.

Project metadata may be discovered from repository evidence and/or an optional project-scoped descriptor (for example `.nexus/project.yaml`) when later justified. The descriptor is metadata, not a requirement to relocate the project.

### Memory and context scopes

Shared memory must be explicitly scoped. V1 scope model:

`GLOBAL → PROJECT → SESSION → TASK`

Agent-private scratch state may exist, but it is not canonical shared memory by default.

Retrieval order is project-aware and task-bounded: task/session context first, then project memory, then only relevant global knowledge. Cross-project reuse is allowed only for evidence-backed reusable capabilities/patterns and must never leak project-specific secrets, incompatible decisions or stale configuration into another project's context.

### Maestri role

Maestri is the Nexus-native control plane/orchestrator, not a separate product and not a project-specific agent. It receives operator intent, resolves `project_id`, loads the project's registry/policy/context, routes work to the appropriate provider/runtime, tracks tasks/sessions/evidence, and keeps authority over lifecycle, budgets, approvals and recovery.

Provider agents execute bounded work inside the selected project's repository/workspace. They do not become the source of truth for project identity, task state, policy or canonical memory.

### Multi-project Control Center

The Nexus Control Center must support portfolio-level and project-level views. Portfolio view shows registered projects, health/status, active tasks, agents, budgets, incidents and blockers. Project drill-down exposes that project's tasks, sessions, memory, knowledge, Git/PRs, tests, deployments, evidence, costs and history without mixing unrelated project state.

## 3B. V1 memory engine: Hindsight

**Decision:** Hindsight is the V1 memory engine. Nexus Brain remains the authority over canonical truth, scope, provenance, conflict resolution, policy and context delivery. For DEV, run the full Hindsight API on demand on existing Windows hardware, use pg0's embedded PostgreSQL/pgvector, and leave Hindsight's internal worker enabled. No paid cloud runtime or external database is part of this phase.

```text
Nexus Brain API
      ↓
Memory Governance
      ↓
MemoryEngine interface
      ↓
HindsightAdapter (V1)
      ↓
Hindsight API + built-in worker (on demand)
      ↓                    ↑
pg0 embedded PostgreSQL + pgvector
      ↓
local persistent data directory + verified backups
```

Hindsight officially supports pg0 on Windows x86_64. In development mode, its API processes background tasks internally; a dedicated worker is reserved for high-throughput deployments and is not required here. Hindsight's default embeddings and reranker run locally. Its LLM provider is Gemini Developer API only when the selected project remains unbilled and the model is currently available in the Free Tier. On free-tier accounts, Google may use submitted content to improve products; sensitive or restricted memory must not be sent to Gemini. Quota exhaustion, errors or unavailable models fail closed; no paid model/provider fallback, Search grounding, Vertex AI or billing link.

Zero-cost is an architecture constraint, not an assertion that free quotas are unlimited. Gemini Free Tier limits are model/project/account-specific and can change; check AI Studio's active RPM/TPM/RPD before live testing. Do not exceed that tier. Google AI Pro subscription and Google Developer Program Premium credits do not authorize API spending. The optional USD 10/month credit is excluded from the operating plan and must never be treated as budget.

### Responsibility boundary

Nexus owns:

- canonical memory lifecycle and promotion policy;
- `OBSERVED/CANDIDATE/VERIFIED/CANONICAL/SUPERSEDED/CONFLICTED/REVOKED` states;
- provenance/evidence requirements;
- GLOBAL/PROJECT/SESSION/TASK scopes;
- project isolation and cross-project reuse policy;
- conflict handling, freshness rules and source re-check;
- Context Compiler and Token Firewall;
- provider-facing Brain API/MCP contracts.

Hindsight owns V1 memory-engine mechanics behind the adapter:

- retain/ingest memory candidates;
- semantic retrieval;
- lexical retrieval;
- relationship/graph-assisted retrieval;
- temporal retrieval;
- ranking/reranking and memory-engine indexing;
- optional reflection only as non-canonical inference.

**Hindsight output never self-promotes to canonical truth.** Any `reflect`, inferred relation, summary or model-generated conclusion re-enters Nexus as `OBSERVED` or `CANDIDATE` and must pass normal verification policy.

### Multi-project banks, tags and retrieval

Use **one Hindsight bank per project**, plus one separate global bank:

```text
bank: global
bank: project:<project_id>
```

`SESSION` and `TASK` remain Nexus scopes, but are represented inside the relevant project bank with Hindsight tags/metadata rather than separate banks:

```text
tag: session:<session_id>
tag: task:<task_id>
tag: scope:project|session|task
tag: type:<memory_type>
```

The invariant is strong isolation by `project_id`: a project bank contains that project's memory; session/task tags narrow retrieval inside it. Cross-project retrieval is denied by default.

For normal task context, Nexus performs **separate retrievals** and owns the merge:

```text
1. query project:<project_id> bank with task/session tags
2. query global bank only when reusable global knowledge is relevant
3. apply Nexus provenance/freshness/conflict/security policy
4. merge + deduplicate + rank
5. Context Compiler + Token Firewall
6. deliver bounded context to the provider agent
```

Hindsight banks do not become an implicit cross-project sharing mechanism. Only evidence-backed reusable knowledge may be promoted to the global bank by Nexus policy.

### Replaceability

Nexus code must depend on an internal `MemoryEngine` contract, not directly on Hindsight APIs throughout the codebase. Minimum V1 adapter surface:

```text
retain()
recall()
search()
relate()
reflect()
health()
```

The Hindsight-specific implementation lives behind `HindsightAdapter`. Provider agents call Nexus Brain API/MCP, not Hindsight directly.

### Graphiti status

Graphiti is **DEFERRED / BENCHMARK ALTERNATIVE** for V1. Do not operate Hindsight and Graphiti as parallel authoritative memory systems. Benchmark Graphiti only if a real Nexus workload demonstrates insufficient graph traversal, temporal relationship quality, retrieval accuracy or scale with Hindsight. Adoption requires same-task A/B evidence, migration/consistency design and no duplicate source of truth.

## 3C. Task, code and evidence intelligence implementation model

The reverse-engineering review of TencentDB Agent Memory, its task/team-memory derivatives, codebase-memory-mcp and related code-intelligence projects adds implementation detail **without adding new top-level work packages or creating another Brain**.

### Internal contracts first

Nexus code depends on internal contracts, not vendor APIs throughout the codebase:

```text
MemoryEngine
├── retain()
├── recall()
├── search()
├── relate()
├── reflect()
└── health()

CodeIntelligenceEngine
├── index()
├── searchSymbol()
├── getContext()
├── getCallers()
├── getCallees()
├── getTests()
├── analyzeImpact()
├── getChanges()
└── health()

EvidenceEngine
├── record()
├── validate()
├── supersede()
├── conflict()
└── trace()

TaskIntelligence
├── detectBoundary()
├── currentTask()
├── retrieveSkills()
└── closeTask()
```

V1 mappings:

- `MemoryEngine → HindsightAdapter`.
- `CodeIntelligenceEngine → CBMAdapter` initially, subject to pinned-version/security/correctness validation.
- `TaskIntelligence → Nexus-native`.
- Provider agents call Nexus contracts; they do not call Hindsight or the code-intelligence backend as authorities.

### Evidence lifecycle

Retrieval alone does not prove usefulness. Nexus records a separate evidence lifecycle:

```text
RECALLED → SELECTED → INJECTED → USED → VALIDATED → CONTRIBUTED
```

A memory/Skill may be retrieved and still contribute nothing. Positive contribution requires a concrete link to a decision/change/tool action plus independent validation such as tests, CI, source inspection or another objective checker.

### Task-aware context and Skills

A session may contain multiple tasks. Nexus detects task boundaries and keeps task-scoped context separate:

```text
PROJECT → SESSION → TASK
```

On a new task, old task context is not bulk-carried forward. After evidenced successful work, Nexus may derive a procedural Skill/SOP as a `CANDIDATE`; it becomes project-level or global reusable knowledge only after provenance, compatibility and validation gates.

### Code Intelligence boundary

The initial code-intelligence backend supplies evidence about the **current code**:

- symbols, definitions, callers/callees and imports;
- routes/services and dependency relationships;
- related tests and change/blast-radius analysis;
- Git diff/history signals;
- incremental indexing and bounded cross-repository relationships.

Code-graph output can be incomplete for dynamic frameworks or parser/LSP edge cases. Therefore `CodeIntelligenceEngine` results carry source/project/commit/index version and coverage/confidence metadata. Nexus must fall back to direct file/Git/test/runtime verification when confidence is insufficient.

### Bounded code context bundle

Nexus may expose a provider-neutral edit/context operation that assembles only what a task needs:

```text
target symbol/file
+ current source
+ callers/callees
+ relevant dependencies
+ related tests
+ recent Git changes
+ blast radius
+ verified project memory
+ relevant evidence
→ Context Compiler
→ Token Firewall
→ provider agent
```

This bundle is a Nexus feature, not a direct pass-through of any external MCP implementation.

### Tool profiles

Maestri selects a minimal tool surface per task instead of exposing every tool schema to every provider. Initial conceptual profiles:

```text
core    → context/search/status
coding  → code context/impact/tests/changes
review  → diff/impact/tests/evidence
memory  → remember/search/history/evidence
```

Profiles are capability policies, not provider-native installation changes.

### Cross-project intelligence

Cross-project code/memory reuse is opt-in and policy-gated. Project-specific facts stay isolated. Only evidence-backed reusable abstractions, Skills/patterns or explicitly linked inter-repository relationships may cross project boundaries, with ACL/secrets/version/compatibility checks.

### Implementation sequence after migration readiness

Keep the canonical **25 work packages**. Implement these capabilities as subtasks/acceptance gates inside them:

```text
contracts
→ Project Registry
→ Hindsight memory
→ evidence ledger/governance
→ task intelligence
→ code intelligence adapter
→ incremental indexing
→ bounded code-context bundle
→ Context Compiler/Token Firewall
→ tool profiles
→ validated Skills/SOPs
→ cross-project intelligence
→ Maestri orchestration
→ Control Center
→ paired benchmarks
→ failure/recovery E2E
```

No external project is copied wholesale into Nexus merely because its design is useful. Prefer adapters and independently owned Nexus contracts first; reuse/adaptation of source code requires explicit license, security, maintenance and version-pinning review.

## 3D. Research, Reach and BrowserMesh implementation model

This section validates and adapts the proposed Lumenva Intelligence/Research/Reach/BrowserMesh design into the **Nexus-owned** architecture. The useful external DNA is retained behind Nexus contracts; no external project becomes another control plane.

Validated upstream references as of 2026-09-26:

- **Agent Reach** — `Panniantong/Agent-Reach`, MIT, latest validated release `v1.5.0`. Its strongest reusable pattern is a capability layer with ordered backends plus real health/doctor probes.
- **Last30Days** — `mvanhorn/last30days-skill`, MIT, latest validated release `v3.25.0`. Its strongest reusable patterns are multi-source fanout, source-aware normalization/scoring, host-model judgment, clustering, watchlist deltas, explicit partial-result handling and untrusted-content hardening.
- **Scrapling** — `D4Vinci/Scrapling`, BSD-3-Clause. Stable `main` is `v0.4.15`; branch `v5-dev` declares `0.5` and is development-only. V1 must pin a stable release and treat 0.5 browser-agent features as experimental until released and regression-tested.

### Canonical flow

```text
Operator
  ↓
Maestri
  ↓
Task/Research Router
  ↓
ResearchEngine
  ↓
ReachEngine
  ↓
Capability Registry + Provider Registry
  ↓
API / MCP / CLI / BrowserMesh
                  ↓
             BrowserBackend
             ├─ Scrapling
             ├─ Playwright fallback
             └─ Remote CDP
                  ↓
         Content Boundary / Sanitizer
                  ↓
              Evidence[]
                  ↓
        PostgreSQL + Object Storage
                  ↓
      Research fusion / grounding
                  ↓
                Maestri
                  ↓
        answer / task / automation

Governed findings only:
Evidence → OBSERVED/CANDIDATE → verification → Hindsight memory
```

The separation is strict:

- **Maestri** decides what work exists, budget, risk, approvals and continuation.
- **ResearchEngine** decides how to investigate and combine evidence.
- **ReachEngine** decides which capability/provider/transport can satisfy a source request.
- **BrowserMesh** decides where/how an authorized browser session runs.
- **BrowserBackend** performs page retrieval/interaction behind BrowserMesh.
- **EvidenceEngine** normalizes provenance and result state.
- **Memory Governance** decides what, if anything, becomes durable memory.

### Internal contracts

```text
ResearchEngine
  research(request) -> ResearchResult

ReachEngine
  execute(capability, input, policy) -> ReachOutcome

ProviderRegistry
  resolve(capability, constraints) -> ProviderRoute[]

BrowserMesh
  openSession(request)
  execute(session, action)
  snapshot(session)
  close(session)

BrowserBackend
  fetch()
  open()
  observe()
  act()
  screenshot()
  close()

EvidenceEngine
  normalize()
  dedupe()
  recordSighting()
  ground()
  trace()

PolicyEngine
  evaluate(action) -> PolicyDecision
```

No provider-specific type may leak above its adapter boundary.

### Capability vocabulary and typed outcomes

Initial external capability surface stays intentionally small:

```text
web.search
web.read
web.extract
web.crawl
web.interact

github.search / github.read
reddit.search / reddit.read
youtube.search / youtube.transcript
x.search / x.read
```

Internal providers can be API, MCP, CLI or browser transports. Outcomes are typed rather than collapsed to generic errors:

```text
OK
EMPTY
PARTIAL
DEGRADED
AUTH_REQUIRED
RATE_LIMITED
QUOTA_EXHAUSTED
PROVIDER_DOWN
BLOCKED
TIMEOUT
SCHEMA_CHANGED
HOST_UNAVAILABLE
POLICY_DENIED
APPROVAL_REQUIRED
```

Fallback is **error-aware**, not “any failure → stealth”. Authentication/access-control failures stop or enter the credential/approval workflow; rate limits back off or switch provider; JavaScript requirements can escalate to a dynamic browser; browser/stealth routes run only when the project policy and source terms allow them.

### Evidence contract

Every source normalizes to the same envelope:

```text
Evidence
├── evidence_id
├── project_id
├── run_id
├── source
├── provider
├── capability
├── url / canonical_url
├── title / body / snippet
├── author
├── published_at / fetched_at
├── engagement
├── relevance / freshness / authority
├── query
├── extraction_method
├── backend
├── content_hash
├── trust_level = UNTRUSTED
└── provenance
```

Repeated sightings are separate from the canonical evidence record so trend/change signals do not duplicate content. Store source/run metadata, not secrets.

### Research pipeline

V1 pipeline:

```text
ResearchRequest
  ↓
Planner
  ↓
query decomposition + time window + source budget
  ↓
bounded fanout
  ↓
ReachEngine
  ↓
Evidence[]
  ↓
normalize → dedupe → deterministic relevance/fusion
  ↓
rerank / cluster when justified
  ↓
grounding
  ↓
Maestri/current-host judge
  ↓
ResearchResult
```

The Research engine does not silently select an unrelated model. Model-assisted judgment is explicit, metered and attributable. Limits include maximum queries, providers, results/provider, browser escalations, wall time and budget.

### BrowserMesh 2.0 — selective extraction, convergence and governed deployment

BrowserMesh 2.0 is **not a greenfield browser product and not a second Maestri**. Nexus first harvests proven code, contracts, tests and safety patterns from the user's existing BrowserMesh/Maestri assets, then converges them behind Nexus-owned contracts. The target is a governed multi-agent browser execution capability with minimum tools/context, deterministic-first routing, explicit isolation and evidence.

**Operational gate:** this section is future Blueprint work. BrowserMesh implementation follows its package dependencies and acceptance gates; migration readiness is complete.

Core invariants:

```text
BROWSERMESH != CONTROL PLANE
BROWSERMESH != SECOND TASK STORE
BROWSERMESH != SECOND SKILL REGISTRY
BROWSERMESH != SECOND EVIDENCE AUTHORITY
BROWSERMESH != UNRESTRICTED COMPUTER CONTROL

MAESTRI owns task/risk/budget/approval/continuation.
NEXUS GOVERNANCE owns policy and side-effect authorization.
NEXUS EVIDENCE owns durable evidence/provenance.
NEXUS SKILL REGISTRY owns browser skill metadata and lazy loading.
BROWSERMESH owns browser execution/session/host/recipe lifecycle.
```

#### Source harvest: copy the useful Maestri/BrowserMesh DNA, not the old product boundary

The mandatory harvest set is:

| Source | Frozen evidence baseline | What to inspect first |
|---|---|---|
| `trydavidqix/BrowserMesh` | `main@061e38292dc850e06750dc99c66dc9dc8df503f6` | `src/browser/*`, `src/action-bus/*`, `src/approval/*`, `src/evidence/*`, `src/runtime/*`, `src/state/*`, `bridge/server.mjs`, WebMCP bridge, tests and master plan |
| Lumenva/Maestri Wave 4 | `trydavidqix/Lumenva` audited source paths | `apps/crm/lib/agent-engine/wave4/{action-bus,event-wake,event-idempotency}*` plus security reviews |
| Lumenva browser skill | `trydavidqix/Lumenva/.agents/skills/playwright-cli/*` | snapshots/refs, sessions, storage state, CDP/extension attach, tracing, network, video and Playwright test patterns |
| BrowserMesh persistence/security references | Lumenva migrations and Wave 4 evidence | BrowserMesh event idempotency, replay protection, tenant/RLS patterns, signed wake/HMAC, actor/capability validation |
| Nexus current runtime | canonical `main` after migration readiness | existing contracts, governance, evidence, execution, control-plane, Edge MCP and package-DAG constraints to prevent duplicate owners |

Every source artifact receives a harvest record:

```text
SOURCE_ID
SOURCE_REPO
SOURCE_REF
SOURCE_PATH
BLOB_SHA / CONTENT_HASH
PURPOSE
CURRENT_TESTS
SECURITY_BOUNDARY
DEPENDENCIES
COUPLING
CURRENT_NEXUS_OWNER
DUPLICATE_OWNER?
LICENSE / PROVENANCE
CLASSIFICATION = REUSE_AS_IS | ADAPT | REPLACE | ARCHIVE | DROP
TARGET_PATH
REQUIRED_CONTRACT_TESTS
REQUIRED_MIGRATION_TESTS
NOTES / EVIDENCE
```

Preserve source history and exact refs. Never edit the source repositories merely to make extraction easier, and never copy a module into Nexus before ownership/dependency/security/tests are understood.

#### Initial extraction classification

This is the starting hypothesis; the harvest audit may tighten it with evidence:

| Existing capability | Initial disposition | Nexus target |
|---|---|---|
| BrowserMesh `BrowserDriver` + origin allowlist | **ADAPT** | provider-neutral `BrowserBackend`/action executor contracts |
| BrowserMesh capability order (WebMCP → bridge → semantic DOM → visual) | **REUSE + EXTEND** | Browser Intent/Execution Resolver with API/MCP/CLI and HTTP/Scrapling ahead of Chromium |
| BrowserMesh direct CDP bridge | **ADAPT** | `DirectCDPBrowserHost`/remote transport; keep behind narrow contract |
| BrowserMesh WebMCP bridge | **ADAPT** | structured native capability route before browser automation |
| BrowserMesh Action Bus | **SELECTIVE ADAPT** | browser-specific action envelope/idempotency only; do not create a second Nexus Action Bus/control plane |
| BrowserMesh approvals | **MERGE INTO OWNER** | `packages/governance` Approval/Policy owner |
| BrowserMesh evidence store/collectors | **MERGE INTO OWNER** | `packages/evidence`; no second evidence authority |
| BrowserMesh graph executor | **DROP AS AUTHORITY / KEEP AS REFERENCE** | Maestri/control-plane already owns DAG/orchestration |
| BrowserMesh Claude/Codex adapters | **DROP AS DUPLICATE / KEEP TEST IDEAS** | Nexus `packages/providers` owns provider adapters |
| BrowserMesh SQLite/Neon state | **ARCHIVE AS MIGRATION REFERENCE** | canonical Nexus stores/contracts own durable state |
| Maestri Wave 4 `ActionEnvelope`, worker identity and evidence envelope | **ADAPT** | browser task/action contracts with project/task/agent scope |
| Wave 4 event wake + idempotency/replay prevention | **REUSE/ADAPT AFTER TEST REVIEW** | browser event/lease/recovery inputs behind Nexus Event/Policy contracts |
| Wave 4 HMAC/actor/capability checks | **REUSE SECURITY PATTERNS** | governance/runtime boundary |
| Wave 4 tenant/RLS migrations | **REFERENCE, DO NOT BLINDLY COPY** | adapt to Nexus project isolation and canonical DB schema |
| Playwright CLI skill | **HARVEST RULES, NOT A SECOND REGISTRY** | Nexus Skill Registry entries `browser-*`, lazy-loaded per `task_id + agent_id` |
| Old BrowserMesh UI/graph | **SELECTIVE UI REUSE ONLY** | Control Center BrowserMesh views; no second dashboard/product |

#### Extraction protocol

```text
X0 FREEZE SOURCE REFS
   ↓
record repo/ref/tree/blob hashes and source provenance

X1 INVENTORY
   ↓
files + contracts + tests + runtime dependencies + data stores + security assumptions

X2 DUPLICATE/OWNER MAP
   ↓
compare each capability against current Nexus control-plane/governance/evidence/providers/execution owners

X3 TEST/EVIDENCE HARVEST
   ↓
preserve useful unit/integration/security fixtures before porting implementation

X4 CONTRACT NORMALIZATION
   ↓
derive provider-neutral Nexus BrowserPlan/BrowserAction/Observation/Backend/Host/Profile/Recipe contracts

X5 CLASSIFY
   ↓
REUSE_AS_IS / ADAPT / REPLACE / ARCHIVE / DROP with explicit reason

---------------- MIGRATION READINESS COMPLETE — IMPLEMENTATION MAY PROCEED ----------------

X6 ISOLATED PORT
   ↓
one bounded capability at a time in an isolated branch/worktree; tests first

X7 COMPATIBILITY + SECURITY GATE
   ↓
old-source fixtures + new Nexus contract tests + package-DAG + sensitive/prompt-injection gates

X8 CUTOVER
   ↓
only after Nexus owner is proven; no duplicate runtime/state/router remains

X9 ARCHIVE PROVENANCE
   ↓
retain source mapping and superseded compatibility notes; never erase source history
```

A source module is not accepted because it once worked in Lumenva. It is accepted only when its Nexus owner, contract, tests, dependency boundary, security assumptions and migration evidence pass.

#### Browser Intent Router and BrowserPlan

Before allocating Chromium, Maestri/Reach classifies:

```text
READ
SEARCH
EXTRACT
CRAWL
INTERACT
AUTHENTICATED_INTERACT
FILE_DOWNLOAD
FILE_UPLOAD
VISUAL_INTERACT
MONITOR
RECIPE_RUN
```

Every browser-required task receives a bounded `BrowserPlan` subordinate to the Nexus task/EngineeringPlan:

```text
BrowserPlan
├── browser_task_id
├── project_id
├── task_id
├── agent_id
├── engineering_plan_id?
├── intent
├── risk_level
├── autonomy_level
├── allowed_origins[]
├── allowed_redirect_origins[]
├── blocked_origins[]
├── download_origins[]
├── upload_origins[]
├── interaction_mode
├── observation_mode
├── backend_preference[]
├── host_requirements
├── profile_policy
├── secret_policy
├── tool_profile
├── context_budget
├── max_actions
├── max_pages
├── max_runtime
├── max_browser_seconds
├── max_cost
├── approval_gates[]
├── success_assertions[]
└── stop_conditions[]
```

BrowserPlan is not another task authority. Maestri owns lifecycle; BrowserMesh executes the authorized plan.

#### Execution ladder

```text
REQUEST
  ↓
Can API / MCP / CLI / WebMCP solve it?
  ├─ YES → structured native route
  └─ NO
       ↓
Can HTTP solve it?
  ├─ YES → Scrapling Web Retrieval/Crawl
  └─ NO
       ↓
Needs deterministic DOM/accessibility interaction?
  ├─ YES → Playwright direct
  └─ NO
       ↓
DOM target is brittle/semantic?
  ├─ YES → Stagehand SemanticResolver → typed BrowserAction[]
  └─ NO
       ↓
Visual-only/canvas/opaque UI?
  ├─ YES → VisualResolver / computer-use adapter → typed BrowserAction[]
  └─ NO
       ↓
HUMAN TAKEOVER / BLOCKED
```

**Failure does not automatically escalate privilege.** `AUTH_REQUIRED`, CAPTCHA/human verification, access-control, `POLICY_DENIED`, secret-scope violation or high-risk side effects stop or enter the explicit approval/takeover flow.

#### Deterministic core and narrow action surface

Playwright direct is the primary interaction backend. Do not expose the full Playwright MCP/tool catalog to every agent.

External/task-scoped facade:

```text
web.read
web.extract
web.crawl
web.interact
browser.takeover
```

Internal typed actions remain narrow:

```text
open
navigate
observe
find
click
type
scroll
upload
download
screenshot
network
console
checkpoint
restore
close
```

Stagehand and visual providers propose/resolve typed `BrowserAction[]`; they do not bypass Nexus Policy to perform side effects directly.

#### Browser skill loading

Browser skills use the **same canonical Nexus Skill Registry** and lazy loader as Engineering Control:

```text
browser-read
browser-extract
browser-crawl
browser-interact
browser-authenticated
browser-files
browser-debug
browser-visual
browser-recipe
```

Only compact metadata is globally visible. Full bodies are loaded only for the current `task_id + agent_id`. No browser skill catalog is injected wholesale and no task inherits another task's browser SkillSet.

#### Session/profile isolation

Default invariant:

```text
1 browser task + 1 agent
        ↓
1 isolated BrowserSession
        ↓
1 BrowserContext / isolated state
        ↓
independent ToolProfile + EvidenceScope + ArtifactScope + CostBudget

NO shared cookies by default
NO shared tabs
NO shared localStorage/sessionStorage
NO implicit profile sharing
NO cross-task browser memory
```

Profile classes:

```text
EPHEMERAL      task-scoped, destroy at close
PROJECT        bounded persistent project state
USER_ATTACHED  explicitly authorized existing Chrome/Edge session; exclusive lease
SERVICE        service-specific automated identity with explicit policy
```

Credentials remain outside model context:

```text
Vault / Secret Store
       ↓
Credential Broker
       ↓
profile/session reference
       ↓
BrowserContext

Agent sees authentication_state/profile reference, not password/cookie/token.
```

#### Observation and context boundary

Prefer the minimum sufficient observation:

```text
1 accessibility snapshot/subset
2 targeted DOM
3 structured extracted content
4 relevant network response
5 screenshot region
6 full screenshot
```

`BrowserObservation` carries URL/title/origin, bounded accessibility/DOM/text, relevant elements/network/console, optional screenshot/artifact refs, trust=`UNTRUSTED`, provenance and content hash.

After use:

```text
OBSERVE → USE → RECORD RESULT/EVIDENCE → COMPACT → STOP REINJECTING OLD SNAPSHOT
```

Internet/page content never becomes system/tool instruction merely because it is visible in DOM, accessibility text, network payload, screenshot/OCR, PDF or downloaded artifact.

#### Risk, origin, files and secret policy

Use the Nexus R0–R4 family, but classify the **effect**, not merely the primitive action:

- **R0:** read/search/snapshot/extract.
- **R1:** navigation/tab/scroll/expand with no external mutation.
- **R2:** reversible mutation or form preparation with bounded data sensitivity.
- **R3:** submit/send/publish/commit external state or transmit sensitive data.
- **R4:** destructive, financial, security-sensitive or high-impact action.

R3/R4 follow the Approval Center policy. Typing a secret into an external form is treated as data transmission, not a harmless `type()`.

Every plan enforces origin/redirect/download/upload policies. A redirect outside the authorized origin set stops before data is transmitted.

Downloads:

```text
browser → quarantine → type/hash/size → policy/security scan → Artifact Store → metadata/ref to agent
```

Uploads:

```text
file → project/scope check → data classification → destination/origin check → approval if required → upload
```

Downloaded files never auto-execute.

#### Human takeover, recovery and leases

`browser.takeover()` pauses autonomous execution for SSO/2FA/consent, policy approval, visual ambiguity or uncertain consequential actions. Resume returns through the same BrowserPlan/Policy boundary.

State machine:

```text
CREATED → ALLOCATING → STARTING → READY → BUSY
                           ↓
          WAITING / APPROVAL / HUMAN_TAKEOVER
                           ↓
                RECOVERING / DEGRADED
                           ↓
             BLOCKED / CLOSING / CLOSED / ERROR
```

Every session has `lease_owner`, `lease_expires_at`, heartbeat, idle timeout and hard timeout. Agent/runtime death expires the lease, checkpoints what policy permits and releases resources.

Recovery is bounded:

```text
classify failure
→ retry only if retryable
→ re-observe
→ deterministic DOM route
→ semantic resolver
→ visual resolver if authorized
→ alternate host/backend if policy-compatible
→ human takeover
→ BLOCKED
```

Never loop indefinitely.

#### Recipes 2.0

Successful traces become candidates, never immediate canonical automation:

```text
agent exploration
→ successful evidenced trace
→ RecipeCandidate
→ normalize typed actions
→ success assertions
→ validation runs
→ RecipeVersion
```

Replay prefers deterministic execution. Failure triggers targeted semantic repair and a **new candidate version**; it never silently overwrites the last known-good recipe.

Track at minimum:

```text
success_rate
last_validated
site_version_hint
average_actions
average_runtime
failure_types
repair_count
```

Low-confidence recipes fall back to assisted/fresh exploration according to policy.

#### Host Mesh and remote infrastructure

Browser hosts are provider-neutral:

```text
Windows workstation  → local Chrome/Edge, USER_ATTACHED
VPS/Linux            → headless browser slots
Linux heavy host     → browser pool when justified
Remote               → Direct CDP / Playwright Server first
Optional later       → Steel / managed provider adapters
```

`BrowserHost` reports host ID/type/online state/resources/browser slots/active sessions/supported backends/profiles/region/heartbeat. Routing is deterministic-first: eligibility → policy → capability → profile → host health/quota → score reliability/latency/cost/load/locality.

No ML router is required initially.

#### Backend contract

```text
BrowserBackend
├── health()
├── createContext()
├── open()
├── navigate()
├── observe()
├── execute(actions)
├── extract()
├── screenshot()
├── network()
├── download()
├── upload()
├── checkpoint()
├── restore()
└── close()
```

Provider-native Playwright/Stagehand/Scrapling/visual/CDP types do not leak above adapters.

#### Data model additions

Browser-specific canonical records include at minimum:

```text
browser_tasks
browser_plans
browser_sessions
browser_contexts
browser_hosts
browser_leases
browser_actions
browser_observations
browser_artifacts
browser_profiles
credential_bindings
browser_recipes
browser_recipe_versions
browser_recipe_runs
browser_failures
browser_recovery_attempts
browser_usage
browser_provider_runs
browser_approvals
browser_takeovers
```

Secrets remain outside these records.

#### Repository ownership during implementation

Do **not** create `packages/browsermesh` on the first implementation commit merely because the target domain has a name. Start inside existing canonical owners:

```text
packages/contracts/src/browser/      # BrowserPlan/Action/Observation/Backend/Host/Profile/Recipe contracts
packages/execution/src/browsermesh/  # sessions/actions/hosts/leases/recipes/recovery/routing
packages/providers/src/browser/      # playwright/scrapling/stagehand/visual/remote-cdp/steel adapters
packages/governance/src/browser/     # risk/origins/credentials/files/approvals
packages/evidence/src/browser/       # browser evidence/artifact/trace integration
apps/edge/src/browser-host/          # local/host bridge when required
apps/control-center/src/browsermesh/ # operator views
evals/browser/                       # fixtures/benchmarks/adversarial/isolation/reports
```

After the BrowserMesh MVP gate, extract a dedicated `packages/browsermesh` only if the measured package DAG shows a cohesive domain, reduced coupling, one clear owner and no new cycles/duplicate authority.

#### BrowserMesh implementation milestones B0–B20

These are **sub-milestones inside existing Nexus work packages**, not new top-level WPs.

```text
B0  Legacy/source harvest: BrowserMesh repo + Maestri Wave 4 + Playwright skill + migrations/tests
B1  Browser contracts + BrowserPlan + typed action/result/error vocabulary
B2  Policy/trust/origin/side-effect/secret/file contracts before real interaction
B3  Backend + Host + Capability registries
B4  Session/lease/profile isolation core
B5  Playwright deterministic backend
B6  Observation Engine + browser-aware Context Compiler budget
B7  Scrapling Web Retrieval/Crawl backend
B8  BrowserMesh MVP: Maestri → BrowserPlan → Playwright/Scrapling → Evidence → Verify
B9  Stagehand SemanticResolver, only after measured selector/DOM failures
B10 VisualResolver/computer-use adapters, only for cases B9 cannot solve
B11 Trace/artifact/evidence pipeline using native Playwright traces where possible
B12 Profiles + Credential Broker + human takeover
B13 Parallel isolation gate: 4+ agents/tasks, independent contexts/leases/SkillSets, zero leakage
B14 Recipes v1 deterministic replay
B15 Recipe validation/repair/versioning
B16 Host Router: Windows + VPS + Linux
B17 Remote infrastructure: Direct CDP/Playwright Server first; Steel/managed adapters experimental
B18 Control Center BrowserMesh views
B19 Browser eval suite: Nexus fixtures + BrowserGym/WebArena-Verified/WorkArena/VisualWebArena/AssistantBench where appropriate
B20 Production hardening + release gate
```

**First production-useful BrowserMesh gate: B8.** B9/B10/B17 are not prerequisites for useful browser automation and must not be built merely because they are architecturally attractive.

#### BrowserMesh evaluation and release gates

Measure at minimum:

```text
task_success_rate
action_success_rate
first_route_success
recipe_success_rate
actions_per_task
llm_turns_per_task
tokens_per_task
browser_seconds
latency
cost
http_to_browser_escalation_rate
dom_to_semantic_escalation_rate
semantic_to_visual_escalation_rate
wrong_action_rate
unnecessary_action_rate
recovery_rate
human_takeover_rate
approval_rate
recipe_reuse_rate
recipe_repair_rate
policy_violation_rate
unauthorized_side_effect
cross_task_leakage
secret_exposure
```

Production acceptance requires contract/unit/integration tests plus parallel isolation, hostile-content/prompt-injection, approval, wrong-origin redirect, upload/download, secret-boundary, recipe replay, recovery, lease expiry, host failover where supported, evidence/observability and cost-budget gates.

Target invariants for security/isolation failures are zero observed violations in the acceptance corpus:

```text
unauthorized_side_effect = 0
cross_task_leakage = 0
secret_exposure = 0
policy_bypass = 0
```

External benchmarks are reference suites, not Nexus truth. BrowserGym/AgentLab/WebArena-family results are combined with Nexus-specific tests for project isolation, approvals, profile safety, host leases, credential boundary, artifacts and multi-agent leakage.

#### BrowserMesh observability

Emit browser events through the canonical Nexus event/evidence path:

```text
browser.action.started/completed/failed
browser.navigation
browser.download
browser.upload
browser.policy_denied
browser.approval_requested
browser.takeover_started/ended
browser.recovery
browser.session_closed
```

Record `trace_ref`, screenshot/artifact refs, network summary, console errors, action timeline, recipe version and backend/provider without leaking secrets.

Browser runtime state is not automatically Brain memory:

```text
Browser run
→ operational evidence
→ task result
→ verified useful?
   ├─ no  → operational history only
   └─ yes → candidate knowledge/recipe
             → Nexus governance
```

The global memory invariant remains: **Agents produce observations; evidence produces knowledge.**

### Untrusted web-content boundary

HTML cleanup is defense-in-depth, not a proof of safety. All internet content remains untrusted after sanitization.

Required controls:

- strip scripts/styles/comments/templates/hidden/invisible content where safe;
- normalize zero-width/control characters;
- preserve provenance and content hash;
- quote/encapsulate source text so it cannot become system/tool instructions;
- never execute instructions found in fetched content;
- keep read/research tools separate from mutation/action tools;
- pass any external side effect through PolicyEngine/Approval Center.

### Browser recipes

Successful repeatable workflows may generate a versioned recipe candidate:

```text
agent/browser trace
  ↓
candidate recipe
  ↓
deterministic runner
  ↓
assertions/evidence
  ↓
selector failure?
  ├─ adaptive relocation candidate
  └─ agent repair candidate
  ↓
new recipe version
```

Recipe repair never silently overwrites the last known-good version. A recipe that performs R2+ actions requires the same policy/approval evaluation as an agent action.

### Risk model

Reuse the Nexus R0–R4 policy family:

- **R0** read-only/search/snapshot.
- **R1** safe navigation/observation.
- **R2** reversible mutation/input preparation.
- **R3** external side effect such as submitting/publishing/sending.
- **R4** destructive/high-impact/financial/security-sensitive action.

BrowserMesh executes no R3/R4 action without the configured approval gate.

### Data model additions

Canonical PostgreSQL tables/records should cover at minimum:

```text
research_topics
research_runs
research_queries
source_runs
evidence
evidence_sightings
research_clusters
research_findings
research_briefings
research_watchlists
providers
provider_capabilities
capability_routes
provider_runs
provider_quotas
browser_tasks
browser_plans
browser_sessions
browser_contexts
browser_hosts
browser_leases
browser_actions
browser_observations
browser_artifacts
browser_profiles
credential_bindings
browser_recipes
browser_recipe_versions
browser_recipe_runs
browser_failures
browser_recovery_attempts
browser_usage
browser_provider_runs
browser_approvals
browser_takeovers
usage_events
approval_requests
host_nodes
```

Large HTML/screenshots/artifacts go to object storage; their metadata/provenance stays in PostgreSQL.

### Memory boundary: Hindsight stays V1

The proposal's `PostgreSQL + Graphiti` memory block is **not adopted for V1** because it conflicts with the existing Hindsight decision. The corrected Nexus path is:

```text
Raw Evidence / Runs
  → PostgreSQL + Object Storage

Relevant governed findings
  → OBSERVED / CANDIDATE
  → verification/conflict/freshness policy
  → HindsightAdapter
  → project/global memory banks

Graphiti
  → DEFERRED benchmark alternative only
```

RAG uses the existing PostgreSQL/pgvector/Brain retrieval boundary; no second authoritative vector database is added.

### Repository ownership

Fit Research/Reach/Browser capabilities into existing canonical owners first; do not create a second product tree or a new package solely because a conceptual domain has a name.

```text
packages/
├── contracts/            # research/reach/browser/evidence contracts
├── routing/              # provider/cost/quota/reliability selection
├── evidence/             # normalization/provenance/sightings + browser evidence
├── governance/           # policy/approval/risk + browser trust/origin/file policy
├── brain/                # governed research-memory integration
├── execution/            # BrowserMesh sessions/actions/hosts/leases/recipes initially
├── providers/            # research + playwright/scrapling/stagehand/visual/CDP adapters
├── research/             # create only when its ownership is proven cohesive
└── reach/                # create only when its ownership is proven cohesive

apps/
├── edge/                 # local browser-host bridge when required
├── worker/               # research/reach/browser jobs when real owned runtime exists
├── brain-api/            # provider-neutral intelligence endpoints when implemented
└── control-center/       # research/reach/browser/approval views
```

A dedicated `packages/browsermesh` is an **optional post-B8 extraction**, not an initial requirement. Create it only when the measured dependency graph proves a cohesive browser domain, reduced coupling, one owner and no new cycle/duplicate state authority.

External BrowserMesh/Lumenva source is harvested by exact ref and selectively adapted; it is not vendored wholesale. Provider-specific implementations stay behind Nexus adapters.

### Implementation milestones after migration readiness

These are **milestones inside the existing 25 work packages**, not new top-level WPs:

```text
M0  contracts + threat model
M1  Capability Registry
M2  Provider Registry + health
M3  Reach deterministic router
M4  Agent Reach optional adapter
M5  Scrapling stable Web Retrieval/Crawl adapter
M6  BrowserMesh source harvest + contracts/policy/session foundations (B0–B4)
M7  untrusted-content boundary/sanitizer
M8  Evidence Store + sightings
M9  Research MVP                         ← first production-useful research milestone
M10 dedupe/fusion/rerank/grounding
M11 governed research-memory integration (Hindsight; Graphiti deferred)
M12 BrowserMesh deterministic interaction core (B5–B8)
M13 semantic/visual browser escalation only after measured need (B9–B10)
M14 versioned browser recipes + repair candidates (B14–B15)
M15 Host Router/capacity + remote infrastructure experiments (B16–B17)
M16 cost + quota + reliability routing
M17 watchlists + briefings + change detection
M18 autonomous intelligence only after BrowserMesh B20 + platform E2E/security/eval gates
```

M9 acceptance proves the end-to-end path:

```text
Maestri → ResearchEngine → ReachEngine
        → native/Agent-Reach/Scrapling providers
        → Evidence → PostgreSQL
        → grounded ResearchResult
```

before recipes, Graphiti experiments, broad browser autonomy or multi-host optimization are allowed to expand scope.

### Required evaluation gates

Compare at least:

- direct/native provider route vs adapter route;
- HTTP vs dynamic-browser escalation;
- research without vs with multi-source fusion;
- provider fallback correctness;
- evidence precision/deduplication and wrong-source rate;
- total requests, browser seconds, latency and monetary cost;
- prompt-injection/hostile-content resilience;
- R0–R4 authorization behavior;
- outage/rate-limit/quota/auth/schema-change degradation;
- recipe reproducibility and rollback;
- Windows/VPS/Linux host behavior where supported.

An optimization is accepted only if it lowers cost/latency/tool load **without reducing grounding, evidence quality or policy compliance**.

## 3E. Mandatory Engineering Control Plane

The Engineering Control Plane is the **mandatory quality/governance layer for every coding agent governed by Nexus**. It is not a separate product or a second orchestrator. Maestri remains the control plane; Engineering Control classifies the engineering work, selects the minimum methodology required, enforces objective gates and records evidence.

The design consolidates reusable patterns from Ponytail, Boring Engineering, Code Discipline, Simple Engineering, Superpowers, glebis TDD, SpecMint-TDD, Anti-Slop and MegaBrain while preserving **one concern → one canonical owner**.

### Mandatory framework, conditional modules

“Mandatory for every agent” means the framework always runs, **not** that every skill is loaded into every prompt.

```text
coding task
  ↓
Engineering Router
  ↓
task type + risk + scope + contracts + autonomy
  ↓
required module set
  ↓
agent execution
  ↓
Verification Gate
  ↓
Delivery Gate
```

Always required:

- `core-discipline`: no invented requirements, silent scope expansion, unsupported success claims or speculative infrastructure;
- `engineering-router`: task/risk/scope/mode classification;
- `risk-engine`: selects rigor/autonomy and escalation;
- `scope-guard-lite`: records expected blast radius and flags unexplained expansion;
- `verification`: fresh evidence before completion;
- `delivery-gate`: required checks must pass or the result is explicitly partial/blocked.

Conditionally loaded:

- `lean-engineering`;
- `tdd`;
- `tdd-isolated`;
- `systematic-debugging`;
- `contract-guard`;
- `specification`;
- `review`;
- `audit`;
- `anti-slop-*`;
- `branch-engineering`;
- `dependency-discipline`;
- `orchestration`.

This keeps context small while still making the engineering policy mandatory.

### Permanent automatic activation

The user never needs to say “use TDD”, “use debugging”, “use verification” or name any Engineering Control skill. For every Nexus-governed coding task, the permanent project/provider instruction layer automatically invokes the Engineering Router before mutation.

```text
user request
  ↓
permanent project/provider engineering rule
  ↓
Engineering Router
  ↓
EngineeringPlan
├── task_id
├── agent_id
├── task_type
├── risk_level
├── scope_size
├── expected_files
├── expected_tests
├── contract_impact
├── testability
├── execution_mode
├── autonomy_level
├── skill_policy
│   ├── required[]
│   ├── optional[]
│   ├── forbidden[]
│   ├── loaded[]
│   └── completed[]
├── context_budget
├── tool_profile
├── verification_gates[]
└── delivery_policy
```

Provider-specific permanent instructions are distribution mechanisms only. The canonical rule remains Nexus-owned. The user must not need to manually trigger mandatory skills.

### Lazy skill loading, task isolation and context budget

Core invariant:

```text
NEVER LOAD THE FULL SKILL CATALOG INTO AN AGENT CONTEXT
SKILLS BELONG TO TASKS, NOT TO SESSIONS
```

Nexus maintains a compact **Skill Registry** containing metadata only:

```text
skill_id
purpose
trigger/task_types
risk_levels
dependencies
conflicts
precedence_owner
estimated_context_cost
version
status
```

Before selection, the router sees only compact registry metadata. Full skill bodies are materialized into the active context only after `Skill Resolver` selects them for the current `task_id + agent_id`.

```text
Skill Registry
  ↓ metadata only
Skill Resolver
  ↓ justified selection
Skill Loader
  ↓ minimum required bodies
Context Compiler / Token Firewall
  ↓ bounded SkillSet
Agent Context
```

Per-task isolation means parallel agents may receive different SkillSets even inside the same project/session:

```text
Session
├── Task A / Agent A → Debug + TDD + Verify
├── Task B / Agent B → Lean + UI + Responsive + Verify
├── Task C / Agent C → Branch Engineering + Contract + Review + Verify
└── Task D / Agent D → Spec + Contract + Isolated-TDD + Review + Verify
```

No agent inherits another task's loaded skills merely because the agents share a session, project or provider.

Dynamic loading is allowed only through the resolver:

```text
task starts with SkillSet A
  ↓
new evidenced condition appears
  ↓
agent requests capability / Router detects condition
  ↓
Skill Resolver re-evaluates
  ├── unjustified → deny
  └── justified   → load additional skill
```

Example: a normal feature starts with Lean + TDD; a public API impact is discovered; `contract-guard` is loaded only after the impact is evidenced.

When a phase finishes, Nexus should compact and stop carrying the detailed skill body in subsequent bounded contexts when the provider/runtime permits it:

```text
LOAD → USE → RECORD RESULT/EVIDENCE → COMPACT → DROP FROM NEXT CONTEXT
```

This is context management, not deletion of the canonical skill. Providers that cannot literally evict already-sent context must still avoid reinjecting the full skill on later turns and rely on compaction/new task context boundaries.

Mandatory Skill Loading Policy:

1. Skills are lazy-loaded.
2. Full skill bodies are never globally injected.
3. The Router sees compact registry metadata before selection.
4. SkillSets are scoped to `task_id + agent_id`.
5. Parallel agents have independent SkillSets.
6. Dynamic skill addition requires Router/Resolver justification.
7. Finished-phase skills are compacted and not reinjected when possible.
8. Duplicate concern owners cannot be loaded simultaneously.
9. Conflicting skills are resolved by the precedence policy.
10. Context Compiler enforces a per-task skill-context budget.
11. No provider agent may bypass Skill Resolver for mandatory Engineering Control.
12. The user never needs to manually invoke a mandatory engineering skill.

### Precedence and canonical owners

```text
SECURITY
→ DATA INTEGRITY
→ CORRECTNESS
→ USER REQUIREMENTS
→ EXISTING CONTRACTS
→ TESTS / ACCEPTANCE CRITERIA
→ MINIMUM BLAST RADIUS
→ SIMPLICITY
→ PERFORMANCE
→ STYLE / ANTI-SLOP
```

```text
YAGNI / reuse / stdlib / minimum design       → LEAN
root-cause investigation                       → DEBUG
RED→GREEN→REFACTOR                            → TDD
scope drift / adjacent edits                   → SCOPE
public/schema/event/CLI compatibility          → CONTRACT
UI/copy/responsive/human/comment quality       → ANTI-SLOP
repo-wide structural debt                      → AUDIT
current diff correctness                       → REVIEW
branch/worktree integration                    → BRANCH ENGINEERING
multi-agent topology/recovery/handoffs         → ORCHESTRATION
proof before DONE                              → VERIFY
```

A module may reference another owner but must not reimplement its rules.

### EngineeringPlan contract

```text
EngineeringPlan
├── task_id
├── agent_id
├── task_type
├── risk_level
├── scope_size
├── expected_files
├── expected_tests
├── contract_impact
├── testability
├── execution_mode
├── autonomy_level
├── skill_policy
│   ├── required[]
│   ├── optional[]
│   ├── forbidden[]
│   ├── loaded[]
│   └── completed[]
├── context_budget
├── tool_profile
├── verification_gates[]
└── delivery_policy
```

Initial task types: `BUG`, `FEATURE`, `REFACTOR`, `ARCHITECTURE`, `REVIEW`, `AUDIT`, `PROTOTYPE`, `MIGRATION`, `BRANCH_INTEGRATION`, `DEPENDENCY_CHANGE`, `UI`, `COPY`, `TEST_ONLY`, `PERFORMANCE`, `SECURITY_RELATED`.

### Rigor and autonomy

```text
FAST      → CORE + LEAN + VERIFY
STANDARD  → CORE + LEAN + TDD + VERIFY
STRICT    → CORE + SCOPE + CONTRACT + TDD + REVIEW + VERIFY
CRITICAL  → SPEC + CONTRACT + SCOPE + ISOLATED-TDD + REVIEW + INTEGRATION + VERIFY + DELIVERY GATE
```

Autonomy is separate:

```text
A0 assist / ask
A1 execute read-only or trivially safe work
A2 execute bounded work + recover
A3 autonomous normal engineering within policy
A4 autonomous multi-agent orchestration within explicit limits
```

Risk/project policy may lower autonomy. No external methodology may globally force A4.

### Lean engineering

```text
required?
  no → do not build
already exists?
  yes → reuse
stdlib/native/existing dependency?
  yes → use it
direct simple implementation sufficient?
  yes → implement directly
abstraction proven necessary?
  no → stay direct
yes → create the minimum justified abstraction
```

Security, data integrity, accessibility and explicit compatibility requirements are never sacrificed merely to reduce LOC.

### TDD and debugging

Default TDD where behavior is testable:

`RED → prove RED → GREEN → prove GREEN → REFACTOR → prove GREEN again`

Critical/selected tasks may use isolated TDD with separate Test Writer and Implementer contexts. This is not the default because it increases cost/latency.

Debugging follows:

`OBSERVE → REPRODUCE → EVIDENCE → TRACE → HYPOTHESIS → PROVE/DISPROVE → REGRESSION TEST → FIX → VERIFY`

Random multi-fix iteration before a root-cause attempt is rejected by policy.

### Review, audit and branch engineering

`review` evaluates the current diff and acceptance scope. `audit` evaluates repository-wide structural concerns and produces findings; it does not auto-delete.

`branch-engineering` handles divergent branch/worktree consolidation:

```text
inventory
→ commit/diff graph
→ feature matrix
→ duplicate-change detection
→ conflict prediction
→ baseline tests
→ integration order
→ isolated integration worktree/branch
→ regression/TDD
→ review
→ verify
→ residual implementation plan
```

No worker merges directly to `main`.

### Orchestration patterns

MegaBrain contributes useful reference patterns: sequential, parallel fan-out, DAG pipeline, loop/iterate and hybrid/sub-orchestration. Nexus places `EngineeringPlan`, risk/autonomy and project policy above the topology.

Self-healing ladder:

`failure → retry same executor only when retryable → alternate evidence-backed approach → different qualified executor → decompose smaller → BLOCKED`

Retries are bounded by budget/attempt policy and preserve failure evidence.

### OpenAI plugin packaging and cross-provider portability

The canonical engineering rules remain Nexus-owned. Distribution is generated from one source:

```text
Nexus canonical engineering policy + skills
          ↓
adapter/package generator
          ├── OpenAI portable plugin
          ├── Codex compatibility overlay
          ├── Claude Code adapter
          ├── Gemini adapter
          ├── Cursor adapter
          ├── Copilot adapter
          └── generic Agent Skills / project-instruction adapter
```

For OpenAI surfaces, portable packaging uses root `plugin.json`, `skills/`, optional root `mcp.json`, and optional lifecycle hooks. `.codex-plugin/plugin.json` is compatibility fallback, not the canonical portable manifest.

Skills define judgment/workflows. MCP exposes deterministic evidence/actions only when instruction-only workflows are insufficient. Hooks enforce **objective** runtime gates where supported and trusted. CI/branch rules remain the final provider-independent enforcement layer.

### Mandatory enforcement rings

```text
Ring 1 — ORCHESTRATION
Maestri refuses to dispatch a coding task without EngineeringPlan.

Ring 2 — PROVIDER ADAPTER
A permanent generated project/provider rule auto-invokes Engineering Control; Skill Resolver injects only the task-specific SkillSet/tool profile using the provider-supported mechanism.

Ring 3 — RUNTIME
Trusted hooks or equivalent project controls check objective pre-edit/pre-completion rules where supported.

Ring 4 — EVIDENCE
Tests/typecheck/lint/build/contract/scope evidence is captured independently of agent claims.

Ring 5 — DELIVERY
CI/rulesets/merge policy reject delivery when mandatory project/risk gates fail.
```

An agent running completely outside Nexus may ignore an instruction/plugin. Therefore “all agents mandatory” is guaranteed at the **Nexus task/delivery boundary**, not by assuming every third-party runtime honors the same prompt mechanism.

### Repository ownership

Do not create a separate permanent `lumenva-engineering` product in V1. Place canonical logic inside Nexus:

```text
packages/governance/src/engineering/
├── precedence
├── risk
├── scope
├── contracts
├── dependency-discipline
├── verification
└── delivery

packages/control-plane/src/engineering/
├── router
├── execution-planner
├── autonomy
├── skill-registry
├── skill-resolver
├── skill-loader
├── context-budget
└── orchestration

packages/evidence/src/engineering/
├── verification-evidence
├── review-findings
└── metrics

.agents/skills/engineering/
├── core-discipline
├── lean-engineering
├── tdd
├── tdd-isolated
├── systematic-debugging
├── scope-guard
├── contract-guard
├── specification
├── review
├── audit
├── anti-slop
├── branch-engineering
└── verification

tooling/generators/engineering-adapters/
├── openai-plugin
├── codex
├── claude-code
├── gemini
├── cursor
├── copilot
└── generic

evals/engineering/{datasets,graders,adversarial,reports}
```

Portable plugin build artifacts are generated; provider-specific copies are not hand-maintained.

### Implementation maturity after migration readiness

These are internal milestones, not new top-level Nexus work packages:

```text
E0 source/license/rule/conflict matrix + baseline evals
E1 core + precedence + vocabulary + compact Skill Registry schema
E2 Engineering Router + Risk/Autonomy + Skill Resolver + per-task context budget
E3 Lean + TDD + Debug + Scope + Contract + Verify + lazy Skill Loader
E4 Review + Audit + Branch Engineering + Specification + Anti-Slop + dynamic skill escalation/compaction
E5 permanent provider/project auto-activation adapters + portable OpenAI plugin packaging
E6 deterministic Engineering MCP only where evals prove it is needed
E7 objective hooks/runtime enforcement
E8 risk-gated multi-agent orchestration with isolated per-task SkillSets (MegaBrain patterns)
E9 engineering metrics/intelligence including skill-load/context-cost telemetry
E10 universal provider distribution + release gates
```

The first usable gate is E3. Do not build E6+ because it looks architecturally attractive; require evidence that E5/instruction-only execution cannot satisfy the need.

### Engineering evals

Every material change to the control plane is benchmarked against a no-policy baseline and selected reference approaches. Dataset classes include tiny bug, normal bug, feature, refactor, legacy repo, branch chaos, API/schema migration, dependency change, UI, ambiguous request and security-sensitive change.

Measure task/acceptance success, regressions, unexplained files/LOC changed, new dependencies, unnecessary abstractions, scope drift, false completion claims, useful test quality, defects caught pre-merge, contract preservation, tokens, latency and cost.

No upstream self-reported benchmark is adopted as Nexus truth. A new layer is accepted only when Nexus evals show a measurable problem that the simpler layer does not solve.


## 3F. Maestri Reflex — Nexus-native System-One decision engine

**Decision:** Nexus does not depend on paid Jev. The useful System-One pattern is implemented inside the existing Maestri authority as a Nexus-owned, local-first, typed decision layer. Jev remains an external reference for fast typed decisions; it does not become a runtime dependency, provider authority or second control plane.

Canonical owner:

```text
maestri.decide()
```

No parallel authorities:

```text
NO Jev Router
NO Fast Decision Router
NO Resource Router authority
NO Council Router authority
```

Resource selection, Council invocation and provider routing are outputs/sub-decisions of the same Maestri decision authority.

### Canonical decision flow

```text
EVENT / TASK
     ↓
Hard Rules + Policy Engine
     ↓
Fast deterministic features
(project / task / tool / risk / cost / latency / quota / evidence)
     ↓
Local semantic + classification layer [when useful]
     ↓
Calibrated confidence
     ├── confident typed decision → EXECUTE
     ├── low confidence / conflict → ABSTAIN
     └── unresolved / high-risk ambiguity → strong-model fallback
                                      ↓
                               typed decision
                                      ↓
                           Maestri execution plane
                                      ↓
                        outcome + evidence + telemetry
```

Hard policy always outranks learned/model output. A classifier can recommend a decision but cannot override an approval requirement, security boundary, project policy, protected-branch rule or other deterministic prohibition.

### Typed decision contract

Minimum decision dimensions:

```text
route
risk
priority
retry_allowed
needs_review
needs_approval
needs_ceo
escalation_target
abstain
confidence
decision_source
reason_codes
evidence_refs
```

The contract must support deterministic, classifier, contextual and fallback decisions without changing the caller-facing schema.

### Open-component implementation map

These projects/models are **replaceable components or implementation references**, never new authorities:

| Need | V1 candidate/reference | Nexus role |
|---|---|---|
| Policy / hard rules | existing Nexus Governance; OPA concepts as reference | deterministic deny/allow/approval constraints before learned decisions |
| Semantic routing patterns | vLLM Semantic Router; Aurelio `semantic-router` | reference implementations for embedding/classifier routing and fast local decisions |
| Default embedding candidate | `multilingual-e5-small` | compact multilingual task/intent representation suitable for local CPU evaluation |
| Embedding challenger | BGE-M3 | benchmark challenger where larger representation measurably improves decisions |
| Few-shot classifier | SetFit + scikit-learn | small supervised classifiers for typed decision dimensions |
| Task/complexity reference | NVIDIA prompt task/complexity classifier | reference taxonomy/features for task type and complexity; not an authority |
| Probability calibration | scikit-learn calibration / temperature scaling | convert raw scores into measured confidence used by `abstain` policy |
| Local inference | ONNX Runtime | CPU-first portable inference behind a Nexus adapter |
| Router training/eval reference | RouteLLM | methodology/reference for routing datasets, comparative evaluation and thresholds |
| Incremental learning [later] | River | optional online-learning challenger only after replay/safety gates |
| Precedent retrieval | canonical PostgreSQL + pgvector | retrieve scoped prior decisions/outcomes as contextual features, not truth by similarity |
| Telemetry | OpenTelemetry + Nexus traces; Langfuse patterns/reference where useful | latency, calibration, fallback, outcome and regression evidence |

Dependencies must be pinned, security-reviewed and benchmarked before adoption. The table does not authorize installing all components. Start with the smallest stack that passes Nexus evals.

### Hybrid decision model

Do not rely on embeddings alone. The decision input combines:

```text
deterministic policy/features
+ task/project metadata
+ tool/provider health and quota
+ risk and side-effect class
+ bounded context/memory precedents
+ semantic embedding when useful
+ calibrated classifier output
```

Negation, short prompts, ambiguous language, stale memory and cross-project similarity are explicit failure cases. Low-confidence or conflicting outputs must `abstain` instead of guessing.

### Confidence, calibration and abstention

No universal confidence threshold is hard-coded as truth. Thresholds are selected from versioned evaluation data and may differ by decision dimension/risk class.

Track at minimum:

```text
routing_accuracy
risk_false_negative_rate
approval_false_negative_rate
abstain_rate
fallback_rate
calibration_error
decision_latency_ms
decision_cost
policy_override_attempts
post_decision_success_rate
```

High-risk dimensions bias toward abstention/fallback. A fast wrong approval/risk decision is worse than a slower escalation.

### Evidence-backed learning flywheel

Learning data comes from verified operational traces, not from agent self-report:

```text
DecisionInput
→ Decision
→ Execution
→ Objective Outcome
→ Evidence
→ Review/Correction
→ Versioned Decision Dataset
→ Offline benchmark
→ Candidate model
→ Shadow
→ Canary
→ Promote / Reject / Rollback
```

Dataset rows preserve project/task scope, decision schema version, policy version, feature provenance and objective outcome. Secrets and unnecessary raw content are excluded. Cross-project reuse requires the same isolation/provenance rules as Nexus memory.

### Implementation stages — migration readiness complete

```text
R0  typed DecisionInput/DecisionResult contracts + reason/evidence schema
R1  deterministic hard-rule/Policy baseline + golden decision corpus
R2  local embedding/classifier adapter benchmark; no production authority
R3  probability calibration + explicit abstain/fallback policy
R4  ONNX/local CPU packaging + latency/resource benchmarks
R5  shadow mode against real Maestri decisions; zero execution authority
R6  paired evaluation versus deterministic baseline and strong-model fallback
R7  bounded production activation for low-risk decision dimensions
R8  evidence-backed decision dataset + offline retraining pipeline
R9  custom multi-head Maestri Reflex candidate, only when data proves benefit
R10 staged promotion/rollback with continued drift/regression monitoring
```

**V1 does not require custom model training.** V1 establishes the contracts, deterministic baseline, local open-component path, calibration, abstention, evaluation and telemetry. A Nexus-trained Maestri Reflex becomes eligible only when the evidence dataset is large/clean enough and a candidate beats the baseline on the relevant acceptance metrics without weakening safety.

### Acceptance gates

Maestri Reflex is not production-ready until all are demonstrated:

1. one authoritative `maestri.decide()` contract with no duplicate router authority;
2. hard policy cannot be bypassed by embedding/classifier/model output;
3. calibrated confidence and explicit abstention work on held-out data;
4. low-confidence, conflict and unsupported classes reach the configured fallback;
5. project/task isolation prevents cross-project decision-context leakage;
6. shadow/canary comparison records decision, evidence and objective outcome;
7. rollback to deterministic baseline is immediate and tested;
8. risk/approval false negatives meet the project-defined safety gate;
9. local inference resource/latency budgets are measured on supported hosts;
10. no paid Jev dependency is required for normal Nexus operation.

## 4. Current verified baseline

- GitHub repository is `trydavidqix/nexus-brain`; `main` is default. The canonical checkout matches the active Nexus workspace, and `origin` points to `https://github.com/trydavidqix/nexus-brain.git`.
- Before reconciliation, local `main` was clean and matched `origin/main` at `0b0552a9216d731696861de579c62262063dd682`. PR #43 is open from `docs/provider-native-directory-boundary`; this revision reconciles its Blueprint with the newer migration/readiness status on `main`.
- Migration packages NB-24–NB-29 are complete. Their status is recorded separately below and is not a product-feature completion claim.
- The migrated codebase contains 10 packages and 3 apps. Post-merge checks recorded in the migration audit passed; legacy CodeQL findings remain visible and are not declared fixed by code movement.
- Existing `docs/MASTER_BLUEPRINT_CANONICAL.md` contains a prior Maestri-wide design and source-to-plan map. Its verified snapshot says MCG F0–F2 and F4 are accepted (**4/7 MCG phases, 57% MCG-only**); F3, F5 and F6 are partial. This is not a Nexus-wide percentage.
- Existing plan/status records say Brain service/API/database, Git governance enforcement, provider-backed Cloud/Jules execution, full Cloud Fabric acceptance and cross-provider recovery are not yet proven complete. Treat them as pending until fresh tests/evidence confirm otherwise.
- Seven Gmail source attachments have been copied into `docs/blueprints/sources/`; their recorded lengths match Gmail metadata and their local SHA-256 hashes are in `sources/SHA256SUMS.txt`. The seven exact source messages were moved to Gmail Trash on 2026-09-25 after source review and plan validation; they were not permanently deleted. The prior Maestri blueprint is retained behind a historical/superseded banner, not as a second active tracker.

## 5. Source ledger and lossless coverage

The files below are immutable evidence/source snapshots, not active trackers. Their unique requirements are represented by the architecture decisions, work packages and acceptance gates in this document. Preserve differences as unresolved where this plan has not selected a V1 decision.

| Source | Canonical coverage |
|---|---|
| `sources/lumenva_global_shared_memory_plan.md` | Global project/capability intelligence; context on demand; multi-client integrations; scanner/indexer; memory compiler; temporal provenance; cross-project reuse. |
| `sources/lumenva_global_brain_plano_implantacao.md` | Core/storage schemas; incremental indexing; capability graph; MCP/API contracts; event capture; compiler; retrieval; observability and cross-agent tests. |
| `sources/lumenva_global_brain_cloud_first_backup_plan.md` | Cloud Run, Cloud SQL, Cloud Storage, minimal PC, GitHub indexing, uncommitted snapshots, create-only backups, PITR/vault and disaster recovery. |
| `sources/lumenva_global_brain_plano_completo_implantacao.md` | Contracts, Google infrastructure, core API, schema, MCP, indexer, retrieval, decision plane, integrations and evaluation. |
| `sources/lumenva_global_brain_plano_completo_v1.md` | V1/non-goals, provider-neutral interfaces, decision tiers, capability/reuse coverage, security and operational tests. |
| `sources/lumenva_everything_edge_implantacao.md` | Everything Journal adapter, cursor, PROJECTS_ROOT/ignore, burst aggregation, Git evidence, Edge, snapshots, offline queue, health and fallback. |
| `sources/lumenva_global_brain_plano_unico_final.md` | Final simplified V1 decisions: cloud-first, no local brain DB/watcher, one Edge, six MCP tools, seven initial tables, backup policy and acceptance. |
| `MASTER_BLUEPRINT_CANONICAL.md` (historical predecessor) | Maestri runtime/session/task/policy/context, Agent Factory, Council/C4, evidence, MCG, Cloud Fabric, Local Runtime, Codex Cloud, Jules, benchmarks, AutoImprove, Reflex, transfer ledger and unresolved decisions. Map these as internal modules; retain its detailed body and status evidence behind a supersession banner. |

No source capability is discarded merely because it is deferred from V1. Deferred means “retained, not required for first usable release.” Duplicate implementations are consolidated only when their responsibility and acceptance are equivalent.

## 6. Work packages and dependency order

Statuses: `TODO`, `IN_PROGRESS`, `BLOCKED`, `VALIDATING`, `DONE`. Current stage is NB-03. Mark a package `DONE` only after its acceptance checks pass and evidence is linked here or in the package’s test/CI artifacts.

| ID | Work package | Depends on | Acceptance gate | Initial status |
|---|---|---|---|---|
| NB-00 | Repository identity, exact source preservation, one canonical tracker | — | GitHub/local name aligned; all source files checksummed and indexed; prior tracker marked historical; no unrelated paths | DONE |
| NB-01 | Nexus monorepo inventory and ownership map | NB-00 | Exact included/excluded Nexus-owned paths; ownership map; source/import/workspace graph; no CRM/voice migration. Final local path cutover is tracked by NB-29. | DONE |
| NB-02 | Contracts and threat/scope model | NB-01 | Versioned request, identity, task, memory, evidence and permission schemas; provider-neutral Brain/Research/Reach plus `BrowserPlan`, `BrowserTask`, `BrowserSession`, `BrowserObservation`, typed `BrowserAction`, `BrowserBackend`, `BrowserHost`, `BrowserProfile`, `BrowserRecipe`; `EngineeringPlan`, `SkillRegistryEntry`, `TaskSkillSet`, skill-load/compaction events; browser origin/redirect/trust/secret/upload/download/side-effect boundaries; engineering risk/autonomy/context-budget/delivery contracts; conflicts recorded as unresolved | DONE |
| NB-03 | Zero-cost local runtime baseline | NB-02 | Reproducible Windows setup for official full Hindsight API + embedded pg0/pgvector; on-demand API with internal worker; Gemini Developer API Free Tier only, with no billing-linked project, fail-closed quota behavior and no paid fallback; local-only embeddings/reranker; persistent data outside Git; verified backup/restore; documented future PostgreSQL migration; cost boundary and secret hygiene checks. Cloud IaC remains reference-only and is never applied. | IN_PROGRESS |
| NB-04 | Canonical database, temporal memory and provenance | NB-02, NB-03 | Local PostgreSQL/pgvector canonical DEV store; Hindsight V1 behind Nexus ownership; global/project banks; session/task tags; append-only observations/events; research/evidence/sightings/run provenance; `OBSERVED/CANDIDATE/VERIFIED/CANONICAL/SUPERSEDED/CONFLICTED/REVOKED`; `RECALLED/SELECTED/INJECTED/USED/VALIDATED/CONTRIBUTED`; raw web evidence remains untrusted and separate from memory promotion; ACL/scope; verified local restore and pg0-to-external-Postgres export/import compatibility. | TODO |
| NB-05 | Brain API and one MCP contract | NB-02, NB-04 | Provider-neutral Nexus API/MCP fronts internal engines; external backends are never agent-facing authorities; authenticated context/search/remember/reuse/status plus bounded code/edit-context and research/web capability facade; `remember` stores observations/candidates unless policy passes; responses expose status/provenance/source/coverage/trust; contract tests; bounded context/tool surface | TODO |
| NB-06 | GitHub project indexer and sync/reconciliation | NB-02, NB-03, NB-04 | Idempotent webhook + scheduled reconciliation; branch/commit provenance; safe retry | TODO |
| NB-06A | Project Registry and multi-project identity/scope | NB-02, NB-04, NB-06 | Stable project IDs; repo/workspace bindings; lifecycle/stack metadata; per-project policies/agent/tool/browser permissions/budgets; memory bank + code-index + research/source/provider-policy bindings; global/project/session/task namespaces; cross-project isolation tests; project registration without code relocation | TODO |
| NB-07 | Workspace index, Code Intelligence and capability evidence | NB-01, NB-06, NB-06A | `CodeIntelligenceEngine` with initial validated CBM adapter; per-project files/symbols/calls/imports/routes/tests/dependencies/Git-change evidence; incremental re-index; impact/blast-radius queries; coverage/confidence + source/commit/index-version metadata; bounded cross-repo links; safe direct-source fallback; no namespace collision | TODO |
| NB-08 | Hybrid retrieval, research and reuse coverage | NB-05, NB-07 | Hindsight + code-evidence + governed research-evidence retrieval; task-boundary-aware selection; Research planner/fanout normalization/dedupe/fusion/rerank/grounding with bounded source/query/budget limits; project bank first and global separately; conflicted/revoked excluded; raw web evidence remains untrusted; abstention/partial-result semantics; safe reusable cross-project lookup; explainable coverage | TODO |
| NB-09 | Memory/event compiler, Skills and Maestri decision tiers | NB-04, NB-05, NB-08 | Existing memory lifecycle plus compact canonical Skill Registry; one authoritative `maestri.decide()` typed contract; deterministic Policy baseline; benchmarkable local embedding/classifier adapter; calibrated confidence + explicit `abstain` + strong-model fallback; no paid Jev dependency or duplicate router authority; full skill bodies lazy-loaded only after Resolver selection; generated/derived skills stay candidates until validated; contradictions/version drift explicit | TODO |
| NB-10 | Windows Everything Edge + Git adapter | NB-01 | Journal cursor, root/ignore filters, Git branch/diff, burst grouping, offline fallback and health | TODO |
| NB-11 | Uncommitted snapshot/restore path | NB-03, NB-10 | Encrypted unique create-only snapshots, ownership/scope checks, offline queue, verified restore; no auto-commit | TODO |
| NB-12 | Provider adapters and project integrations | NB-05, NB-09 | Claude/Codex/Gemini/Jules plus research/reach/browser providers use generated Engineering Control adapters with permanent automatic activation for coding tasks; user never manually invokes mandatory skills; adapters receive only Resolver-selected task-specific SkillSets/tool profiles, never the full catalog; OpenAI portable plugin/Codex compatibility and other provider packages generated from one canonical source; native provider dirs untouched | TODO |
| NB-13 | Maestri control plane as Nexus-native multi-project orchestrator | NB-02, NB-05, NB-06A | Resolves project identity then automatically requires an `EngineeringPlan` for every coding task; `maestri.decide()` is the single typed decision authority for route/risk/priority/retry/review/approval/escalation with hard Policy first, calibrated local decision path when justified, explicit abstention and bounded strong-model fallback; Skill Resolver selects the minimum task-specific SkillSet/context budget; parallel tasks/agents receive isolated SkillSets; Maestri remains platform-wide | TODO |
| NB-14 | Agent Factory, policy, approvals and bounded execution | NB-13 | Validated AgentDefinitions plus mandatory Engineering Control policy; provider agents cannot bypass Skill Resolver; required/optional/forbidden skill policy and context budgets enforced per task+agent; browser R0–R4 effect classification, origin/redirect, credential/file/data-transmission and approval gates enforced before backend execution; risk/autonomy, scope/contract/dependency/verification gates, bounded loops, optional isolated-TDD contexts and evidence hooks; no runtime may self-declare DONE or bypass project/browser policy | TODO |
| NB-15 | Local/cloud agent and BrowserMesh execution | NB-12, NB-13, NB-14 | Complete BrowserMesh B0 selective harvest from `trydavidqix/BrowserMesh`, Lumenva/Maestri Wave 4 and Playwright skill without duplicate control/state owners; isolated workspaces/branches and browser sessions; Playwright direct deterministic interaction core, Scrapling Web Retrieval/Crawl route, Stagehand/visual adapters only after eval-gated need, Direct CDP/Playwright Server remote path; host/session/lease/profile registry with Windows/VPS/Linux eligibility/capacity/expiry; resumable jobs, bounded error-aware recovery, quota-safe retries, independent tests and no direct main merge | TODO |
| NB-16 | Council/C4, evidence and review/report flow | NB-13, NB-14 | Identical snapshots, independent reviews, current-diff review distinct from repo-wide audit, adversarial/second review when risk requires it, mandatory structured verification report, owner approval and acceptance manifest | TODO |
| NB-17 | MCG Context Gateway/Token Firewall integration | NB-05, NB-10, NB-13 | Preserve bounded batch/redaction; prove the live provider path and paired-token/round-trip benchmark without quality loss; merge governed memory/code/research plus compact `EngineeringPlan` and only Resolver-selected skill bodies into bounded per-task/per-agent context; never inject the full skill catalog; enforce skill-context budget; compact phase results and stop reinjecting completed skill bodies when possible; dedupe tool schemas; prove parallel isolated SkillSets and lower token load with no correctness/policy loss | TODO |
| NB-18 | Multi-project Control Center/dashboard/reporting and design/accessibility | NB-17, NB-06A | Existing portfolio/project views plus Engineering Control visibility per task/agent and BrowserMesh views for sessions/hosts/tasks/actions/live state/approvals/recipes/profiles/artifacts/failures/cost/tokens/browser-seconds; show EngineeringPlan, BrowserPlan, selected/loaded/completed skills, reasons for dynamic additions, context budget and verification/delivery state; parallel tasks remain isolated; no cross-task skill/browser-state leakage; reference fidelity/accessibility | TODO |
| NB-19 | GitHub Actions, security, commit discipline and Git hygiene | NB-01, NB-02 | Provider-independent Engineering Delivery Gate plus concrete GitHub baseline: protected `main`, PR-only delivery, squash merge, required CI/security/dependency/CodeQL/secret gates, least-privilege Actions, pinned third-party actions, Dependabot grouping, OIDC for cloud auth, CODEOWNERS for sensitive paths; repository commit/PR titles follow `<area>: <imperative action>` and reject vague subjects such as `chore`, `misc`, `update`, `changes`, `WIP` or `final`; Nexus Git Hygiene Guard enforces task↔branch↔worktree ownership, detects empty/merged/orphaned/duplicate/stale resources, and only permits cleanup after proof that work is clean, merged/redundant and preserved; dirty/unmerged/unknown resources are never auto-deleted and become `STALE_REVIEW_REQUIRED`; local/plugin hooks remain supplementary to authoritative CI/rulesets | TODO |
| NB-20 | Backup, PITR, immutable vault and disaster recovery | NB-03, NB-04 | Unique backups, retention/soft-delete, PITR and tested restore; immutable lock only after restore gate | TODO |
| NB-21 | Observability, budgets and operational runbooks | NB-05, NB-09, NB-13 | Existing platform metrics plus Maestri decision source/confidence/reason, abstain/fallback rate, calibration error, routing accuracy, risk/approval false negatives, decision latency/cost and post-decision outcome; engineering task type/risk/mode, selected/loaded/completed skills, skill-context bytes/tokens, dynamic-load events, regressions and verification gates; BrowserMesh route/escalation/actions/tokens/browser seconds/lease/recovery/approval/isolation/policy/secret metrics; no hidden reasoning storage; degradation/rollback runbooks | TODO |
| NB-22 | Cross-provider, cross-project, offline, security and recovery E2E | NB-05–NB-21 | Existing platform E2E plus mandatory Engineering Control across Codex/Claude/Gemini/Jules and BrowserMesh B20: automatic skill activation without full-catalog injection; 4+ parallel tasks with isolated task+agent SkillSets **and 4+ independent browser sessions/contexts/leases**; zero cross-task cookie/storage/profile/evidence leakage in acceptance corpus; justified dynamic load and completed-phase non-reinjection; Resolver/backend bypass attempts; hostile web/prompt-injection, wrong-origin redirect, secret transmission, upload/download, R3/R4 approval, lease expiry, recipe rollback, recovery/takeover and host-failover tests where supported; false-DONE prevention; paired evals for correctness, leakage, context size, regressions, scope drift, tokens/browser-seconds/latency/cost | TODO |
| NB-23 | Release, source-email cleanup and final synchronization | NB-00–NB-22 | All source/coverage checks pass; final docs committed/pushed; only authorized email messages trashed; local/remote synced | TODO |

### Dependency waves

```text
Wave 0: NB-00 → NB-01 → NB-02
Wave 1: NB-03 → NB-04 → NB-05
Wave 2: NB-06 / NB-10 / NB-19 (independent ownership after contracts)
Wave 3: NB-06 → NB-06A → NB-07 → NB-08 → NB-09; NB-10 → NB-11
Wave 4: NB-12 → NB-13 → NB-14 → NB-15 / NB-16 / NB-17
Wave 5: NB-18 / NB-20 / NB-21
Final:  NB-22 → NB-23
```

No parallel worker/Jules session is part of the current authorization. When later authorized, every work package must have one owner, disjoint write scope, branch/worktree, TDD tests, acceptance contract and integration gate. Never start dependent tasks together or allow a worker to merge directly to `main`.

## 7. GitHub, commit discipline, Git hygiene and toolchain gates

Before changing protections or installing tools, record current state and consult current official documentation. Verify repository visibility, default branch, Actions, workflow permissions, required checks, rulesets, CodeQL/secret/dependency scanning, Dependabot, merge methods, auto-delete-branch behavior, branch deletion/force-push policy and current worktree/branch ownership. Do not treat a passing workflow as a required merge gate unless GitHub confirms it is enforced. Avoid broad settings changes and third-party actions without pinning/security review. Local hooks are supplementary; GitHub is authoritative.

### 7.1 Canonical GitHub delivery model

The target operating model is intentionally boring:

```text
main = only permanent development branch
task
  ↓
short-lived task branch
  ↓
bounded worktree when local isolated writes are needed
  ↓
PR
  ↓
required checks + Engineering Delivery Gate
  ↓
squash merge
  ↓
remote task branch deleted
  ↓
local branch/worktree retired only after preservation + clean/merged proof
```

No direct push to `main`, no force-push to `main`, no deletion of `main`, and no agent may merge around required gates. Merge queue stays disabled until concurrent PR volume justifies it; when enabled, required workflows must explicitly support the merge-queue event path.

### 7.2 Main ruleset and required gates

Target `main` ruleset:

```text
PR required
force-push denied
branch deletion denied
required conversation resolution where supported
required status checks
squash merge as canonical merge method
bypass restricted to explicitly documented break-glass actors
```

Required checks are created only when they are stable and actually report for every applicable PR. Planned baseline:

```text
typecheck
unit-tests
integration-tests
build
dependency-review
codeql
secret/security gate
engineering-delivery-gate
git-hygiene-gate
```

A check must not become required while it can remain permanently pending on valid changes. Path-filtered workflows need a non-pending design before becoming required.

### 7.3 Actions and supply-chain hardening

- default `GITHUB_TOKEN` permission is read-only; jobs receive only the permissions they need;
- third-party Actions are pinned to immutable commit SHAs after security review;
- cloud deployment/authentication prefers short-lived OIDC credentials instead of permanent cloud keys in GitHub Secrets;
- CodeQL, secret scanning/push protection and dependency review are enabled where the repository/plan supports them;
- Dependabot updates package and GitHub Actions dependencies on a bounded schedule and groups compatible updates to avoid PR spam;
- `CODEOWNERS` covers security/governance, `.github/workflows/**`, infrastructure/deployment and other sensitive paths with verified owners;
- workflow changes cannot silently lower the checks that protect the same workflow path.

### 7.4 Commit and PR naming standard

Repository history must say what changed. Nexus does **not** use vague Conventional-Commit buckets such as `chore:` as a default escape hatch.

Canonical subject format:

```text
<area>: <imperative action>
```

Examples:

```text
maestri: Add calibrated decision fallback
browsermesh: Isolate browser sessions by task
memory: Prevent cross-project context leakage
github: Enforce required checks on main
```

Rules:

- use a concrete repository/domain area;
- use an imperative action that describes the real effect;
- keep the subject concise and specific;
- PR title uses the same format because squash merge makes it the canonical history entry;
- body/evidence may explain why, risks and validation without bloating the subject.

Reject vague subjects such as:

```text
chore: ...
misc
update
changes
cleanup
fix
WIP
final
final-final
stuff
update files
```

A legitimate cleanup/refactor still names the affected area and concrete effect, for example `routing: Remove duplicate legacy resolver`.

### 7.5 Branch and worktree naming/ownership

For Nexus-governed coding work:

```text
1 active task
→ 1 task_id
→ 1 owner
→ 1 short-lived branch
→ 0 or 1 bounded local worktree for that owner/task
```

A second worktree/branch for the same task requires an explicit subtask/owner split recorded by Maestri. Parallel agents never silently share a writable worktree.

Canonical branch shape:

```text
<kind>/<task-id>-<short-slug>
```

Allowed `kind` values are project-defined, small and explicit (for example `feature`, `fix`, `refactor`, `docs`, `security`, `recovery`). Branch naming is not used as a substitute for task ownership metadata.

### 7.6 Git Hygiene Guard

Nexus owns a read-first `Git Hygiene Guard` that continuously classifies branches/worktrees without deleting anything merely because it is old.

Minimum classifications:

```text
ACTIVE
EMPTY
SAFE_MERGED_CLEAN
DIRTY
UNMERGED
ORPHANED_METADATA
DUPLICATE_CANDIDATE
STALE_REVIEW_REQUIRED
RECOVERY_PROTECTED
UNKNOWN
```

It detects at minimum:

- branch with no commits beyond its base;
- worktree without an active task/owner;
- task with multiple unintended writable worktrees;
- merged branch still present after delivery;
- orphaned Git worktree metadata;
- duplicate branches/worktrees pointing to equivalent work;
- stale resources with no active task or PR;
- branch/worktree whose source task/PR cannot be resolved;
- resources protected by recovery/migration activity.

Age alone never proves safety. A stale threshold only triggers review.

### 7.7 Cleanup proof and safety boundary

Cleanup is a proof-driven lifecycle, not a timer:

```text
DISCOVER
→ CLASSIFY
→ PROVE OWNERSHIP
→ PROVE PRESERVATION
→ PROVE CLEAN / MERGED / REDUNDANT
→ RETIRE
→ VERIFY
```

Automatic retirement is allowed only for resources that Nexus itself can prove are safe under current project policy. Anything dirty, unmerged, unknown, recovery-related or carrying unique local content becomes `STALE_REVIEW_REQUIRED` or `RECOVERY_PROTECTED`.

Hard rules:

- never delete solely because a branch/worktree is old;
- never clean unknown or dirty work automatically;
- never overwrite unique local work;
- never infer duplication from names alone; use Git/tree/content evidence;
- never perform hygiene cleanup while a recovery/migration gate protects the resource;
- preserve provenance linking task → branch → worktree → PR → merge commit → evidence.

This safety boundary is mandatory because repository hygiene must not recreate the class of failure currently being investigated in Lumenva recovery.

### 7.8 Implementation plan

Implementation remains inside NB-19; these are internal milestones, not new top-level work packages:

```text
G0  Read-only GitHub/repository/worktree baseline inventory
G1  Commit/PR/branch naming contracts + validators
G2  CI/security/dependency workflows with least-privilege permissions
G3  Engineering Delivery Gate + Git Hygiene Gate in report-only mode
G4  main ruleset with stable required checks and squash-only delivery
G5  CodeQL + secret/push protection + dependency review + Dependabot grouping
G6  CODEOWNERS + sensitive-path protection + OIDC cloud-auth path
G7  task↔branch↔worktree ownership registry and hygiene classifications
G8  duplicate/orphan/stale detection with preservation evidence
G9  safe retirement workflow for proven SAFE_MERGED_CLEAN/EMPTY resources
G10 concurrency validation; enable merge queue only if real parallel PR load justifies it
```

**Migration gate:** configuration that can move/delete/retire branches or worktrees remains subject to ownership, preservation and clean/merged proof. During any active recovery gate, the Git Hygiene Guard is discovery/report-only for protected resources.

### 7.9 NB-19 acceptance evidence

NB-19 is not DONE until evidence shows:

1. `main` protection/ruleset is active and cannot be bypassed by normal agents;
2. every required check reports reliably on applicable PRs;
3. Actions use least privilege and reviewed third-party actions are SHA-pinned;
4. CodeQL/security/dependency/secret gates operate as intended;
5. Dependabot is grouped/bounded rather than generating uncontrolled PR noise;
6. squash merge produces the enforced concrete commit-title format;
7. vague commit/PR titles are rejected;
8. task↔branch↔worktree ownership is queryable and parallel writers are isolated;
9. empty/merged/orphaned/duplicate/stale resources are detected;
10. dirty/unmerged/unknown/recovery-protected resources cannot be auto-retired;
11. safe-retirement evidence proves no unique local work was lost;
12. a repository audit after retirement shows no unintended empty branches, orphan worktrees or duplicate active ownership.

Toolchain inventory covers Windows/global, repository-local, CLI, agents, skills, MCPs, runtimes, tests, security, observability, GitHub and cloud. Each item is `EXISTS`, `CONFIGURED`, `PARTIAL`, `MISSING`, `UNVERIFIED` or `UNNECESSARY`; never install duplicates before inventory. Jules readiness requires official docs plus a safe real-repository smoke test, scoped repository access, environment setup/secrets, session/branch/result review and quota-safe operation.

## 8. Security, authority and non-goals

- Do not treat sanitization as trust: all fetched internet content remains `UNTRUSTED` and cannot issue tool/system instructions.
- Do not auto-escalate authentication/access-control/CAPTCHA/paywall failures into stealth/browser bypass. Stop, switch to an authorized provider, or request user/approval flow.
- Do not expose provider-native research/browser tool catalogs directly to every agent; keep the Nexus capability facade small and task-scoped.
- Do not deploy Graphiti in V1 merely for research/change intelligence; Hindsight remains the selected V1 memory engine and PostgreSQL/object storage remain the evidence/run stores.
- Do not track Scrapling `v5-dev` as a production dependency before a released 0.5+ version passes pinned contract/security/regression evaluation.

- User decisions and verified code/config/test/runtime evidence outrank agent inference. Memory candidates require provenance and scope checks.
- Core memory invariant: **agents produce observations; evidence produces knowledge**. No output from Codex, Claude, Gemini/Antigravity, Jules, or Nexus itself becomes canonical solely because a model asserted it.
- Canonical memory is not blind trust. High-impact decisions must retain a path back to source evidence so the acting agent can re-check the current authoritative source when required.
- Contradictions are first-class state: never silently choose between conflicting claims. Record `CONFLICTED`, preserve both evidence chains, and promote only after an objective resolution rule or verified source settles the conflict.
- Fresh verified evidence may mark older canonical facts `SUPERSEDED`; history/provenance remain append-only and auditable.
- Context injection is task-bounded: retrieve the minimum relevant verified information needed for the current task rather than dumping the full shared memory into provider prompts.
- Do not expose Hindsight directly to provider agents as an authority. Agents use Nexus Brain API/MCP; Hindsight remains an internal replaceable engine behind Nexus governance.
- Project banks are isolation boundaries. Session/task scoping uses tags/metadata inside the selected project bank; do not create separate session/task banks by default.
- Project-bank and global-bank retrievals are performed separately and merged only by Nexus after scope, provenance, freshness, conflict and security checks.
- Do not run Graphiti in parallel as a second authoritative V1 memory system. It remains a benchmark alternative until evidence justifies a migration or specialized adapter.
- Do not run TencentDB Agent Memory, MARM, Total Agent Memory, CodeGraph memory, or codebase-memory-mcp memory as parallel authoritative Brains. Their useful patterns/backends may be adapted behind Nexus contracts only.
- Code Intelligence is advisory evidence, not truth. Parser/LSP/graph misses or stale indexes must fall back to direct Git/file/test/runtime verification.
- Task/Skill extraction must not convert a successful-looking agent narrative into reusable procedure without objective task outcome evidence.
- Least privilege; no secrets in logs, context, execution records, reports or source archives. Edge receives only short-lived scoped identity, not cloud-admin or database credentials.
- No direct-main worker writes, force-push, destructive cleanup, auto-merge, auto-commit backup, Docker install, paid provider calls, model training, irreversible bucket lock, or CRM/voice migration without the applicable explicit authorization and gates.
- Repository hygiene is evidence-driven: commit/PR subjects must be concrete; branch/worktree cleanup requires ownership, preservation and clean/merged/redundant proof. Dirty, unmerged, unknown and recovery-protected resources are never auto-deleted.
- Keep provider-native global directories and installations external to Nexus. Codex, Claude Code, Gemini/Antigravity and other provider runtimes retain their official install/config/state locations; Nexus must not require moving, forking, vendoring or patching those directories.
- Project integration may add only supported project-level adapters/configuration (for example MCP, API, CLI, hooks or project instructions). A project instruction or skill does not prove a Windows-global config is active, and official provider updates must continue to work independently of Nexus.
- Do not make every engineering module always-on. The Engineering Control framework is mandatory, but Router/Risk select the minimum relevant skill set to avoid duplicated work and token bloat.
- Do not inject the full engineering skill catalog into any provider/session/task. Only compact metadata is globally visible; full skill bodies are lazy-loaded per `task_id + agent_id` through Skill Resolver and bounded by Context Compiler.
- Do not rely on a skill/plugin prompt as the sole enforcement mechanism. Objective completion/delivery rules must be backed by Nexus policy/evidence and provider-independent CI/rulesets.
- Do not let generated orchestration skills self-grant autonomy, install dependencies, change public contracts, lower tests, merge to main or bypass approvals.
- Do not adopt fixed universal coverage thresholds. Project policy, acceptance criteria and risk define the required evidence.
- Do not hand-maintain divergent provider copies of Engineering Control; adapters/packages are generated from one canonical Nexus source.
- Jev/System-One remains a reference only: normal Nexus operation must not require a paid Jev service. Maestri decision capability is Nexus-owned behind `maestri.decide()`.
- Do not let an embedding/classifier/model bypass hard policy, approval, security or protected-branch rules. Low-confidence/conflicting decisions must abstain or escalate.
- Do not train/promote a custom Maestri Reflex from agent narratives alone; training/evaluation rows require scoped traces, objective outcomes and evidence, with shadow/canary/rollback gates.
- Keep models/providers replaceable. The product owns contracts, evidence, memory, task state and recovery.

## 9. Objective progress

The implementation tracker has **25 work packages total**: NB-00..NB-23 (24 packages) plus NB-06A (Project Registry). This denominator is canonical unless a future blueprint change explicitly adds/removes a package. Only `DONE` counts; `IN_PROGRESS`, `VALIDATING`, `BLOCKED` and `TODO` do not. Component-specific acceptance remains separately labeled (for example, MCG 4/7 = 57% MCG-only); do not average it into the Nexus total.

Current tracker snapshot: `DONE 3/25`, `BLOCKED 0/25`, `IN_PROGRESS 1/25`, `TODO 21/25`; **Nexus implementation progress: 12%, remaining: 88%**. NB-00 and NB-01 are accepted preparation/audit packages. NB-02 is accepted; NB-03 is in progress after owner-approved cloud architecture decisions, with the remaining project, billing, cost, and API-allowlist gates documented below. Versioned schemas and TypeScript types cover identity, task, memory, evidence, permission, EngineeringPlan, Brain, Research, Reach, BrowserPlan/task/session/observation/action/backend/host/profile/recipe, Skill Registry entries, TaskSkillSets and skill events. Evidence: [`threat-and-scope.md`](../architecture/threat-and-scope.md), focused tests under `packages/contracts/tests`, package typecheck, workspace integration tests, architecture and syntax checks, and sensitive-data scan. The threat/scope model records unresolved policy vocabularies for later runtime enforcement. Existing partial MCG, dashboard and security work remains evidence only; NB-17–NB-19 stay `TODO` until their full acceptance gates pass.

### NB-01 audit record

The ownership and local-path audit is [`NB-01_SOURCE_OWNERSHIP_AND_LOCAL_PATH_AUDIT.md`](NB-01_SOURCE_OWNERSHIP_AND_LOCAL_PATH_AUDIT.md). NB-01 is accepted as source inventory/ownership work; final path cutover belongs to NB-29. The prior blocked snapshot is superseded by the completed migration record below. CRM/voice and separate project code remain out of scope.

### Migration readiness completion record (NB-24–NB-29)

Migration readiness is a separate preparation track, not part of the 25-package implementation denominator. All six gates are complete. NB-29 completion and the canonical repository path are confirmed by the active task state; local `main` was verified clean and synchronized with `origin/main` at `0b0552a9216d731696861de579c62262063dd682` before this PR reconciliation.

| ID | Completed gate | Status |
|---|---|---|
| NB-24 | Canonical monorepo AS-IS→TARGET map and boundary proof | DONE |
| NB-25 | Shared contracts, schemas, registries and architecture gates | DONE |
| NB-26 | Domain package migration | DONE |
| NB-27 | Executable apps and Windows Edge migration | DONE |
| NB-28 | PNPM, integration tests, evals, docs and GitHub architecture | DONE |
| NB-29 | Canonical local path cutover and final local/GitHub synchronization | DONE |

The migration audit and implementation evidence remain in [`../migration/NEXUS_CANONICAL_ARCHITECTURE_MIGRATION.md`](../migration/NEXUS_CANONICAL_ARCHITECTURE_MIGRATION.md). The prior `NB-29 BLOCKED` statements in that historical audit are superseded by this completion record and the active task state. Do not infer implementation-package completion from migration gates, code movement, or migration CI.

### NB-03 architecture reconciliation and technical validation (2026-09-26)

The first NB-03 proposal selected Google Cloud, Cloud SQL PostgreSQL + pgvector, Cloud Storage and separately deployed Hindsight API/worker services. The owner canceled that proposal because of its estimated USD 35–60/month recurring cost. OpenTofu 1.12.6 and `infra/cloud/tofu/` remain as an unapplied reference only; this repository must not run `tofu apply` for that design. No billing account should be linked to continue the canceled plan.

The canceled cloud design had included Cloud Run, Cloud SQL, Cloud Storage, Secret Manager, Artifact Registry, `europe-west1`, separate service accounts, and billing budget alerts. These choices are historical context only; they are not authorization to provision resources. This phase creates no cloud project resources, API enablements, IAM bindings, secrets, billing links or PROD environment.

Technical validation: current Hindsight documentation says Windows x86_64 and pg0 are supported; the full `hindsight-api` package supplies local embeddings/reranking, while `hindsight-api-slim` requires external model services and is excluded. pg0 persists its data under `~/.pg0/instances/<name>/data/` (or a configured data directory), separately from its binaries under `~/.pg0/installation/`. For this pinned configuration, Hindsight uses `%USERPROFILE%\.pg0\instances\nexus-dev\data`. The API runs its internal worker by default; dedicated workers are for high-throughput use. Hindsight recommends 1.5 GiB minimum/2 GiB API memory, 512 MiB minimum/1 GiB+ PostgreSQL, and 2 vCPU for basic CPU-only workloads. This machine has 8 GiB RAM and an Intel i5-8250U (4 cores/8 logical processors), which clears the published baseline for local development; monitor actual combined peak memory before loading a large corpus.

Gemini is a supported Hindsight LLM provider. Pin `gemini-3.5-flash` only if AI Studio confirms it is currently available in the Free Tier for the key's unbilled project; pricing currently lists its standard input/output as free. Published rate-limit docs define RPM, input TPM and RPD per model/project/account, with RPD resetting at midnight Pacific, and do not promise a fixed quota for every user. When the free tier is unavailable or exhausted, requests stop with an error. Do not switch the project to paid tier. Google documents that free-tier content may be used to improve products, so only non-sensitive, explicitly allowed content can be sent; local embedding and reranking do not leave the machine. No Google AI Pro subscription or optional Developer Program Premium credit is counted toward API funding.

Backups use PostgreSQL `pg_dump` custom-format exports to a unique local path, a SHA-256 manifest, and a restore test into a separate local pg0 instance. Keep the database directory outside the repo and keep secrets outside tracked files. Future PostgreSQL migration uses a consistent `pg_dump` from pg0 18.1, restore into the same major version or newer PostgreSQL with pgvector enabled, preserve the Hindsight schema, change only `HINDSIGHT_API_DATABASE_URL`, then validate row counts, bank-level recall, provenance/scope invariants and a rollback backup before cutover. A downgrade to an older PostgreSQL major version needs a separate clone-based compatibility test and explicit review of generated schema/index features; do not attempt it as a direct cutover. Hindsight storage documentation confirms PostgreSQL is its native storage backend; changing from pg0 to external PostgreSQL does not change the data model. Re-embedding is required only if changing the embedding model/dimensions.

Implementation evidence (2026-09-26): installed hash-locked Hindsight 0.10.1 and pg0-embedded 0.15.2 in `infra/local/hindsight/.venv`; pg0 initialized PostgreSQL 18.1.0 at the configured persistent path. Hindsight reported healthy with a connected database (HTTP 200); migrations created 24 public tables. A custom-format `pg_dump`, SHA-256 check, isolated pg0 restore and restored-table check passed. Nine focused NB-03 integration checks and PowerShell parser checks passed. Gemini configuration was exercised with a deliberately invalid, non-secret placeholder: Hindsight initialized locally, but the provider verification request returned HTTP 400. This is not evidence of valid Gemini credentials or Free Tier eligibility.

Runtime setup and live Gemini smoke testing require a Gemini Developer API key backed by an unbilled project. That credential is not stored in Git and no value is logged. If a key is unavailable, local installation, pg0 persistence and deterministic tests continue; live provider validation waits for a Free Tier key. NB-03 remains `IN_PROGRESS` until the live Gemini Free Tier, quota/fail-closed behavior and remaining integration/security evidence gates pass.

Live validation update (2026-09-26): project `gen-lang-client-0491977901` is selected with Cloud Billing disabled. Hindsight 0.10.1 returned HTTP 200 for health, retain, and recall using synthetic non-sensitive data; recall returned the retained fact. The original retain failures were Gemini `503 UNAVAILABLE` (upstream transient overload), not a payload or pre-provider failure. The initial reflect HTTP 504 followed Hindsight's 30-second reflect LLM timeout. Local runtime now uses one retry for transient Gemini errors, 2-second initial/5-second maximum backoff, and a 120-second reflect LLM timeout. A later reflect reached Gemini but received `429 RESOURCE_EXHAUSTED` for the Free Tier daily request quota (limit 20 for `gemini-3.5-flash`). The local runtime now installs a persistent daily-quota circuit breaker that stops subsequent Gemini calls through midnight Pacific; daily RPD exhaustion is not retried, while transient 503 errors retain one bounded retry. The breaker is loaded at process startup, so the existing Hindsight process must be restarted after the quota reset; its startup provider verification itself makes one Gemini call. Unit tests cover daily-quota classification, persistent blocking, reset timing, and 503 non-blocking behavior. Do not call Gemini again on 2026-09-26. Repeat the prepared reflect verification after the next RPD reset; keep NB-03 `IN_PROGRESS` until a fresh successful Gemini reflect call and all remaining gates pass.

Current technical references: [Hindsight installation](https://hindsight.vectorize.io/developer/installation), [Hindsight services](https://hindsight.vectorize.io/developer/services), [Hindsight storage](https://hindsight.vectorize.io/developer/storage), [Hindsight configuration](https://hindsight.vectorize.io/developer/configuration), [pg0](https://github.com/vectorize-io/pg0), [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), [Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits), and [Gemini billing](https://ai.google.dev/gemini-api/docs/billing).

## 10. Email deletion gate

The seven emails are authorized for deletion only after all of these are true:

1. Each exact source attachment is present under `docs/blueprints/sources/` and has matching byte size/hash to the retrieved attachment.
2. The prior Maestri blueprint’s detailed body is retained behind a supersession banner as historical source, and this Nexus blueprint is the sole active tracker.
3. The source ledger and decisions above have been checked against every source; unresolved conflicts remain explicit.
4. The canonical file is reopened and checked for required sections, all seven source paths, all work-package IDs, and the historical blueprint reference.
5. Email search is repeated by exact attachment filename/message identity; only those seven identified messages are moved to Gmail Trash. Verify all seven are in Trash and no unrelated message was touched.

Do not permanently delete. If any gate fails, leave all source emails untouched and report the exact blocker.

## 11. Final acceptance

Nexus Brain is complete only when all **25 work packages** (NB-00..NB-23 plus NB-06A) are `DONE`, full-workspace checks and provider-backed gates pass, every capability has evidence, security/backup recovery is verified, all sources remain preserved, and local `main` is synchronized with GitHub `main`. No overall completion claim is made from MCG’s 4/7 score.
