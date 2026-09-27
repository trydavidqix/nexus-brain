# ADR 0002: autoridade da memória persistente do Brain

- Status: Aceita para o corte local do NB-04
- Data: 2026-09-27

## Contexto

O MCG mantém uma API de compatibilidade de memória persistente em JSONL sob o root configurado. O Operating Core também oferece contratos de memória, mas não era um store persistente. NB-04 implementa a autoridade local necessária para registros versionados do Nexus Brain.

## Decisão

- `PostgresMemoryStore` sobre PostgreSQL local do pg0 é a autoridade para registros canônicos versionados, eventos de memória, research runs, evidências e sightings do Nexus Brain DEV.
- `MemoryEngine` é dono do ciclo de vida, escopo, ACL, proveniência, aprovação de promoção e retorno de memória canônica. Hindsight V1 permanece um índice e mecanismo de recuperação substituível; suas respostas não viram autoridade.
- O adaptador Hindsight aceita somente conteúdo `SYNTHETIC` ou `NON_SENSITIVE`, limita o endpoint a loopback e não promove resultados de `reflect`; cada reflexão retorna `CANDIDATE` não persistido.
- Promoções para `VERIFIED` ou `CANONICAL` exigem autorização explícita. O comportamento padrão é negar.
- `packages/brain/src/memory.mjs` continua disponível como compatibilidade da memória JSONL do MCG. Busca no código não encontrou chamadas de runtime aos seus helpers de escrita/recuperação. O dashboard permanece seu leitor compatível.
- Em 2026-09-27, `NEXUS_BRAIN_STATE` e `MCG_ROOT` estavam unset e `.nexus-state/state/memory` não existia no root padrão. Portanto, nenhuma linha JSONL de memória precisava ser importada. Artefatos de avaliação não foram migrados.

## Consequências

- Há uma autoridade persistente para o modelo versionado do Nexus Brain. A API JSONL permanece como superfície histórica do MCG e não recebe novas gravações do `MemoryEngine`.
- Escopos `PROJECT`, `SESSION` e `TASK` exigem vínculo ao projeto. Escopo `TASK` vincula task e agent na indexação, recuperação e store canônico. Escopo global é consultado separadamente e somente com opt-in.
- Evidência bruta permanece `UNTRUSTED` e fora do índice Hindsight até passar por política de validação independente.
- Eventos e proveniência são append-only, incluindo bloqueio de `UPDATE`, `DELETE` e `TRUNCATE`.
- O pacote local de integração não expõe API pública de Brain; isso pertence ao NB-05.
- Uma migração JSONL só será executada se inventário futuro encontrar dados de memória. Backup, importação, verificação de escopo e recuperação devem passar antes de retirar a compatibilidade.
