# NB-19 G2: Actions and Workflow Hardening Evidence

**Captured:** 2026-09-27
**Branch:** `codex/nb19-g2-ci-security`
**Scope:** repository-authored CI, security-scan, and fuzzing workflows, plus the repository action-pinning policy. No secrets or cloud resources changed.

## Changes

- Added explicit read-only `contents` permissions to MCG CI and retained read-only defaults in security workflows.
- Kept `security-events: write` only on Semgrep and OSV upload jobs. Gitleaks gets `contents: read` and `pull-requests: read`; ZAP and fuzzing get `contents: read`.
- Set `persist-credentials: false` for every repository checkout.
- Replaced mutable CI action tags with full commit SHAs:
  - `actions/checkout` v7: `3d3c42e5aac5ba805825da76410c181273ba90b1`
  - `opentofu/setup-opentofu` v2.0.2: `a1320f892987e89d278cc92dc5adc984fb93aca4`
  - `pnpm/action-setup` v4: `b906affcce14559ad1aafd4ab0e942779e9f58b1`
  - `actions/setup-node` v7: `820762786026740c76f36085b0efc47a31fe5020`
- Added MCG CI regression execution plus validation for PR title and task branch, and for the first subject line pushed to `main`.
- Existing security workflow actions were already pinned to full SHAs; the SHA scan confirms every repository-authored workflow action remains pinned.

The security scanners remain report-only in this milestone. G2 does not convert their current `continue-on-error` behavior into merge gates; G5 will review the existing alert backlog and gate reliability before promotion.

Every SHA pin retains its release tag as a same-line comment so Dependabot can resolve and update the pinned action reference. The existing weekly, grouped Dependabot policy was not changed.

After workflow PR #55 merged, the GitHub Actions repository policy was updated and read back: Actions remain enabled, `allowed_actions` remains `all`, and `sha_pinning_required` is now `true`. This makes GitHub reject any workflow action reference that is not pinned to a full commit SHA.

## Validation

| Gate | Result |
| --- | --- |
| `actionlint` on all three workflows | Passed |
| Full SHA scan across workflow `uses:` references | Passed; all are full 40-character SHAs |
| Workspace unit suites | Passed |
| Git naming regression | 11 passed, 0 failed |
| Workspace integration | 20 passed, 0 failed |
| Architecture | Passed; 13 packages |
| TypeScript checks | Passed for all configured workspace packages |
| Syntax/import smoke | Passed; 124 modules |
| Secret/path/personal-data scan | Passed; 266 files |
| `git diff --check` | Passed |
| GitHub Actions policy readback | `sha_pinning_required: true`; `enabled: true`; `allowed_actions: all` preserved |

Local OpenTofu remains unavailable; the PR's remote MCG `tofu` job validates the pinned setup action and infrastructure syntax.

## References

- [GitHub Actions secure-use reference](https://docs.github.com/en/actions/reference/security/secure-use) recommends least-privilege `GITHUB_TOKEN` permissions and full commit SHA pins.
- [Repository Actions permissions API](https://docs.github.com/en/rest/actions/permissions) documents the `sha_pinning_required` setting.
- [Dependabot version updates](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependabot-version-updates) documents updates for actions referenced by version or commit SHA.
- [Gitleaks Action README](https://github.com/gitleaks/gitleaks-action/blob/master/README.md) documents the token use for pull request API operations and the optional comment control.
