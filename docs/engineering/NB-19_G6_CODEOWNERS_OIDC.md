# NB-19 G6: Sensitive Paths and Google Cloud OIDC

**Status:** Implementation prepared; protected merge requires a second eligible code owner.

## Sensitive path ownership

The repository owner is assigned to repository policy and automation, GitHub rulesets, cloud/IaC, contracts, and canonical engineering decisions in [`.github/CODEOWNERS`](../../.github/CODEOWNERS). The versioned main-ruleset policy requests code-owner approval for files with an owner. Live activation awaits an eligible second reviewer; other paths have no forced owner review.

The GitHub API currently lists only `trydavidqix` as a repository collaborator. The G6 PR is authored by `trydavidqix`, who cannot approve their own pull request. The G6 policy therefore needs another trusted code owner before it can merge.

PR [#65](https://github.com/trydavidqix/nexus-brain/pull/65), head `09935197a8c94b9f2ad96a3b22cebca560421c14`, passed all reported GitHub checks. The active main ruleset still has code-owner review disabled pending the owner’s reviewer decision. The proposed manifest must not merge until live enforcement can be activated safely.

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

Read-only inventory confirmed `gcloud` targets the Nexus project. It has zero global Workload Identity pools and two existing service accounts named for Gemini API keys. No credential values or keys were read. Those service accounts were not reused for CI authentication. No Workload Identity Pool, Provider, service account, billing link, or cloud resource was created. The path is prepared for a future authorized workflow; live federation remains unverified until a dedicated service account and provider exist.

## Validation

- `pnpm test:engineering-gates`: 17/17 passed. Tests cover sensitive CODEOWNERS paths, the absence of a global wildcard, the OIDC action SHA pin, required explicit inputs, credential-file cleanup, and main-ruleset code-owner review.
- `pnpm check:architecture`: passed; 13 packages checked.
- `pnpm check:syntax`: passed; 130 modules parsed.
- `pnpm scan:sensitive`: passed; 280 files checked.
- `actionlint` passed for `ci.yml`, `security-scanning.yml`, and `dependency-review.yml`.
- Gitleaks scanned 129 commits after applying the one exact-fingerprint test-fixture ignore; no leaks found.
- `git diff --check`: passed.
- Live GCP federation was not attempted; no provider or service account is configured.

## Sources

- [Google GitHub Action for Cloud authentication](https://github.com/google-github-actions/auth/tree/7c6bc770dae815cd3e89ee6cdf493a5fab2cc093)
- [Google authentication action setup and Workload Identity Federation](https://github.com/google-github-actions/auth/blob/7c6bc770dae815cd3e89ee6cdf493a5fab2cc093/README.md)
- [GitHub CODEOWNERS documentation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
