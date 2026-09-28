# Nexus — Plano de Implantação Atualizado

**Autoridade:** este documento descreve fases de capacidade e não mantém estado de milestones. Dependências, escopo, Definition of Done e status pertencem exclusivamente ao [Master Implementation Blueprint](../blueprints/NEXUS_BRAIN_MASTER_IMPLEMENTATION_BLUEPRINT.md). As fases abaixo não substituem nem reordenam os work packages NB.

Este plano foi consolidado de uma branch de documentação. A direção nele registrada complementa o Blueprint; o Blueprint prevalece em qualquer conflito.

## Gate de entrada

A implantação funcional começa somente depois de:

```text
NB-03
↓
NB-04
↓
NB-19 / CI
↓
NB-29
↓
MIGRATION READINESS = 100%
```

Antes disso, o trabalho continua sendo migração, consolidação, validação e preparação da base.

---

## Fase 1 — Project Factory

Transformar o Autonomous Project Factory em módulo nativo do Nexus.

```text
OBJETIVO DO USER
↓
ProjectFactoryRequest
↓
Discovery
↓
Resource / Capability Discovery
↓
REUSE | USE_PROVIDER | ADAPT | BUILD
↓
Architecture Plan
↓
Task DAG
↓
Agents necessários
↓
Engineering Control
↓
Execução
↓
Review + Verify
↓
Projeto concluído
```

Regras:

- pesquisar antes de construir;
- reutilizar código/ferramenta existente quando fizer sentido;
- não instalar dependência automaticamente sem necessidade;
- gerar tasks pequenas e verificáveis;
- usar Maestri como orquestrador, sem criar outro control plane.

---

## Fase 2 — Capability Discovery

Absorver os melhores conceitos de Capability OS, Tool Hub, Tool Gateway e MCP/CLI/API stack dentro dos owners existentes.

```text
TASK
↓
Capabilities necessárias
↓
Capability Registry
↓
Provider Registry
↓
Tool Registry
↓
Health / Quota / Policy
↓
menor conjunto necessário
```

Nunca carregar todas as skills, MCPs ou tools.

Cada agente recebe apenas:

```text
task_id
agent_id
contexto necessário
skills necessárias
tools necessárias
permissões mínimas
```

Não criar Capability OS, Tool Hub ou Tool Gateway como produtos paralelos.

---

## Fase 3 — Maestri Reflex

Incorporar o Fast Decision Engine dentro da única autoridade de decisão:

```text
maestri.decide()
```

Fluxo:

```text
REQUEST
↓
Hard Rules
↓
Policy
↓
Estado atual
↓
Decisão determinística
↓
classificador/local semantic se necessário
↓
confidence calibrada
↓
EXECUTE
ou
ABSTAIN
ou
DEEP MODEL
```

Princípio:

```text
Código calcula.
Estado contextualiza.
Classifier sugere.
Policy autoriza.
Modelo grande raciocina só quando necessário.
```

Confidence nunca substitui Risk ou Approval.

---

## Fase 4 — Memory / Hindsight

Finalizar a hierarquia canônica:

```text
GLOBAL
↓
PROJECT
↓
SESSION
↓
TASK
```

Garantir:

- provenance;
- temporal facts;
- supersession;
- conflict;
- checkpoints;
- dedupe;
- retrieval por escopo;
- memória candidata antes de promoção.

Regra:

```text
Hindsight = engine
Nexus = autoridade
```

---

## Fase 5 — Engineering Control Plane

Aplicar automaticamente em toda task de engenharia:

```text
TASK
↓
Engineering Router
↓
Risk + Scope
↓
Skill Resolver
↓
Skill Loader
↓
Agent
↓
Tests
↓
Independent Review
↓
VERIFY
↓
Delivery Gate
```

Módulos permanentes:

```text
LEAN
DEBUG
TDD
SCOPE
CONTRACT
REVIEW
BRANCH ENGINEERING
ANTI-SLOP
VERIFY
```

O usuário não precisa pedir manualmente o uso dessas regras.

---

## Fase 6 — Git & Agent Governance

Modelo de ownership:

```text
1 task
↕
1 owner agent
↕
1 branch
↕
1 worktree
```

Antes de qualquer cleanup:

```text
inventory
→ graph
→ diff
→ tests
→ unique work check
→ preservation proof
→ cleanup
```

Nunca apagar trabalho desconhecido ou não preservado.

---

## Fase 7 — Workforce Runtime

Consolidar scheduling técnico por classe de recurso:

```text
TINY
LIGHT
NORMAL
HEAVY
EXCLUSIVE
```

Considerar:

- prioridade;
- quota;
- host disponível;
- health;
- concorrência;
- preempção;
- handoff;
- resume;
- fallback.

Não importar turnos empresariais da Lumenva para o Nexus.

---

## Fase 8 — BrowserMesh

Absorver os conceitos úteis do Agent Browser no BrowserMesh existente.

```text
Browser Task
↓
Host Router
↓
Session
↓
Profile isolado
↓
Policy
↓
Playwright / Retrieval / Semantic fallback
↓
Evidence
```

Prioridade de execução:

```text
API
→ MCP
→ CLI
→ HTTP retrieval
→ browser determinístico
→ semantic/visual fallback
```

---

## Fase 9 — Learning + Reputation

Depois de haver execução real suficiente:

```text
Execution
↓
Evidence
↓
Outcome
↓
Review
↓
Metrics
↓
Learning Dataset
```

Medir por capability/model/provider:

- success rate;
- reviewer acceptance;
- latency;
- retries;
- custo;
- quota;
- regressões.

Nenhum agente pode aumentar sozinho suas permissões.

---

## Fase 10 — Project Factory completo

Estado-alvo:

```text
User: "Cria X"
↓
Nexus entende requisitos
↓
procura implementações existentes
↓
decide reuse/adapt/build
↓
monta arquitetura
↓
cria DAG
↓
escolhe agents
↓
cria branches/worktrees
↓
implementa
↓
testa
↓
review independente
↓
corrige
↓
integra
↓
entrega evidência
```

Arquitetura final de execução:

```text
User
→ Project Factory
→ Maestri
→ Engineering Control
→ Capability Discovery
→ Memory
→ Workforce
→ BrowserMesh / Tools
→ Agents
→ Review
→ Verify
→ Delivery
```

## Regra arquitetural final

Capability OS, Tool Hub, Tool Gateway e Fast Decision Engine não viram produtos paralelos.

Seus conceitos válidos são absorvidos pelos owners já existentes do Nexus:

- Maestri;
- Reach;
- Capability Registry;
- Provider Registry;
- Tool Registry;
- Engineering Control;
- Execution;
- Governance;
- Evidence;
- Memory;
- BrowserMesh;
- Project Factory.
