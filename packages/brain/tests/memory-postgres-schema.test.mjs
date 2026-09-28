import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const schemaPath = resolve(dirname(fileURLToPath(import.meta.url)), '../migrations/0001_canonical_memory.sql');
const sql = await readFile(schemaPath, 'utf8');

test('draft SQL scopes project, session, task, and global records explicitly', () => {
  assert.match(sql, /scope = 'GLOBAL' and project_id is null and scope_id = 'global'/i);
  assert.match(sql, /scope = 'PROJECT' and project_id is not null and scope_id = project_id/i);
  assert.match(sql, /scope in \('SESSION', 'TASK'\) and project_id is not null/i);
  assert.match(sql, /valid_until is null or valid_until > valid_from/i);
  assert.match(sql, /status not in \('VERIFIED', 'CANONICAL'\) or cardinality\(evidence_ids\) > 0/i);
});

test('draft SQL keeps lifecycle and usage events append-only', () => {
  assert.match(sql, /create table if not exists nexus_memory_events/i);
  assert.match(sql, /create trigger %i before update or delete on %i for each row execute function nexus_reject_memory_event_mutation\(\)/i);
  assert.match(sql, /revoke update, delete on %i from public/i);
  assert.match(sql, /'nexus_research_runs', 'nexus_evidence_records', 'nexus_evidence_sightings', 'nexus_memory_events'/i);
  assert.match(sql, /'RECALLED'.*'SELECTED'.*'INJECTED'.*'USED'.*'VALIDATED'.*'CONTRIBUTED'/s);
  assert.doesNotMatch(sql, /create extension .*vector/i);
  assert.doesNotMatch(sql, /drop table|truncate table|delete from/i);
});
