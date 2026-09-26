# Local Hindsight DEV — zero additional monthly cost

This is the active NB-03 runtime. It uses existing Windows hardware, Hindsight's full API package, embedded pg0 PostgreSQL/pgvector, local embeddings and local reranking. It has no cloud provisioning, paid database, hosted worker, cloud billing link, or paid provider fallback. The API and its internal worker run only while the local process is running.

## Hardware and requirements

Hindsight's current installation guide lists 1.5 GiB minimum/2 GiB recommended RAM for the full API, 512 MiB minimum/1 GiB+ for PostgreSQL, and 2 vCPU as fine for development/basic CPU-only workloads. The current Nexus host reports 8 GiB RAM and an Intel i5-8250U with 4 cores/8 logical processors. This is enough for a small local DEV workload; stop or reduce competing applications if memory pressure appears. The full package downloads local ML models on first run and needs several GB of local disk space.

## Install and run

```powershell
./infra/local/hindsight/install.ps1
./infra/local/hindsight/run.ps1 -AllowNonSensitiveGeminiData
```

Create the Gemini API key in AI Studio only for a project that shows the Free plan and has no billing account linked. Google AI Pro does not pay Gemini Developer API charges. Do not attach billing or select Paid tier. The optional USD 10/month Google Developer Program credit is not counted as authorization or budget. Never pass passwords, tokens, private customer data, confidential memories, or restricted source content to this Free Tier; Google currently documents that Free Tier content may be used to improve its products.

Gemini quotas vary by model, project and account. Check the active RPM (requests/minute), TPM (input tokens/minute) and RPD (requests/day) in AI Studio before provider tests; RPD resets at midnight Pacific. Hindsight allows one retry after transient provider errors such as HTTP 503, with a 2-second initial and 5-second maximum backoff. A daily-quota HTTP 429 trips a local persistent circuit breaker at `%LOCALAPPDATA%\Nexus\Hindsight\gemini-rpd-circuit.json`; later calls fail locally until the next midnight Pacific and do not contact Gemini. The marker stores no key or prompt. Quota exhaustion is an error: there is no automatic provider/model or paid fallback. Standard Gemini text generation is the only remote model function; embeddings/reranking stay local and Search/Maps grounding, Batch, Vertex AI and paid features are not configured.

The breaker loads at process startup through `sitecustomize.py`. Restart Hindsight after changing `start.ps1`; startup performs a Gemini provider verification request. Do not restart during an exhausted daily quota window.

## Persistent data, backups and migration

This setup assigns the pg0 instance name `nexus-dev`, so its data directory is `%USERPROFILE%\.pg0\instances\nexus-dev\data\`; pg0 installation files live separately under `%USERPROFILE%\.pg0\installation\`. These directories are outside Git. Keep them on a disk with enough free space and include them in an encrypted, separate-device backup routine. A backup is not proven until a restore into a separate local pg0 instance succeeds.

Use `backup.ps1` to create a PostgreSQL custom-format export while the API is running, write it to a unique create-only file outside the repository, and record its SHA-256. Use `restore-test.ps1 -BackupPath <file>` to verify the checksum and restore into a separate, uniquely named local pg0 instance. The installed package includes pg0-embedded 0.15.2; the backup scripts resolve its matching PostgreSQL utilities from pg0's installation directory. Keep backup payloads out of Git and redact memory content from logs.

Future external PostgreSQL migration preserves the PostgreSQL schema: stop writes, take and verify a final `pg_dump`, create the same PostgreSQL major version as pg0 (18.1) or newer with pgvector, restore the full dump, point Hindsight's `HINDSIGHT_API_DATABASE_URL` at it, then verify schema/table counts, bank IDs, scoped recall and provenance invariants. A move to an older PostgreSQL major version requires a clone-based compatibility test and explicit schema/index review before cutover. Keep pg0 unchanged as the rollback source until the external restore and application checks pass. If the embedding model or vector dimensions change, perform a separately planned re-embedding; this is not needed merely to move between pg0 and PostgreSQL.

## Safety

- Bind only to `127.0.0.1`; do not expose Hindsight's API/MCP to a LAN or Internet.
- Keep the API key in process environment or an OS secret store; never commit it or put it in a tracked `.env` file.
- A Free Tier API key does not create a hard spend cap if its project later becomes billing-linked. Keep this project's billing disabled and check its AI Studio plan before use.
- IaC in `infra/cloud/tofu/` is historical reference only. Never apply it under the current zero-cost decision.
