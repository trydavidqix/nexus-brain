import { readFile } from 'node:fs/promises';

const MIGRATION_VERSION = '0004_github_indexer';
const MIGRATION = new URL('../migrations/0004_github_indexer.sql', import.meta.url);

export class PostgresGitHubIndexStore {
  constructor(pool) {
    if (!pool?.connect || !pool?.query) throw new Error('github_index_postgres_pool_invalid');
    this.pool = pool;
  }

  async migrate() {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('create table if not exists nexus_schema_migrations (version text primary key, applied_at timestamptz not null default now())');
      const existing = await client.query('select version from nexus_schema_migrations where version = $1', [MIGRATION_VERSION]);
      if (existing.rowCount === 0) {
        await client.query(await readFile(MIGRATION, 'utf8'));
        await client.query('insert into nexus_schema_migrations(version) values ($1)', [MIGRATION_VERSION]);
      }
      await client.query('COMMIT');
      return { applied: existing.rowCount === 0, version: MIGRATION_VERSION };
    } catch {
      await client.query('ROLLBACK').catch(() => {});
      throw new Error('github_index_migration_failed');
    } finally { client.release(); }
  }

  async beginDelivery({ deliveryId, eventName, payloadHash, startedAt }) {
    const inserted = await this.pool.query(
      `insert into nexus_github_webhook_deliveries (delivery_id, event_name, payload_sha256, status, started_at)
       values ($1, $2, $3, 'PROCESSING', $4)
       on conflict (delivery_id) do update set status = 'PROCESSING', started_at = excluded.started_at, attempts = nexus_github_webhook_deliveries.attempts + 1
       where nexus_github_webhook_deliveries.payload_sha256 = excluded.payload_sha256
         and nexus_github_webhook_deliveries.status = 'PROCESSING'
         and nexus_github_webhook_deliveries.started_at < now() - interval '5 minutes'
       returning delivery_id`, [deliveryId, eventName, payloadHash, startedAt]);
    if (inserted.rowCount === 1) return true;
    const current = await this.pool.query('select payload_sha256 from nexus_github_webhook_deliveries where delivery_id = $1', [deliveryId]);
    if (current.rows[0] && current.rows[0].payload_sha256 !== payloadHash) throw new Error('webhook_delivery_id_reused');
    return false;
  }

  async completeDelivery(deliveryId, completedAt) {
    const result = await this.pool.query("update nexus_github_webhook_deliveries set status = 'COMPLETED', completed_at = $2 where delivery_id = $1 and status = 'PROCESSING'", [deliveryId, completedAt]);
    if (result.rowCount !== 1) throw new Error('webhook_delivery_state_invalid');
  }

  async releaseDelivery(deliveryId) {
    await this.pool.query("delete from nexus_github_webhook_deliveries where delivery_id = $1 and status = 'PROCESSING'", [deliveryId]);
  }

  async recordBranchSnapshot(snapshot) {
    if (!snapshot || typeof snapshot.projectId !== 'string' || !snapshot.projectId || typeof snapshot.repository !== 'string' || typeof snapshot.branch !== 'string' || !/^[a-f0-9]{40,64}$/.test(snapshot.headSha) || !['webhook', 'reconciliation'].includes(snapshot.source) || !Array.isArray(snapshot.commits)) throw new Error('github_branch_snapshot_invalid');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `insert into nexus_github_branch_observations (project_id, repository, branch, head_sha, first_observed_at, last_observed_at, source)
         values ($1,$2,$3,$4,$5,$5,$6)
         on conflict (project_id, repository, branch, head_sha) do update set last_observed_at = greatest(nexus_github_branch_observations.last_observed_at, excluded.last_observed_at)`,
        [snapshot.projectId, snapshot.repository, snapshot.branch, snapshot.headSha, snapshot.observedAt, snapshot.source]);
      await client.query(
        `insert into nexus_github_branch_heads (project_id, repository, branch, head_sha, observed_at, source, delivery_id, deleted_at)
         values ($1,$2,$3,$4,$5,$6,$7,null)
         on conflict (project_id, repository, branch) do update set head_sha = excluded.head_sha, observed_at = excluded.observed_at, source = excluded.source, delivery_id = excluded.delivery_id, deleted_at = null
         where (nexus_github_branch_heads.deleted_at is null or nexus_github_branch_heads.deleted_at <= excluded.observed_at)
           and ((excluded.source = 'reconciliation' and nexus_github_branch_heads.observed_at <= excluded.observed_at)
             or (nexus_github_branch_heads.deleted_at is null and nexus_github_branch_heads.head_sha = $8)
             or (nexus_github_branch_heads.deleted_at is null and nexus_github_branch_heads.head_sha = excluded.head_sha)
             or nexus_github_branch_heads.deleted_at is not null)`,
        [snapshot.projectId, snapshot.repository, snapshot.branch, snapshot.headSha, snapshot.observedAt, snapshot.source, snapshot.deliveryId, snapshot.beforeSha]);
      for (const commit of snapshot.commits) {
        if (!/^[a-f0-9]{40,64}$/.test(commit?.sha || '') || typeof commit.message !== 'string' || typeof commit.author !== 'string' || !Number.isFinite(new Date(commit.committedAt).getTime())) throw new Error('github_commit_provenance_invalid');
        await client.query(
          `insert into nexus_github_commits (project_id, repository, commit_sha, message, author, committed_at, commit_url)
           values ($1,$2,$3,$4,$5,$6,$7) on conflict (project_id, repository, commit_sha) do nothing`,
          [snapshot.projectId, snapshot.repository, commit.sha, commit.message, commit.author, commit.committedAt, commit.url]);
        await client.query(
          `insert into nexus_github_branch_commits (project_id, repository, branch, commit_sha, observed_at)
           values ($1,$2,$3,$4,$5) on conflict (project_id, repository, branch, commit_sha) do nothing`,
          [snapshot.projectId, snapshot.repository, snapshot.branch, commit.sha, snapshot.observedAt]);
      }
      await client.query('COMMIT');
    } catch {
      await client.query('ROLLBACK').catch(() => {});
      throw new Error('github_branch_snapshot_persist_failed');
    } finally { client.release(); }
  }

  async recordBranchDeletion({ projectId, repository, branch, beforeSha, deletedAt, deliveryId }) {
    if (typeof projectId !== 'string' || !projectId || typeof repository !== 'string' || typeof branch !== 'string' || !/^[a-f0-9]{40,64}$/.test(beforeSha || '') || typeof deletedAt !== 'string' || typeof deliveryId !== 'string') throw new Error('github_branch_deletion_invalid');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `update nexus_github_branch_heads set deleted_at = $5, observed_at = $5, source = 'webhook', delivery_id = $6
         where project_id = $1 and repository = $2 and branch = $3 and head_sha = $4 and deleted_at is null`,
        [projectId, repository, branch, beforeSha, deletedAt, deliveryId]);
      if (result.rowCount === 1) {
        await client.query(
        `update nexus_github_branch_observations set last_observed_at = greatest(last_observed_at, $5)
         where project_id = $1 and repository = $2 and branch = $3 and head_sha = $4`,
        [projectId, repository, branch, beforeSha, deletedAt]);
      }
      await client.query('COMMIT');
      return { deleted: result.rowCount === 1 };
    } catch {
      await client.query('ROLLBACK').catch(() => {});
      throw new Error('github_branch_deletion_persist_failed');
    } finally {
      client.release();
    }
  }

  async markMissingBranches({ projectId, repository, presentBranches, observedAt }) {
    if (typeof projectId !== 'string' || !projectId || typeof repository !== 'string' || !Array.isArray(presentBranches) || presentBranches.some(branch => typeof branch !== 'string' || !branch) || typeof observedAt !== 'string') throw new Error('github_branch_reconciliation_invalid');
    const result = await this.pool.query(
      `update nexus_github_branch_heads set deleted_at = $4, source = 'reconciliation', delivery_id = null
       where project_id = $1 and repository = $2 and deleted_at is null
         and not (branch = any($3::text[])) and observed_at <= $4`,
      [projectId, repository, presentBranches, observedAt]);
    return { deletedBranches: result.rowCount };
  }

  async getBranchHead(projectId, repository, branch) {
    const result = await this.pool.query('select head_sha, observed_at from nexus_github_branch_heads where project_id = $1 and repository = $2 and branch = $3 and deleted_at is null', [projectId, repository, branch]);
    return result.rows[0] ? { sha: result.rows[0].head_sha, observedAt: result.rows[0].observed_at } : null;
  }

  async close() { await this.pool.end(); }
}
