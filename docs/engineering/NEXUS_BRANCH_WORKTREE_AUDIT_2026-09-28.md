# Nexus Branch and Worktree Audit — 2026-09-28

**Status:** Complete pre-cleanup recovery snapshot. No branch, worktree or remote-tracking ref was deleted during this audit.

## Snapshot

- Repository: `trydavidqix/nexus-brain`; canonical remote: `https://github.com/trydavidqix/nexus-brain.git`.
- `main` / `origin/main`: `cf95999393477bcf483cc3462ac68520d8a40ab9`; clean and synchronized at capture.
- Audited 116 branch refs: 51 local and 65 remote-tracking. GitHub reports 56 branch heads; 9 tracked refs no longer exist on GitHub.
- Full Git ref snapshot: 121 refs; includes local/remote heads, symbolic remote HEAD and tags.
- Four registered Git worktrees were recorded. Full porcelain status, HEAD, upstream and untracked paths are in the JSON.
- Two additional Nexus-named directories outside Git worktree metadata lack `.git`; both remain preserved. One archive includes `state/`; it was not recursively inspected or removed.

Machine-readable evidence: [`NEXUS_BRANCH_RECOVERY_MANIFEST_2026-09-28.json`](NEXUS_BRANCH_RECOVERY_MANIFEST_2026-09-28.json). For each branch ref it records ahead/behind, exclusive commits, patch-equivalent counts, file paths vs merge-base, GitHub existence, PRs and cleanup disposition.

Manifest SHA-256: `79d472a5adbb76a4e3e5c94c00b7b57861897561414025d0f913db48ac1159c2`.

## Canonical documentation

- `origin/docs/plan1-nexus-implementation-plan`: all 13 headings and all 415 source lines are present in `docs/plans/NEXUS_IMPLEMENTATION_PLAN.md` (419 lines); no source content is missing.
- `origin/docs/plan2-nexus-engineering-control-plane-v2`: all 104 headings and all 2,487 source lines are present in `docs/plans/NEXUS_ENGINEERING_CONTROL_PLANE_IMPLEMENTATION_PLAN.md` (2,491 lines); no source content is missing.
- PR #102 merged BrowserMesh fast-path acceptance into the Master Blueprint. PR #50 closed after its criteria were verified in B0/B5/B6/B8 and production gates.
- PR #104 merged this recovery inventory at `cf95999393477bcf483cc3462ac68520d8a40ab9`. PR #103 was closed after branch-name validation failed; its same commit was carried through PR #104.
- The final ref snapshot is delivered through PR #105 with title `docs: record final Nexus ref snapshot`; the local Git naming validator passed for its title and branch.

## Preserve before cleanup

| Branch or worktree | Evidence | Disposition |
|---|---|---|
| `codex/nb05-brain-api-mcp-contract` | Open draft PR #81; unique NB-05 code/tests | Preserve branch and clean worktree. |
| `feature/audit-2-nexus-blueprint-assimilation` | Open PR #78; 25 branch-only commits with contracts/compiler/tests | Preserve; dependencies gate integration. |
| `feature/audit-1-email-blueprint-assimilation` | Closed PR #77; implementation files match PR #78, but Blueprint/history differs | Preserve until PR #78 resolves. |
| Dependabot branches | Open PRs #61 and #62 | Preserve pending review. |
| `codex/mcg-finalization` | Nine-file local snapshot committed as `0f972b504c5089044e0594f67595ebf4896b3295` and pushed | Keep recovery backup; old docs were not merged. |
| `codex/nb04-temporal-provenance-prep` | PR #73 merged; clean managed worktree remains attached | Archive only after final use check; preserve checkout metadata. |

Merged-PR refs, plan branches and stale remote-tracking refs are classified individually in JSON. Merged PRs prove accepted branch content; PR commit records remain on GitHub. No force-push, reset, clean, billing change, or Lumenva project data access occurred.

## Validation

- Local JSON parse and `git diff --check` passed; Gitleaks reported no findings in the recovery files.
- PR #104 required CodeQL, Gitleaks, OSV, Semgrep, ZAP, dependency-review, MCG and tofu checks passed.
- NB-29 is complete against the actual scoped inventory and preserved Nexus worktree. The historical 417-file count remains unverified and is not a precondition; see [`NB-29 cutover revalidation`](NB-29_CUTOVER_REVALIDATION_2026-09-28.md).
- No cleanup has started. Preserve this snapshot before deleting any candidate branch.
