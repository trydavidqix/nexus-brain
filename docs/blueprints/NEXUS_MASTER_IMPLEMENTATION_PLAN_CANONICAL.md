# NEXUS — MASTER IMPLEMENTATION PLAN CANÔNICO

**Status:** Plano unificado para implementação  
**Data:** 28/09/2026  
**Projeto:** Nexus Brain  
**Objetivo:** fundir fielmente os cinco planos desta sessão, preservar as decisões anteriores relevantes do Nexus e eliminar lacunas sem simplificar, remover ou inventar capacidades.

---

# 0. 3-CHECK DE CONSOLIDAÇÃO

Este documento foi montado com três verificações independentes.

## Check 1 — Cobertura

Tudo que apareceu nos cinco planos da sessão foi rastreado para um destino canônico.

Também foram relidos os planos anteriores relevantes disponíveis no projeto/biblioteca, especialmente:

- `Engineering_Control_Plane_Plano_Implementacao_V1.docx`;
- `Engineering_Agent_Control_Plane_Plano_de_Implementacao_V1.docx`;
- `MEGA_HANDOFF_NEXUS_2026-09-26.md`;
- material anterior de contexto/token optimization, Context Compiler, Event Bus, Context Diff, cache por hash e Artifact Registry;
- decisões anteriores recuperadas sobre Project Registry, Capability/Provider/Tool Registry, multi-provider execution, BrowserMesh/Research/Reach e provider-neutralidade.

## Check 2 — Duplicações e conflitos

Capacidades equivalentes foram fundidas, mas não apagadas.

Conflitos de ordem foram resolvidos pelas decisões mais recentes desta sessão:

- **Parallel Execution Fabric agora vem antes do Engineering Control Plane**, porque o Nexus precisa trabalhar com vários agentes em paralelo durante a própria construção.
- A antiga recomendação de provar single-agent primeiro não foi removida: ela virou **gate interno da Implantação 1**, usando mocks/um worker antes de liberar fan-out real.
- **SQLite + filesystem + Git são a arquitetura permanente e oficial do Nexus**.
- **Redis, se algum dia necessário, será apenas coordenação/cache efêmera e nunca source of truth**.
- Beads, Gas Town, Worktrunk, Parallel Code, Agent Orchestrator, Symphony e similares são **referências/adapters opcionais**, nunca autoridades arquiteturais.
- O núcleo não depende de LangGraph.
- Hindsight é engine atrás de adapter, nunca autoridade.
- MCP é uma capability/bridge; o núcleo do Nexus não depende de MCP para existir.

## Check 3 — Dependências e ordem

Cada bloco abaixo foi ordenado por dependência real:

```text
SHARED FOUNDATION
        ↓
PARALLEL EXECUTION FABRIC
        ↓
ENGINEERING CONTROL PLANE
        ↓
MEMORY & INTELLIGENCE SYSTEM
        ↓
HARDENING / PRODUCTIZATION
        ↓
ADVANCED / SCALE EXTENSIONS
```

Nenhum bloco posterior deve ser usado para justificar pular gates do bloco anterior.

---

# 1. PRINCÍPIOS CANÔNICOS

```text
ONE NEXUS
ONE PLATFORM
ONE BRAIN
ONE PRODUCT
ONE MONOREPO
ONE CONTROL PLANE
ONE CANONICAL OPERATIONAL STATE
ONE GOVERNED MEMORY SYSTEM

1…N WORKERS
N PROVIDERS
N PROJECTS
N LAZY-LOADED CAPABILITIES
```

## 1.1 Regras absolutas

```text
REFERENCE ≠ DEPENDENCY
PATTERN ≠ PRODUCT
ADAPTER ≠ AUTHORITY

CHAT ≠ SOURCE OF TRUTH
AGENT REPORT ≠ EVIDENCE
EXECUTION_FINISHED ≠ DONE

MEMORY ≠ AUTHORITY
PERFORMANCE MEMORY = SIGNAL
POLICY = AUTHORITY

NEVER LOAD THE FULL SKILL CATALOG
NEVER LOAD THE FULL CAPABILITY CATALOG

SKILLS BELONG TO TASKS, NOT SESSIONS
TOOLS/MCPs ARE LOADED BY TASK NEED
NO CROSS-TASK CONTEXT LEAKAGE

NO COMPLETION WITHOUT EVIDENCE
NO SELF-APPROVAL
NO SILENT REQUIREMENT CHANGE
NO SILENT SPEC CHANGE
NO UNBOUNDED RETRY
NO AGENT MAY CHANGE ITS OWN BUDGET
NO AGENT MAY REMOVE ITS OWN REQUIRED GATES
```

## 1.2 Prioridade de decisão

```text
SECURITY
>
DATA INTEGRITY
>
CORRECTNESS
>
USER REQUIREMENTS
>
APPROVED PRODUCT REQUIREMENTS
>
EXISTING CONTRACTS
>
TESTS / ACCEPTANCE
>
MINIMUM BLAST RADIUS
>
SIMPLICITY
>
PERFORMANCE
>
STYLE / ANTI-SLOP
```

---

# 2. ARQUITETURA FINAL

```text
USER / ISSUE / GOAL / AUTOMATION / API
                ↓
          INTENT ROUTER
                ↓
         TASK CLASSIFIER
                ↓
      PRODUCT / PRD ROUTER
                ↓
          SPEC COMPILER
                ↓
       ENGINEERING PLAN
                ↓
             PLANNER
                ↓
      EXECUTABLE TASK GRAPH
                ↓
         DAG VALIDATOR
                ↓
      DURABLE TASK STATE
                ↓
          READY QUEUE
                ↓
   AUTHORITATIVE SCHEDULER
                ↓
   CLAIM + LEASE + FENCING
                ↓
 OWNERSHIP / RESOURCE CHECK
                ↓
      CAPABILITY RESOLVER
                ↓
       CONTEXT COMPILER
                ↓
      WORKSPACE ALLOCATOR
                ↓
       ELASTIC WORKER POOL
     ┌──────────┼──────────┬──────────┐
     ▼          ▼          ▼          ▼
   Codex      Claude     Gemini     OpenCode
     │          │          │          │
 NODE LOOP   NODE LOOP   NODE LOOP   NODE LOOP
     └──────────┴─────┬────┴──────────┘
                      ↓
                  VERIFIER
                      ↓
                EVIDENCE STORE
                      ↓
                  REVIEWER
                      ↓
                   AUDITOR
                ↙           ↘
            ACCEPT         REPAIR
               ↓             │
               └──────┬──────┘
                      ↓
                 CONVERGENCE
                      ↓
             INTEGRATION MANAGER
                      ↓
                 MERGE QUEUE
                      ↓
                     MAIN
                      ↓
              MEMORY CHECKPOINT
                      ↓
              VERIFIED LEARNING
```

---

# 3. ESTRUTURA DO MONOREPO

```text
nexus/
├── apps/
│   ├── cli/
│   ├── api/
│   ├── mcp-server/
│   └── mission-control/
│
├── packages/
│   ├── protocol/
│   ├── kernel/
│   ├── core/
│   ├── state/
│   ├── storage/
│   ├── projects/
│   ├── capabilities/
│   ├── tasks/
│   ├── planner/
│   ├── graph/
│   ├── scheduler/
│   ├── leases/
│   ├── ownership/
│   ├── events/
│   ├── sessions/
│   ├── runtime/
│   ├── agents/
│   ├── models/
│   ├── providers/
│   ├── workspaces/
│   ├── artifacts/
│   ├── deliverables/
│   ├── integration/
│   ├── policies/
│   ├── hooks/
│   ├── skills/
│   ├── tools/
│   ├── mcp/
│   ├── product/
│   ├── spec/
│   ├── architecture/
│   ├── tdd/
│   ├── debugging/
│   ├── memory/
│   ├── context/
│   ├── code-intelligence/
│   ├── ledger/
│   ├── acceptance/
│   ├── verifier/
│   ├── browser-verifier/
│   ├── evidence/
│   ├── review/
│   ├── auditor/
│   ├── approvals/
│   ├── convergence/
│   ├── security/
│   ├── recovery/
│   ├── observability/
│   ├── metrics/
│   ├── tracing/
│   └── plugin/
│
├── adapters/
│   ├── codex/
│   ├── claude/
│   ├── gemini/
│   ├── opencode/
│   ├── acp/
│   ├── git/
│   ├── worktrunk/
│   ├── beads/
│   └── hindsight/
│
├── plugins/
│   ├── codex/
│   ├── claude/
│   └── gemini/
│
├── skills/
├── policies/
├── configs/
├── schemas/
├── migrations/
├── tests/
├── evals/
├── docs/
└── examples/
```

---

# 4. SHARED FOUNDATION

A Foundation não é um quarto produto. É a base mínima comum.

## 4.1 Stack inicial

```text
Node.js 22+
TypeScript
pnpm workspaces
Zod
SQLite
Filesystem artifacts
Git
Vitest
E2E shell fixtures
ESLint
Prettier
Structured logging
Versioned schemas
Migrations
GitHub CI
```

## 4.2 Persistência fixa do Nexus

```text
SQLite
+
Filesystem
+
Git
=
ARQUITETURA OFICIAL E PERMANENTE DO NEXUS
```

Responsabilidades:

```text
SQLite
= canonical operational state

Filesystem
= artifacts / evidence / checkpoints / caches / logs grandes / screenshots / reports

Git
= canonical code / branch / commit / history truth
```

Essa arquitetura não é provisória e não existe plano de substituição por outro banco relacional.

Escala deve ser resolvida primeiro com:

```text
WAL
short transactions
indexes
batch writes
prepared statements
busy timeout
filesystem offload para payloads grandes
archive / compaction / rotation
separação em múltiplos arquivos SQLite por domínio quando benchmark justificar
```

Se workers remotos existirem no futuro, eles acessam o estado através do Control Plane API; não escrevem diretamente no arquivo SQLite.

## 4.3 Universal Protocol

O domínio não depende de Codex, Claude ou Gemini.

Tipos obrigatórios:

```text
Project
Goal

Task
TaskSpec
TaskState
TaskContract
TaskResult
TaskGraph
GraphNode
Dependency
ConflictGraph

Resource
ResourceLock

Lease
FencingToken

Worker
WorkerHeartbeat

Session
SessionState

Workspace
Worktree

EngineeringPlan

Capability
Role
Agent
AgentDefinition
AgentCapabilities
Model
Provider
Skill
Tool
MCPServer
BrowserCapability
VerifierCapability

Policy
Hook

Run
Attempt
Checkpoint
Budget

Artifact
Deliverable

LedgerEntry
RuntimeEvent
OutboxEvent

Evidence
Audit
Review
VerificationResult
GateResult
AcceptanceManifest

ApprovalRequest
ApprovalDecision

PDR
PRD
Requirement
Spec
ADR

MemoryRecord
MemoryVersion
MemorySource
MemoryEvidence
Decision

PerformanceSignal
SOPCandidate
SkillCandidate
```

## 4.4 Identidade

```text
project_id
goal_id

task_id
node_id
dependency_id

run_id
attempt_id

session_id

worker_id
agent_id
model_id
provider_id

workspace_id
worktree_id

lease_id
resource_id

artifact_id
deliverable_id

evidence_id
audit_id
approval_id

prd_id
requirement_id
spec_id
adr_id

memory_id

trace_id
idempotency_key
```

### Goal Contract v1

`Goal` is scoped to exactly one `Project`. Its v1 wire contract is:

```text
goal_id: non-empty string
project_id: non-empty string
objective: non-empty string
scope: non-empty list of non-empty strings
out_of_scope: list of non-empty strings
requirements: list of non-empty strings
constraints: list of non-empty strings
assumptions: list of non-empty strings
acceptance_criteria: non-empty list of non-empty strings
risk: R0 | R1 | R2 | R3 | R4
required_gates: list of non-empty strings
definition_of_done: non-empty list of non-empty strings
```

All fields above are required. Empty lists are allowed only where the wire contract does not say non-empty. Unknown fields are rejected; extensions require a new schema version.
The field set formalizes the existing Goal Contract checklist in `NEXUS_ENGINEERING_CONTROL_PLANE_IMPLEMENTATION_PLAN.md`; `project_id` binds Goal to the canonical project identity.

The contract validates shape only. Runtime enforcement must freeze `definition_of_done` when implementation starts. A legitimate change requires a revision request, reason, authorization, and new version. A hidden change is `INTEGRITY_COMPROMISED`.

## 4.5 Delegation lineage

Preservar:

```text
run_id
parent_task_id
parent_agent_id
delegation_depth
created_by
owner
```

Proteções:

```text
parent must exist
run_id consistent
delegation_depth automatic
max depth configurable
ancestor-agent loop detection
task lineage cycle detection
```

Default inicial conservador:

```text
max_delegation_depth = 3
```

Alterável por policy, nunca pelo próprio worker.

## 4.6 Durable State

```text
.nexus/
├── state.db
├── artifacts/
├── evidence/
├── events/
├── runtime/
├── checkpoints/
├── workspaces/
├── cache/
├── telemetry/
└── quarantine/
```

## 4.7 Storage abstraction

```text
StateStore
└── SQLiteStateStore
```

`StateStore` existe para isolamento de domínio, testes e engenharia limpa; não representa um roadmap de troca do banco de produção.

Testes podem usar `InMemoryStateStore`, mas produção usa SQLite.

Nenhum pacote de domínio conhece SQL diretamente.

Tabelas/repos iniciais:

```text
projects
agents
tasks
task_dependencies
task_lineage
sessions
leases
resource_locks
workspaces
artifacts
deliverables
verification_results
evidence
events
outbox
attempts
usage
budgets
approvals
idempotency_keys
```

## 4.8 Transações

Regra:

```text
STATE CHANGE
+
OUTBOX EVENT
```

na mesma transação.

Events relevantes são append-only.

## 4.9 Project Registry

O Nexus é um monorepo, mas gerencia muitos projetos externos.

Cada projeto registra:

```text
project_id
repo
default_branch
workspace policy
lifecycle
stack
permissions
policies
approvals
budgets
memory namespace
task scope
session scope
evidence scope
Git bindings
CI bindings
deployment bindings
provider constraints
```

O Nexus registra/governa/orquestra; não absorve o repo externo.

### Project Contract v1

Each Project Registry record uses this required wire shape:

```text
project_id: non-empty string
repo: non-empty opaque repository locator
default_branch: non-empty string
workspace_policy: JSON object
lifecycle: non-empty string
stack: list of non-empty strings
permissions: JSON object
policies: JSON object
approvals: JSON object
budgets: JSON object
memory_namespace: non-empty string
task_scope: non-empty string
session_scope: non-empty string
evidence_scope: non-empty string
git_bindings: list of JSON objects
ci_bindings: list of JSON objects
deployment_bindings: list of JSON objects
provider_constraints: list of JSON objects
```

All fields are required. Empty lists and JSON objects are valid where no bindings, stack facts, or local configuration exist yet. Repository locator remains opaque; implementations must not rewrite, infer, or normalize it. `lifecycle` remains an opaque non-empty string because this plan defines no lifecycle vocabulary. Nested policy, approval, budget, workspace, binding, and provider-constraint shapes remain owned by their respective contracts; Project v1 validates only their container types. Unknown top-level fields are rejected; extensions require a new schema version.

The Project contract registers and governs an external repository. It does not absorb or mutate that repository. Project Factory must inspect an unknown repository and gather evidence before proposing changes.

## 4.10 Project Factory

Responsável por registrar e preparar projetos sem absorvê-los:

```text
create/register project
inspect existing project
detect stack
detect Git
detect package manager
detect tests
detect CI
create Nexus metadata
bind policies
bind capabilities
bind memory namespace
bind evidence namespace
validate project
health check
```

Fluxo:

```text
NEW / EXISTING PROJECT
↓
PROJECT FACTORY
↓
PROJECT INSPECTION
↓
PROJECT DEFINITION
↓
VALIDATION
↓
PROJECT REGISTRY
↓
READY
```

Nunca modificar automaticamente um repo desconhecido antes de inspection/evidence.

## 4.11 Universal Capability Registry

```text
Capability Registry
├── roles
├── agents
├── models
├── providers
├── runtimes
├── skills
├── tools
├── MCP servers
├── browsers
├── databases
├── verifiers
├── deployment capabilities
├── research capabilities
└── code-intelligence providers
```

Metadata compacta:

```yaml
id:
type:
purpose:
triggers:
capabilities:
task_types:
risk_levels:
dependencies:
conflicts:
owner:
permissions:
provider:
estimated_cost:
estimated_context_cost:
health:
version:
status:
```

## 4.12 Context permanente mínimo

Sempre carregado:

```text
AGENTS.md
essential policies
Capability Registry metadata
project identity
task identity
minimal execution contract
```

Nunca permanentemente:

```text
all skills
all MCPs
all tools
all docs
all PRDs
all ADRs
all memories
all provider manuals
all historical transcripts
```

## 4.13 Lazy loading universal

```text
TASK
 ↓
ROUTER
 ↓
CAPABILITY REQUIREMENTS
 ↓
REGISTRY METADATA
 ↓
RESOLVER
 ↓
MINIMUM CAPABILITY SET
```

Podem ser lazy-loaded:

```text
skills
tools
MCPs
models
provider features
docs
browser
DB capability
memory slice
spec slice
ADR slice
code intelligence
verifiers
research backends
```

Lifecycle:

```text
SELECT
↓
LOAD
↓
USE
↓
RECORD EVIDENCE
↓
COMPACT
↓
UNLOAD / STOP REINJECTING
```

## 4.14 Papéis estáveis

Core:

```text
ORCHESTRATOR
RESEARCHER
ARCHITECT
IMPLEMENTER
REVIEWER
VERIFIER
OPS
```

Roles especializadas podem existir por task, mas não viram agentes permanentes desnecessários.

Especialização:

```text
ROLE
+
AGENT
+
MODEL
+
SKILLS
+
TOOLS
+
MCPs
+
CONTEXT
+
POLICIES
```

## 4.15 Agent Factory

Todo agente persistente deve nascer de definição validada.

```text
AgentDefinition
      ↓
Validator
      ↓
Capability Resolver
      ↓
Provider Compiler
      ↓
Registry
      ↓
version/hash
      ↓
health probe
      ↓
runtime instance
```

Campos:

```text
id
name
role
purpose
provider
model_profile
instructions
skills
allowed_tools
forbidden_tools
write_scope
context
memory
network_policy
secret_policy
risk
resource
timeout
tool_budget
acceptance
output_schema
```

Instanciação manual só para diagnóstico marcado `EPHEMERAL`.

## 4.16 Local Event Bus

Event bus local central para desacoplar módulos internos.

```text
SOURCE
↓
LOCAL EVENT BUS
├── State
├── Telemetry
├── Alerts
├── Scheduler
├── Mission Control
├── Memory
├── Evidence
└── Evals
```

Fontes podem incluir runtime, scheduler, agents, tools, MCPs, hooks, validation, workspaces, CI adapters, research e browser.

Não usar IA para transportar eventos internos.

## 4.17 Foundation Gate

```text
install PASS
typecheck PASS
lint PASS
tests PASS
build PASS
schemas PASS
migrations PASS
serialization PASS
SQLite reopen PASS
SQLite recovery PASS
config validation PASS
Capability Registry PASS
mock AgentAdapter PASS
crash/restart PASS
```

---

# 5. IMPLANTAÇÃO 1 — PARALLEL EXECUTION FABRIC

**Primeira implantação operacional.**

Objetivo:

```text
1…N AGENTS
+
DEPENDENCY-AWARE EXECUTION
+
SAFE PARALLELISM
+
DURABLE STATE
+
ISOLATED WRITERS
+
SESSIONS/RESUME
+
RECOVERY
+
CONTROLLED INTEGRATION
```

## 5.1 Gate zero: provar o núcleo antes do fan-out

A antiga regra de “single-agent first” é preservada aqui.

Primeiro provar:

```text
Mock Agent
↓
Task
↓
Claim
↓
Lease
↓
Session
↓
Workspace
↓
Deliverable
↓
Verification V1
↓
State transition
```

Só então liberar vários workers.

Isso evita overengineering sem atrasar a arquitetura parallel-first.

## 5.2 Planner + Task Decomposition

```text
GOAL
 ↓
PLANNER
 ↓
WORK BREAKDOWN
 ↓
TASKS
 ↓
CONTRACTS
 ↓
DEPENDENCIES
 ↓
RESOURCES
 ↓
EXECUTABLE GRAPH
```

Feature grande não deve virar uma task monolítica por padrão.

## 5.3 Executable Graph Contract

```yaml
id:
task_id:

role:
agent:
model:
provider:

mode:
  read-only | writer

goal:
scope:
acceptance:

depends_on: []

inputs: []
outputs: []

skills: []
tools: []
mcps: []

context_requirements: []

workspace:
permissions:

budget:
retry_policy:
max_attempts:

verification_gates: []

resources:
ownership:

on_success:
on_failure:

lease:
```

## 5.4 Task Lifecycle

Estados canônicos:

```text
PENDING
BLOCKED
READY
CLAIMED
RUNNING
VALIDATING
REVIEWING
INTEGRATING
MERGE_READY
MERGING
DONE

FAILED
STALE
CANCELLED
```

Operações:

```text
createTask()
claimTask()
startTask()
blockTask()
resumeTask()
verifyTask()
completeTask()
failTask()
cancelTask()
retryTask()
```

Transições não previstas são inválidas.

## 5.5 Blocker Protocol

Block reasons:

```text
DEPENDENCY_BLOCK
RESOURCE_BLOCK
CAPACITY_BLOCK
QUOTA_BLOCK
POLICY_BLOCK
EXTERNAL_BLOCK
APPROVAL_BLOCK
SECURITY_BLOCK
PROVIDER_BLOCK
WORKSPACE_BLOCK
```

Registro de blocker:

```text
TASK
STATUS
CAUSE
EVIDENCE
IMPACT
BLOCKED_BY
UNBLOCK_CRITERION
REQUIRED_ACTION
SAFE_WORKAROUND
SINCE
```

`BLOCKED` nunca pula diretamente para `DONE`.

## 5.6 Dependency DAG

Edges:

```text
HARD
ARTIFACT
SOFT
DISCOVERED_FROM
```

### HARD

Predecessor precisa atingir conclusão segura.

### ARTIFACT

Dependente pode consumir:

```text
immutable commit
+
declared output contract
+
verification evidence
```

antes do merge final somente quando policy permitir.

### SOFT

Relacionamento sem gating.

### DISCOVERED_FROM

Task criada durante outra execução.

## 5.7 DAG Validator

Validar:

```text
cycles
dangling nodes
dangling edges
missing dependencies
missing entry points
unreachable nodes
invalid contracts
invalid artifacts
invalid outputs
invalid routing
ownership contradictions
impossible resource combinations
```

Graph inválido não executa.

## 5.8 DAG ≠ Workflow Routing

```text
DAG
= what may run

WORKFLOW ROUTING
= what happens after an outcome
```

Exemplo:

```text
validation PASS → integration
validation FAIL → repair task
security FAIL   → security remediation
CI FAIL         → CI repair
budget exhausted→ escalation
```

## 5.9 Ready Queue

READY exige:

```text
dependencies satisfied
+
required artifacts present
+
resource available
+
ownership valid
+
policy permits
+
budget available
+
provider capacity
+
required approvals satisfied
```

## 5.10 Authoritative Scheduler

Só o Nexus despacha.

```text
READY QUEUE
↓
SCHEDULER
↓
WORKER ASSIGNMENT
```

Worker não escolhe autonomamente a próxima task.

## 5.11 Scheduler Priority

Score:

```text
critical path
priority
dependents unlocked
age
risk
estimated duration
estimated cost
provider suitability
resource contention
repo contention
deadline
starvation protection
```

## 5.12 Elastic Worker Pool

```text
1…N workers
```

Config inicial exemplo:

```yaml
global_max: 4

providers:
  codex: 4
  claude: 2
  gemini: 2
  opencode: 2

repositories:
  nexus-brain: 4
```

Escala sem mudança arquitetural.

## 5.13 Capacity formula

```text
workers_to_run =
min(
  READY_ELIGIBLE_TASKS,
  GLOBAL_LIMIT,
  PROVIDER_CAPACITY,
  MACHINE_CAPACITY,
  REPO_CAPACITY,
  RESOURCE_CAPACITY,
  BUDGET_CAPACITY
)
```

## 5.14 Dois níveis de concorrência

```text
Nexus workers
+
provider subagents
=
effective concurrency
```

Default:

```text
nested fan-out = OFF
```

Ativado somente por EngineeringPlan/policy.

## 5.15 Agent Adapter API

Contrato universal:

```text
info()
capabilities()
health()

startSession()
resumeSession()

execute()

interrupt()
cancel()
shutdown()

usage()
```

Mocks obrigatórios antes de gastar quota externa:

```text
MockCodex
MockClaude
MockGemini
```

## 5.16 Provider Adapters

Garantidos no design:

```text
Codex
Claude Code
Gemini
OpenCode
Future Providers
```

Conectar um por vez.

### Codex

Preservar suporte a:

```text
thread start/resume
turn start
interrupt/cancel
stream notifications
background execution
request timeout
hard timeout
broker recovery
structured output
```

### Claude Code

Preservar:

```text
structured runtime when available
PTY fallback only when needed
session resume
roles
policies
scope
```

Bloquear:

```text
uncontrolled nested agents
recursive Control Plane invocation
unauthorized MCP
```

### Gemini

Preservar parsing estruturado:

```text
init
message
tool_use
tool_result
result
error
```

## 5.17 ACP Gateway

Provider-neutral extension:

```text
initialize()
newSession()
loadSession()
prompt()
cancel()
setModel()
setMode()
```

`ACPAgentAdapter` permite um agente compatível entrar por config + capability manifest.

Core não depende de ACP.

## 5.18 Session Manager

Task ≠ Session.

```text
start
get
list
resume
interrupt
cancel
archive
```

Persistir:

```text
session_id
agent
provider_session_id
task_id
project_id
cwd
worktree
status
started_at
last_activity
```

Uma task pode ter vários attempts usando a mesma sessão.

## 5.19 Atomic Claim

```text
T7 READY
↓
atomic claim
↓
worker owns T7
```

Segundo worker recebe `CLAIM DENIED`.

## 5.20 Lease

```text
lease_owner
lease_started_at
lease_expires_at
heartbeat_deadline
```

Sem lease válido, mutação é bloqueada.

## 5.21 Fencing Token

Cada aquisição gera token crescente.

Worker antigo não consegue:

```text
WRITE
COMPLETE
MERGE
```

depois de perder a lease.

## 5.22 Heartbeats

Persistir:

```text
worker
task
run
lease
provider
last_progress
resource usage
status
```

Detectar:

```text
dead
stalled
quota exhausted
provider unavailable
no progress
```

## 5.23 Ownership

Separado do DAG.

```yaml
T1:
  owns:
    - apps/api/**

T2:
  owns:
    - apps/web/**
```

## 5.24 Resource Locks

Exclusivos:

```text
package.json
lockfiles
schema.prisma
migrations/**
shared schemas
shared contracts
release files
deployment config
```

READY no DAG pode continuar bloqueado por `RESOURCE_BLOCK`.

## 5.25 Workspace Manager

```text
Workspace Pool
├── slot-01
├── slot-02
├── slot-03
└── slot-N
```

```text
SLOT ≠ BRANCH
SLOT ≠ PERMANENT WORKTREE
```

Slot representa capacidade.

## 5.26 Writer Isolation

```text
1 WRITABLE TASK
=
1 BRANCH
=
1 ISOLATED WORKTREE
```

## 5.27 Read-only shared checkout

Research/Review podem compartilhar checkout somente se:

```text
filesystem writes blocked
Git mutation blocked
task read-only
```

## 5.28 Dirty Workspace Protection

Nunca:

```text
blind git reset --hard
blind git clean
```

Estado duvidoso:

```text
WORKSPACE_QUARANTINED
```

## 5.29 Safe Workspace Cache

Pode compartilhar:

```text
dependency cache
compiler cache
package download cache
build cache
tool cache
```

Nunca mutable task state.

## 5.30 Branch Engineering

Fluxo completo preservado:

```text
inventory
↓
commit graph
↓
diff graph
↓
baseline tests
↓
feature matrix
↓
duplicate detection
↓
conflict prediction
↓
integration order
↓
isolated worktree
↓
integration branch/worktree
↓
tests
↓
review
↓
verify
↓
residual plan
```

Nunca remover branch/worktree sem provar conteúdo.

## 5.31 Worker Contract

Worker recebe apenas o necessário:

```text
goal
task
node
scope
acceptance
dependencies
immutable inputs

role
agent
model
provider

branch
worktree

permissions
budget

lease
fencing token

required gates
```

Stage 2 adiciona:

```text
EngineeringPlan
skills
tools
MCPs
policies
PRD/spec/ADR slices
```

Stage 3 adiciona:

```text
verified memory
task intelligence
performance signals
```

## 5.32 Manager / Executor Split

```text
MANAGER
= escolhe o próximo slice a partir de estado verificado

EXECUTOR
= executa um slice bounded em contexto fresco
```

Manager não implementa código por padrão. `ExecutorResult` nunca equivale automaticamente a `DONE`.

## 5.48 Node Execution Loop

```text
RECEIVE
↓
LOAD CONTEXT
↓
ACT
↓
OBSERVE
↓
VERIFY
↓
PASS ───────────────→ RETURN EVIDENCE
↓ FAIL
DIAGNOSE
↓
REPAIR
↓
REPLAN IF REQUIRED
↓
RETRY
```

Sempre limitado por budget e circuit breaker.

## 5.48 Artifact Store

Tipos:

```text
plan
diff
patch
report
review
test_result
benchmark
diagnostic
handoff
runtime_snapshot
```

Storage:

```text
filesystem
+
SQLite metadata
```

Content addressing:

```text
SHA-256 where viable
```

Artifacts não dependem do texto livre do modelo.

## 5.48 Structured Deliverables

Todos os adapters convertem outputs para shape comum:

```json
{
  "status": "COMPLETE",
  "summary": "",
  "files_changed": [],
  "artifacts": [],
  "tests": [],
  "blockers": [],
  "verification_results": []
}
```

`status=COMPLETE` do agent não promove Task automaticamente.

## 5.48 ResultDigest / FailureDigest

Criar resumos estruturados e limitados para:

```text
delegation
handoff
retry
recovery
Context Pack
evaluation
```

Evita reenviar trajetória inteira.

## 5.48 Event Outbox

Eventos mínimos:

```text
TASK_CREATED
TASK_READY
TASK_CLAIMED

LEASE_CREATED
LEASE_RENEWED
LEASE_EXPIRED

SESSION_STARTED
SESSION_RESUMED

WORKER_STARTED
WORKER_STOPPED
WORKER_FAILED

WORKSPACE_ALLOCATED
WORKTREE_CREATED
WORKSPACE_QUARANTINED

NODE_STARTED
NODE_COMPLETED
NODE_FAILED

DELEGATION_REQUESTED

COMMAND_EXECUTED
ARTIFACT_CREATED
COMMIT_CREATED

VALIDATION_STARTED
VALIDATION_PASSED
VALIDATION_FAILED

REVIEW_COMPLETED
AUDIT_COMPLETED

PR_CREATED
MERGE_STARTED
MERGED

RECOVERY_STARTED
RECOVERY_COMPLETED

TASK_DONE
TASK_FAILED
```

## 5.48 State/Event separation

Não usar Event Sourcing puro.

```text
CURRENT STATE
+
EVENT HISTORY
+
OUTBOX
```

Telemetry nunca é load-bearing.

## 5.48 Ledger V1

Registrar:

```text
reads
writes
commands
tool calls
MCP calls
tests
Git operations
agent
model
provider
worker
timestamps
outputs
```

## 5.48 Ledger V2

Adicionar:

```text
repo state hash
observation validity
observation timestamp
modification counters
command fingerprint
tool-result fingerprint
result reuse
```

Detectar:

```text
stale observation
duplicate action
duplicate command
unchanged state
repeated failure
```

## 5.48 Validation Gate V1

Antes do Control Plane completo:

```text
scope
Git diff
lint
typecheck
build
unit tests
integration tests
contract tests
ownership
main freshness
Git sanity
```

Agent terminou:

```text
EXECUTION_FINISHED
```

não `DONE`.

## 5.48 Watchdog + Recovery

Detectar:

```text
idle stall
hard timeout
child crash
worker crash
broker crash
MCP disconnect
session loss
orphan lease
provider failure
quota exhaustion
CI failure
merge failure
```

Recovery ladder:

```text
1. interrupt
2. resume
3. restart runtime
4. restore session/task
5. retry attempt
6. fail safely
```

Nunca infinite retry.

## 5.48 Reconciliation Engine

Boot:

```text
LOAD STATE
↓
CHECK OUTBOX
↓
CHECK LEASES
↓
CHECK SESSIONS
↓
CHECK WORKERS
↓
CHECK WORKSPACES
↓
CHECK WORKTREES
↓
CHECK GIT
↓
CHECK PRs
↓
CHECK CI
↓
CHECK MERGED COMMITS
↓
RECONCILE
↓
RESUME
```

## 5.48 Integration Manager

```text
Worker A ─┐
Worker B ─┼─→ Integration Queue
Worker C ─┘
                 ↓
       Integration Worktree
                 ↓
          Latest Main
                 ↓
       Rebase / Merge
                 ↓
       Conflict Detection
                 ↓
       Full Validation
                 ↓
       Integration Audit
```

## 5.48 Conflict Handling

Conflito não é resolvido silenciosamente.

Possíveis resultados:

```text
serialize
create integration task
request replan
block
escalate
```

## 5.48 Merge Queue

V1:

```text
1 active merge / repo
```

Execução paralela, integração controlada.

## 5.48 Dependency Release

Default:

```text
predecessor MERGED + VERIFIED
→ dependent READY
```

Exceção:

```text
ARTIFACT edge
+
immutable artifact
+
contract
+
verification evidence
```

## 5.48 DoD — Parallel Execution Fabric

- Durable State.
- Universal protocol.
- Delegation lineage.
- Task lifecycle.
- Executable Graph Contract.
- Dependency DAG.
- DAG validation.
- Conditional routing.
- Ready Queue.
- Authoritative Scheduler.
- Elastic Worker Pool.
- Provider limits.
- Nested concurrency accounting.
- Mock providers before real quota.
- Codex/Claude/Gemini/OpenCode adapter contracts.
- Session Manager.
- ACP gateway contract.
- Atomic Claim.
- Lease.
- Fencing.
- Heartbeats.
- Ownership.
- Resource Locks.
- Worktree isolation.
- Read-only checkout.
- Workspace Pool.
- Safe caching.
- Workspace quarantine.
- Branch Engineering.
- Worker Contract.
- Node Execution Loop.
- Artifact Store.
- Structured Deliverables.
- ResultDigest/FailureDigest.
- Ledger V1/V2.
- Event Outbox.
- Event History.
- Validation V1.
- Watchdog.
- Recovery.
- Reconciliation.
- Integration Manager.
- Conflict Handling.
- Merge Queue.
- Failed worker replacement.
- Zombie worker rejection.
- No premature dependency execution.

---

# 6. IMPLANTAÇÃO 2 — ENGINEERING CONTROL PLANE

Objetivo: colocar metodologia, policy e enforcement sobre o Parallel Fabric.

## 6.1 Permanent Engineering Activation

Usuário diz:

```text
implementa X
corrige Y
```

e o Nexus escolhe automaticamente o processo.

## 6.2 Intent Router

Entrada:

```text
user request
issue
task
automation
API request
CI event
tracker event
```

## 6.3 Task Classifier

Tipos:

```text
QUESTION
QUICK
BUG
FEATURE
REFACTOR
ARCH_CHANGE
SECURITY
API_CHANGE
DB_CHANGE
TEST
REVIEW
RESEARCH
RELEASE
DOCS
OPS
DEPLOY
MIGRATION
```

Avaliar:

```text
domain
risk
complexity
testability
product impact
contract impact
architecture impact
security impact
data impact
migration impact
```

## 6.4 Risk / Complexity

```text
LOW
MEDIUM
HIGH
CRITICAL
```

```text
TRIVIAL
SMALL
MEDIUM
LARGE
```

## 6.5 EngineeringPlan

```yaml
task_id:
agent_id:
role:
model:
provider:

task_type:
domain:
risk_level:
complexity:

scope:
expected_files:
expected_tests:

product_impact:
contract_impact:
architecture_impact:
security_impact:
data_impact:
migration_impact:

testability:

execution_mode:
autonomy_level:

required_capabilities:
optional_capabilities:
forbidden_capabilities:

required_skills:
optional_skills:
forbidden_skills:

required_tools:
required_mcps:

context_budget:
tool_profile:

budget:
parallelism_policy:

verification_gates:
delivery_policy:
```

Nenhuma coding task relevante é despachada sem EngineeringPlan.

## 6.6 Enforcement Rings

### Ring 1 — Orchestration
Scheduler não despacha coding task relevante sem EngineeringPlan.

### Ring 2 — Provider Adapter
Regra permanente autoativa Control Plane e injeta apenas capabilities da task.

### Ring 3 — Runtime
Hooks e controles objetivos.

### Ring 4 — Evidence
Checks coletados independentemente da fala do agente.

### Ring 5 — Delivery
CI/rulesets/merge gates bloqueiam entrega inválida.

## 6.7 Policy Engine

Domínios:

```text
scope
permissions
evidence
testing
security
budget
retry
worktree
memory
requirements
completion
delivery
simplicity
approvals
capabilities
```

Policies:

```text
NO_COMPLETION_WITHOUT_EVIDENCE
NO_TEST_BYPASS
NO_SELF_APPROVAL
NO_UNAPPROVED_PRD_CHANGE
NO_UNAPPROVED_SPEC_CHANGE
NO_ADR_OVERRIDE
NO_DEPENDENCY_BYPASS
NO_FAILED_GATE_MERGE
NO_UNRELATED_CAPABILITY_LOADING
NO_CROSS_TASK_CONTEXT_LEAKAGE
NO_UNBOUNDED_RETRY
NO_AGENT_MAY_CHANGE_ITS_OWN_BUDGET
NO_AGENT_MAY_CHANGE_ITS_OWN_REQUIRED_GATES
```

## 6.8 Hook Engine

```text
session-start
prompt-submit

before-task
before-dispatch
before-plan

before-capability-load
after-capability-load

before-code
after-code

before-tool
after-tool

before-mcp
after-mcp

before-write
after-write

before-commit

before-verify
after-verify

before-review
after-review

before-audit

before-complete
before-merge
after-merge

agent-stop
```

Ações:

```text
ALLOW
WARN
BLOCK
INJECT_CONTEXT
REQUEST_REMEDIATION
REQUEST_APPROVAL
```

## 6.9 Universal Capability Resolver

EngineeringPlan declara necessidades abstratas.

Resolver escolhe implementação concreta:

```text
debugging
+
DB introspection
+
browser verification
```

pode virar:

```text
debugging skill
+
DB tool/MCP
+
Playwright verifier
```

## 6.10 Skill Registry

Metadata:

```text
id
purpose
triggers
task_types
risk_levels
dependencies
conflicts
owner
context_cost
version
status
```

## 6.11 Lazy Skill Loader

```text
SEARCH
↓
SELECT
↓
LOAD
↓
USE
↓
EVIDENCE
↓
COMPACT
↓
UNLOAD / STOP REINJECTION
```

## 6.12 Lazy Tool/MCP Loader

```text
NEED
↓
RESOLVE
↓
CONNECT
↓
USE
↓
RECORD
↓
DISCONNECT / STOP INJECTING
```

## 6.13 Engineering Sources

Incorporar sem concatenar:

```text
Ponytail
Boring Engineering
Lean Engineering
Simple Engineering
Code Discipline
Superpowers
Anti-Slop
glebis TDD
SpecMint-TDD
MegaBrain
```

MegaBrain contribui:

```text
sequential
parallel fan-out
DAG
loop
hybrid
handoffs
recovery/resume
self-healing
adversarial review
```

sempre abaixo de Policy/Risk/Autonomy.

## 6.14 Concern Ownership

```text
LEAN
→ YAGNI / reuse / stdlib / minimum design

DEBUG
→ root cause

TDD
→ RED/GREEN/REFACTOR

SCOPE
→ scope drift

CONTRACT
→ API/schema/CLI compatibility

ANTI-SLOP
→ UI/copy/responsive/human quality

AUDIT
→ repo-wide issues

REVIEW
→ current diff

BRANCH ENGINEERING
→ branch/worktree integration

ORCHESTRATION
→ graph/scheduler/handoff/recovery

VERIFY
→ proof before DONE
```

## 6.15 Rigor

```text
FAST
CORE + LEAN + VERIFY

STANDARD
CORE + LEAN + TDD + VERIFY

STRICT
CORE + SCOPE + CONTRACT + TDD + REVIEW + VERIFY

CRITICAL
SPEC + CONTRACT + SCOPE + ISOLATED-TDD
+ REVIEW + SECURITY + INTEGRATION + VERIFY + DELIVERY
```

## 6.16 Product Classification

PRD obrigatório quando houver:

```text
relevant feature
new user flow
significant functional change
multiple requirements
relevant UX
significant external integration
security/compliance product impact
MEDIUM/LARGE scope
ambiguous objective
```

Caso contrário:

```text
PRD = SKIPPED_WITH_REASON
```

## 6.17 Product Discovery

```text
IDEA
↓
PRODUCT CLASSIFICATION
↓
DISCOVERY
↓
PDR
↓
PRD
↓
PRD GATE
```

## 6.18 PDR

Campos:

```text
id
status
context
problem
decision
alternatives
reasoning
expected_outcome
risks
constraints
dependencies
owner
created_at
supersedes
```

Estados:

```text
PROPOSED
ACCEPTED
SUPERSEDED
REJECTED
```

## 6.19 PRD

Campos:

```text
id
version
status
owner

problem
user_outcome
business_outcome

personas
use_cases

goals
non_goals
out_of_scope

functional_requirements
non_functional_requirements

constraints
dependencies
assumptions

success_metrics
risks
open_questions
acceptance_criteria

security_considerations
privacy_considerations
migration_considerations

related_pdrs
related_specs
related_adrs
```

## 6.20 Requirement Model

```text
id
type
priority
statement
verification
status
```

Tipos:

```text
FUNCTIONAL
NON_FUNCTIONAL
SECURITY
PRIVACY
PERFORMANCE
RELIABILITY
UX
COMPATIBILITY
MIGRATION
```

Prioridade:

```text
MUST
SHOULD
COULD
WONT
```

## 6.21 PRD Lifecycle

```text
DRAFT
↓
CLARIFYING
↓
READY_FOR_REVIEW
↓
APPROVED
↓
IMPLEMENTING
↓
VALIDATING
↓
SATISFIED
```

Laterais:

```text
BLOCKED
SUPERSEDED
REJECTED
```

## 6.22 PRD Gate

```text
problem defined
goals defined
non-goals defined
out-of-scope explicit

requirements testable
acceptance defined

critical open questions = 0

dependencies mapped
risks mapped

metrics defined or explicit skip
security/privacy assessed when relevant
migration assessed when relevant
```

## 6.23 Spec Compiler

```text
PRODUCT INTENT
+
PDR
+
PRD
+
REQUIREMENTS
+
CONSTRAINTS
        ↓
SPEC COMPILER
        ↓
CANONICAL BEHAVIORAL SPEC
```

Não inventa requirements escondidos.

## 6.24 Spec Engine

```text
PRD = WHAT + WHY
SPEC = EXACT BEHAVIOR
PLAN = HOW
TASK = EXECUTABLE UNIT
TDD = IMPLEMENTATION PROOF
```

Pipeline:

```text
SPECIFY
↓
CLARIFY
↓
ANALYZE
↓
PLAN
↓
TASKS
```

## 6.25 Requirement Traceability

```text
PRD-REQ
↓
SPEC-BEHAVIOR
↓
TASK
↓
TEST
↓
EVIDENCE
```

MUST não pode sumir.

## 6.26 Requirement Change Control

```text
DISCOVERED CHANGE
↓
CHANGE PROPOSAL
↓
PRD/SPEC IMPACT
↓
APPROVE / REJECT
↓
NEW VERSION
↓
REPLAN
```

## 6.27 Architecture Engine

```text
Architecture Description
Architecture Impact
Architecture Validation
ADR
```

ADR:

```text
context
decision
alternatives
consequences
risks
dependencies
affected components
status
```

Estados:

```text
PROPOSED
ACCEPTED
SUPERSEDED
DEPRECATED
```

## 6.28 TDD Engine

```text
RED
↓
FAILING TEST
↓
RED EVIDENCE
↓
GREEN
↓
MINIMUM IMPLEMENTATION
↓
GREEN EVIDENCE
↓
REFACTOR
↓
VERIFY
```

Sem evidência:

```text
TDD_GATE = FAIL
```

## 6.29 Debugging Engine

```text
REPRODUCE
↓
COLLECT EVIDENCE
↓
ROOT CAUSE
↓
FAILING TEST
↓
FIX
↓
REGRESSION TEST
↓
VERIFY
```

## 6.30 Anti-loop Engine

```text
ALLOW
REUSE_RESULT
NUDGE
BLOCK
```

Signals:

```text
same action
same state
same command
same failure
no progress
```

## 6.31 Retry Engine

```text
RETRY_SAME
RETRY_WITH_FEEDBACK
CHANGE_AGENT
CHANGE_MODEL
CHANGE_PROVIDER
CHANGE_TOOL
CHANGE_MCP
REPLAN
ESCALATE
```

## 6.32 Circuit Breakers

```text
budget exceeded
same failure
same command
tool unavailable
MCP unavailable
provider unavailable
permission denied
security issue
dependency blocked
no progress
excessive context growth
```

## 6.33 Budget Engine

Controla:

```text
tokens
money
runtime
attempts
tool calls
MCP calls
parallel workers
nested agents
provider quota
```

## 6.34 Model Profiles

Preservar profiles:

```text
TINY
LIGHT
NORMAL
HEAVY
EXCLUSIVE
AUDIT
```

Roteamento por:

```text
task
risk
capability
quota
load
cost
latency
historical performance
```

## 6.35 Acceptance Engine

Cada critério declara modo de prova:

```text
DETERMINISTIC
AGENTIC
HUMAN
```

Deterministic sempre preferido quando possível.

## 6.36 Agentic Rubric

Usada apenas para critérios não totalmente determinísticos.

Complementa; nunca substitui testes objetivos.

## 6.37 Verifier

Checks:

```text
scope
Git diff
build
lint
typecheck
unit
integration
E2E
security
smoke
contracts
acceptance
ownership
Git state
runtime
```

Verifiers especializados:

```text
CommandVerifier
FileVerifier
DiffVerifier
TestVerifier
ReviewVerifier
BrowserVerifier
```

## 6.38 Browser Verifier

```text
Playwright Adapter
↓
Render
↓
DOM
↓
Console
↓
Network
↓
Interaction
↓
Screenshot
↓
Visual/Runtime Evidence
```

Lazy-loaded.

## 6.39 Evidence Store

Guardar:

```text
logs
test outputs
build outputs
diffs
hashes
screenshots
network traces
API responses
security scans
benchmarks
artifacts
tree hash
runtime snapshots
```

Ligação:

```text
requirement
spec behavior
task
test
gate
run
attempt
review
audit
```

## 6.40 Evidence Graph

Relacionar explicitamente:

```text
Claim
↓
Evidence
↓
Source
↓
Artifact
↓
Task
↓
Trace
```

O sistema deve conseguir responder objetivamente: `Por que esta task foi considerada concluída?`

## 6.41 Reviewer

Avalia:

```text
current diff
correctness
scope
quality
contracts
maintainability
```

Não substitui Verifier.

## 6.42 Independent Agent Review

Regra:

```text
implementer != reviewer
```

quando policy exigir.

Findings estruturados:

```text
severity
file
reason
suggested_action
evidence
```

Correções voltam via resume ao implementer original quando apropriado.

## 6.43 Auditor

Preferencialmente read-only e com contexto independente.

```text
ACCEPT
REJECT
NEEDS_EVIDENCE
BLOCKED
```

Preferência:

```text
IMPLEMENTER != REVIEWER != VERIFIER != AUDITOR
```

quando capacidade permitir.

## 6.44 Approvals

Persistir:

```text
ApprovalRequest
ApprovalDecision
```

Campos:

```text
scope
reason
requested_by
required_authority
status
decision
evidence
expires_at
created_at
decided_at
```

Aplicações:

```text
destructive operation
production deploy
security exception
PRD change
Spec change
budget elevation
sensitive data
high-risk DB operation
permission elevation
```

## 6.45 Verified State Promotion

Somente:

```text
mandatory gates PASS
+
required review PASS
+
Auditor ACCEPT
```

promove progresso.

Falha vira:

```text
EVIDENCE
+
REWORK
```

## 6.46 Convergence Engine

```text
PRD
↕
SPEC
↕
ADR
↕
ARCHITECTURE
↕
PLAN
↕
TASK GRAPH
↕
CODE
↕
TESTS
↕
EVIDENCE
```

Requirement state:

```text
SATISFIED
PARTIAL
FAILED
NOT_IMPLEMENTED
SUPERSEDED
```

Gap:

```text
GAP
↓
REMEDIATION TASK
↓
IMPLEMENT
↓
VERIFY
↓
CONVERGE AGAIN
```

## 6.47 Security Engine

Cobertura:

```text
secrets
shell
network
filesystem
database
deployment
delete
merge
authentication
authorization
payments
PII
external input
supply chain
dependencies
cryptography
permissions
MCP permissions
tool permissions
provider permissions
```

Resultado:

```text
ALLOW
DENY
ASK
```

Redaction obrigatória:

```text
API keys
cookies
tokens
authorization headers
.env values
```

## 6.48 Delivery Gate

```text
dependencies PASS
tests PASS
evidence COMPLETE
review PASS
audit ACCEPT
security PASS/SKIP
architecture PASS/SKIP
requirements SATISFIED
convergence PASS
CI PASS
integration PASS
```

Então:

```text
READY_TO_MERGE
```

## 6.49 DoD — Engineering Control Plane

- Intent Router.
- Task Classifier.
- Risk/Complexity.
- EngineeringPlan.
- Enforcement rings.
- Policy Engine.
- Hook Engine.
- Capability Resolver.
- Skill Registry.
- Lazy skills.
- Lazy tools/MCPs.
- Ponytail/Boring/Lean/Simple/Code Discipline/Superpowers/Anti-Slop/TDD/SpecMint/MegaBrain adaptations.
- PDR.
- PRD.
- PRD Gate.
- Spec Compiler.
- Spec Engine.
- Requirement Traceability.
- Requirement Change Control.
- Architecture/ADR.
- TDD.
- Debug.
- Anti-loop.
- Retry.
- Circuit Breakers.
- Budget Engine.
- Model Profiles.
- Acceptance Engine.
- Agentic Rubric.
- Verifier.
- Browser Verifier.
- Evidence Store.
- Reviewer.
- Independent review.
- Auditor.
- Approvals.
- Verified State Promotion.
- Convergence.
- Security.
- Delivery Gate.
- False-DONE prevention.

---

# 7. IMPLANTAÇÃO 3 — MEMORY & INTELLIGENCE SYSTEM

Princípio:

```text
AGENTS PRODUCE OBSERVATIONS
EVIDENCE PRODUCES KNOWLEDGE
```

## 7.1 Memory Engine

Provider-neutral:

```text
context()
recall()
remember()
checkpoint()
verify()
search()
supersede()
revoke()
health()
```

## 7.2 Memory Lifecycle

```text
OBSERVED
↓
CANDIDATE
↓
VERIFIED
↓
CANONICAL
```

Laterais:

```text
SUPERSEDED
CONFLICTED
REVOKED
```

## 7.3 Hindsight Adapter

```text
Nexus MemoryEngine
↓
Hindsight Adapter
↓
Hindsight
```

Hindsight é engine, não autoridade.

Graphiti não é Memory V1.

## 7.4 Memory Identity

```text
memory_id

project_id
task_id
node_id
run_id
attempt_id

agent_id
session_id
workspace_id

created_at
```

## 7.5 Namespaces

```text
global
project:<project_id>
```

Task/session/run ficam como metadata.

Cross-project leakage = BLOCK.

## 7.6 Memory Types

```text
DECISION
CONSTRAINT
FACT
ARCHITECTURE
CONVENTION
LESSON
FAILURE
SOLUTION
OPEN_GOAL
KNOWN_BUG
WORKFLOW
SOP
PERFORMANCE_SIGNAL
```

## 7.7 Provenance

```text
source
provenance
authority
confidence

valid_from
valid_until

project
task
node
run
agent

evidence
supersedes

created_at
updated_at
```

## 7.8 Source Types

```text
USER_EXPLICIT
GIT
RUNTIME
CONFIG
TEST
TOOL_RESULT
MCP_RESULT
TASK_RESULT
AGENT_OBSERVATION
IMPORTED
INFERENCE
```

## 7.9 Truth Hierarchy

```text
CURRENT RUNTIME / GIT / CONFIG
>
APPROVED BLUEPRINT / PRD / SPEC / ADR / CONTRACT
>
VERIFIED MEMORY
>
CANDIDATE MEMORY
>
AGENT INFERENCE
```

## 7.10 Temporal Knowledge

Não apagar histórico.

```text
Fact V1
valid_from=A
valid_until=B
SUPERSEDED

Fact V2
valid_from=B
valid_until=null
CANONICAL
```

Responder:

```text
what is true now?
what was true then?
```

## 7.11 Conflict Resolution

```text
source authority
↓
evidence
↓
temporal validity
↓
recency where appropriate
↓
resolution
```

Resultado:

```text
CANONICAL
SUPERSEDED
CONFLICTED
REVOKED
```

## 7.12 Memory Layers

Preservar a organização em camadas:

```text
L0 Current Turn
L1 Current Task
L2 Current Session
L3 Project Memory
L4 Decisions / ADR
L5 Evidence Archive
```

O agente recebe somente a combinação necessária.

## 7.13 Evidence Attribution

```text
RECALLED
↓
SELECTED
↓
INJECTED
↓
USED
↓
VALIDATED
↓
CONTRIBUTED
```

Retrieval hit ≠ memória útil.

## 7.14 Context Compiler

Entrada:

```text
Task
Executable Node
EngineeringPlan

PDR/PRD slice
Spec slice
ADR slice

Dependency outputs
Interfaces

Policies
Capabilities

Skills
Tools
MCPs

Memory
Code Intelligence

Evidence requirements
```

Pipeline:

```text
RETRIEVE
↓
RELEVANCE FILTER
↓
AUTHORITY FILTER
↓
TEMPORAL FILTER
↓
CONFLICT FILTER
↓
TOKEN FIREWALL
↓
CONTEXT BUDGET
↓
MINIMUM CONTEXT PACKAGE
```

## 7.15 Context priority classes

Preservar classificação anterior:

```text
must_keep
constraints
decisions
acceptance_criteria
evidence
recent
unresolved
project_memory
historical
disposable
```

Cada fragmento deve ter:

```text
id
hash
priority
source
timestamp
provenance
scope
```

## 7.16 Context Diff

Não reenviar contexto inteiro quando só parte mudou.

```text
context_version N
→
context_version N+1
```

Medir:

```text
full_context_chars
delta_chars
delta_reuse_percent
estimated_tokens_avoided
```

Quando runtime suportar, enviar delta.

## 7.17 Context Cache por Hash

Cada bloco:

```text
content_hash
```

Se não mudou, reutilizar referência/cache.

Métricas:

```text
cache_hits
cache_misses
cache_hit_rate
context_reused
tokens_avoided_estimated
```

Não alegar economia causal sem benchmark.

## 7.18 Start-of-task context

```text
brain.context(task)
```

Pode incluir:

```text
current architecture
requirements
decisions
constraints
known failures
task history
dependency outputs
canonical sources
```

## 7.19 On-demand Recall

```text
brain.recall(query)
```

Usado quando:

```text
uncertainty detected
decision context missing
known failure suspected
subsystem boundary crossed
historical reason needed
```

Não consultar a cada tool call.

## 7.20 Checkpoint

Fim de task relevante:

```text
brain.checkpoint()
```

Pipeline:

```text
NORMALIZE
↓
EXTRACT CANDIDATES
↓
DEDUPE
↓
SOURCE CHECK
↓
EVIDENCE CHECK
↓
TEMPORAL RESOLUTION
↓
CONFLICT CHECK
↓
VERIFY
↓
CANONICALIZE
```

## 7.21 Dedupe

Resultado possível:

```text
reinforce
merge
new version
supersede
create
```

## 7.22 Stale Detection

Detectar:

```text
source changed
commit changed
config changed
runtime changed
spec superseded
ADR superseded
evidence invalidated
```

Então:

```text
REVERIFY
SUPERSEDE
REVOKE
CONFLICT
```

## 7.23 Learning Engine

```text
OUTCOME
↓
LESSON CANDIDATE
↓
EVIDENCE
↓
NOVELTY CHECK
↓
DURABILITY CHECK
↓
GENERALIZATION CHECK
↓
DEDUPE
↓
VERIFY
↓
PERSIST
```

Operações:

```text
reinforce
merge
supersede
decay
archive
revoke
```

## 7.24 Task Intelligence

```text
task-boundary detection
task-scoped retrieval

repeated problem detection
failure-pattern detection
successful workflow detection

SOP candidates
Skill candidates
```

## 7.25 Memory → SOP / Skill Promotion

```text
REPEATED VERIFIED PATTERN
↓
CANDIDATE SOP
↓
EVIDENCE
↓
EVAL
↓
POLICY / HUMAN APPROVAL WHEN REQUIRED
↓
SKILL REGISTRY
```

Nunca auto-promover opinião do agente.

## 7.26 Performance Memory

Dimensões:

```text
task type
domain
risk
complexity

role
agent
model
provider

skill
tool
MCP

project
```

Métricas:

```text
success rate
first-pass success
retries
replans
cost
latency
tokens
context size
review rejection
auditor rejection
recovery rate
regressions
provider failures
tool failures
```

## 7.27 Cost-aware Routing

Router/Scheduler podem usar:

```text
capability fit
historical performance
cost
latency
quota
failure rate
```

Nunca relaxar security/correctness gates.

## 7.28 Code Intelligence Engine

Separado da memória.

```text
Memory Engine
=
facts
decisions
lessons
historical context
```

```text
Code Intelligence
=
symbols
imports
dependencies
call graph
ownership
blast radius
test relationships
code evidence
```

Provider-neutral.

Fallback:

```text
Git
files
tests
runtime
```

Adapter externo só após:

```text
version validation
security validation
Windows validation
correctness validation
```

## 7.29 Garbage Collection / Consolidation

```text
candidate cleanup
duplicate merge
stale detection
superseded compaction
low-value decay
archive
quality evaluation
context-budget optimization
```

Nunca apagar evidência necessária.

## 7.30 Memory Security

```text
read scopes
write scopes
project isolation
agent permissions
source authority
PII classification
secret detection
audit trail
revocation
```

```text
SECRETS = NEVER AUTOMATICALLY STORED
```

## 7.31 DoD — Memory & Intelligence

- Provider-neutral MemoryEngine.
- Hindsight adapter.
- Namespaces.
- Provenance.
- Authority/confidence.
- Temporal history.
- Conflict resolution.
- Stale detection.
- Dedupe.
- Memory layers.
- Evidence attribution.
- Context Compiler.
- Token Firewall.
- Context Budget.
- Context priorities.
- Context Diff.
- Context hash cache.
- `context()`.
- `recall()`.
- `checkpoint()`.
- Learning Engine.
- Task Intelligence.
- SOP/Skill promotion.
- Performance Memory.
- Cost-aware routing.
- Code Intelligence.
- Consolidation/GC.
- Project isolation.
- Secret protection.
- Memory evals.

---

# 8. CROSS-CUTTING HARDENING / PRODUCTIZATION

## 8.1 Observability

Eventos:

```text
task.created
task.classified
task.ready
task.claimed

lease.created
lease.renewed
lease.expired

session.started
session.resumed

worker.started
worker.stalled
worker.failed

workspace.created
workspace.quarantined

capability.selected
skill.loaded
skill.unloaded

tool.called

mcp.connected
mcp.called
mcp.disconnected

node.started
node.completed
node.failed

test.red
test.green

gate.failed
gate.passed

review.completed
audit.completed

memory.recalled
memory.contributed
memory.conflicted
memory.superseded

convergence.completed

merge.ready
merged
```

## 8.2 Metrics

```text
tokens
cost
latency
duration

attempts
retries
replans

scheduler utilization
queue wait

worker utilization
worker failures

lease expirations
resource contention

workspace provisioning time

false DONE
review rejection
auditor rejection

skill performance
model performance
provider performance
tool performance
MCP performance

memory recall precision
useful recall rate
memory contribution
stale memory rate

context size
context tokens saved

session reuse
delegation depth

recovery rate

integration conflicts
merge failures
```

## 8.3 Tracing

```text
trace_id

project_id
goal_id
task_id
node_id

run_id
attempt_id

worker_id
agent_id
model_id
provider_id

session_id
workspace_id
```

Qualquer falha deve ser reconstruível.

## 8.4 Progress Engine

Progresso vem do estado verificado do graph, nunca do “acho que 80%”.

Calcular por:

```text
verified task state
dependency graph
required gates
accepted deliverables
remaining blockers
```

Separar:

```text
DONE
IN_PROGRESS
BLOCKED
READY
WAITING_APPROVAL
FAILED
```

## 8.5 Executive Brief

Gerar automaticamente a partir de estado/evidência, nunca de estimativa livre do modelo:

```text
Goal
Status
Completed
Blocked
Risks
Decision Required
Evidence
Next Recommended Action
```

## 8.16 Control Plane API

```text
/projects
/goals

/tasks
/graphs
/nodes

/runs
/attempts
/sessions

/workers
/scheduler
/leases
/resources

/workspaces

/agents
/models
/providers

/capabilities
/skills
/tools
/mcp

/artifacts
/deliverables

/prds
/specs
/adrs

/verifications
/evidence
/reviews
/audits

/approvals

/memory
/code-intelligence

/metrics
/events
```

CLI/Mission Control usam o mesmo core/API.

## 8.16 CLI

```text
nexus init

nexus run
nexus task
nexus resume

nexus status
nexus logs

nexus graph

nexus scheduler
nexus workers
nexus leases
nexus sessions
nexus workspaces

nexus capabilities
nexus skills
nexus tools
nexus mcp

nexus agents
nexus providers

nexus artifacts

nexus prd
nexus spec
nexus adr

nexus verify
nexus review
nexus audit

nexus approvals

nexus memory
nexus evidence

nexus doctor
nexus doctor --deep
```

## 8.16 Nexus MCP Server

Bridge única para hosts quando necessário.

Tools iniciais preservados:

```text
agent_delegate
agent_status
agent_resume
agent_cancel

task_create
task_status

artifact_get

verification_run

skill_search
skill_activate

control_plane_status
```

Regra:

```text
MCP is an interface
not the Control Plane
```

Core funciona mesmo sem MCP.

## 8.16 Host Plugins

Wrappers finos e pertencentes ao mesmo produto Nexus.

```text
plugins/claude
plugins/codex
plugins/gemini
```

### Claude
- hooks;
- core policy;
- Nexus MCP registration;
- skill/capability discovery.

### Codex
- AGENTS/rules/config;
- Nexus MCP;
- host integration.

### Gemini
- MCP;
- project instructions;
- hooks quando suportados.

Instalar/remover wrapper não pode corromper o Control Plane.

## 8.16 Automatic Delegation

```text
PROMPT
↓
HOST
↓
POLICY
↓
TASK CLASSIFIER
↓
ROUTER
↓
LOCAL / DELEGATE / REVIEW / PARALLEL
```

Usuário não precisa nomear provider/skill.

## 8.16 Mission Control

UI:

```text
Projects
Goals
Task DAG
Ready Queue
Running Tasks

Workers
Agents
Providers
Sessions
Quotas

Leases
Resource Locks
Worktrees

Runs
Attempts
Retries
Failures

PRD
Spec
ADR

Capabilities
Skills
Tools
MCPs

Verification
Evidence
Artifacts
Deliverables

Reviews
Audits
Approvals

Memory
Code Intelligence

Tokens
Costs

CI
Merge Queue
Incidents
```

UI não é source of truth.

## 8.16 Doctor

`nexus doctor --deep` deve verificar:

```text
Node
pnpm
Git
SQLite
filesystem permissions

Codex binary/auth/App Server
Claude binary/auth
Gemini binary/auth
OpenCode/ACP when configured

MCP registration
ACP support

state DB
migrations
events/outbox

leases
orphan leases

sessions
orphan sessions

workers
scheduler

worktrees
dirty/quarantined workspaces

policies
hooks
Capability Registry
Skill Registry

provider quota/health

CI bindings
```

Saída deve apontar:

```text
probable cause
evidence
remediation
```

## 8.16 CI / Tracker / Automation Triggers

Preservar:

```text
Issue
PR
CI failure
schedule
manual
API
```

Futuros loops:

```text
automatic issue intake
scheduled loops
CI repair loops
PR babysitter/shepherd
```

Sempre sob policies/gates.

## 8.16 Permanent Activation

Usuário não precisa pedir:

```text
PRD
Spec
ADR
TDD
Debug
Lean
Review
Audit
Security
Worktree
Multi-agent
Verification
Memory
Anti-loop
Recovery
Browser verification
```

Prompt permanente deve permanecer mínimo.

Enforcement fica no runtime.

## 8.16 Autonomy Levels

```text
A0 ASSIST
A1 READ_ONLY / TRIVIAL
A2 BOUNDED EXECUTION
A3 AUTONOMOUS ENGINEERING
A4 AUTONOMOUS MULTI-AGENT
```

Autonomia aumenta somente com histórico verificado.

Risk/Policy pode reduzir imediatamente.

## 8.16 Plugin Packaging

Um único produto/plugin Nexus distribui:

```text
manifest
runtime entrypoint

kernel
protocol

state
events
ledger

task graph
scheduler
leases
ownership
sessions
workspaces

Capability Registry
Capability Resolver

policies
hooks

routers

product
spec
architecture

TDD
debug

skills
tools
MCP adapters/server

agents
models
providers
ACP

artifacts
deliverables

loops
recovery

verifier
browser verifier
acceptance
evidence
review
auditor
approvals
convergence

memory
context
code intelligence

security

observability
metrics
tracing

API bridge
CLI
Mission Control integration

host wrappers
```

---

# 9. RESEARCH / REACH / BROWSERMESH — EXTENSÃO PRESERVADA

Capacidade do Blueprint anterior que não deve ser perdida.

Arquitetura futura:

```text
Nexus Control Plane
↓
ResearchEngine
↓
ReachEngine
↓
Capability/Provider Registry
↓
API / MCP / CLI / BrowserMesh
↓
HTTP / Scrapling / Playwright / Remote CDP
↓
Sanitizer
↓
Evidence
↓
Grounding
↓
Nexus
```

Princípios:

- pesquisa interna antes de externa quando aplicável;
- browser é capability lazy;
- Playwright para browser determinístico;
- Scrapling como backend candidato, sujeito a validação;
- Remote CDP opcional;
- conteúdo externo passa por sanitização;
- resultados entram como Evidence, não verdade automática;
- Research/Reach nunca cria segundo Control Plane.

---

# 10. FIXED STORAGE ARCHITECTURE

## 10.1 SQLite + Filesystem + Git são fixos

```text
SQLite
+
Filesystem
+
Git
=
PERMANENT NEXUS STORAGE ARCHITECTURE
```

Não existe promotion gate para outro banco relacional.

O Nexus deve continuar nessa arquitetura mesmo com:

```text
1…N agents
parallel execution
multiple projects
large task history
memory
events
evidence
observability
Mission Control
remote workers through Control Plane API
```

Escala deve ser tratada com otimização do SQLite, particionamento lógico, filesystem para payloads grandes, archive/compaction e centralização das mutações pelo Control Plane.

Redis pode existir no futuro apenas como coordenação/cache efêmera se necessidade real for comprovada. Mesmo nesse caso:

```text
Redis ≠ canonical state
Redis ≠ task authority
Redis ≠ memory authority
```

# 11. DISTRIBUTED / FLEET EXTENSIONS

Depois do core comprovado:

```text
distributed workers
remote hosts
cross-project fleet
additional providers
remote execution environments
cloud execution modes
```

Preservar uma interface única:

```text
Local
Worktree
Remote
Cloud
```

sem mudar TaskContract.

---

# 12. EVAL SUITE

## 12.1 Parallel / State

```text
invalid DAG
dependency gating
artifact dependency
race claim
lease expiry
zombie worker
heartbeat loss
resource conflict
ownership conflict
worker crash
scheduler crash
Control Plane restart
SQLite reopen
machine restart
dirty workspace
workspace quarantine
merge conflict
dependency release
idempotency duplicate
delegation lineage cycle
delegation depth overflow
```

## 12.2 Provider / Session

```text
Codex crash
Claude crash
Gemini crash
provider unavailable
quota exhaustion
lost session
session resume
orphan session
broker crash
ACP failure
MCP restart
```

## 12.3 Routing / Capabilities

```text
wrong task classification
wrong role
wrong agent
wrong model
wrong provider
wrong skill
wrong tool
wrong MCP
unnecessary MCP
excessive context
unnecessary parallelism
nested fan-out explosion
```

## 12.4 Engineering

```text
typo
simple bug
complex bug
feature
auth feature
API change
DB migration
architecture change
security issue
scope drift
PRD drift
Spec drift
ADR violation
TDD bypass
false DONE
loop
budget violation
```

## 12.5 Verification

```text
agent claims DONE without tests
build passes but acceptance fails
review rejection
audit rejection
missing evidence
stale evidence
wrong tree hash
browser regression
security finding
```

## 12.6 Memory

```text
invented memory
candidate treated as canonical
conflicting memory
stale memory
superseded memory
cross-project leakage
secret persistence
bad retrieval
irrelevant context
context overload
incorrect canonicalization
incorrect temporal answer
```

## 12.7 Multi-agent matrix

Obrigatório:

```text
Claude → Codex
Claude → Gemini
Codex → Claude
Codex → Gemini
Gemini → Claude
Gemini → Codex

Claude + Codex
Claude + Gemini
Codex + Gemini
Claude + Codex + Gemini

same provider multiple workers
mixed providers
parallel review
adversarial review
```

## 12.8 Hardening

```text
stress tests
concurrency tests
race-condition tests
scope-escape tests
recursive delegation tests
session corruption tests
large output tests
large diff tests
long-running command tests
filesystem failure
disk-full simulation where practical
event/outbox recovery
```

---

# 13. MVPs CANÔNICOS

## MVP 0 — Mock Core

Sem gastar providers:

```text
Task
↓
Mock Agent
↓
State
↓
Lease
↓
Session
↓
Workspace
↓
Deliverable
↓
Verification V1
↓
State Promotion
```

## MVP 1 — Parallel Core

```text
T1 + T2 independent
T3 depends on T1
T4 depends on T1 + T2

↓
DAG
↓
Scheduler
↓
T1/T2 parallel
↓
isolated worktrees
↓
validation
↓
integration
↓
merge queue

T1 merged
→ T3 ready

T2 merged
→ T4 ready
```

## MVP 2 — Engineering Bugfix

```text
"Corrige esse bug e adiciona regression test"

↓
Classifier
↓
EngineeringPlan
↓
Capability Resolver
↓
Debug + TDD + Verify
↓
relevant tools only
↓
Parallel Fabric
↓
RED
↓
GREEN
↓
Verifier
↓
Evidence
↓
Reviewer
↓
Auditor
↓
Convergence
↓
Merge
```

## MVP 3 — Product Feature

```text
"Cria login Google"

↓
FEATURE / AUTH / HIGH
↓
Product Classification
↓
PDR if needed
↓
PRD
↓
PRD Gate
↓
Spec Compiler
↓
Spec
↓
ADR if needed
↓
Executable Task DAG
↓
Capability Resolution
↓
Security
↓
TDD
↓
Parallel Implementation
↓
Browser Verification if relevant
↓
Evidence
↓
Review
↓
Audit
↓
Convergence
↓
Merge Queue
```

## MVP 4 — Memory

```text
NEW TASK
↓
brain.context()
↓
verified relevant memory
↓
Context Compiler
↓
EngineeringPlan
↓
execution
↓
verification
↓
audit
↓
brain.checkpoint()
↓
candidate knowledge
↓
source/evidence validation
↓
canonical memory
```

## MVP 5 — Failure / Recovery

```text
T7 CLAIMED
↓
worker dies
↓
heartbeat timeout
↓
lease expires
↓
reconciliation
↓
T7 READY
↓
new worker claims
↓
new fencing token
↓
resume
↓
old worker returns
↓
mutation rejected
```

## MVP 6 — Elastic Multi-Agent

```text
READY=1
→ 1 worker

READY=4
→ 4 workers

READY=15
effective capacity=8
→ 8 workers

4 migration tasks
migration lock capacity=1
→ 1 runs
→ 3 RESOURCE_BLOCKED
```

---

# 14. ORDEM CANÔNICA DE IMPLEMENTAÇÃO

```text
SHARED FOUNDATION
│
├── Bootstrap
├── Universal Protocol
├── Domain Model
├── Durable State
├── StateStore abstraction
├── Project Registry
├── Delegation Lineage
├── Capability Registry
├── Agent Factory
├── Permanent Minimal Context
└── Lazy Capability Architecture
        ↓
PARALLEL EXECUTION FABRIC
│
├── Mock Core Gate
├── Planner
├── Executable Graph
├── Task Lifecycle
├── Blocker Protocol
├── DAG
├── DAG Validator
├── Ready Queue
├── Scheduler
├── Provider/Agent Adapters
├── Session Manager
├── Claims
├── Leases
├── Fencing
├── Heartbeats
├── Ownership
├── Resource Locks
├── Workspace Pool
├── Worktrees
├── Read-only Checkout
├── Branch Engineering
├── Node Loop
├── Artifacts
├── Structured Deliverables
├── Result/Failure Digests
├── Ledger V1/V2
├── Events
├── Outbox
├── Validation V1
├── Watchdog
├── Recovery
├── Reconciliation
├── Integration
├── Conflict Handling
└── Merge Queue
        ↓
ENGINEERING CONTROL PLANE
│
├── Intent Router
├── Task Classifier
├── EngineeringPlan
├── Enforcement Rings
├── Policies
├── Hooks
├── Capability Resolver
├── Skill Registry
├── Lazy Skills
├── Lazy Tools/MCPs
├── Engineering Methodologies
├── Product/PDR/PRD
├── Spec Compiler
├── Requirement Traceability
├── Requirement Change Control
├── Architecture/ADR
├── Lean
├── TDD
├── Debug
├── Anti-loop
├── Retry
├── Circuit Breakers
├── Budgets
├── Model Profiles
├── Acceptance Engine
├── Agentic Rubric
├── Verifier
├── Browser Verifier
├── Evidence
├── Review
├── Independent Review
├── Auditor
├── Approvals
├── Verified State Promotion
├── Convergence
├── Security
└── Delivery Gate
        ↓
MEMORY & INTELLIGENCE
│
├── Memory Engine
├── Hindsight Adapter
├── Namespaces
├── Governance
├── Provenance
├── Truth Hierarchy
├── Temporal Knowledge
├── Conflict Resolution
├── Memory Layers
├── Attribution
├── Context Compiler
├── Token Firewall
├── Context Priorities
├── Context Diff
├── Hash Cache
├── Checkpoint
├── Dedupe
├── Stale Detection
├── Learning Engine
├── Task Intelligence
├── SOP/Skill Promotion
├── Performance Memory
├── Cost-Aware Routing
├── Code Intelligence
└── Consolidation/GC
        ↓
HARDENING / PRODUCTIZATION
│
├── Observability
├── Metrics
├── Tracing
├── Progress Engine
├── Control Plane API
├── CLI
├── Nexus MCP Server
├── Host Plugins
├── Automatic Delegation
├── Mission Control
├── Doctor
├── CI/Tracker Triggers
├── Permanent Activation
├── Autonomy
├── Plugin Packaging
├── E2E Matrix
├── Failure E2E
├── Stress/Race/Security Hardening
└── V1 Release Gate
        ↓
ADVANCED / SCALE
│
├── Research Engine
├── Reach Engine
├── BrowserMesh
├── Distributed Workers
├── Remote Hosts
├── Cross-project Fleet
├── Additional Providers
└── Optional Ephemeral Coordination Gate
```

---

# 15. ESTRATÉGIA DE DESENVOLVIMENTO

Cada fase obrigatoriamente:

```text
SPEC
↓
IMPLEMENT
↓
UNIT TEST
↓
INTEGRATION TEST
↓
REVIEW
↓
GATE
↓
NEXT PHASE
```

Não avançar com:

```text
critical TODO
broken required test
stub in main path
fake used as production
unverified state transition
unresolved data-loss risk
```

Dogfood gradual:

1. usar mocks;
2. usar um provider;
3. usar dois workers;
4. usar vários workers;
5. ativar Engineering Control;
6. ativar Memory;
7. só depois escalar automação.

---

# 16. DEFINITION OF DONE — V1

O Nexus V1 não está pronto antes de:

## Core
- Universal Protocol estável.
- SQLite + filesystem durável.
- StateStore abstraído.
- Project Registry.
- Capability Registry.
- Agent Factory.
- Idempotency.
- Event/Outbox transacional.

## Parallel
- DAG.
- Scheduler.
- Ready Queue.
- Claim/Lease/Fencing.
- Heartbeats.
- Sessions/resume.
- Ownership/resource locks.
- Worktree isolation.
- Workspace quarantine.
- Recovery/reconciliation.
- Integration/Merge Queue.

## Providers
- Codex.
- Claude.
- Gemini.
- OpenCode contract.
- ACP gateway contract.
- Bidirectional delegation entre providers suportados.

## Engineering
- EngineeringPlan obrigatório.
- Policies/Hooks permanentes.
- Lazy capabilities.
- PRD/Spec/ADR.
- TDD/Debug.
- Anti-loop/Retry/Budget.
- Verifier/Evidence.
- Independent Review.
- Auditor.
- Approvals.
- State Promotion.
- Convergence.
- Security.
- Delivery Gate.

## Memory
- MemoryEngine provider-neutral.
- Hindsight adapter.
- Governance/provenance.
- Temporal knowledge.
- Context Compiler.
- Context Diff/cache.
- Checkpoints.
- Task Intelligence.
- Performance Memory.
- Code Intelligence.

## Productization
- CLI.
- API.
- Nexus MCP bridge.
- Host wrappers.
- Observability.
- Metrics.
- Tracing.
- Progress Engine.
- Mission Control.
- Doctor.
- E2E/Failure E2E.
- Hardening.
- Install/uninstall reproduzível.
- False-DONE prevention.

---

# 17. V2 / FUTURE, PRESERVADO MAS NÃO ANTECIPADO

Somente após V1 provar necessidade:

```text
optional ephemeral coordination/cache
distributed scheduler
distributed workers
remote hosts
cross-project fleet
advanced Mission Control
tracker integrations
automatic issue intake
scheduled loops
CI repair loops
PR babysitter
additional providers
Research/Reach/BrowserMesh productionization
```

Propostas de auto-improvement nunca são autoaplicadas cegamente; passam por gates/evals.

---

# 18. 3-CHECK FINAL — MAPA DE COBERTURA

## Plano 1
Preservado:
- Foundation;
- Domain Model;
- Durable State;
- Policies/Hooks;
- Skills/Router;
- PRD/Spec/Architecture;
- TDD/Debug;
- Ledger;
- Verifier/Evidence/Auditor;
- Retry/Circuit Breaker/Budgets;
- Task Graph;
- Multi-agent;
- Security;
- Observability;
- Metrics/Tracing;
- CLI/Plugin;
- Performance Memory;
- Mission Control;
- Autonomy;
- Evals.

## Plano 2
Preservado:
- Dependency DAG;
- atomic claim;
- leases;
- scheduler autoritativo;
- elastic N-agent pool;
- provider limits;
- resource locks;
- worktrees;
- workspace pool;
- Event Outbox;
- recovery;
- merge queue;
- dois níveis de concorrência.

## Plano 3
Preservado:
- external tools as references/adapters;
- Nexus-native state/scheduler/memory/policies;
- Beads/Worktrunk optional adapters;
- no external architectural authority.

## Plano 4
Preservado:
- Foundation → Parallel → Engineering → Memory → Hardening;
- Domain/Durable State;
- Ledger V2;
- Requirement Traceability;
- Architecture/ADR;
- State Promotion;
- Code Intelligence;
- Memory Attribution;
- GC;
- Tracing;
- Security;
- packaging;
- evals.

## Plano 5
Preservado:
- Universal Capability Registry;
- lazy skills/tools/MCPs;
- stable roles;
- Gemini explicit;
- Executable Node Contract;
- Spec Compiler;
- Browser Verifier;
- Approvals;
- read-only checkout;
- API;
- Mission Control;
- fixed SQLite + filesystem + Git architecture; optional ephemeral coordination only when proven necessary.

## Planos anteriores relevantes recuperados
Também preservados:
- Universal Protocol;
- delegation lineage/depth protection;
- Session Manager;
- ACP Gateway;
- Artifact Store;
- Structured Deliverables;
- Result/Failure Digests;
- Acceptance Engine;
- Agentic Rubric;
- MCP server;
- thin Host Plugins;
- Doctor;
- complete provider E2E matrix;
- Failure E2E;
- Project Registry;
- Project Factory;
- Local Event Bus;
- Manager / Executor split;
- Evidence Graph;
- Executive Brief;
- Blocker Protocol;
- Branch Engineering;
- Context layers;
- Context Diff;
- hash cache;
- Research/Reach/BrowserMesh future track;
- CI/tracker/scheduled repair automation;
- distributed/remote fleet as V2.

---

# 19. REGRA FINAL DO NEXUS

```text
USER ASKS FOR WORK
        ↓
NEXUS UNDERSTANDS
        ↓
NEXUS DEFINES PRODUCT REQUIREMENTS WHEN NEEDED
        ↓
NEXUS COMPILES THE SPEC
        ↓
NEXUS BUILDS THE GRAPH
        ↓
DAG DECIDES WHAT MAY RUN
        ↓
SCHEDULER DECIDES WHAT WILL RUN
        ↓
LEASE DECIDES WHO OWNS IT
        ↓
FENCING PREVENTS STALE OWNERS
        ↓
WORKTREE DECIDES WHERE WRITES HAPPEN
        ↓
CAPABILITY RESOLVER LOADS ONLY WHAT IS NEEDED
        ↓
POLICY DECIDES WHAT IS ALLOWED
        ↓
ENGINEERING CONTROL DECIDES HOW IT MUST BE ENGINEERED
        ↓
WORKERS EXECUTE IN PARALLEL
        ↓
VERIFIER DECIDES WHETHER IT WORKS
        ↓
REVIEWER CHECKS THE CHANGE
        ↓
AUDITOR DECIDES WHETHER IT IS ACCEPTABLE
        ↓
CONVERGENCE CHECKS THE WHOLE CONTRACT
        ↓
INTEGRATION MANAGER RECONCILES PARALLEL RESULTS
        ↓
MERGE QUEUE DECIDES WHEN IT ENTERS MAIN
        ↓
MEMORY LEARNS ONLY FROM VERIFIED RESULTS
        ↓
PERFORMANCE MEMORY IMPROVES FUTURE ROUTING
        ↓
POLICY REMAINS AUTHORITY
```

---

# 20. SOURCE / PROVENANCE NOTE

Este plano é uma consolidação documental. Ele não afirma que as capacidades descritas já estejam implementadas.

A fusão foi baseada nos cinco planos desta sessão e nos documentos anteriores relevantes recuperados do projeto/biblioteca. Estados mutáveis de Git, providers, branches, CI, processos ou filesystem não foram usados para declarar implementação.

O princípio final permanece:

```text
PRESERVE
→ PROVE
→ CHANGE

EVIDENCE
→ PROMOTION

NO SILENT LOSS
```
