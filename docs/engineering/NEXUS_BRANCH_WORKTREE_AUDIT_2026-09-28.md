# Nexus Branch and Worktree Audit — 2026-09-28

**Status:** Recovery inventory recorded before branch cleanup. No branches or worktrees were deleted while collecting this snapshot.

## Snapshot

- Repository: `trydavidqix/nexus-brain`; canonical remote: `https://github.com/trydavidqix/nexus-brain.git`.
- `main` / `origin/main`: `854f9628a0a2914093db1a138c215654e931cc1a`; clean and synchronized at capture.
- Audited 112 branch refs: 49 local refs and 63 remote-tracking refs. GitHub reported 54 branch heads; 9 remote-tracking refs no longer exist on GitHub.
- Full `refs/` snapshot: 117 refs, including local/remote heads, symbolic remote HEAD and tags.
- Four registered Git worktrees were recorded. Full porcelain status, upstream, HEAD and untracked file records are in the JSON manifest.
- Two additional Nexus-named directories were found outside registered worktrees. Both lack `.git`; neither was removed. One archive contains `state/` and remains preserved without recursive inspection.

Machine-readable recovery file: [`NEXUS_BRANCH_RECOVERY_MANIFEST_2026-09-28.json`](NEXUS_BRANCH_RECOVERY_MANIFEST_2026-09-28.json). It records every ref name and object ID, branch ahead/behind counts against `main`, graph-exclusive commit IDs and subjects, branch-contributed file paths, GitHub branch existence, pull request association, worktree porcelain and untracked status, plus disposition evidence.

Manifest SHA-256: `daf8ee7cb66c877d37e38543e14ddf4691d5a6d854d06ecaa32a02ea5949c6a9`.

## Canonical documentation comparison

- `origin/docs/plan1-nexus-implementation-plan`: all 13 headings and all 415 source lines are present in `docs/plans/NEXUS_IMPLEMENTATION_PLAN.md` (419 lines). No source content is missing.
- `origin/docs/plan2-nexus-engineering-control-plane-v2`: all 104 headings and all 2,487 source lines are present in `docs/plans/NEXUS_ENGINEERING_CONTROL_PLANE_IMPLEMENTATION_PLAN.md` (2,491 lines). No source content is missing.
- PR #102 merged BrowserMesh fast-path acceptance into the Master Blueprint. PR #50 was closed only after its criteria were verified in B0/B5/B6/B8 and production gates.

## Branch disposition

| State | Branches / refs | Evidence and action |
|---|---|---|
| Integrated | Branches tied to merged PRs; plan branches above | Preserve this manifest first. Candidate cleanup only after this snapshot is merged and refs are rechecked. |
| Keep | `codex/nb04-temporal-provenance-prep` | PR #73 merged; clean managed worktree remains available for recoverable archive. |
| Keep | `codex/nb05-brain-api-mcp-contract` | Open draft PR #81 has unique NB-05 code and tests. |
| Keep | `feature/audit-2-nexus-blueprint-assimilation` | Open PR #78 has 25 branch-only commits and unique Project Factory/Maestri implementation; dependency sequence still applies. |
| Keep | `feature/audit-1-email-blueprint-assimilation` | PR #77 closed; implementation source/tests match PR #78. Keep its remaining Blueprint/history delta until PR #78 resolves. |
| Keep | `dependabot/github_actions/github-actions-f1e5ee2635`; `dependabot/npm_and_yarn/production-dependencies-39d93a22fb` | Open PRs #62 and #61; retain pending review. |
| Keep backup | `codex/mcg-finalization` | Nine-file worktree state committed as `0f972b504c5089044e0594f67595ebf4896b3295` and pushed. No unique executable behavior absent from main was identified; old docs were preserved but not merged. |
| Candidate local cleanup | `codex/nb06-github-project-indexer`, `codex/nexus-canonical-architecture`, and merged-PR local topic refs | Branch tips are ancestors of main or tied to merged PRs. Check worktree attachment before deleting any local ref. |
| Candidate stale-ref cleanup | Refs with `remote_exists=false` in JSON | These are local remote-tracking pointers, not current GitHub branches. Remove only after this manifest is merged. |

Merged PR proof includes PR number, merge state, source head and URL in JSON. Unique or unresolved branches remain preserved. No force-push, reset, clean, billing change, or Lumenva project data access occurred.

## Delivery validation

- PR #102 merged as `854f9628a0a2914093db1a138c215654e931cc1a` after required CodeQL, Gitleaks, OSV, Semgrep, ZAP, dependency-review, MCG and tofu checks passed.
- NB-29 closes against the actual scoped state manifest and reconciled Nexus worktree. Historical 417-file count remains unverified and is not a precondition; see [`NB-29 cutover revalidation`](NB-29_CUTOVER_REVALIDATION_2026-09-28.md).
- Cleanup has not started. This report preserves the pre-cleanup state and exact reasons for retained branches.
