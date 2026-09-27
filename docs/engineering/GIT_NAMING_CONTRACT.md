# Git Naming Contract

This contract implements NB-19 G1. It applies to new Nexus commits, pull request titles, and task branches. Existing remote branches are not renamed or deleted by the validator.

## Commit subjects and pull request titles

Use the same one-line format for commit subjects and pull request titles:

```text
<area>: <imperative action>
```

The area is lowercase and identifies a concrete project domain. The action starts with a concrete imperative verb. The current verb vocabulary is maintained in `tooling/scripts/check-git-naming.mjs`; add a verb there when a valid project change needs one. The validator rejects generic areas (`chore`, `misc`, `update`, `changes`, `cleanup`, `fix`, `wip`, `final`, `stuff`) and vague one-line subjects such as `WIP`, `final-final`, `fix`, or `update files`.

Examples:

```text
memory: Prevent cross-project context leakage
github: Record repository security baseline
browsermesh: Isolate browser sessions by task
```

The validator accepts explicit inputs and returns a nonzero exit code for invalid names:

```powershell
node tooling/scripts/check-git-naming.mjs --subject "memory: Prevent cross-project context leakage"
node tooling/scripts/check-git-naming.mjs --pr-title "github: Record repository security baseline"
```

## Task branches

Use this shape:

```text
<kind>/<task-id>-<short-slug>
```

Allowed kinds are `codex`, `docs`, `feature`, `fix`, `recovery`, `refactor`, and `security`. `codex` is included for the Codex host's configured branch prefix. A task ID starts with letters and contains digits; one hyphen between the key and digits and one decimal suffix are allowed. The descriptive slug uses lowercase kebab-case.

```text
feature/NB-03-zero-cost-local
codex/nb19-g1-naming-contracts
```

Validate a branch explicitly:

```powershell
node tooling/scripts/check-git-naming.mjs --branch "feature/NB-03-zero-cost-local"
```

## Enforcement boundary

G1 provides the contract, executable validator, and regression tests. G2 runs the regression tests and validates PR titles and task branches in MCG CI, plus the first commit subject pushed to `main`. The active `main` ruleset requires the `mcg`, `tofu`, and `CodeQL` checks, requires squash-only PR merges, and blocks direct updates. No local hook is required for correctness.
