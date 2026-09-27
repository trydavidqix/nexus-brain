# NB-19 G7: Task, Agent, Branch, and Worktree Ownership

**Status:** Complete on 2026-09-27. Registry implementation PR [#67](https://github.com/trydavidqix/nexus-brain/pull/67) merged as `2963f21f443c6c4f9c31f264796328fad6f7b1c8`; Blueprint-alignment correction PR [#69](https://github.com/trydavidqix/nexus-brain/pull/69) merged as `a9537f2d98a144e62168975eafa11d91d9cdaa94`.

## Registry behavior

- The versioned schema and code live in `tooling/scripts/ownership-registry-core.mjs` and `tooling/scripts/ownership-registry-store.mjs`.
- Runtime records live under the repository’s Git common directory at `nexus-ownership/registry.json`. This is local Git metadata, not a tracked project file. It stores absolute worktree paths and must not be committed or copied between machines.
- Each active record binds one `taskId` and `agentId` to the current non-main branch and current worktree. The CLI derives branch and worktree from Git; callers cannot supply an arbitrary path.
- Each task has one active owner. A second agent requires a distinct child `taskId` created by an explicit subtask/owner split recorded by Maestri. The registry refuses duplicate active task IDs; it does not create or authorize splits.
- Active records cannot share a branch or worktree. Re-registering an active identity cannot silently move its work.
- `release` changes the record to `RELEASED`; it does not delete registry history, branch, or worktree.
- Registry claims are caller-declared metadata, not authenticated agent identity. Maestri remains the authority for creating a child task split; this registry does not create or authenticate that split. Enforcement against a malicious caller belongs to the later Engineering Control Plane.

## Commands

Register or inspect ownership from the worktree being recorded:

```powershell
pnpm task:ownership register --task-id NB-19-G7 --agent-id codex-root
pnpm task:ownership list
pnpm task:ownership release --task-id NB-19-G7 --agent-id codex-root
```

The list output omits absolute paths. Release only changes metadata. No command in this milestone retires Git resources.

## Hygiene integration

The report-only Git Hygiene Gate reads the local registry. It classifies a worktree as `ACTIVE` only when an `ACTIVE` record matches both its branch and normalized worktree path. Dirty worktrees remain `DIRTY`. Missing registries report `UNAVAILABLE`; malformed registries report `INVALID` and prove no ownership. Reports contain counts and registry availability only, never task IDs, agent IDs, branch names, or local paths.

The report continues to perform zero mutations. Ownership alone never proves preservation, redundancy, merge status, or safe retirement. G8–G10 handle detection, retirement gates, and concurrency validation.

## Validation

- `pnpm test:engineering-gates`: 33/33 passed, including single-owner enforcement and the Maestri split requirement.
- `pnpm -r --if-present test:unit`: passed across 13 workspace packages.
- `pnpm test:integration`: 20/20 passed.
- `pnpm -r --if-present typecheck`: passed across configured packages.
- `pnpm check:architecture`: passed; 13 packages.
- `pnpm check:syntax`: passed; 136 modules parsed.
- `pnpm scan:sensitive`: passed; 287 files.
- `actionlint` passed for all three workflow files.
- PR #67 head `cf4980b52dfffdb442d4d23880fbcf343a18d42b` passed required checks and merged; it was not deleted and no worktree was retired.
- Correction PR #69 head `5a7fcc5df0d45989e67c77063bd39dd2f486eb17` passed MCG, Tofu, CodeQL, Analyze, Gitleaks, dependency review, OSV-Scanner, Semgrep, Jazzer.js, and ZAP, then merged as `a9537f2d98a144e62168975eafa11d91d9cdaa94`.
