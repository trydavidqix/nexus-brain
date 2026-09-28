# Nexus Engineering Control Plane — Plano Canônico Completo V2.1

**Autoridade:** especificação técnica subordinada ao [Master Implementation Blueprint](../blueprints/NEXUS_BRAIN_MASTER_IMPLEMENTATION_BLUEPRINT.md). Este documento não mantém status ou dependências globais. O Blueprint é a fonte única para escopo, ordem, Definition of Done e conclusão dos work packages.

As fases detalham o Engineering Control Plane como subsistema. Elas não autorizam carregar o catálogo completo de skills por task; use apenas a seleção lazy e isolamento definidos pelo Blueprint.

## Decisão central

Um único plugin instalável. Nenhuma funcionalidade removida.

```text
NEXUS ENGINEERING PLUGIN
│
├── Control Plane
├── Always-On Constitution
├── Policy / Integrity
├── Goal + Task State
├── Routers
├── Dynamic Skills
├── Context Engine
├── Memory Intelligence
├── Code Intelligence
├── Product / Spec / Architecture
├── Agent Runtime
├── Worktrees / Task DAG
├── Continuous / Recovery Engine
├── Engineering Quality Gate
├── Verifier / Auditor
├── Convergence / Delivery
├── Observability / Learning
└── Mission Control
```

Não é uma mega-skill.

```text
1 instalação
1 plugin
1 control plane
N módulos
N capabilities pequenas
carregamento sob demanda
```

## Princípio de autoativação permanente

O usuário instala/ativa o Nexus Engineering uma vez. Depois disso, pedidos normais de engenharia devem passar automaticamente pelo Control Plane sem exigir `@plugin`, `$skill`, `/skill` ou qualquer lembrete manual.

```text
INSTALL / ENABLE ONCE
↓
SESSION START
↓
tiny bootstrap + invariants + Nexus identity
↓
USER REQUEST
↓
automatic intake/router
↓
minimum capabilities selected
↓
only required context/tools/skills loaded
↓
execution
↓
hard hooks + evidence + delivery gates
```

Regra estrutural:

```text
PLUGIN = habilitado permanentemente no projeto/perfil

CONTROL PLANE = ativo em toda task de engenharia

REGRAS CRÍTICAS = enforcement determinístico
                  (hooks / permissions / gates / CI)

ROUTER = automático em todo pedido

CAPABILITIES = lazy / on-demand

SKILLS VISÍVEIS AO HOST = poucas e roteadoras

TOOLS / MCP = on-demand

SCANNERS PESADOS = risk-based

SUBAGENTS = somente quando justificados

CONTEXTO = somente o necessário para task_id + agent_id
```

O sistema não depende de o modelo "lembrar" de usar o plugin. Guidance orienta; hooks/gates bloqueiam violações objetivas.

## Três classes de regra

```text
1. ALWAYS-ON GUIDANCE
   pequena constitution / invariants

2. CONDITIONAL GUIDANCE
   rules/skills/capabilities carregadas por task, path, risco ou fase

3. HARD ENFORCEMENT
   hooks, permissions, policy engine, deterministic gates e CI
```

Nenhuma regra de segurança, integridade, escopo, evidence ou conclusão pode depender apenas de texto no prompt.

## Regra de compatibilidade

Os nomes antigos viram implementações/adapters; as capacidades permanecem.

```text
MegaBrain
→ Nexus Engineering Intelligence

Engineering Quality Gate
→ Quality subsystem interno

PMB
→ MemoryEngine adapter

Hindsight
→ MemoryEngine primário do Nexus V1

OntoIndex
→ CodeIntelligenceEngine adapter

Superpowers
→ Engineering Methodology source/adapter

Spec Kit
→ Specification adapter

Tikalk Product/Architect
→ Product + Architecture adapters

Architecture Guard
→ Architecture governance adapter

Continuous-Claude
→ fonte de mecanismos do Continuous Engine
```

## Pipeline final

```text
SESSION START / RESUME
↓
BOOTSTRAP HOOK
↓
tiny constitution + plugin identity + persisted state
↓
USER REQUEST
↓
USER PROMPT HOOK
↓
TASK INTAKE
↓
GOAL CONTRACT
↓
CLASSIFIER
↓
RISK + COMPLEXITY + AUTONOMY
↓
WORKFLOW SELECTOR
↓
ENGINEERING PLAN
↓
TASK GRAPH quando necessário
↓
POLICY ENGINE
↓
CONTEXT RESOLVER
↓
MEMORY + CODE INTELLIGENCE
↓
SKILL RESOLVER
↓
TOOL / MODEL / AGENT RESOLVER
↓
TASK CONTEXT PACKAGE
↓
WORKTREE / OWNERSHIP
↓
MANAGER
↓
EXECUTOR
↓
QUALITY GATES
↓
EXECUTION + EVIDENCE + FINDINGS LEDGERS
↓
VERIFIER
↓
AUDITOR
↓
REMEDIATION / RECOVERY se necessário
↓
ARCHITECTURE + SPEC CONVERGENCE
↓
DELIVERY / MERGE GATE
↓
DONE_VERIFIED
↓
LEARNING
```

# Fase 0 — Source Audit + Provenance

Antes de portar qualquer código externo:

```text
identify source
↓
license
↓
exact capability
↓
exact commits
↓
provenance
↓
security review
↓
fixture/eval
↓
port behind Nexus contract
```

Aplicar a:

```text
Superpowers
pcvelz/superpowers
Spec Kit
Tikalk
Architecture Guard
PMB
OntoIndex
Continuous-Claude
fork pwnholic
Trail of Bits skills
Symphony
LoopX
Gas City
Beads
LongHorizon Harness
```

Nunca mergear fork inteiro cegamente.

# Fase 1 — Plugin Foundation

Tudo dentro do monorepo Nexus.

```text
plugins/nexus-engineering/
├── plugin.json
├── adapters/
│   ├── openai/
│   ├── claude/
│   └── future/
├── core/
├── policies/
├── hooks/
│   ├── hooks.json
│   ├── session-start
│   ├── user-prompt-submit
│   ├── subagent-start
│   ├── pre-tool-use
│   ├── post-tool-use
│   ├── permission-request
│   ├── pre-compact
│   ├── post-compact
│   ├── subagent-stop
│   ├── stop
│   └── session-end
├── rules/
│   ├── permanent/
│   └── scoped/
├── router/
│   ├── engineering
│   ├── implementation
│   ├── quality
│   ├── security
│   ├── architecture
│   ├── git
│   └── release
├── skills/
│   └── router-skills/
├── capabilities/
│   └── internal/
├── workflows/
├── runtime/
├── agents/
├── context/
├── memory/
├── code-intelligence/
├── worktrees/
├── state/
├── ledgers/
├── evidence/
├── findings/
├── quality/
├── scanners/
├── verifier/
├── auditor/
├── recovery/
├── observability/
├── learning/
├── evals/
└── assets/
```

Também:

```text
OpenAI portable plugin
Claude compatibility
Codex compatibility/fallback
future provider adapters
project-level enablement
first-install hook trust/review
provider-specific lifecycle translation
```

### Enable once

Codex:

```toml
[plugins."nexus-engineering@nexus"]
enabled = true
```

Claude Code:

```text
plugin instalado + habilitado
→ hooks do plugin carregados no início da sessão
→ restart/reload somente quando a configuração de hooks mudar
```

Hook novo ou alterado deve passar pelo mecanismo de confiança do runtime quando ele exigir isso. O plano nunca usa bypass de confiança como configuração normal.

Gate: `PLUGIN_BOOT_OK + AUTO_ACTIVATION_OK`.

# Fase 2 — Canonical Data Model

Contratos versionados:

```text
Goal
GoalContract
FrozenDoD
Task
TaskGraph
EngineeringPlan
Workflow
Skill
Capability
Agent
Provider
Model
Policy
Gate
Finding
Evidence
Artifact
Decision
Run
Attempt
Budget
Worktree
Lease
LedgerEntry
ContextPackage
```

Todos validáveis e serializáveis.

# Fase 3 — Durable State

O chat nunca será a fonte de verdade.

```text
state/
├── goals
├── tasks
├── graphs
├── decisions
├── blockers
├── evidence
├── findings
├── artifacts
├── ownership
├── leases
├── budgets
├── attempts
├── checkpoints
└── history
```

Crash/restart:

```text
process dies
↓
new session
↓
load persisted state
↓
reconstruct exact next step
↓
resume
```

# Fase 4 — Goal Contract + Frozen DoD

Toda task relevante começa com:

```text
objective
scope
out_of_scope
requirements
constraints
assumptions
acceptance_criteria
risk
required_gates
definition_of_done
```

Após implementação começar:

```text
DoD = FROZEN
```

Mudança legítima:

```text
revision request
→ reason
→ authorization
→ new version
```

Mudança escondida:

```text
INTEGRITY_COMPROMISED
```

# Fase 5 — Always-On Constitution

Pequena, permanente, alvo de aproximadamente 1.500 tokens.

```text
Understand before editing.
Verify before assuming.
Reuse before creating.
Prefer smallest correct implementation.
No speculative abstractions.
No silent scope expansion.
Fix root causes.
Preserve contracts.
Never weaken checks to get green.
Never claim completion without fresh evidence.
```

### Como permanece ativa

A constitution é fonte canônica do plugin. Cada adapter a injeta da forma nativa mais confiável do runtime:

```text
Codex
→ plugin enabled
→ SessionStart bootstrap
→ project AGENTS.md apenas para orientação estática quando fizer sentido
→ hooks/gates para enforcement

Claude Code
→ plugin enabled
→ SessionStart bootstrap
→ CLAUDE.md / unscoped rules somente para invariants pequenos quando fizer sentido
→ path-scoped rules para convenções locais
→ hooks/permissions para enforcement
```

Após compaction:

```text
PreCompact
→ persistir goal/task/decisions/blockers/evidence/next action

PostCompact
→ reinjetar somente bootstrap + estado mínimo necessário
```

O plugin não depende de um manual grande em `AGENTS.md` ou `CLAUDE.md`. Esses arquivos são guidance; regras inquebráveis ficam em mecanismos determinísticos.

Todo o resto continua lazy.

# Fase 6 — Policy + Integrity Engine

Policies:

```text
scope
evidence
budget
retry
permissions
worktree
security
dependency
testing
review
completion
no-self-approval
simplicity
approval-boundaries
```

Precedência Nexus:

```text
SECURITY
↓
DATA INTEGRITY
↓
CORRECTNESS
↓
USER REQUIREMENTS
↓
EXISTING CONTRACTS
↓
TESTS / ACCEPTANCE
↓
MINIMUM BLAST RADIUS
↓
SIMPLICITY
↓
PERFORMANCE
↓
STYLE
```

Hash/proteger:

```text
Frozen DoD
Scope
Gate Policy
Test Baseline
Verification Config
```

# Fase 7 — Task Classification

```text
QUESTION
SIMPLE_EDIT
BUG_FIX
FEATURE
REFACTOR
ARCHITECTURE
TESTING
REVIEW
AUDIT
INVESTIGATION
RESEARCH
MIGRATION
BRANCH_INTEGRATION
DEPENDENCY_CHANGE
FRONTEND_UI
PERFORMANCE
SECURITY
DOCUMENTATION
RELEASE
INCIDENT
UNKNOWN
```

Classificação deterministic-first. LLM entra apenas quando necessário.

# Fase 8 — Quatro eixos separados

## Risk

```text
R0 → R4
```

## Ceremony

```text
TINY
LIGHT
NORMAL
HEAVY
```

## Autonomy

```text
A0 assist
A1 read-only/trivial
A2 bounded
A3 autonomous engineering
A4 bounded multi-agent
```

## Quality Profile

```text
FAST
STANDARD
DEEP
RELEASE
INCIDENT
```

# Fase 9 — EngineeringPlan

Gerado antes de alterar código:

```text
EngineeringPlan
├── task_id
├── agent_id
├── goal_id
├── task_type
├── risk
├── ceremony
├── autonomy
├── quality_profile
├── scope
├── expected_files
├── expected_tests
├── contract_impact
├── testability
├── execution_mode
├── skills
├── context_budget
├── tool_profile
├── model_profile
├── verification_gates
├── stop_conditions
└── delivery_policy
```

Maestri não despacha coding task sem isso.

# Fase 10 — Router Registry + Capability Registry

Não expor todo o catálogo interno como skills globais do host.

Superfície pequena visível:

```text
nexus-engineering
nexus-implementation
nexus-quality
nexus-security
nexus-architecture
nexus-git
nexus-release
```

Catálogo interno, fora do contexto global:

```text
capability_id
purpose
triggers
task_types
risk_levels
requires
provides
conflicts
priority
context_cost
provider_support
tool_dependencies
version
status
```

Regra:

```text
few visible routers
↓
internal registry lookup
↓
minimum capabilities
↓
load actual instructions/assets only when needed
```

Isso evita que dezenas ou centenas de descrições de skills disputem o orçamento inicial do modelo.

No Codex, skills roteadoras mantêm implicit invocation habilitada; capacidades internas não precisam existir como skills globais descobertas pelo modelo. No Claude, usar o mesmo princípio: poucas skills model-visible e conhecimento especializado interno/on-demand.

Nunca carregar catálogo completo.

# Fase 11 — Router + Capability Resolver + Lazy Loader

```text
UserPromptSubmit
↓
Engineering Router
↓
Task + EngineeringPlan
↓
Router/Capability metadata
↓
Resolver
↓
minimum valid CapabilitySet
↓
Lazy Loader
```

Por `task_id + agent_id`.

O loader pode materializar, conforme necessidade:

```text
skill body
reference
rule slice
script
scanner
MCP/tool schema
provider adapter
```

Lifecycle:

```text
DISCOVER MINIMALLY
↓
LOAD
↓
USE
↓
RECORD RESULT
↓
COMPACT
↓
STOP REINJECTING
```

Não existe `load all`. Uma capability nova só entra quando o Router consegue justificar o trigger, dependência ou evidência que a exige.

# Fase 12 — Catálogo integral de Capabilities / Skills internas

A lista abaixo continua integralmente preservada, mas não significa que cada item seja uma skill global visível ao provider. O Router decide se a capability será implementada como skill, rule, script, hook, scanner, reference ou composição interna.

## Core

```text
core-discipline
simplicity / lean-engineering
explore
specification
planning
implementation
systematic-debugging
tdd
tdd-isolated
scope-guard
contract-guard
verification
review
audit
anti-slop
branch-engineering
migration
security
release
architecture
orchestration
```

## Quality especializada

```text
differential-review
static-analysis
semgrep-analysis
codeql-analysis
secrets-scan
dependency-risk
supply-chain-review
audit-context-building
false-positive-check
property-based-testing
fuzzing
mutation-testing
variant-analysis
agentic-actions-audit
spec-to-code-compliance
post-patch-validation
second-opinion
```

## Stack-specific

```text
c-review
rust-review
go-review
frontend-quality
accessibility
database
infra
```

# Fase 13 — Context Manager

```text
budget
selector
deduper
compressor
assembler
eviction
reload
```

Context hierarchy:

```text
L0 Permanent Policies
L1 Project Contract
L2 Goal
L3 Task
L4 Relevant Code
L5 Relevant Memory/Evidence
L6 Skill/Tool-specific context
```

# Fase 14 — Task Context Package

Cada agente recebe somente:

```text
task.json
goal-slice.json
spec-slice.md
architecture-slice.md
relevant-adrs.md
interfaces.md
dependencies.json
required-skills.json
required-policies.json
required-evidence.json
current-findings.json
```

Nunca history dump.

# Fase 15 — Memory Intelligence

```text
MemoryEngine
├── prepare
├── recall
├── write
├── relevance
├── dedupe
├── provenance
├── supersession
└── conflict
```

Categorias:

```text
decision
constraint
lesson
known_issue
failed_approach
architecture
open_goal
```

Lifecycle Nexus:

```text
OBSERVED
→ CANDIDATE
→ VERIFIED
→ CANONICAL
```

Hindsight = engine primário atual. PMB = adapter compatível/benchmarkável.

# Fase 16 — Code Intelligence

Contrato: `CodeIntelligenceEngine`.

```text
symbols
imports
callers
callees
inheritance
routes
dependency paths
impact analysis
blast radius
change detection
dead code
safe refactor
audit evidence
```

OntoIndex continua como adapter candidato.

```text
LOCATE
→ TRACE
→ IMPACT
→ EDIT
→ VERIFY
```

# Fase 17 — Product / Spec / Architecture

Ativação proporcional.

Tiny fix:

```text
Goal
→ Task
```

Feature:

```text
Goal
→ SPEC
→ Plan
→ Tasks
```

Produto grande:

```text
Product Discovery
→ PDR
→ PRD
→ SPEC
→ ADR
→ Architecture
→ Plan
→ DAG
```

# Fase 18 — Spec Kit

```text
specify
clarify
plan
tasks
analyze
converge
```

Regra:

```text
SPEC KIT = WHAT
```

# Fase 19 — Superpowers / Engineering Methodology

```text
brainstorming
systematic debugging
TDD
executing plans
subagent-driven-development
review
verification-before-completion
worktrees
finishing branch
```

Regra:

```text
SUPERPOWERS = HOW
```

# Fase 20 — Spec ↔ Execution Bridge

```text
feature
goal
tasks
spec
plan
dependencies
required_skills
required_gates
execution_mode
status
```

# Fase 21 — Architecture Guard

Ativado somente quando necessário.

```text
before implementation
during implementation
after implementation
before delivery
```

Detecta:

```text
architecture drift
boundary violation
dependency violation
forbidden coupling
obsolete components
spec divergence
ADR violation
```

# Fase 22 — Agent Runtime

Roles:

```text
Scout
Planner
Architect
Implementer
Debugger
Reviewer
Security
QA
Researcher
Manager
Verifier
Auditor
Integrator
```

Por agente:

```text
permissions
tools
skills
context_budget
write_scope
worktree
budget
task_id
```

# Fase 23 — Manager → Executor → Verifier → Auditor

```text
MANAGER
↓
escolhe próximo slice

EXECUTOR
↓
implementa

VERIFIER
↓
prova deterministicamente

AUDITOR
↓
aceita ou rejeita
```

Regras:

```text
Manager não implementa.
Executor não declara sucesso.
Verifier verifica estado real.
Auditor idealmente independente/read-only.
```

# Fase 24 — Acceptance Engine

Cada critério:

```text
DETERMINISTIC
AGENTIC
HUMAN
```

Agentic rubric complementa, nunca substitui testes.

# Fase 25 — Worktree Manager

```text
1 task
↔
1 owner
↔
1 lease
↔
1 branch
↔
1 worktree
```

Suportar:

```text
create
status
resume
env
ports
ownership
integration
cleanup
```

Cleanup somente depois de preservation proof.

# Fase 26 — Execution Ledger

```text
observations
modifications
commands
tests
tool calls
git changes
invalidations
```

Detecta stale reads, same command/test/state, no modification e redundant action.

Pode retornar:

```text
ALLOW
REUSE_RESULT
NUDGE
REPLAN
BLOCK
```

# Fase 27 — Evidence Ledger

```text
command
exit code
timestamp
agent
runtime
commit/tree hash
diff
artifact hashes
logs
screenshots
scanner result
test result
```

Nunca aceitar "tests should pass" como evidence.

# Fase 28 — Findings Ledger

```text
id
fingerprint
source
rule
category
CWE
severity
confidence
file
lines
evidence
reproducible
status
duplicate_of
owner
fix_commit
validation
```

Lifecycle:

```text
NEW
TRIAGED
VALIDATED
FALSE_POSITIVE
DUPLICATE
FIXING
FIXED
VERIFIED
ACCEPTED_RISK
BLOCKING
```

# Fase 29 — Quality Profiles + Scanner Router

FAST:

```text
lint
types/build
targeted tests
incremental Semgrep
secret scan
diff review
```

STANDARD:

```text
FAST
+ broader tests
+ dependency check
+ differential review
+ FP triage
```

DEEP:

```text
STANDARD
+ CodeQL
+ context building
+ supply chain
+ PBT/fuzzing/variant when applicable
```

RELEASE:

```text
DEEP
+ full SAST
+ full deps
+ secrets
+ IaC
+ SBOM
+ complete tests
+ mutation when appropriate
+ second opinion
```

INCIDENT:

```text
root cause
→ variant analysis
→ repo-wide search
→ regression
→ patch validation
→ release gate
```

# Fase 30 — Scanner Stack

Condicional:

```text
Semgrep
CodeQL
Gitleaks
TruffleHog
OSV-Scanner
Trivy
Checkov
kube-linter
Hadolint
zizmor
ecosystem-native audits
```

Language based:

```text
Python
JS/TS
Rust
Go
Java
C/C++
```

# Fase 31 — False Positive Gate

```text
finding
↓
dedupe
↓
evidence check
↓
data-flow/context
↓
environment/version
↓
safe reproduction
↓
VALIDATED
or FALSE_POSITIVE
or REVIEW_REQUIRED
```

# Fase 32 — Advanced Testing

Sob demanda:

```text
Property-Based Testing
Fuzzing
Mutation Testing
```

# Fase 33 — Variant Analysis

```text
root cause
↓
structural pattern
↓
repository search
↓
rank candidates
↓
validate variants
```

Obrigatório em INCIDENT.

# Fase 34 — Agentic Actions Audit

Triggers:

```text
.github/workflows
Claude/Codex/Gemini actions
MCP definitions
skills
hooks
agent tools
permission configs
```

Checar untrusted prompts, unsafe sandbox, wildcard permissions, secret exposure, AI output executed as code e cross-file workflow problems.

# Fase 35 — UI Quality

Somente frontend:

```text
anti-slop
accessibility
Playwright
screenshots
visual diff
UI verdict
```

# Fase 36 — Post-Patch Validation

```text
rerun original failure
↓
regression
↓
scanner
↓
variant check
↓
diff review
↓
new-finding check
```

Só então finding vira VERIFIED.

# Fase 37 — Continuous Engine

```text
failure detection
drift detection
repetition detection
context injection
skill activation
compiler/test loop
phase gates
handoff
```

Runtime logic, não agente.

# Fase 38 — Recovery Engine

Estados:

```text
RUNNING
BLOCKED
FAILED
STUCK
RECOVERING
DONE
```

Detectar repetição por:

```text
error
patch
hypothesis
tools
affected files
state
```

Recovery:

```text
retry same executor
↓
change hypothesis
↓
rebuild context
↓
change qualified executor/model
↓
decompose task
↓
escalate
```

# Fase 39 — Retry + Circuit Breakers + Budgets

```text
max_turns
max_retries
max_tokens
max_cost
max_runtime
max_agents
max_concurrency
```

Circuit breakers:

```text
same failure
tool unavailable
permission missing
security violation
no state change
budget exhaustion
```

# Fase 40 — Task DAG

```text
depends_on
blocks
parallel_safe
exclusive_resource
owner
lease
worktree
required_skills
required_gates
```

# Fase 41 — Parallel Scheduler

Considerar ready queue, priority, capacity, budget, provider availability, worktree conflicts e file overlap.

# Fase 42 — File Claims

```text
Agent A claims X
Agent B claims Y
```

Overlap crítico → serialize.

# Fase 43 — Multi-Agent

```text
SEQUENTIAL
PARALLEL FAN-OUT
DAG
LOOP
HYBRID
SUB-ORCHESTRATION
```

Cada child task recebe task_id, agent_id, skills, context, budget, worktree e permissions próprios.

# Fase 44 — Integration Manager

```text
worker branches
↓
integration worktree
↓
conflict tasks
↓
full verification
↓
audit
↓
delivery gate
```

# Fase 45 — Provider / Model Router

Escolher por capability, task, risk, complexity, context, quota, health, availability, cost, latency e historical quality.

Model profiles:

```text
cheap
normal
heavy
audit
```

# Fase 46 — Adapters

Primeira classe:

```text
Codex
Claude Code
```

Depois:

```text
OpenCode
Cursor
Gemini
other providers
local agents
```

Um core; adapters traduzem hooks/tools/capabilities.

# Fase 47 — Cross-Agent Protocol

```text
Claude
→ architecture/spec

Codex
→ implementation

fresh verifier
→ verification

auditor
→ acceptance
```

Shared state, não transcript compartilhado.

# Fase 48 — Convergence Engine

```text
PDR
PRD
SPEC
ADR
ARCHITECTURE
PLAN
TASK
CODE
TEST
EVIDENCE
```

Gap → remediation task.

# Fase 49 — Final Delivery / Merge Gate

Exigir conforme task:

```text
scope
contracts
tests
evidence
security
quality
review
architecture
convergence
integrity
```

Resultados:

```text
PASS
PASS_WITH_ADVISORIES
BLOCKED
REVIEW_REQUIRED
```

Sucesso do task state: `DONE_VERIFIED`.

# Fase 50 — CI / PR Integration

```text
checkout
↓
diff
↓
router
↓
profile
↓
checks
↓
ledgers
↓
SARIF
↓
review
↓
gate
```

Release branch usa RELEASE.

# Fase 51 — Autoativação, Hooks e Enforcement Rings

O hook system é parte central do Control Plane, não um detalhe opcional.

## Lifecycle canônico

### SessionStart

```text
session start/resume
↓
confirm plugin identity/version
↓
load tiny constitution
↓
load project contract
↓
recover persisted active task if any
↓
initialize router/state pointers
```

Não carrega catálogo completo de skills, MCPs, scanners ou referências.

### UserPromptSubmit

Executa automaticamente para cada pedido.

```text
user prompt
↓
engineering intent?
├─ no → minimal/no engineering route
└─ yes
   ↓
   classify task
   ↓
   risk + ceremony + autonomy
   ↓
   create/update Goal Contract + EngineeringPlan
   ↓
   resolve minimum capabilities
   ↓
   prepare minimum context
```

Este é o gatilho principal que elimina a necessidade de o usuário dizer "use o Nexus", "use TDD" ou "use a skill".

### SubagentStart

Propagar somente:

```text
task_id
agent_id
role
scope
required capabilities
permissions
budget
worktree
acceptance/evidence slice
```

Nunca herdar o catálogo inteiro ou contexto de agentes irmãos.

### PreToolUse

Guarda determinístico antes da ação.

Validar:

```text
scope
permissions
destructive command
secret handling
test/gate tampering
forbidden files
production mutation
dependency policy
branch/worktree ownership
approval boundary
```

Resultados suportados pelo adapter:

```text
ALLOW
DENY
REWRITE quando o runtime suporta
ADD MINIMAL CONTEXT quando o runtime suporta
ASK via permission layer quando aplicável
```

A política canônica é comum; cada adapter usa apenas controles realmente suportados pelo provider.

### PostToolUse

```text
tool result
↓
Execution Ledger
↓
Evidence Ledger
↓
changed-file / state invalidation
↓
cheap relevant checks
↓
Findings update
↓
router re-evaluation somente se nova evidência justificar
```

Nenhum scanner pesado roda automaticamente em toda edição.

### PermissionRequest

Aplicado a operações que exigem decisão explícita:

```text
production
secrets
destructive DB/data
irreversible delete
deploy/release
major scope expansion
gate relaxation
Frozen DoD revision
critical external side effect
```

### PreCompact

Persistir:

```text
goal
task
EngineeringPlan
decisions
blockers
attempt state
evidence pointers
loaded/completed capabilities
next exact action
```

### PostCompact

Reinjetar apenas o bootstrap e o estado mínimo necessário. Capabilities pesadas voltam somente se ainda forem relevantes.

### SubagentStop

Subagente só encerra com contrato estruturado:

```text
result
diff/commit pointer
tests/checks
evidence
findings
blockers
handoff
```

Se faltarem requisitos obrigatórios, o Control Plane devolve REWORK/NEEDS_EVIDENCE.

### Stop

Último cadeado antes de sucesso:

```text
attempt to stop
↓
required gates passed?
fresh evidence?
scope valid?
contracts preserved?
blockers resolved?
verifier required and passed?
integrity valid?
↓
yes → allow completion
no  → block/continue with exact missing work
```

O Stop Gate nunca aceita declaração textual do agente como prova.

### SessionEnd

Persistir somente estado durável, resultado, métricas, decisões verificadas, work-in-progress recuperável e learning candidates. Não armazenar transcript bruto como estado operacional.

## Provider translation

```text
CANONICAL NEXUS HOOK
↓
Provider Adapter
├── Codex lifecycle hook
├── Claude Code lifecycle hook
└── fallback deterministic gate quando evento equivalente não existir
```

Não assumir que um hook de Claude funciona no Codex ou vice-versa.

## Rings

```text
RING 1 — ORCHESTRATION
RING 2 — PROVIDER ADAPTER
RING 3 — RUNTIME HOOKS / PERMISSIONS
RING 4 — EVIDENCE / VERIFICATION
RING 5 — DELIVERY / CI
```

Sem EngineeringPlan não despacha. Adapter injeta somente contexto/capabilities da task. Runtime bloqueia violações objetivas. Nexus coleta evidence independentemente do agente. CI/rulesets impedem entrega inválida.

## Fail-closed vs fail-visible

Regras críticas de segurança/integridade devem falhar fechado quando o runtime consegue fazê-lo com segurança. Falha de hook/scanner nunca é convertida silenciosamente em PASS.

```text
PASS ≠ UNKNOWN
PASS ≠ ERROR
```

# Fase 52 — Anti-Bypass / Anti-Gaming

Detectar:

```text
--no-verify
disabled lint
disabled typecheck
test weakening
assertion deletion
warning suppression
gate-config manipulation
DoD manipulation
scope manipulation
```

# Fase 53 — Approval Boundaries

Aprovação explícita para:

```text
destructive migration
production mutation
secret access/transmission
irreversible operation
major scope expansion
gate relaxation
Frozen DoD revision
critical external side effects
```

# Fase 54 — Observability

Eventos:

```text
task.created
task.classified
workflow.selected
skill.loaded
skill.unloaded
agent.assigned
tool.called
gate.failed
gate.passed
test.red
test.green
finding.created
review.completed
convergence.completed
merge.ready
task.completed
```

Trace:

```text
goal_id
task_id
run_id
attempt_id
agent_id
```

# Fase 55 — Learning Engine

Somente aprender com resultado verificado.

```text
outcome
↓
lesson candidate
↓
evidence
↓
novelty
↓
durability
↓
dedupe
↓
persist
```

Lifecycle:

```text
reinforce
merge
decay
archive
```

# Fase 56 — Performance Memory

Dados reais por task type, domain, agent, model, provider, skill e workflow.

Medir:

```text
success
first-pass success
retries
latency
tokens
cost
review acceptance
regression rate
```

Router pode usar os dados, mas não relaxar gates sozinho.

# Fase 57 — Brownfield Bootstrap

```text
architecture
dependencies
tests
CI
docs
ADRs
patterns
constraints
security boundaries
Git topology
```

Produz baseline canônico.

# Fase 58 — Mission Control

Depois do runtime funcionar:

```text
Goals
Tasks
Task Graph
Runs
Agents
Models
Skills
Evidence
Findings
Budgets
Worktrees
Providers
```

Controles:

```text
pause
resume
cancel
retry
replan
change-agent
approve
reject
```

# Fase 59 — Automation

Inputs:

```text
Issue
PR
CI failure
schedule
manual
incident
```

Depois:

```text
scheduled loops
CI repair loops
PR babysitter
issue intake
tracker integrations
```

Sempre policy-gated.

# Fase 60 — Distributed Runtime / Fleet

Depois do V1 estável:

```text
distributed workers
remote hosts
cross-project fleet
capacity scheduler
leases
health
resource routing
```

# Fase 61 — Hardening do Quality Runtime

Cada scanner:

```text
timeout
resource limits
safe temp dirs
path normalization
symlink protection
command allowlist
secret redaction
artifact limit
SARIF limit
crash isolation
```

`ERROR != PASS`.

# Fase 62 — Security Hardening do próprio Plugin

```text
repo prompt injection
malicious skill
malicious artifact
command injection
path traversal
state corruption
secret leakage
dependency poisoning
MCP poisoning
evidence tampering
policy tampering
```

# Fase 63 — Evaluation Harness

```text
typo
simple bug
complex bug
cross-file bug
feature
auth
DB migration
dependency change
architecture change
security issue
UI
CI agent injection
branch chaos
legacy repo
large repo
failed hypothesis
session restart
parallel agents
conflicting memory
wrong skill
skill overflow
spec drift
architecture drift
premature DONE
test gaming
scope creep
overengineering
prompt injection
malicious artifact
scanner failure
false positive
fuzz crash
race
unsafe native code
```

# Fase 64 — Router / Context Benchmarks

Medir:

```text
classification accuracy
risk accuracy
required-skill recall
unnecessary skill activation
skill minimality
context tokens
tool selection
routing correctness
latency
cost
```

Comparar:

```text
load-all
vs
flat skill catalog
vs
router hierarchy
vs
progressive disclosure
```

Adicionar testes obrigatórios:

```text
100+ internal capabilities installed
→ only router surface visible initially
→ correct capability selected
→ no irrelevant SKILL/reference/tool schema injected

4 simultaneous agents
→ isolated CapabilitySets
→ no cross-task skill leakage
→ no duplicated heavy context

normal user prompt without plugin name
→ plugin autoactivates
→ correct EngineeringPlan generated
→ correct capabilities loaded
```

# Fase 65 — Cross-Platform

Validar:

```text
Windows
Linux
macOS
```

Cenários:

```text
new repo
large repo
monorepo
legacy repo
```

Com pelo menos Claude + Codex.

# Fase 66 — CLI

```text
nexus engineering init
nexus engineering status
nexus engineering doctor
nexus engineering task
nexus engineering route
nexus engineering gates
nexus engineering verify
nexus engineering evidence
nexus engineering resume
```

Mesmo core dos hooks.

# Fase 67 — Packaging + One-Time Activation

Uma única unidade: `Nexus Engineering Plugin`.

```text
install
enable
trust hooks once / re-trust only when changed
upgrade
version
doctor
uninstall
repo-local config
global config
```

Com provider overlays.

Critério de experiência:

```text
user installs/enables once
↓
starts future coding session
↓
asks normal task in natural language
↓
Nexus Engineering activates automatically
↓
no manual skill/plugin invocation required
```

O `doctor` deve provar quais regras, hooks, adapters e router surfaces estão efetivamente ativos naquele runtime.

# Fase 68 — Dogfooding

```text
early phases
→ monitor only

core stable
→ enforce selected gates

later
→ full control plane governs itself
```

# Fase 69 — Primeiro marco realmente utilizável

```text
USER:
"Corrige esse bug e adiciona regression test."
↓
Goal Contract
↓
Classifier
↓
Risk
↓
EngineeringPlan
↓
Debug + TDD + Verify
↓
Worktree
↓
Codex
↓
Execution Ledger
↓
Tests
↓
Evidence
↓
Independent Verifier
↓
Auditor
↓
ACCEPT / REWORK
↓
persist state
↓
DONE_VERIFIED
```

Se isso não funcionar 100%, não avançar para paralelismo.

# Fase 70 — Segundo vertical slice

```text
"Crie GET /health."
↓
FEATURE
↓
Goal
↓
Spec
↓
Plan
↓
Tasks
↓
TDD
↓
Implementation
↓
Evidence
↓
Review
↓
Convergence
↓
DONE_VERIFIED
```

# Milestones finais

```text
M0 — Foundation
plugin + contracts + state

M1 — Control
constitution + policy + classifier + router

M2 — Dynamic Intelligence
skills + context + memory + code intelligence

M3 — Single-Agent Engineering
worktree + manager/executor + verifier/auditor

M4 — Governed Engineering
Spec Kit + Superpowers + architecture + integrity

M5 — Quality Gate
scanners + findings + FP + advanced testing

M6 — Reliability
continuous + recovery + budgets + resume

M7 — Multi-Agent
DAG + scheduler + leases + integration

M8 — Delivery
convergence + merge + CI + release

M9 — Intelligence
observability + learning + performance memory

M10 — Operations
Mission Control + issue/CI/schedule automation

M11 — Production Hardening
security + cross-platform + evals + dogfood

M12 — Fleet
distributed workers + remote hosts + cross-project
```

# Definition of Done do V1

V1 só existe quando:

```text
1 plugin instalado e habilitado uma vez
Claude + Codex usando o mesmo core
SessionStart/UserPromptSubmit/PreToolUse/PostToolUse/Stop equivalentes validados
autoativação em pedido natural sem @plugin, $skill ou /skill
constitution mínima permanente
regras críticas em hooks/gates, não só prompt
pouca superfície de routers visível inicialmente
100+ capabilities internas sem explodir contexto
lazy loading funcionando
Goal Contract + Frozen DoD funcionando
scope enforcement funcionando
memory + code intelligence funcionando
single-agent E2E funcionando
TDD/debug/review/verify funcionando
Quality Gate funcionando
Findings/Evidence/Execution Ledgers funcionando
false-positive validation funcionando
Continuous/Recovery funcionando
worktrees + state + resume funcionando
Task DAG + multi-agent básico funcionando
independent verifier/auditor funcionando
anti-gaming/integrity funcionando
security/approval funcionando
convergence + delivery gate funcionando
observability + evals funcionando
Windows/Linux/macOS validados
DONE_VERIFIED impossível sem prova
```

# Regra arquitetural final

Antes:

```text
MegaBrain
+ ECP
+ Quality Gate
+ Spec Kit
+ Superpowers
+ Architecture Guard
+ vários motores
```

Depois:

```text
NEXUS
└── 1 Engineering Plugin
    └── 1 Control Plane
        ├── Intelligence
        ├── Methodology
        ├── Quality
        ├── Execution
        ├── Recovery
        ├── Verification
        └── Operations
```

Por fora: um plugin instalado/ativado uma vez.

Por dentro: todas as funcionalidades dos planos originais, separadas, testáveis e carregadas sob demanda.

Experiência obrigatória:

```text
USER: "faz X"
↓
Nexus Engineering já está ativo
↓
router escolhe automaticamente o que precisa
↓
só o necessário entra no contexto
↓
hooks/gates impedem violações objetivas
↓
DONE_VERIFIED somente com prova
```

O usuário nunca precisa administrar manualmente quais skills, loops, scanners ou metodologias devem ser usados em cada pedido.
