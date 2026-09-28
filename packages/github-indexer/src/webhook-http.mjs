import { createServer } from 'node:http';

const MAX_BYTES = 1_048_576;
const CLIENT_ERRORS = new Set(['webhook_payload_invalid', 'webhook_payload_too_large', 'webhook_delivery_id_invalid', 'webhook_signature_invalid', 'repository_not_registered', 'push_payload_invalid', 'push_payload_commits_invalid', 'webhook_delivery_id_reused']);

export function createGitHubWebhookServer({ indexer, host = '127.0.0.1', port = 0, maxPayloadBytes = MAX_BYTES }) {
  if (!indexer || typeof indexer.handleWebhook !== 'function') throw new Error('github_webhook_indexer_invalid');
  if (!['127.0.0.1', '::1'].includes(host) || !Number.isInteger(port) || port < 0 || port > 65535 || !Number.isInteger(maxPayloadBytes) || maxPayloadBytes < 1 || maxPayloadBytes > MAX_BYTES) throw new Error('github_webhook_server_config_invalid');
  const server = createServer(async (request, response) => {
    if (request.method !== 'POST' || request.url !== '/webhooks/github') {
      response.writeHead(404).end();
      return;
    }
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] || '')) {
      response.writeHead(415).end();
      return;
    }
    const chunks = []; let size = 0; let oversized = false;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > maxPayloadBytes) oversized = true;
      else if (!oversized) chunks.push(chunk);
    }
    if (oversized) {
      response.writeHead(413).end();
      return;
    }
    try {
      const result = await indexer.handleWebhook({
        deliveryId: request.headers['x-github-delivery'],
        eventName: request.headers['x-github-event'],
        signature: request.headers['x-hub-signature-256'],
        rawBody: Buffer.concat(chunks),
      });
      response.writeHead(202, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({ status: result.status }));
    } catch (error) {
      const code = typeof error?.message === 'string' ? error.message : '';
      const status = code === 'webhook_signature_invalid' ? 401 : CLIENT_ERRORS.has(code) ? 400 : 503;
      response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({ error: CLIENT_ERRORS.has(code) ? code : 'github_webhook_temporarily_unavailable' }));
    }
  });
  return {
    server,
    async listen() {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, resolve);
      });
      return server.address();
    },
    async close() {
      if (!server.listening) return;
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    },
  };
}

export function createReconciliationScheduler({ indexer, intervalMs, onError = () => {} }) {
  if (!indexer || typeof indexer.reconcile !== 'function' || !Number.isInteger(intervalMs) || intervalMs < 60_000 || typeof onError !== 'function') throw new Error('github_reconciliation_scheduler_config_invalid');
  let timer = null; let stopped = true; let running = null;
  const run = async () => {
    if (stopped || running) return running;
    running = Promise.resolve().then(() => indexer.reconcile()).catch(error => { onError(error); }).finally(() => { running = null; });
    return running;
  };
  const schedule = () => {
    if (stopped) return;
    timer = setTimeout(async () => { await run(); schedule(); }, intervalMs);
    timer.unref?.();
  };
  return {
    async start({ runImmediately = true } = {}) {
      if (!stopped) return;
      stopped = false;
      if (runImmediately) await run();
      schedule();
    },
    async stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
      await running;
    },
  };
}
