# NB-29 Cutover Revalidation — 2026-09-28

**Status:** `DONE` (Owner disposition, 2026-09-28). The 10 actually found files in the scoped legacy and Nexus state roots are inventoried and hashed below. The reported historical count of 417 remains unverified because no trusted expected manifest exists; that count is not an NB-29 precondition and this report does not claim those files were recovered or absent.

Machine-readable observed-state manifest: [`NB-29 observed-state manifest`](NB-29_OBSERVED_STATE_MANIFEST_2026-09-28.json). It records only the 10 files currently found in the two bounded roots, with relative path, size, last-write timestamp, and SHA-256. Manifest file SHA-256: `de7cca69475553488117cc87a6b5b824502b27b10b933fd25d9d7393459fa2a6`. It makes no claim about the unverified historical 417-file set.

## Verified state

- Canonical checkout: `%USERPROFILE%\Desktop\Projetos\nexus-brain`; remote `https://github.com/trydavidqix/nexus-brain.git`.
- Local `main` and `origin/main` are synchronized and clean at `9bfcdc0cb56607efc8933c975945f4e73ee1bd27`.
- Required checks passed for migration PRs #43, #49, #73–#75, #79–#80, and #82–#83. The active `Nexus protected main` ruleset has no bypass actors, requires strict status checks, squash-only merges, linear history, and blocks force-push and branch deletion.
- NB-03 Hindsight was healthy at `127.0.0.1:8888`; one synthetic reflect returned HTTP 200. The Hindsight LLM-request registry recorded `openai-codex`, `gpt-6-luna`, `success`, `reflect_tool_call`. No Gemini key was read; response text was not printed or persisted. See [NB-03 live revalidation](NB-03_CODEX_OAUTH_REVALIDATION_2026-09-27.md).
- NB-04 live integration, ACL/scope, append-only, backup/restore, and PostgreSQL compatibility evidence remains in [NB-04 preparation](NB-04_PREPARATION.md); workspace integration tests passed 26/26.
- The project Codex MCP probe returned `HEALTHY` for `nexus_local_runtime`, exposing only `mcg_read_batch` over stdio. The probe issued discovery/list requests only; it called no MCP tool.
- Global `mcg.cmd`, `mcg.ps1`, and `stop-mcg-daemon.cmd` were repointed from the obsolete `.lumenva\nexus-brain` target to the canonical Desktop checkout. Both `mcg.cmd doctor` and `mcg.ps1 doctor` returned the Nexus product and canonical state root. No Node process used the obsolete target. `doctor` reports optional Maestri Wire config missing; Nexus standalone operation does not require Wire.
- `.nexus-state` is ignored by Git. Its two current eval artifacts match the two files in `%USERPROFILE%\Desktop\Projetos\maestri-context-gateway\.mcg-state` by relative path, byte length, and SHA-256. Source files were not changed and their content was not printed:
  - `pair-smoke-context-recall-1-1790376343486-7da5f2dd-baseline.jsonl` — 4,591 bytes, SHA-256 `e8eb5b6ca96911bf613e6361f06403d37fdec74717dbd478799ae60be55473aa`.
  - `pair-smoke-context-recall-1-1790376343486-7da5f2dd-baseline.stderr.txt` — 13,980 bytes, SHA-256 `9da3de1409214ef33d0f2d02b1190f087a5c6bbfde59da6596bcf7491f578b47`.
- Local validation passed after a frozen-lockfile install: workspace unit tests, typechecks, integration tests, 47 engineering-gate tests, 11 Git naming tests, 13-package architecture check, 151-module syntax check, and sensitive-data scan (404 files). A Windows LF/CRLF test portability correction merged in PR #83.
- Git `core.hooksPath` is unset and `.git/hooks` contains only Git's sample hooks. The repository has no active local Git hook registration; GitHub's protected-main ruleset is the authoritative delivery gate.

## Preservation gates

1. **Closed on observed scope:** the authorized legacy `.mcg-state` root contains 2 files and the Nexus `.nexus-state` root contains 8. Their current metadata and SHA-256 values are inventoried below; the two eval artifacts match across roots. No other files were found within these roots.
2. **Reconciled:** the preserved Nexus worktree `codex/mcg-finalization` is located at `%USERPROFILE%\.lumenva\worktrees\mcg-finalization`. It was inspected read-only after the Owner explicitly authorized that exact Nexus worktree. Its dirty content is inventoried below; it remains untouched under the no-clean/no-delete guard. No unique executable behavior or test invariant absent from canonical `main` was identified.

The preserved Nexus worktree gate was reconciled in the supplemental audit below. The Owner has determined that the unverifiable historical count of 417 is not a precondition. NB-29 is closed against the real, bounded inventory; no claim is made about files outside those scoped roots.

## Worktrees and open changes

- Nexus `main`, NB-04, and NB-05 worktrees remain present. The main worktree is clean; NB-04 and NB-05 worktrees are clean and synchronized with their branch remotes.
- PR #81 remains an open draft for future NB-05 work. PRs #50 and #78 remain open outside the migration closeout. They were not changed by this audit. PR #72 was not queried or modified.
- No worktree was deleted, reset, cleaned, or force-pushed. No billing, Google project, cloud resource, or Gemini setting changed.

## Supplemental Git metadata check

- The Nexus Git metadata records `codex/mcg-finalization` at commit `5d78258893cf25ce4c6038999a82e1e2be97e8a7`; that commit is an ancestor of `origin/main`.
- `origin` has no branch ref named `codex/mcg-finalization`. Thus the branch's committed history is present in `main`; this does not account for staged, unstaged, or untracked worktree changes.
- The protected worktree's index/files and historical inventory were subsequently audited read-only under Owner authorization; see the supplemental audit below. The worktree was not changed.

## Supplemental revalidation — 2026-09-28

- Revalidation started from clean `main` at `0b9369dacdd581f83d420ac7930f4df6a3450af1`, synchronized with `origin/main`; this head includes merged PR #90, which records a fresh NB-03 `/health` 200 and synthetic reflect 200 with a successful `openai-codex` / `gpt-6-luna` trace. No Gemini key, Google project/billing change, or cloud provisioning occurred.
- The NB-03 Owner decision is present in the Master Blueprint: Codex OAuth satisfies its provider gate; Gemini Free Tier is optional. NB-03 and NB-04 remain `DONE`; NB-19 G0–G10 remains complete. At this earlier point NB-05 was gated by NB-29; the gate is now closed under the 2026-09-28 Owner disposition.
- Current checkout validation passed: workspace unit tests (13 of 14 projects), workspace typecheck (13 of 14 projects), integration tests (26/26), engineering-gate tests (47/47), Git naming tests in CI, architecture (13 packages), syntax/import smoke (151 modules), and sensitive-data scan (404 files).
- Read-only project MCP `mcg_read_batch` successfully read the workspace `package.json` with capability `fs.read`, risk `R0`, deterministic execution. `mcg.cmd doctor` and `mcg.ps1 doctor` both identified the canonical Nexus root, Node 24.19.0 and healthy storage; optional Wire configuration remains absent. `core.hooksPath` is unset and `.git/hooks` contains only sample hooks.
- Nexus NB-04 and NB-05 worktrees are clean and synchronized with their origin branches. The report-only Git hygiene scan made zero mutations, excluded two worktrees and reported one unmerged, one orphaned-metadata and one stale-review-required worktree classification; `safe_retirement_proof` remains unavailable. No excluded worktree was opened.
- PR #81 (gated future NB-05), #50 and #78 currently have passing checks and remain unchanged. Dependabot PRs #61 and #62 have MCG failures specifically at `Enforce Git naming contract` due to their bot branch names; they are outside the migration closeout and remain unchanged.
- PR [#90](https://github.com/trydavidqix/nexus-brain/pull/90) is merged. At the time of this earlier revalidation, both preservation gates remained open. Later audits reconciled the worktree and inventoried actual state files; the historical 417 count remains unverified and is non-gating under the later Owner decision.

## Supplemental preservation audit — 2026-09-28

### Historical state inventory

- PowerShell `Get-FileHash -Algorithm SHA256` and Everything (`es.exe`) agreed on counts for the authorized source/destination roots. No enumeration or hash errors occurred.
- Source `%USERPROFILE%\Desktop\Projetos\maestri-context-gateway\.mcg-state`: 2 files, 18,571 bytes. Its nested `state` directory contains the same 2 files, not additional files. Source manifest SHA-256: `7f20d6b318103ee5b4a6f10ba909f26c59dddc5bd8896c8d18c0c11054ea453b`.
- Destination `%USERPROFILE%\Desktop\Projetos\nexus-brain\.nexus-state`: 8 files, 26,346 bytes. Destination manifest SHA-256: `412303043603e10bc53de7391e9de76689a01ffab653e9a269371a712f67fc1b`.
- Combined source/destination manifest SHA-256: `86e94a740760c499961c11fee8715aeac1cde6171cfc00f6b4f2adb18f8f313e` (10 path entries: 2 source and 8 destination, 44,917 bytes total). The source's nested `state` directory repeats its two root files and is not counted again. Manifest serialization hashes relative paths as UTF-8 without BOM after normalizing `\` to `/`; rows are ordinally sorted by lowercase path hash and contain path hash, decimal byte length, and lowercase content SHA-256 separated by TAB, with UTF-8 without BOM, LF line endings, and a final LF.
- The historical 417-file count still has no reproducible source manifest. It remains unverified and is not a gate under the Owner's 2026-09-28 disposition.

### `codex/mcg-finalization` worktree

- Exact repository root: `%USERPROFILE%\.lumenva\worktrees\mcg-finalization`; `origin` is `https://github.com/trydavidqix/nexus-brain.git`.
- Branch `codex/mcg-finalization`, HEAD `5d78258893cf25ce4c6038999a82e1e2be97e8a7`, upstream `origin/main`; 0 commits ahead and 50 behind `origin/main` by local refs. The commit is already an ancestor of current `main` (`81d41ff89beb33be87f71a3c537dfc1e3d206b9d`), and `origin` has no branch named `codex/mcg-finalization`.
- Git porcelain v2: 7 tracked modified files, 0 staged files, 2 untracked files, and 4 ignored-artifact status entries. Ignored entries were not manually reviewed; the read-only Gitleaks scan covered the worktree and returned only the two findings listed below. `git diff --check` passed.
- The exact nine-file working-tree manifest has SHA-256 `5bbf470f62a08b9bf73a885da58d994bf83d1c6e26d645d7647214ed6dc2bf13`. Each row records lowercase SHA-256 of the relative path's UTF-8 bytes, decimal file size, lowercase file-content SHA-256, and the relative path. Rows sort by path hash; the aggregate digest covers path hash, size, and content hash with TAB separators, UTF-8 without BOM, and LF line endings. Tracked diff SHA-256 (binary `git diff --binary --no-ext-diff HEAD`): `b3685668f8b5127ff2ba34b7a828df921fd7cc1ce41fe925ded9500f093cf5c5`.

| Relative path | Bytes | SHA-256 |
|---|---:|---|
| `docs/STATUS.md` | 18,630 | `29bea4ea2239f7543dda3212f796fcf928ec816fdb7f254304ebbb8d5b53f1c6` |
| `docs/blueprints/NB-01_SOURCE_OWNERSHIP_AND_LOCAL_PATH_AUDIT.md` | 12,558 | `15420d911b956121b0bf5beba1a9565cc26aa44a4503ca10ac9330db039790fa` |
| `docs/blueprints/NEXUS_BRAIN_MASTER_IMPLEMENTATION_BLUEPRINT.md` | 23,428 | `609048de0319b957d3a6e8b14d1f1643e76d8c6b9432f85cf0e580f45b7abdbc` |
| `packages/local-runtime/src/mcp-server.test.ts` | 9,696 | `48a55124abb718cf364a6c4f98efc51d75f6fcd0e4f0c69287ffdff49e86de14` |
| `scripts/run-local-runtime-mcp.mjs` | 820 | `f7fc3c51e78af5436a105dadfa9206e40e2629685a43dcfe009e577855307399` |
| `src/wire.mjs` | 8,578 | `e741b457957117dda6a028c905171f64d821683e5f195a1fc2820143205ffd40` |
| `test/registry.test.mjs` | 2,659 | `9dc29e822c7e4755a89567a1791eab50fd7b82e9c7f66ba3ddbc72ef869ce400` |
| `docs/migration/NEXUS_CANONICAL_ARCHITECTURE_MIGRATION.md` | 25,757 | `e9d4f8eab7f3b8251ef14b840b05fb0087aad2baa86a29a1daae49738a0fec79` |
| `test/wire-security.test.mjs` | 386 | `172d17cdf16c8c59c4e170df6af83f722faf0c9ea6e11061affe0a8b72c1827a` |

- Reconciliation against canonical `main`: shell-free MCP launching is in `tooling/scripts/run-edge-mcp.mjs`; pinned Wire TLS is in `apps/edge/src/bridge/wire.mjs`; corresponding MCP and Wire regression tests are in `apps/edge/tests/`; registry source containment/existence and telemetry compatibility are covered by `packages/context-gateway/tests/registry-compat.test.mjs`. The worktree's status, NB-01, Master Blueprint, and architecture-map edits are older snapshots superseded by current canonical documents. No unique executable behavior or test invariant was found that needs to be re-applied.
- A Gitleaks read-only scan of the preserved worktree found no findings in the nine inventoried files. Two findings were reported in unchanged files outside this manifest: `packages/operating-core/src/cloud-fabric/__tests__/tokens-fabric.test.ts` (`generic-api-key`) and `test/fuzz/redaction.fuzz.mjs` (`private-key`). No matching values were printed.
- PR #93's first MCG check rejected the title verb `reconcile`, which is outside the repository's imperative vocabulary. The title was changed to `docs: record NB-29 preservation evidence`, and the local title validator passed. CI must pass for the updated PR revision before merge.
- This worktree remains untouched and dirty by user constraint; no branch checkout, staging, commit, push, cleanup, copy, or removal was performed.

### Gate result

- The worktree preservation gate is reconciled: its exact dirty state is inventoried, its committed history is in `main`, and all identified executable behavior/test invariants are present in canonical paths. The dirty worktree remains as a preserved local artifact and was not changed.
- The 417-file historical count is explicitly outside the acceptance gate under the Owner's 2026-09-28 disposition. NB-29 closes based on the 10 actual files inventoried in the scoped roots plus the reconciled preserved worktree evidence.

### Post-merge GitHub and worktree revalidation — 2026-09-28

- PR #93, `docs: record NB-29 preservation evidence`, merged by squash as `b02336586d0c55b100f3463f5703e1d2fbcee31e` at 2026-09-28 02:16:14Z. All 13 recorded check runs are `SUCCESS`, including `mcg`, `tofu`, CodeQL, Gitleaks, dependency review, Semgrep, OSV, and ZAP. The remote topic branch was retained.
- Current readback of migration PRs #43, #49, #73–#75, #79–#80, #82–#83, and #90–#93 shows every PR `MERGED` and every recorded check conclusion `SUCCESS`.
- Local `main` is clean and synchronized at `b02336586d0c55b100f3463f5703e1d2fbcee31e`, equal to `origin/main`.
- Active ruleset `Nexus protected main` (ID `24075255`) targets only `main`, is enforced, has no bypass actor, requires PR-only squash and linear history, and requires `mcg`, `tofu`, `CodeQL`, `Gitleaks secrets scan`, and `dependency-review` with strict checks. Force-push and branch deletion are blocked.
- The clean NB-04 worktree is synchronized with its branch remote (0 ahead/0 behind). The clean NB-05 draft worktree is also synchronized (0/0); PR #81 remains open, `isDraft=true`, all 14 recorded check runs pass, and GitHub reports `mergeStateStatus=DIRTY`. It is gated future work and was not changed.
- The Everything CLI query for possible 417-file inventory/manifest names under the Codex metadata root did not return within 20 seconds; it was interrupted. Everything was not installed, started, or reconfigured. No broader fallback scan was run.
- At that earlier audit point, the historical 417-file list appeared to be the only remaining gate; the Owner's later 2026-09-28 disposition supersedes that conclusion. No access to Lumenva-owned project data was made.

### Ignored-path name audit — 2026-09-28

- Read-only Git porcelain v2 status with ignored and untracked paths enabled was run in the authorized Nexus worktree `%USERPROFILE%\.lumenva\worktrees\mcg-finalization`. It reported 23,975 ignored entries: 22,162 under `node_modules`, 1,806 under `packages`, and 7 under `state`.
- The seven `state` paths were `state/dashboard/snapshot.json` and six `state/registry/*.json` files (`agents`, `mcps`, `models`, `plugins`, `runtimes`, `tools`). Their contents were not read.
- No ignored path name in that worktree matched `.mcg-state`, `.nexus-state`, a manifest/inventory/SHA file, or `417`. This is a filename-only check within that exact worktree; it does not prove the historical files never existed or rule out another source location.
- The worktree and its Git state remain unchanged. No Lumenva project data was inspected.

### Read-only filesystem forensics — 2026-09-28

- `fsutil usn queryjournal C:` succeeded. It reported journal ID `0x01dd4777b0acd0f7`, first USN `0x131800000`, next USN `0x133ada5c8`, lowest valid USN `0`, and a 32 MiB maximum journal size. These bounds alone do not establish which dates the retained records cover.
- `fsutil usn readjournal C: startusn=0x133ada5c0` returned `Access denied`; the current PowerShell token is not elevated. `vssadmin list shadows /for=C:` also returned an elevated-permissions error. No journal records or shadow copies were read, and no repeated whole-volume scan was attempted.
- Everything is running; `es.exe` is callable and returned indexed matches in the canonical Nexus checkout, the specifically authorized `codex/mcg-finalization` worktree, and the previously inventoried MCG/Nexus state roots. PowerShell `Get-FileHash -Algorithm SHA256` returned 64-character SHA-256 digests. Queries and hashes read metadata/content hashes only; no file contents were opened.
- The following is a current-file manifest, not the missing historical 417-entry manifest. Paths are relative to the root column. `LastWriteTime` uses the machine's local offset. The source/destination eval rows match by relative path, byte length, and SHA-256; the six registry rows have no matching file in the currently inventoried source root.

| Root | Relative path | Bytes | LastWriteTime | SHA-256 |
|---|---|---:|---|---|
| `%USERPROFILE%\Desktop\Projetos\maestri-context-gateway\.mcg-state` | `state/evals/runs/pair-smoke-context-recall-1-1790376343486-7da5f2dd-baseline.jsonl` | 4,591 | `2026-09-25T23:46:18.0524321+01:00` | `e8eb5b6ca96911bf613e6361f06403d37fdec74717dbd478799ae60be55473aa` |
| `%USERPROFILE%\Desktop\Projetos\maestri-context-gateway\.mcg-state` | `state/evals/runs/pair-smoke-context-recall-1-1790376343486-7da5f2dd-baseline.stderr.txt` | 13,980 | `2026-09-25T23:46:18.0524321+01:00` | `9da3de1409214ef33d0f2d02b1190f087a5c6bbfde59da6596bcf7491f578b47` |
| `%USERPROFILE%\Desktop\Projetos\nexus-brain\.nexus-state` | `state/registry/agents.json` | 2,936 | `2026-09-28T01:28:23.8208174+01:00` | `13992c885d275b71162837f54ba3e7c13b034b7ef92f1cd6e4b62665eed9ab81` |
| `%USERPROFILE%\Desktop\Projetos\nexus-brain\.nexus-state` | `state/registry/mcps.json` | 1,015 | `2026-09-28T01:28:23.8326034+01:00` | `476465438e076331873abe3edc35f78cfdc73a90b79c52cf9e23fadc96cc4258` |
| `%USERPROFILE%\Desktop\Projetos\nexus-brain\.nexus-state` | `state/registry/models.json` | 414 | `2026-09-28T01:28:23.8386037+01:00` | `1dcdcf9f194550260e53732170d40ba6502db428837cff9cf28010e4f6c80f3f` |
| `%USERPROFILE%\Desktop\Projetos\nexus-brain\.nexus-state` | `state/evals/runs/pair-smoke-context-recall-1-1790376343486-7da5f2dd-baseline.jsonl` | 4,591 | `2026-09-25T23:46:18.0524321+01:00` | `e8eb5b6ca96911bf613e6361f06403d37fdec74717dbd478799ae60be55473aa` |
| `%USERPROFILE%\Desktop\Projetos\nexus-brain\.nexus-state` | `state/evals/runs/pair-smoke-context-recall-1-1790376343486-7da5f2dd-baseline.stderr.txt` | 13,980 | `2026-09-25T23:46:18.0524321+01:00` | `9da3de1409214ef33d0f2d02b1190f087a5c6bbfde59da6596bcf7491f578b47` |
| `%USERPROFILE%\Desktop\Projetos\nexus-brain\.nexus-state` | `state/registry/plugins.json` | 397 | `2026-09-28T01:28:23.8307923+01:00` | `ad5f00dd314e99aa70d7f2c991a16468b4a1341a91c63b79c62f3ae0c20dc4fe` |
| `%USERPROFILE%\Desktop\Projetos\nexus-brain\.nexus-state` | `state/registry/runtimes.json` | 1,674 | `2026-09-28T01:28:23.8365944+01:00` | `b6736b9766c17ede01459fe199fa3f2c9eb705d26a1b05d4c733b9dcf1cbe508` |
| `%USERPROFILE%\Desktop\Projetos\nexus-brain\.nexus-state` | `state/registry/tools.json` | 1,339 | `2026-09-28T01:28:23.8277972+01:00` | `faad63ee2f04ccbaace1fefe6e2a321a30217000fb07e2227bfea81423fde4e9` |

- Current exact-root counts remain 2 source files and 8 Nexus destination files (10 path rows; 44,917 bytes combined). The two eval artifacts match across roots; the six registry files exist only in the Nexus destination root. Their complete path, size, timestamp, and SHA-256 manifest appears above. The prior 417 count has no trustworthy expected list and remains unverified, rather than classified as present, moved, renamed, absent, or duplicated.
- NB-29 is `DONE` under the Owner's 2026-09-28 scope decision: actual scoped legacy state and the preserved worktree are accounted for. No inference is made about unobserved historical files.

### Elevated USN/VSS follow-up — 2026-09-28

- One VSS snapshot was readable with elevation: `\\?\GLOBALROOT\Device\HarddiskVolumeShadowCopy3`. The bounded scan covered only the authorized legacy `.mcg-state` and Nexus `.nexus-state` roots; it found 4 path rows representing 2 unique files duplicated across both roots.
- The JSONL manifest recorded the synthetic eval artifact at 4,591 bytes with SHA-256 `e8eb5b6ca96911bf613e6361f06403d37fdec74717dbd478799ae60be55473aa`; this matches both current roots. Its `.stderr.txt` was 13,980 bytes with snapshot SHA-256 `1a3289f8c76452a0cbee1ded28bedabf91d5498f79e720c1baef8da3f3a88ed7`, while both current roots hash to `9da3de1409214ef33d0f2d02b1190f087a5c6bbfde59da6596bcf7491f578b47`. The snapshot and current `.stderr.txt` have the same recorded LastWriteTime and size but different content hashes. Within the snapshot, each file appears once under each root and matching copies have identical hashes.
- Verifiable snapshot manifest (paths relative to each root; LastWriteTime uses local offset):

| Root | Relative path | Bytes | LastWriteTime | Snapshot SHA-256 |
|---|---|---:|---|---|
| `legacy-mcg-state` | `state/evals/runs/pair-smoke-context-recall-1-1790376343486-7da5f2dd-baseline.jsonl` | 4,591 | `2026-09-25T23:46:18.0524321+01:00` | `e8eb5b6ca96911bf613e6361f06403d37fdec74717dbd478799ae60be55473aa` |
| `legacy-mcg-state` | `state/evals/runs/pair-smoke-context-recall-1-1790376343486-7da5f2dd-baseline.stderr.txt` | 13,980 | `2026-09-25T23:46:18.0524321+01:00` | `1a3289f8c76452a0cbee1ded28bedabf91d5498f79e720c1baef8da3f3a88ed7` |
| `nexus-state` | `state/evals/runs/pair-smoke-context-recall-1-1790376343486-7da5f2dd-baseline.jsonl` | 4,591 | `2026-09-25T23:46:18.0524321+01:00` | `e8eb5b6ca96911bf613e6361f06403d37fdec74717dbd478799ae60be55473aa` |
| `nexus-state` | `state/evals/runs/pair-smoke-context-recall-1-1790376343486-7da5f2dd-baseline.stderr.txt` | 13,980 | `2026-09-25T23:46:18.0524321+01:00` | `1a3289f8c76452a0cbee1ded28bedabf91d5498f79e720c1baef8da3f3a88ed7` |
- The elevated manifest reported `snapshot_count=1`, `file_count=4`, and completion at `2026-09-28T04:09:05.9759742+01:00`. This is a bounded metadata/hash result, not a copy or recovery of historical data.
- The elevated USN read starting at the previously recorded `0x131800000` returned `Erro: A entrada foi excluída do diário.`. Its readback reported current first USN `5133828096`, so the requested older start point is no longer retained. No USN records or file paths were recovered. A subsequent read at the current boundary was stopped before producing a result; it yielded no evidence. No installed MFT parser was found. The available VSS snapshot and preserved manifests were used instead; neither contains the expected 417 paths.
- The VSS snapshot scan and current root manifests do not supply an expected path list for the historical 417 files. They establish one historical content difference in the `.stderr.txt` artifact, despite equal size and timestamp. Present, moved, renamed, absent, and duplicate classifications for that unverifiable historical set remain unknown. NB-29 is `DONE` under the later Owner disposition based on the actual scoped manifest and reconciled worktree; the historical 417 count is not a gate.
