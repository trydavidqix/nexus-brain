# Historical NB-03 cloud proposal — do not apply

This directory preserves the superseded paid Google Cloud proposal for reference. The owner canceled it in favor of zero additional monthly cost on local infrastructure.

**Do not link billing, enable APIs, set project credentials, initialize a cloud backend, or run `tofu plan`/`tofu apply` for Nexus using this directory.** The files still describe Cloud SQL, Cloud Run, Cloud Storage, Secret Manager, Artifact Registry, IAM and billing budgets. They are not the active NB-03 architecture or authorization to provision anything.

The active DEV setup is [local Hindsight with pg0](../../local/hindsight/README.md). Any future cloud design requires a new explicit owner decision and cost approval; PROD is out of scope.
