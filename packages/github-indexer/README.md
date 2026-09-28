# GitHub project indexer

NB-06 local-first primitives for verified GitHub push ingestion and scheduled repository reconciliation. The package does not create GitHub webhooks, cloud resources, billing, or public listeners.

## Components

- `createGitHubIndexer` verifies the raw-body HMAC SHA-256 signature, requires a configured project/repository binding, deduplicates GitHub delivery IDs through a durable store, and records branch/commit provenance.
- Branch deletion push events create durable tombstones; scheduled reconciliation also tombstones branches absent from a complete inventory, while preserving concurrent or newer webhook observations.
- `createGitHubWebhookServer` provides `POST /webhooks/github`, caps payloads at 1 MiB, sanitizes errors, and binds only to loopback (`127.0.0.1` or `::1`).
- `createGitHubRestClient` performs read-only GitHub REST `GET`s, validates responses, limits pagination, and retries only bounded transient failures.
- `createReconciliationScheduler` runs reconciliation on a fixed interval without overlapping executions.
- `PostgresGitHubIndexStore` persists delivery receipts, observations, current heads, commit provenance, and branch/commit relationships in the local PostgreSQL/pg0 database. Migration `0004_github_indexer` is additive.

## Runtime wiring

The host application supplies stable project IDs and repository bindings, loads the webhook secret and optional GitHub token from its secret boundary, creates the PostgreSQL pool, runs `store.migrate()`, and injects the dependencies. Secret values must never be placed in repository files, logs, or command-line arguments. A missing webhook secret causes signature verification to fail closed. The token is optional for public repositories; private repositories need a read-only token supplied by the host.

The endpoint intentionally listens on loopback only. A future ingress or webhook registration requires a separately approved reachable endpoint and authentication configuration. Until that exists, the local scheduler can reconcile read-only GitHub data without a public listener.

## Limits and retry behavior

- Webhook bodies: at most 1 MiB.
- Commit entries from push events: at most 300 per delivery, retaining the event's head commit.
- REST pagination: defaults to 10 pages of 100 items and fails without persisting incomplete branch snapshots if the configured page bound is reached.
- REST retry: at most 2 retries by default; only GET network failures, HTTP 408/429/5xx, and explicit exhausted GitHub rate-limit responses are retryable. `Retry-After` is capped at 10 seconds. Authorization and other permanent 4xx responses are not retried.
- Reconciliation obtains each branch's current head. First sync stores the head commit; later syncs collect commits back to the durable prior head. The walk fails closed at the configured page limit instead of persisting a partial history. Database keys deduplicate commits/relationships, and stale webhook events cannot replace a different current head unless their `before` SHA matches. Scheduled reconciliation is authoritative for current heads.

## Validation

Run `pnpm --dir packages/github-indexer test:unit`. Tests use synthetic payloads and injected clients; they do not call GitHub or require secrets. A separate live read-only API check and local PostgreSQL migration/round-trip check are required before NB-06 can be accepted.
