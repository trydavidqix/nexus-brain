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

## Current checkpoint — 2026-09-28

- PR #123 is open from `codex/nb07-code-intelligence` with latest implementation commit `a9ff5b802866142f5ac901b2817793af72aaef81`; the working tree was clean before this documentation synchronization.
- At implementation commit `a9ff5b802866142f5ac901b2817793af72aaef81`, Windows CBM runtime checks failed on runs `36456609716` and `36456604691`; a separate CodeQL run failed (`109044845613`). MCG, OpenTofu, dependency review, Gitleaks, Jazzer.js, Semgrep and ZAP/OSV reporting checks passed in the observed runs. PR #123 was merge-blocked; see [PR #123 checks](https://github.com/trydavidqix/nexus-brain/pull/123). The current documentation sync does not change implementation code.
- CI confirmed source and target index generations, but `query_graph` exited nonzero. The exact error is not established from safely retained evidence.
- The test helper at that implementation commit still returns structured error text after heuristic redactions. Independent review identified this as a blocker because the redactions cannot guarantee that paths or secrets are removed. Keep raw CI diagnostics out of project notes; replace the output with an allowlisted category plus safe metadata before another run.
- NB-07 remains IN PROGRESS and is not eligible for merge or DONE. Implementation execution is paused; this update records documentation state only.
## Current evidence

- The package and Windows workflow are present in the working tree; the CI job is configured to download and checksum-verify the pinned CBM archive, then run the isolated Windows fixture.
- No test, typecheck, install, adapter execution or runtime check has run locally on this PC. The first PR run confirmed Linux unit tests and OpenTofu checks pass, but the Windows fixture setup attempted to build unrelated `better-sqlite3` native code and failed because the hosted runner has no Visual Studio C++ workload. Commit `d4104f9` changed the Windows job to install only the Code Intelligence dependency closure with lifecycle scripts disabled.
- The Windows runtime fixture found two adapter/test issues in sequence: its architecture assertion now follows the `data.code_graph` wrapper, and the engine explicitly requests only `aspects: ['routes']` because CBM 0.11.0's default summary omits routes. The fixture now declares and invokes `helperTest()` in its synthetic test file, so `trace_path(include_tests: true)` has a test-function call edge to traverse. The next Windows Actions run must prove the complete mapping; runtime evidence is pending.
- A later Windows run showed that `trace_path(include_tests: true)` does not guarantee a `helper.test.ts` path in its response: CBM v0.11.0 returns qualified-name/hop entries with an optional `test` boolean, and `include_tests` controls visibility/classification rather than adding file paths or call edges. The fixture now requires one CBM caller row to identify `helperTest` and carry `test: true`; a separate direct-source assertion checks `tests/helper.test.ts` only as `unclassified-text-match`, without claiming a semantic relation. A subsequent CI failure exposed that the `callers` response is one trace-leg object, not a collection; the fixture now traverses that object directly. Fresh Windows Actions evidence is pending.
- The same-head MCG runs disagreed on the existing daemon integration test: one failed cleanup with `ENOTEMPTY` on its temporary state directory (25/26 tests passed), while another run passed all 26 tests; the base `main` run passed as well. This is unrelated to the NB-07 code path, and the transient cleanup failure is recorded without changing daemon code.
- The Windows runtime fixture exposed that CBM v0.11.0 `index_status` does not include `metadata.generation`; its handler returns `indexed_at` and coverage summaries. The generation is exposed by the separate read-only `check_index_coverage` tool. Source and target validation now read the root generation with `scopes: ['.']`; target post-link validation also retains `index_status` for commit provenance. The unit fake matches that API, and a negative test verifies unknown generation still withholds links. Fresh CI confirmed non-empty source and target generations. The real cross-repository query subprocess then returned a nonzero exit; the Windows fixture reports a structured error after heuristic redaction (not proven safe) and, on successful query responses, only query row keys, relation labels and allowlist-match booleans. The later observed run results are recorded in the Current checkpoint above.
- The first PR run also rejected the title naming format; PR #123 was renamed to `code-intelligence: add project-scoped CBM engine` before the rerun.
- An earlier independent static review found no blocker in the stale-target suppression path; focused fake tests cover target HEAD changes and stale backend index commits. The latest independent review found the unsafe test-diagnostic issue described above. The required Windows CI check is currently failing.
