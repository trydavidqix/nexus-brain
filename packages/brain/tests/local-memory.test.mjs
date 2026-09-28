import assert from 'node:assert/strict';
import test from 'node:test';
import { createLocalHindsightMemoryEngine } from '../src/local-memory.mjs';

test('local runtime requires an explicit ACL authorizer before opening pg0', async () => {
  await assert.rejects(createLocalHindsightMemoryEngine(), /explicit ACL read authorizer/);
});
