# NB-19 G0: GitHub and Git Baseline

**Captured:** 2026-09-27
**Repository:** `trydavidqix/nexus-brain`
**Method:** read-only GitHub REST API and local Git inspection. No repository settings or resources were changed.

## Repository and delivery settings

| Control | Observed state |
| --- | --- |
| Visibility / default branch | Public / `main` |
| Main branch protection | Not configured; branch protection API returned HTTP 404 |
| Repository rulesets | 0 |
| Required status checks | None enforced on `main` |
| Merge methods | Merge, rebase, and squash are enabled |
| Delete branch on merge | Disabled |
| Actions | Enabled; all actions allowed; immutable SHA pinning is not required |
| Default workflow token | Read-only; workflow token cannot approve pull requests |
| Dependabot security alerts / updates | Enabled; 0 open Dependabot alerts |
| Secret scanning / push protection | Enabled; 0 open secret scanning alerts |
| Non-provider secret patterns / validity checks | Disabled / disabled |
| Code scanning | 109 open alerts at capture time |

The latest completed run inventory included the MCG gates and Security scanning workflows with successful conclusions. CodeQL also had a successful completed run. A passing run is not an enforced merge gate while `main` has no protection or ruleset.

## Workflow and ownership observations

- `.github/workflows/ci.yml` uses version tags for checkout, OpenTofu setup, pnpm setup, and Node setup. Those references are mutable.
- Security scanning and fuzzing workflow action references use full commit SHAs. Security scan findings are configured with `continue-on-error` in several steps and therefore are not yet blocking gates.
- Repository Actions settings do not require SHA pinning. The repository-wide token default is read-only; workflow-specific permissions still need review and least-privilege hardening in G2.
- Dependabot checks npm and GitHub Actions weekly, applies a seven-day cooldown, caps each ecosystem at five open PRs, and groups production and development npm updates.
- `.github/CODEOWNERS` assigns all paths to `@trydavidqix`; it does not define narrower ownership for workflows, security policy, or infrastructure.
- GitHub lists PR #49 from `feature/NB-03-zero-cost-local` as open draft. PR #50 is also open on an unrelated BrowserMesh documentation branch. Neither branch was modified by G0.
- The primary Nexus checkout is clean on `feature/NB-03-zero-cost-local` at `be9f26e805e96b770f41e760ce3f982513176d58`, tracking its origin branch. The separate Nexus baseline checkout is clean on `codex/nb19-g0-github-baseline` at `c8a11e3620a2f39c2e9df7b9728aea93b4bf1218`, tracking `origin/main`.
- GitHub reports no configured protection or ruleset for `main`; PR-only delivery is therefore a project policy today, not a server-enforced restriction.

## G0 outcome and follow-up

G0 is complete. The baseline confirms that protected-main delivery, enforced checks, squash-only merge policy, narrower sensitive-path ownership, immutable action pinning, and blocking security gates remain unimplemented. These findings are inputs to G1–G6; this audit does not change GitHub settings or clean up any branch/worktree.

No worktree or branch was deleted. No force-push, destructive Git operation, billing change, or external resource provisioning occurred.

## Source endpoints

- [Repository settings](https://api.github.com/repos/trydavidqix/nexus-brain)
- [Actions permissions](https://api.github.com/repos/trydavidqix/nexus-brain/actions/permissions)
- [Rulesets](https://api.github.com/repos/trydavidqix/nexus-brain/rulesets)
- [Main branch protection](https://api.github.com/repos/trydavidqix/nexus-brain/branches/main/protection)
- [Open Dependabot alerts](https://api.github.com/repos/trydavidqix/nexus-brain/dependabot/alerts?state=open)
- [Open code scanning alerts](https://api.github.com/repos/trydavidqix/nexus-brain/code-scanning/alerts?state=open)
- [Open secret scanning alerts](https://api.github.com/repos/trydavidqix/nexus-brain/secret-scanning/alerts?state=open)
