import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve('infra/cloud/tofu');

function readConfiguration() {
  assert.ok(existsSync(root), 'NB-03 OpenTofu configuration must exist');
  return readdirSync(root)
    .filter((entry) => entry.endsWith('.tf'))
    .map((entry) => readFileSync(path.join(root, entry), 'utf8'))
    .join('\n');
}

test('NB-03 cloud IaC remains a historical proposal with no active provisioning authorization', () => {
  const config = readConfiguration();
  const referenceReadme = readFileSync('infra/cloud/tofu/README.md', 'utf8');

  assert.match(referenceReadme, /Historical NB-03 cloud proposal — do not apply/);
  assert.match(referenceReadme, /Do not link billing[\s\S]*run `tofu plan`\/`tofu apply`/);
  assert.match(config, /variable\s+"project_id"/);
  assert.match(config, /europe-west1/);
  assert.match(config, /prefix\s*=\s*"nexus-\$\{var\.environment\}"/);
  assert.match(config, /billingbudgets\.googleapis\.com/);
  assert.match(config, /run\.googleapis\.com/);
  assert.match(config, /sqladmin\.googleapis\.com/);
  assert.match(config, /storage\.googleapis\.com/);
  assert.match(config, /secretmanager\.googleapis\.com/);
  assert.match(config, /artifactregistry\.googleapis\.com/);
  assert.match(config, /iam\.googleapis\.com/);
  assert.match(config, /cloudresourcemanager\.googleapis\.com/);
  assert.match(config, /serviceusage\.googleapis\.com/);
  assert.match(config, /logging\.googleapis\.com/);
  assert.match(config, /monitoring\.googleapis\.com/);
  assert.doesNotMatch(config, /compute\.googleapis\.com|servicenetworking\.googleapis\.com/);
  assert.doesNotMatch(config, /billing_account\s*=\s*"[0-9]{6}-[0-9]{6}-[0-9]{6}"/);
});

test('NB-03 config separates API and worker identities and caps worker count at one', () => {
  const config = readConfiguration();

  assert.match(config, /name\s*=\s*"\$\{local\.prefix\}-hindsight-api"/);
  assert.match(config, /name\s*=\s*"\$\{local\.prefix\}-hindsight-worker"/);
  assert.match(config, /google_cloud_run_v2_worker_pool/);
  assert.match(config, /scaling\s*\{\s*scaling_mode\s*=\s*"MANUAL"\s+manual_instance_count\s*=\s*1/s);
  assert.match(config, /roles\/cloudsql\.client/);
  assert.match(config, /INGRESS_TRAFFIC_INTERNAL_ONLY/);
  assert.match(config, /max_instance_count\s*=\s*1/);
  assert.match(config, /variable\s+"enable_hindsight_runtime"[\s\S]*?default\s*=\s*false/);
  assert.match(config, /count\s*=\s*var\.enable_hindsight_runtime\s*\?\s*1\s*:\s*0/);
  assert.doesNotMatch(config, /roles\/(?:owner|editor)"/);
  assert.doesNotMatch(config, /allUsers|allAuthenticatedUsers/);
});

test('NB-03 secrets have no checked-in values or Terraform-managed secret versions', () => {
  const config = readConfiguration();

  assert.match(config, /google_secret_manager_secret/);
  assert.match(config, /postgres-operator-password/);
  assert.match(config, /sha256:[a-f0-9]{64}/);
  assert.match(config, /secret_key_ref/);
  assert.match(config, /user_managed\s*\{\s*replicas\s*\{\s*location\s*=\s*var\.region/s);
  assert.doesNotMatch(config, /secret_data\s*=|secret_string\s*=/);
  assert.doesNotMatch(config, /google_secret_manager_secret_version/);
  assert.doesNotMatch(config, /HINDSIGHT_API_LLM_API_KEY\s*=\s*"[^"$]/);
});

test('NB-03 historical cloud reference records the former resources without changing their files', () => {
  const config = readConfiguration();

  assert.match(config, /google_sql_database_instance/);
  assert.match(config, /availability_type\s*=\s*"ZONAL"/);
  assert.match(config, /disk_size\s*=\s*10/);
  assert.match(config, /google_storage_bucket/);
  assert.match(config, /tofu-state-\$\{var\.project_id\}/);
  assert.match(config, /prevent_destroy\s*=\s*true/);
  assert.match(config, /uniform_bucket_level_access\s*=\s*true/);
  assert.match(config, /google_project_iam_member/);
  assert.match(config, /monthly_budget_usd[\s\S]*?default\s*=\s*75/);
  assert.doesNotMatch(config, /google_project_iam_binding/);
});

test('NB-03 database bootstrap enables pgvector without embedding credentials', () => {
  const bootstrap = readFileSync('infra/cloud/database/hindsight-bootstrap.sql', 'utf8');

  assert.match(bootstrap, /CREATE EXTENSION IF NOT EXISTS vector/);
  assert.match(bootstrap, /ALTER DATABASE hindsight OWNER TO hindsight/);
  assert.doesNotMatch(bootstrap, /password\s*=|api[_ -]?key\s*=|postgresql:\/\/[^\s]*:[^\s]*@/i);
});
