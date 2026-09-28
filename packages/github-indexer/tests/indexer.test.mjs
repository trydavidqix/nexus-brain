import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createGitHubIndexer, verifyWebhookSignature } from '../src/indexer.mjs';
import { createGitHubRestClient } from '../src/github-client.mjs';
import { createReconciliationScheduler } from '../src/webhook-http.mjs';

const repository = { projectId: 'nexus-project', owner: 'trydavidqix', name: 'nexus-brain', defaultBranch: 'main' };
const commits = [{ sha: 'a'.repeat(40), message: 'feat: add indexer', author: 'david', committedAt: '2026-09-28T00:00:00Z', url: 'https://github.com/trydavidqix/nexus-brain/commit/' + 'a'.repeat(40) }];
function pushBody(delivery = 'delivery-1') {
  return Buffer.from(JSON.stringify({ ref: 'refs/heads/main', after: commits[0].sha, repository: { full_name: 'trydavidqix/nexus-brain' }, commits: commits.map(c => ({ id: c.sha, message: c.message, timestamp: c.committedAt, url: c.url, author: { username: c.author } })) }));
}
function signed(body, secret = 'test-webhook-secret') { return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`; }

function fixture() {
  const deliveries = new Map(); const snapshots = []; const deletions = []; const missing = []; const heads = new Map();
  const store = {
    async beginDelivery(input) { if (deliveries.get(input.deliveryId) === 'completed') return false; if (deliveries.has(input.deliveryId)) return false; deliveries.set(input.deliveryId, 'processing'); return true; },
    async completeDelivery(id) { deliveries.set(id, 'completed'); },
    async releaseDelivery(id) { deliveries.delete(id); },
    async recordBranchSnapshot(input) { snapshots.push(input); heads.set(`${input.projectId}/${input.repository}/${input.branch}`, { sha: input.headSha }); },
    async recordBranchDeletion(input) { deletions.push(input); const key = `${input.projectId}/${input.repository}/${input.branch}`; if (heads.get(key)?.sha === input.beforeSha) heads.delete(key); },
    async markMissingBranches(input) { missing.push(input); },
    async getBranchHead(projectId, repo, branch) { return heads.get(`${projectId}/${repo}/${branch}`) || null; },
  };
  return { store, snapshots, deliveries, deletions, missing, heads };
}

function deletionBody({ branch = 'feature/old', before = commits[0].sha } = {}) {
  return Buffer.from(JSON.stringify({ ref: `refs/heads/${branch}`, before, after: '0'.repeat(40), deleted: true, repository: { full_name: 'trydavidqix/nexus-brain' }, commits: [] }));
}

test('webhook signatures use HMAC SHA-256 and reject malformed or mismatched values', () => {
  const body = pushBody();
  assert.equal(verifyWebhookSignature(body, signed(body), 'test-webhook-secret'), true);
  assert.equal(verifyWebhookSignature(body, signed(body), ''), false);
  assert.equal(verifyWebhookSignature(body, 'sha256=bad', 'test-webhook-secret'), false);
  assert.equal(verifyWebhookSignature(Buffer.from('{}'), signed(body), 'test-webhook-secret'), false);
});

test('webhook records branch/commit provenance once per delivery', async () => {
  const { store, snapshots } = fixture();
  const indexer = createGitHubIndexer({ store, repositories: [repository], webhookSecret: 'test-webhook-secret', now: () => '2026-09-28T01:00:00Z' });
  const body = pushBody();
  const first = await indexer.handleWebhook({ deliveryId: 'delivery-1', eventName: 'push', signature: signed(body), rawBody: body });
  const duplicate = await indexer.handleWebhook({ deliveryId: 'delivery-1', eventName: 'push', signature: signed(body), rawBody: body });
  assert.equal(first.status, 'processed');
  assert.equal(duplicate.status, 'duplicate');
  assert.equal(snapshots.length, 1);
  assert.deepEqual(snapshots[0], { projectId: 'nexus-project', repository: 'trydavidqix/nexus-brain', branch: 'main', beforeSha: null, headSha: commits[0].sha, observedAt: '2026-09-28T01:00:00Z', source: 'webhook', deliveryId: 'delivery-1', commits: [{ ...commits[0], committedAt: '2026-09-28T00:00:00.000Z' }] });
});

test('branch deletion webhook records a tombstone and deduplicates delivery', async () => {
  const { store, deletions, heads } = fixture();
  const indexer = createGitHubIndexer({ store, repositories: [repository], webhookSecret: 'test-webhook-secret' });
  const snapshot = { projectId: repository.projectId, repository: 'trydavidqix/nexus-brain', branch: 'feature/old', headSha: commits[0].sha };
  heads.set(`${snapshot.projectId}/${snapshot.repository}/${snapshot.branch}`, { sha: snapshot.headSha });
  const body = deletionBody({ branch: snapshot.branch });
  const event = { deliveryId: 'delete-1', eventName: 'push', signature: signed(body), rawBody: body };
  assert.deepEqual(await indexer.handleWebhook(event), { status: 'processed', repository: snapshot.repository, branch: snapshot.branch, deleted: true });
  assert.equal((await indexer.handleWebhook(event)).status, 'duplicate');
  assert.equal(deletions.length, 1);
  assert.equal(heads.has(`${snapshot.projectId}/${snapshot.repository}/${snapshot.branch}`), false);
});

test('webhook rejects untrusted signature, unknown repository, malformed ref, and oversized payload', async () => {
  const { store } = fixture(); const indexer = createGitHubIndexer({ store, repositories: [repository], webhookSecret: 'test-webhook-secret' });
  const body = pushBody();
  await assert.rejects(indexer.handleWebhook({ deliveryId: 'd1', eventName: 'push', signature: 'sha256=bad', rawBody: body }), /webhook_signature_invalid/);
  const noSecret = createGitHubIndexer({ store, repositories: [repository] });
  await assert.rejects(noSecret.handleWebhook({ deliveryId: 'd2', eventName: 'push', signature: signed(body), rawBody: body }), /webhook_signature_invalid/);
  const unknown = Buffer.from(JSON.stringify({ ref: 'refs/heads/main', after: commits[0].sha, repository: { full_name: 'attacker/other' }, commits: [] }));
  await assert.rejects(indexer.handleWebhook({ deliveryId: 'd3', eventName: 'push', signature: signed(unknown), rawBody: unknown }), /repository_not_registered/);
  const malformed = Buffer.from(JSON.stringify({ ref: 'refs/tags/v1', after: commits[0].sha, repository: { full_name: 'trydavidqix/nexus-brain' }, commits: [] }));
  await assert.rejects(indexer.handleWebhook({ deliveryId: 'd4', eventName: 'push', signature: signed(malformed), rawBody: malformed }), /push_payload_invalid/);
  const large = Buffer.alloc(1_048_577, 32);
  await assert.rejects(indexer.handleWebhook({ deliveryId: 'd5', eventName: 'push', signature: signed(large), rawBody: large }), /webhook_payload_too_large/);
});

test('failed webhook releases delivery claim so GitHub retry can safely process it', async () => {
  const { store, snapshots, deliveries } = fixture(); let fail = true;
  const base = store.recordBranchSnapshot;
  store.recordBranchSnapshot = async input => { if (fail) throw new Error('storage_unavailable'); return base(input); };
  const indexer = createGitHubIndexer({ store, repositories: [repository], webhookSecret: 'test-webhook-secret' });
  const body = pushBody(); const event = { deliveryId: 'retry-1', eventName: 'push', signature: signed(body), rawBody: body };
  await assert.rejects(indexer.handleWebhook(event), /storage_unavailable/);
  assert.equal(deliveries.has('retry-1'), false);
  fail = false;
  assert.equal((await indexer.handleWebhook(event)).status, 'processed');
  assert.equal(snapshots.length, 1);
});

test('scheduled reconciliation is repeatable and records observed branch and commits', async () => {
  const { store, snapshots, missing } = fixture();
  const featureCommit = { ...commits[0], sha: 'b'.repeat(40), message: 'feat: branch inventory' };
  const client = { async listBranches() { return [{ name: 'main', commitSha: commits[0].sha }, { name: 'feature/indexer', commitSha: featureCommit.sha }]; }, async listCommits(_repo, branch, options) { assert.ok(options.stopAtHead || options.untilSha); return branch === 'main' ? commits : [featureCommit]; } };
  const indexer = createGitHubIndexer({ store, repositories: [repository], github: client, now: () => '2026-09-28T02:00:00Z' });
  const one = await indexer.reconcile(); const two = await indexer.reconcile();
  assert.deepEqual(one, { repositories: 1, branches: 2, commits: 2 });
  assert.deepEqual(two, one);
  assert.equal(snapshots.length, 4);
  assert.equal(snapshots[0].source, 'reconciliation');
  assert.equal(snapshots[0].headSha, commits[0].sha);
  assert.equal(snapshots[1].branch, 'feature/indexer');
  assert.equal(missing.length, 2);
  assert.deepEqual(missing[0].presentBranches, ['main', 'feature/indexer']);
});

test('reconciliation rejects incomplete or ambiguous branch inventory before tombstoning', async () => {
  const { store, missing } = fixture();
  const client = { async listBranches() { return [{ name: 'feature/orphan', commitSha: commits[0].sha }]; }, async listCommits() { return commits; } };
  const indexer = createGitHubIndexer({ store, repositories: [repository], github: client });
  await assert.rejects(indexer.reconcile(), /github_default_branch_missing/);
  assert.equal(missing.length, 0);
  client.listBranches = async () => [{ name: 'main', commitSha: commits[0].sha }, { name: 'main', commitSha: commits[0].sha }];
  await assert.rejects(indexer.reconcile(), /github_branch_response_invalid/);
  assert.equal(missing.length, 0);
});

test('concurrent webhook delivery is not processed twice', async () => {
  const { store, snapshots } = fixture(); const indexer = createGitHubIndexer({ store, repositories: [repository], webhookSecret: 'test-webhook-secret' });
  const body = pushBody(); const event = { deliveryId: 'concurrent-1', eventName: 'push', signature: signed(body), rawBody: body };
  const results = await Promise.all([indexer.handleWebhook(event), indexer.handleWebhook(event)]);
  assert.equal(results.filter(result => result.status === 'processed').length, 1);
  assert.equal(results.filter(result => result.status === 'duplicate').length, 1);
  assert.equal(snapshots.length, 1);
});

test('GitHub REST client retries only safe transient GET failures with bounded backoff', async () => {
  const delays = []; let attempts = 0;
  const client = createGitHubRestClient({ fetchImpl: async (_url, init) => {
    assert.equal(init.method, 'GET');
    attempts += 1;
    return attempts === 1 ? new Response('', { status: 503, headers: { 'retry-after': '2' } }) : Response.json([{ name: 'main', commit: { sha: commits[0].sha } }]);
  }, sleep: async ms => delays.push(ms), maxRetries: 2 });
  const branches = await client.listBranches('trydavidqix/nexus-brain');
  assert.equal(attempts, 2);
  assert.deepEqual(delays, [2000]);
  assert.deepEqual(branches, [{ name: 'main', commitSha: commits[0].sha }]);
});

test('GitHub REST client does not retry permanent authorization failures', async () => {
  let attempts = 0;
  const client = createGitHubRestClient({ fetchImpl: async () => { attempts += 1; return new Response('', { status: 401 }); }, sleep: async () => {}, maxRetries: 3 });
  await assert.rejects(client.listBranches('trydavidqix/nexus-brain'), /github_http_401/);
  assert.equal(attempts, 1);
});

test('GitHub REST commit history stops at the durable checkpoint or just indexes a new head', async () => {
  const pages = []; const sizes = [];
  const rows = [0, 1].map(index => ({ sha: String.fromCharCode(97 + index).repeat(40), commit: { message: `commit ${index}`, author: { date: '2026-09-28T00:00:00Z' } }, html_url: `https://github.com/trydavidqix/nexus-brain/commit/${String.fromCharCode(97 + index).repeat(40)}` }));
  const client = createGitHubRestClient({ perPage: 2, fetchImpl: async url => { const parsed = new URL(url); pages.push(parsed.searchParams.get('page')); sizes.push(parsed.searchParams.get('per_page')); return Response.json(rows.slice(0, Number(parsed.searchParams.get('per_page')))); } });
  const incremental = await client.listCommits('trydavidqix/nexus-brain', 'main', { untilSha: rows[1].sha });
  assert.equal(incremental.length, 2);
  assert.deepEqual(pages, ['1']);
  const newHead = await client.listCommits('trydavidqix/nexus-brain', 'main', { stopAtHead: true });
  assert.equal(newHead.length, 1);
  assert.equal(sizes[1], '1');
});

test('reconciliation scheduler runs immediately, prevents overlap, and stops cleanly', async () => {
  let calls = 0; let release;
  const indexer = { reconcile: async () => { calls += 1; await new Promise(resolve => { release = resolve; }); } };
  const scheduler = createReconciliationScheduler({ indexer, intervalMs: 60_000 });
  const starting = scheduler.start();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1);
  const stopping = scheduler.stop();
  release();
  await Promise.all([starting, stopping]);
  assert.equal(calls, 1);
});
