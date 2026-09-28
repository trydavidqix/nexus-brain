import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createGitHubWebhookServer } from '../src/webhook-http.mjs';

test('local webhook HTTP endpoint acknowledges valid requests and sanitizes provider errors', async () => {
  const seen = [];
  const server = createGitHubWebhookServer({ indexer: { async handleWebhook(event) { seen.push(event); if (event.deliveryId === 'internal-error') throw new Error('storage password leaked'); return { status: 'processed' }; } } });
  const address = await server.listen();
  try {
    const body = Buffer.from('{"synthetic":true}');
    const signature = `sha256=${createHmac('sha256', 'synthetic-secret').update(body).digest('hex')}`;
    const response = await fetch(`http://127.0.0.1:${address.port}/webhooks/github`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-github-delivery': 'd-1', 'x-github-event': 'push', 'x-hub-signature-256': signature }, body });
    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), { status: 'processed' });
    const failed = await fetch(`http://127.0.0.1:${address.port}/webhooks/github`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-github-delivery': 'internal-error', 'x-github-event': 'push', 'x-hub-signature-256': signature }, body });
    assert.equal(failed.status, 503);
    assert.equal(await failed.text(), '{"error":"github_webhook_temporarily_unavailable"}');
    assert.equal(seen.length, 2);
  } finally { await server.close(); }
});

test('local webhook endpoint enforces route, content type, and payload cap', async () => {
  const server = createGitHubWebhookServer({ indexer: { async handleWebhook() { throw new Error('must_not_run'); } }, maxPayloadBytes: 32 });
  const address = await server.listen();
  try {
    const root = `http://127.0.0.1:${address.port}`;
    assert.equal((await fetch(`${root}/unknown`, { method: 'POST' })).status, 404);
    assert.equal((await fetch(`${root}/webhooks/github`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'x' })).status, 415);
    assert.equal((await fetch(`${root}/webhooks/github`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'x'.repeat(33) })).status, 413);
  } finally { await server.close(); }
});

test('webhook server refuses non-loopback binds by default', () => {
  assert.throws(() => createGitHubWebhookServer({ indexer: { handleWebhook() {} }, host: '0.0.0.0' }), /github_webhook_server_config_invalid/);
});
