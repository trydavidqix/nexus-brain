# Brain — current code

Canonical owners: `packages/brain` for context compilation, knowledge helpers, and the NB-04 canonical memory engine; `packages/context-gateway` for the existing local task/context gateway and provider/MCP discovery.

The NB-04 runtime is exposed through `@nexus-brain/brain/local-memory`. It composes `MemoryEngine`, `PostgresMemoryStore` on the Hindsight pg0 PostgreSQL instance, and a loopback-only `HindsightAdapter`. PostgreSQL owns canonical versioned records, ACL, scope, provenance, research runs, raw evidence and sightings. Hindsight supplies derived retrieval/indexing only. Read authorization must be injected explicitly; canonical promotion is denied unless a validation authorizer approves it. `reflect` returns an unpersisted candidate.

The local provider lane uses the existing Codex OAuth profile and Codex CLI model configuration. It does not use an API key or cloud resource. Hindsight indexing accepts only explicitly classified `SYNTHETIC` or `NON_SENSITIVE` content. Raw research evidence remains `UNTRUSTED` and is stored outside Hindsight.

The Token Firewall capability is preserved: bounded read batches, redaction, context compilation and existing telemetry/evaluation behavior remain available through the Edge and their canonical packages. Provider token savings are not claimed without paired observed measurements.

The legacy MCG JSONL state defaults to `.nexus-state`, stays outside Git, and remains available for dashboard compatibility. It is not the store for NB-04 versioned Brain memory. `MCG_ROOT` is supported only as a legacy override. A public Brain API remains NB-05 work; cloud-backed memory and indexing are not provisioned.
