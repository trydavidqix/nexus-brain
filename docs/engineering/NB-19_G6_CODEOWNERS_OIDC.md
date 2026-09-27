# NB-19 G6: Sensitive Paths and Google Cloud OIDC

**Status:** Complete on 2026-09-27 via PR [#65](https://github.com/trydavidqix/nexus-brain/pull/65), merged as `b89086a3d0be4b79411cc33d35372615b483d7d9`. CODEOWNERS assignments remain advisory while the repository has one eligible reviewer.

## Sensitive path ownership

The repository owner is assigned to repository policy and automation, GitHub rulesets, cloud/IaC, contracts, and canonical engineering decisions in [`.github/CODEOWNERS`](../../.github/CODEOWNERS). GitHub currently lists only `trydavidqix` as a collaborator, and the PR author cannot approve their own pull request. The main ruleset therefore keeps code-owner approval advisory. PR-only delivery, required CI/security checks, resolved conversations, and disabled bypass remain enforced.

PR [#65](https://github.com/trydavidqix/nexus-brain/pull/65), head `fb8bd07b5231747c9506b0b256ae814e5d915179`, passed required CI/security checks and merged. The code-owner setting remains aligned with active ruleset readback (`require_code_owner_review: false`).

## OIDC authentication path

[`.github/actions/google-cloud-oidc/action.yml`](../../.github/actions/google-cloud-oidc/action.yml) wraps Google’s `google-github-actions/auth` action at a full commit SHA. Each caller must explicitly provide a project ID, full Workload Identity Provider resource name, and dedicated service account. The caller grants only `contents: read` and `id-token: write` to the job. The composite action creates short-lived credentials for the job and cleans up the generated file. Root `.gitignore` excludes `gha-creds-*.json`.

Usage shape; store these non-secret identifiers as repository variables and set them only after the corresponding WIF provider and service account are configured:

```yaml
permissions:
  contents: read
  id-token: write

steps:
  - uses: ./.github/actions/google-cloud-oidc
    with:
      project_id: ${{ vars.GCP_PROJECT_ID }}
      workload_identity_provider: ${{ vars.GCP_WORKLOAD_IDENTITY_PROVIDER }}
      service_account: ${{ vars.GCP_SERVICE_ACCOUNT }}
```

The reusable OIDC action is preparation only. No Workload Identity Pool, Provider, service account, billing link, or cloud resource was created. A future deployment workflow must provide its own configured provider and dedicated least-privilege service account. No live cloud authentication or deployment runs in this milestone.

## Validation

- `pnpm test:engineering-gates`: 17/17 passed. Tests cover sensitive CODEOWNERS paths, the absence of a global wildcard, the OIDC action SHA pin, required explicit inputs, credential-file cleanup, and main-ruleset code-owner review.
- `pnpm check:architecture`: passed; 13 packages checked.
- `pnpm check:syntax`: passed; 130 modules parsed.
- `pnpm scan:sensitive`: passed; 280 files checked.
- `actionlint` passed for `ci.yml`, `security-scanning.yml`, and `dependency-review.yml`.
- Gitleaks scanned 129 commits after applying the one exact-fingerprint test-fixture ignore; no leaks found.
- `git diff --check`: passed.
- Cloud federation remains intentionally unconfigured; this milestone prepares the credential-free OIDC path without provisioning cloud identities.
- GitHub merge evidence: PR #65 merged at `b89086a3d0be4b79411cc33d35372615b483d7d9`; all required checks passed for head `fb8bd07b5231747c9506b0b256ae814e5d915179`.

## Sources

- [Google GitHub Action for Cloud authentication](https://github.com/google-github-actions/auth/tree/7c6bc770dae815cd3e89ee6cdf493a5fab2cc093)
- [Google authentication action setup and Workload Identity Federation](https://github.com/google-github-actions/auth/blob/7c6bc770dae815cd3e89ee6cdf493a5fab2cc093/README.md)
- [GitHub CODEOWNERS documentation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
