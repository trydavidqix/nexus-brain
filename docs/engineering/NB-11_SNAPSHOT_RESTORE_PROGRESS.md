# NB-11 — Local Uncommitted Snapshot and Restore

**Status:** Ready for final GitHub Actions and PR integration; independent review approved.

## Scope and recovery boundary

NB-11 stores caller-provided uncommitted workspace files as encrypted, create-only local snapshots. Snapshots remain non-authoritative and outside Git. The store requires separate `workspaceRoot` and `storageRoot`; it rejects storage paths that overlap the workspace. Configure `storageRoot` under a user-owned local-data directory such as `%LOCALAPPDATA%\Nexus\Edge\Snapshots`.

Owner decision: use Windows DPAPI `CurrentUser` for the persistent key, limited to the same Windows user profile and machine. The 32-byte snapshot key is generated locally and wrapped with Windows DPAPI `CurrentUser`. Snapshot payloads use AES-256-GCM with the snapshot ID bound as authenticated data. Key bytes and plaintext payloads are not written to disk or emitted in diagnostics. This recovery lane works across process restarts for the same Windows user profile. It does not claim portability to another user or device. Cloud storage and paid resources remain out of scope.

Every payload carries `project_id`, `task_id`, and `agent_id`. Restore and queue operations require an exact identity match. Paths must be relative and traversal-free. Restore creates a new, non-existing destination inside the configured workspace, verifies each SHA-256 after writing, and never invokes Git or commits changes.

Each snapshot accepts at most 1,000 files and 10 MiB of file contents. The pending queue is capped at 100 snapshots per identity. Queue delivery receives only the encrypted snapshot bytes and stable snapshot ID; failed delivery leaves the snapshot pending. Delivery is at-least-once across process interruption between callback success and local acknowledgement, so callers must treat `snapshot_id` as an idempotency key. The caller supplies the delivery callback; no cloud endpoint or billing path is configured here.

The implementation serializes create-capacity checks and flush delivery with a Windows named mutex scoped to the canonical storage root, identity, and operation. A short-lived Windows PowerShell/.NET helper owns the mutex while the Node operation runs; Windows releases ownership if the helper process exits. Calls within one Node process also use a local mutex to avoid redundant helper processes. The named mutex uses the current Windows logon session (`Local\` namespace), so it coordinates Edge/Node processes in that session; it does not coordinate another Windows session. Storage child directories are canonicalized and checked as real directories under the storage root before use; restore checks workspace containment and rejects symlink/junction parents, including newly created parents. Node's path-based `lstat`/`realpath`/`open` APIs cannot atomically pin every directory against a hostile local process that can concurrently replace entries. The supported boundary therefore assumes the current user's local workspace and storage are not being actively mutated by another untrusted process during snapshot or restore operations; this is not an OS-level defense against a same-user filesystem race.

## Validation evidence

- A synthetic DPAPI `CurrentUser` protect/unprotect roundtrip passed in Windows PowerShell 5.1 without system changes.
- Focused snapshot suite: 13/13 passed after review remediation. It exercises ciphertext-only persistence, restore from a separate Node process under the same Windows user, project/task/agent scope rejection, path traversal and destination checks, Windows reserved device names and trailing dot/space rejection, tamper detection, retryable offline delivery, storage-root exclusion, create-only collision behavior, child junction rejection, queue-cap admission across independent Node processes at the real limit of 100, serialized cross-process flushes, and mutex recovery after a holder process exits.
- Edge package unit suite: 10 files, 59 tests passed after the final Windows path validation hardening.
- Edge package TypeScript check passed. Syntax/import smoke parsed 172 modules. Sensitive-data scan passed across 364 files. `git diff --check` passed.
- `pnpm install --frozen-lockfile` could not build unrelated `better-sqlite3` because Visual Studio C++ build tools are absent. `pnpm install --frozen-lockfile --ignore-scripts` linked existing locked dependencies without downloads; Edge tests/typecheck do not require that native addon.

Cross-process queue admission and flush serialization apply within the same Windows logon session. Delivery is at-least-once if the process exits after callback success but before local acknowledgement; the callback must treat `snapshot_id` as an idempotency key. The implementation does not claim cross-session locking or elimination of hostile same-user filesystem TOCTOU races.

## Acceptance still pending

- Final-head GitHub Actions, Blueprint status reconciliation, PR creation, and merge remain; root owns those gates. Independent review approved with no blocker.
