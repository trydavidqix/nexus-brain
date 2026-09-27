# NB-19 G5: Security and Dependency Gates

**Captured:** 2026-09-27  
**Status:** COMPLETE.

## Repository security baseline

- The Nexus repository is public.
- GitHub Secret Scanning and push protection are enabled.
- Dependabot security updates are enabled.
- Open secret-scanning alerts: 0.
- Open Dependabot alerts: 0.
- Generic/non-provider secret patterns and validity checks are disabled. GitHub does not offer generic-pattern scanning for this user-owned repository without the applicable organization plan.

## Changes in this gate

- Gitleaks becomes a blocking check. PR comments and SARIF artifact uploads remain disabled to avoid copying finding details into extra surfaces.
- One existing test-fixture false positive is ignored by its exact Gitleaks fingerprint in [`.gitleaksignore`](../../.gitleaksignore). The ignore does not exempt its file or rule.
- Dependency Review runs on pull requests to `main`, blocks low-or-higher vulnerabilities in runtime, development, and unknown dependency scopes, and does not invent a license policy.
- The Dependency Review action is pinned to release `v5.0.0` by full commit SHA.
- Dependabot groups GitHub Actions updates and retains existing weekly schedules, seven-day cooldowns, and five-PR limits.
- The versioned `main` ruleset now requests `Gitleaks secrets scan` and `dependency-review` in addition to `mcg`, `tofu`, and `CodeQL`. Activation waits until both new checks report successfully.

## Local validation

- `pnpm test:engineering-gates`: 15/15 passed.
- `pnpm check:architecture`: passed; 13 packages checked.
- `pnpm check:syntax`: passed; 129 modules parsed.
- `pnpm scan:sensitive`: passed; 276 files checked.
- `actionlint` on `security-scanning.yml`, `dependency-review.yml`, and `ci.yml`: passed.
- Gitleaks 8.30.1 scanned 121 commits / about 3.33 MB. After applying the single exact-fingerprint ignore, it reported no leaks.
- `git diff --check`: passed.

## Sources

- [GitHub dependency review](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependency-review)
- [Dependency Review action inputs at v5.0.0](https://github.com/actions/dependency-review-action/blob/a1d282b36b6f3519aa1f3fc636f609c47dddb294/action.yml)
- [Dependabot groups and wildcard patterns](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#groups)
- [GitHub secret scanning availability](https://docs.github.com/en/code-security/how-tos/secure-your-secrets/detect-secret-leaks/enable-secret-scanning)
- [Gitleaks configuration and finding fingerprints](https://github.com/gitleaks/gitleaks)

## Integration evidence

- Implementation PR [#60](https://github.com/trydavidqix/nexus-brain/pull/60) merged on 2026-09-27.
- PR head: `60351eb8c112e135940e3ade993d88eb6dcfebbc`; squash merge commit: `26c085fba80c9c56b1438dbda6e1e7728ba56bae`.
- Evidence closeout PR [#63](https://github.com/trydavidqix/nexus-brain/pull/63) merged on 2026-09-27 at `29fdbb24199058ee60dd113b897c0ba38a39b1db`.
- Required checks passed on the PR head: `mcg`, `tofu`, `CodeQL`, `Gitleaks secrets scan`, and `dependency-review`.
- Other configured PR checks also passed: JavaScript/TypeScript analysis, Semgrep, OSV-Scanner, and ZAP baseline.
- Active ruleset ID `24075255` readback confirms those five required checks, strict up-to-date checks, `main`-only targeting, and zero bypass actors.
- Both PRs had merge state `CLEAN` before squash merge.
