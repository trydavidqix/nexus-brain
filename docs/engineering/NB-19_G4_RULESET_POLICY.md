# NB-19 G4: Main Ruleset Policy

**Captured:** 2026-09-27
**Status:** Prepared; external GitHub settings have not yet been applied.
**Target:** repository `trydavidqix/nexus-brain`, branch `main`

## Baseline

- Repository is public; authenticated role is `ADMIN`.
- Default branch is `main`.
- No repository rulesets are installed; the branch-protection API reports `Branch not protected`.
- Squash, merge-commit, and rebase methods are currently enabled. Automatic head-branch deletion is disabled.
- PR #57 head `fe471c080108f9f327bac8a6fc6a22167778105c` reported stable passing contexts `mcg`, `tofu`, and `CodeQL`.
- `mcg` and `tofu` checks originate from GitHub Actions integration `15368`; `CodeQL` originates from GitHub Advanced Security integration `57789`.

## Target policy

[`main-ruleset.json`](../../.github/rulesets/main.json) is the versioned request body for the repository rulesets API. It targets only `refs/heads/main` and requires:

- pull requests, resolved review conversations, and squash-only merges;
- current passing `mcg`, `tofu`, and `CodeQL` checks;
- linear history, no force-push, and no deletion;
- no bypass actors.

Repository merge settings must permit squash and disable merge commits and rebase merges. Automatic head-branch deletion remains disabled. Merge queue remains disabled because the Blueprint requires evidence of concurrent PR load before enabling it.

G4 is not complete until GitHub readback confirms the active ruleset and repository merge settings, and a PR proves the required checks are enforced. This policy file alone is not enforcement evidence.

## Source

- [GitHub REST rulesets API](https://docs.github.com/en/rest/repos/rules)
- [Ruleset rules and PR/status-check behavior](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
- [Repository merge settings API](https://docs.github.com/en/rest/repos/repos)
