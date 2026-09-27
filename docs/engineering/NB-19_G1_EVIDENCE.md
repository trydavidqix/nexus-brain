# NB-19 G1: Naming Contract Evidence

**Captured:** 2026-09-27
**Branch:** `codex/nb19-g1-naming-contracts`
**Scope:** commit subjects, pull request titles, and task branch names. No GitHub settings or existing branches changed.

## Deliverables

- `docs/engineering/GIT_NAMING_CONTRACT.md` defines the forward-looking naming contract.
- `tooling/scripts/check-git-naming.mjs` validates explicit commit subject, pull request title, and branch inputs.
- `tooling/tests/git-naming.test.mjs` covers valid examples and rejects vague subjects, non-imperative actions, missing task IDs, unsupported branch kinds, and invalid slugs.
- `pnpm test:git-naming` runs the focused regression tests.

## Validation

| Gate | Result |
| --- | --- |
| Red/green naming regression | 11/11 passed after observing expected failures before implementation |
| Workspace unit suites | Passed |
| Focused Git naming tests | 11 passed, 0 failed |
| Workspace integration | 20 passed, 0 failed |
| Architecture | Passed; 13 packages |
| TypeScript checks | Passed for all configured workspace packages |
| Syntax/import smoke | Passed; 124 modules |
| Secret/path/personal-data scan | Passed; 265 files |
| `git diff --check` | Passed |

The local OpenTofu executable is unavailable on this host; G1 does not alter infrastructure. CI remains the authoritative OpenTofu check.

## Enforcement status

G1 provides a runnable contract and tests. The validator is not yet a required CI gate or local hook. G2 will integrate it after reviewing workflow permissions and pinned actions. Existing remote branches were left intact; G1 does not rename or delete historical work.
