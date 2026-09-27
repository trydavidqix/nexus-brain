# NB-19 G4: Main Ruleset Policy

**Captured:** 2026-09-27
**Status:** Active and verified on 2026-09-27.
**Target:** repository `trydavidqix/nexus-brain`, branch `main`

## Baseline

- Repository is public; authenticated role is `ADMIN`.
- Default branch is `main`.
- Before activation, no repository ruleset existed and the branch-protection API reported `Branch not protected`.
- Before activation, squash, merge-commit, and rebase methods were enabled. Automatic head-branch deletion was disabled and remains disabled.
- PR #57 head `fe471c080108f9f327bac8a6fc6a22167778105c` reported stable passing contexts `mcg`, `tofu`, and `CodeQL`.
- `mcg` and `tofu` checks originate from GitHub Actions integration `15368`; `CodeQL` originates from GitHub Advanced Security integration `57789`.

## Target policy

[`main-ruleset.json`](../../.github/rulesets/main.json) is the versioned request body for the repository rulesets API. It targets only `refs/heads/main` and requires:

- pull requests, resolved review conversations, and squash-only merges;
- current passing `mcg`, `tofu`, and `CodeQL` checks;
- linear history, no force-push, and no deletion;
- no bypass actors.

Repository merge settings must permit squash and disable merge commits and rebase merges. Automatic head-branch deletion remains disabled. Merge queue remains disabled because the Blueprint requires evidence of concurrent PR load before enabling it.

## Activation evidence

- Repository ruleset `Nexus protected main` is active with ID `24075255`, targets only `refs/heads/main`, and has no bypass actors.
- API readback confirms required `mcg`, `tofu`, and `CodeQL` checks from their expected GitHub integrations, strict up-to-date checks, PR-only updates, resolved review conversations, squash-only merge, linear history, blocked force pushes, and blocked branch deletion.
- Repository settings readback confirms squash enabled; merge commits and rebase disabled; automatic head-branch deletion still disabled.
- PR #59 head `9be44834683bf9cfbf72b15b11003c4f1561ac64` had all checks passing and `mergeStateStatus=CLEAN` after ruleset activation. This verifies the active ruleset accepts a PR only after required checks pass.

## Source

- [GitHub REST rulesets API](https://docs.github.com/en/rest/repos/rules)
- [Ruleset rules and PR/status-check behavior](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
- [Repository merge settings API](https://docs.github.com/en/rest/repos/repos)
