# NB-19 G7: Task, Agent, Branch, and Worktree Ownership

**Status:** Complete on 2026-09-27 via PR [#67](https://github.com/trydavidqix/nexus-brain/pull/67), merged as `2963f21f443c6c4f9c31f264796328fad6f7b1c8`. G7 records ownership and feeds read-only hygiene classification. It performs no branch or worktree cleanup.

## Registry behavior

- The versioned schema and code live in `tooling/scripts/ownership-registry-core.mjs` and `tooling/scripts/ownership-registry-store.mjs`.
- Runtime records live under the repository’s Git common directory at `nexus-ownership/registry.json`. This is local Git metadata, not a tracked project file. It stores absolute worktree paths and must not be committed or copied between machines.
- Each active record binds one `taskId` and `agentId` to the current non-main branch and current worktree. The CLI derives branch and worktree from Git; callers cannot supply an arbitrary path.
- Active records cannot share a branch or worktree. Separate agents on one task need separate branches and worktrees. Re-registering an active identity cannot silently move its work.
- `release` changes the record to `RELEASED`; it does not delete registry history, branch, or worktree.
- Registry claims are caller-declared metadata, not authenticated agent identity. Enforcement against a malicious caller belongs to the later Engineering Control Plane.

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

- `pnpm test:engineering-gates`: 32/32 passed. Tests cover unique active ownership, separate agent workspaces, release history, exact branch/path matching, registry storage, CLI behavior, and report privacy.
- `pnpm -r --if-present test:unit`: passed across 13 workspace packages.
- `pnpm test:integration`: 20/20 passed.
- `pnpm -r --if-present typecheck`: passed across configured packages.
- `pnpm check:architecture`: passed; 13 packages.
- `pnpm check:syntax`: passed; 136 modules parsed.
- `pnpm scan:sensitive`: passed; 287 files.
- `actionlint` passed for all three workflow files.
- Local report read the registry as `AVAILABLE`, classified the dirty implementation worktree as `DIRTY`, and reported zero mutations.
- PR #67 head `cf4980b52dfffdb442d4d23880fbcf343a18d42b` passed required checks: MCG, Tofu, CodeQL, Analyze, Gitleaks, dependency review, OSV-Scanner, Semgrep, Jazzer.js, and ZAP.
- PR #67 merged as `2963f21f443c6c4f9c31f264796328fad6f7b1c8`; the branch was not deleted and no worktree was retired.
