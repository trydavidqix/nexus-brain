# NB-19 G5: Security and Dependency Gates

**Captured:** 2026-09-27  
**Status:** Implemented locally; pull request checks and required-ruleset activation pending.

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

## Pending integration evidence

Record the G5 pull request number, final head SHA, passing required-check contexts, active-ruleset readback, and merge commit here before marking G5 complete.
