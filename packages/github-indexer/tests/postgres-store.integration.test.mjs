import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { PostgresGitHubIndexStore } from '../src/postgres-store.mjs';
import { createGitHubIndexer } from '../src/indexer.mjs';
import { createGitHubWebhookServer } from '../src/webhook-http.mjs';

const { Pool } = pg;
const configPath = process.env.NEXUS_PG0_INSTANCE_CONFIG || join(process.env.USERPROFILE || homedir(), '.pg0', 'instances', 'nexus-dev', 'instance.json');
let instance;
try { instance = JSON.parse(await readFile(configPath, 'utf8')); } catch { instance = null; }

test('pg0 migrations, webhook idempotency and branch provenance are durable', { skip: !instance && 'local pg0 configuration unavailable' }, async () => {
  const admin = new Pool({ host: '127.0.0.1', port: Number(instance.port), user: instance.username, password: instance.password, database: instance.database, max: 1, connectionTimeoutMillis: 3000, ssl: false });
  const schema = `nexus_nb06_it_${randomBytes(6).toString('hex')}`;
  let store; let webhookServer;
  try {
    await admin.query(`create schema "${schema}"`);
    const pool = new Pool({ host: '127.0.0.1', port: Number(instance.port), user: instance.username, password: instance.password, database: instance.database, max: 2, connectionTimeoutMillis: 3000, ssl: false, options: `-c search_path=${schema}` });
    store = new PostgresGitHubIndexStore(pool);
    assert.deepEqual(await store.migrate(), { applied: true, version: '0004_github_indexer' });
    assert.deepEqual(await store.migrate(), { applied: false, version: '0004_github_indexer' });

    const startedAt = new Date().toISOString();
    const delivery = { deliveryId: 'integration-delivery', eventName: 'push', payloadHash: 'a'.repeat(64), startedAt };
    assert.equal(await store.beginDelivery(delivery), true);
    assert.equal(await store.beginDelivery({ ...delivery, startedAt: new Date(Date.now() + 10).toISOString() }), false);
    await assert.rejects(store.beginDelivery({ ...delivery, payloadHash: 'b'.repeat(64) }), /webhook_delivery_id_reused/);
    await store.completeDelivery('integration-delivery', new Date().toISOString());
    assert.equal(await store.beginDelivery({ ...delivery, startedAt: new Date().toISOString() }), false);

    const firstSha = 'a'.repeat(40); const nextSha = 'b'.repeat(40);
    const commit = (sha, message, committedAt) => ({ sha, message, author: 'synthetic', committedAt, url: null });
    const webhookSecret = 'synthetic-only-webhook-secret';
    const repository = { projectId: 'synthetic-project', owner: 'owner', name: 'repo', defaultBranch: 'main' };
    const github = { async listBranches() { return [{ name: 'main', commitSha: nextSha }]; }, async listCommits(_repo, _branch, options) { if (options.stopAtHead) return [commit(nextSha, 'second', '2026-09-28T03:01:00Z')]; assert.deepEqual(options, { untilSha: firstSha }); return [commit(nextSha, 'second', '2026-09-28T03:01:00Z'), commit(firstSha, 'first', '2026-09-28T03:00:00Z')]; } };
    const indexer = createGitHubIndexer({ store, repositories: [repository], webhookSecret, github, now: () => '2026-09-28T03:02:00Z' });
    webhookServer = createGitHubWebhookServer({ indexer });
    const address = await webhookServer.listen();
    const push = Buffer.from(JSON.stringify({ ref: 'refs/heads/main', before: '0'.repeat(40), after: firstSha, repository: { full_name: 'owner/repo' }, commits: [{ id: firstSha, message: 'first', timestamp: '2026-09-28T03:00:00Z', author: { username: 'synthetic' } }] }));
    const signature = `sha256=${createHmac('sha256', webhookSecret).update(push).digest('hex')}`;
    const sendPush = () => fetch(`http://127.0.0.1:${address.port}/webhooks/github`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-github-delivery': 'pg0-push-delivery', 'x-github-event': 'push', 'x-hub-signature-256': signature }, body: push });
    const deliveries = await Promise.all([sendPush(), sendPush()]);
    assert.deepEqual(deliveries.map(response => response.status), [202, 202]);
    assert.deepEqual((await Promise.all(deliveries.map(response => response.json()))).map(result => result.status).sort(), ['duplicate', 'processed']);
    await indexer.reconcile();
    await store.recordBranchSnapshot({ projectId: 'synthetic-project', repository: 'owner/repo', branch: 'main', beforeSha: null, headSha: firstSha, observedAt: '2026-09-28T03:03:00Z', source: 'webhook', deliveryId: 'stale-delivery', commits: [commit(firstSha, 'first', '2026-09-28T03:00:00Z')] });
    assert.equal((await store.getBranchHead('synthetic-project', 'owner/repo', 'main')).sha, nextSha);
    const deletion = Buffer.from(JSON.stringify({ ref: 'refs/heads/main', before: nextSha, after: '0'.repeat(40), deleted: true, repository: { full_name: 'owner/repo' }, commits: [] }));
    const deletionSignature = `sha256=${createHmac('sha256', webhookSecret).update(deletion).digest('hex')}`;
    const deletionResponse = await fetch(`http://127.0.0.1:${address.port}/webhooks/github`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-github-delivery': 'pg0-delete-delivery', 'x-github-event': 'push', 'x-hub-signature-256': deletionSignature }, body: deletion });
    assert.equal(deletionResponse.status, 202);
    assert.equal((await store.getBranchHead('synthetic-project', 'owner/repo', 'main')), null);
    await store.recordBranchSnapshot({ projectId: 'synthetic-project', repository: 'owner/repo', branch: 'feature/removed', beforeSha: null, headSha: firstSha, observedAt: '2026-09-28T03:01:00Z', source: 'webhook', deliveryId: 'seed-removed', commits: [commit(firstSha, 'first', '2026-09-28T03:00:00Z')] });
    await indexer.reconcile();
    assert.equal((await store.getBranchHead('synthetic-project', 'owner/repo', 'main')).sha, nextSha);
    assert.equal(await store.getBranchHead('synthetic-project', 'owner/repo', 'feature/removed'), null);
    const counts = await store.pool.query('select (select count(*) from nexus_github_commits) as commits, (select count(*) from nexus_github_branch_observations) as observations, (select count(*) from nexus_github_branch_commits) as relations');
    assert.deepEqual(Object.values(counts.rows[0]).map(Number), [2, 3, 3]);
  } finally {
    await webhookServer?.close().catch(() => {});
    await store?.close().catch(() => {});
    await admin.query(`drop schema "${schema}" cascade`).catch(() => {});
    await admin.end();
  }
});
