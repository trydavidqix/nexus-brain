import assert from 'node:assert/strict';
import test from 'node:test';
import { openWireFeed } from '../src/wire.mjs';

test('remote Wire feed requires a certificate pin before opening a TLS socket', async () => {
  await assert.rejects(
    openWireFeed({ host: '198.51.100.10', port: 0, token: 'test-token' }, 'workspace-test', () => {}),
    /Wire certificate pin required/
  );
});
