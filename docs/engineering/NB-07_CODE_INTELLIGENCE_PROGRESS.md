# NB-07 Code Intelligence progress

**Status:** IN PROGRESS. Implementation is on `codex/nb07-code-intelligence`; do not mark accepted until the pinned CBM Windows integration fixture and required GitHub Actions checks pass.
**Dependencies:** NB-01, NB-06 and NB-06A are present on `main`.
**Scope:** provider-neutral `CodeIntelligenceEngine`, initial pinned CBM 0.11.0 adapter, Project v2 workspace binding isolation, advisory graph evidence, bounded direct-source/Git fallback, explicit cross-repository target selection, and Windows CI fixture.
**Validation policy:** tests, typecheck, integration and security validation run only in GitHub Actions. No local tests, typecheck, package installation or CBM execution are authorized on this PC.

## Decisions implemented

- Project identity is obtained only through `StateStore.getProject(project_id)`. The caller must provide an exact registered Project v2 workspace binding, and an injected platform resolver supplies the local workspace path. Missing, ambiguous, unresolved and Project v1 workspaces fail closed.
- Backend aliases are scoped to both project ID and exact opaque workspace binding. The binding path is never normalized or returned. Queries always carry the alias; the adapter does not enumerate backend projects.
- CBM is an advisory, replaceable backend. Coverage remains unknown/incomplete unless proven. Backend index commit stays unknown unless returned by CBM; local Git HEAD is reported separately.
- Cross-repository indexing requires an explicit allowlist of at most three registered targets. Target relationships are read through a bounded query, associated only with an allowed target, and omitted when attribution, generation, or stable workspace HEAD cannot be established. Target paths are redacted.
- The adapter invokes only the pinned one-shot CLI with argument arrays, no shell, bounded time/output and exact version verification. The Windows GitHub Actions job downloads the pinned release and checks its SHA-256 before the runtime fixture.

## Acceptance evidence required

1. GitHub Actions unit tests, typecheck and repository-required checks pass on the final PR head.
2. Windows GitHub Actions runtime fixture proves the mappings against CBM 0.11.0, including Project v2 isolation, cross-repository target attribution, generation/provenance handling, path redaction and fail-closed behavior.
3. Independent static review reports no blocker; any remediation is followed by fresh GitHub Actions checks.
4. Final evidence, commit and merge are recorded here and in the canonical Blueprint before NB-07 is marked DONE.

## Current evidence

- The package and Windows workflow are present in the working tree; the CI job is configured to download and checksum-verify the pinned CBM archive, then run the isolated Windows fixture.
- No test, typecheck, install, adapter execution or runtime check has run locally on this PC. The first PR run confirmed Linux unit tests and OpenTofu checks pass, but the Windows fixture setup attempted to build unrelated `better-sqlite3` native code and failed because the hosted runner has no Visual Studio C++ workload. Commit `d4104f9` changed the Windows job to install only the Code Intelligence dependency closure with lifecycle scripts disabled.
- The next Windows run first exposed and corrected a test-path mismatch: `engine.index()` results are wrapped under `data.code_graph`. The corrected fixture then exposed a real adapter gap: CBM 0.11.0's default `get_architecture` summary omits routes unless `aspects` explicitly requests them. The adapter now requests only `aspects: ['routes']`, and its fake test asserts that parameter; the focused Windows runtime proof is pending.
- The same-head MCG runs disagreed on the existing daemon integration test: one failed cleanup with `ENOTEMPTY` on its temporary state directory (25/26 tests passed), while another run passed all 26 tests; the base `main` run passed as well. This is unrelated to the NB-07 code path, and the transient cleanup failure is recorded without changing daemon code.
- The first PR run also rejected the title naming format; PR #123 was renamed to `code-intelligence: add project-scoped CBM engine` before the rerun.
- Independent static review passed. The code suppresses links if target HEAD changes during indexing or if CBM reports a stale backend index commit; focused fake tests cover both cases. Fresh GitHub Actions evidence remains pending.
