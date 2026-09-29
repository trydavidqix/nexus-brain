import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import { validateContract } from '@nexus-brain/contracts';

const MIGRATIONS = [
  { version: '0001_canonical_memory', file: new URL('../migrations/0001_canonical_memory.sql', import.meta.url) },
  { version: '0002_memory_scope_bindings', file: new URL('../migrations/0002_memory_scope_bindings.sql', import.meta.url) },
  { version: '0003_research_provenance', file: new URL('../migrations/0003_research_provenance.sql', import.meta.url) }
];

export async function createLocalPg0MemoryStore({ instanceConfigPath, authorizePromotion } = {}) {
  const configPath = instanceConfigPath || process.env.NEXUS_PG0_INSTANCE_CONFIG || join(process.env.USERPROFILE || homedir(), '.pg0', 'instances', 'nexus-dev', 'instance.json');
  let instance;
  try { instance = JSON.parse(await readFile(configPath, 'utf8')); } catch { throw new Error('Local pg0 instance metadata is unavailable. Start Hindsight/pg0 and verify the local installation.'); }
  const port = Number(instance.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !instance.username || !instance.password || !instance.database) throw new Error('Local pg0 instance metadata is incomplete.');
  const pool = new Pool({ host: '127.0.0.1', port, user: instance.username, password: instance.password, database: instance.database, max: 3, connectionTimeoutMillis: 3000, idleTimeoutMillis: 30000, ssl: false });
  return new PostgresMemoryStore(pool, { authorizePromotion });
}

export class PostgresMemoryStore {
  constructor(pool, { authorizePromotion = async () => false } = {}) { if (!pool?.connect || !pool?.query) throw new Error('A PostgreSQL-compatible pool is required.'); if (typeof authorizePromotion !== 'function') throw new Error('Memory promotion requires an explicit validation authorizer.'); this.pool = pool; this.authorizePromotion = authorizePromotion; }

  async migrate() {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('CREATE TABLE IF NOT EXISTS nexus_schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
      let appliedVersion = null;
      for (const migration of MIGRATIONS) {
        const prior = await client.query('SELECT version FROM nexus_schema_migrations WHERE version = $1', [migration.version]);
        if (prior.rowCount > 0) continue;
        await client.query(await readFile(migration.file, 'utf8'));
        await client.query('INSERT INTO nexus_schema_migrations(version) VALUES ($1)', [migration.version]);
        appliedVersion = migration.version;
      }
      await client.query('COMMIT');
      return { applied: appliedVersion !== null, version: appliedVersion || MIGRATIONS.at(-1).version };
    } catch { await client.query('ROLLBACK').catch(() => {}); throw new Error('Nexus canonical memory migration failed; no migration was recorded.'); }
    finally { client.release(); }
  }

  async health() {
    try { await this.pool.query('SELECT 1'); return { healthy: true }; }
    catch { return { healthy: false }; }
  }

  async persistResearchRun(run) {
    if (!validateContract('research-run', run).valid) throw new Error('Research run failed the versioned research-run contract.');
    const result = await this.pool.query(
      'INSERT INTO nexus_research_runs (run_id, project_id, task_id, agent_id, status, started_at, completed_at, evidence_ids, warnings, limits, budget, provenance, summary) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (run_id) DO NOTHING RETURNING run_id',
      [run.run_id, run.project_id, run.task_id, run.agent_id, run.status, run.started_at, run.completed_at, run.evidence_ids, run.warnings, run.limits, run.budget, run.provenance, run.summary ?? null]
    );
    return { inserted: result.rowCount === 1, run_id: run.run_id };
  }

  async persistEvidence(evidence) {
    if (!validateContract('evidence', evidence).valid || !evidence.content_hash) throw new Error('Evidence failed the versioned evidence contract or lacks a content hash.');
    const result = await this.pool.query(
      'INSERT INTO nexus_evidence_records (evidence_id, project_id, run_id, source, provider, capability, url, canonical_url, title, body, snippet, author, published_at, fetched_at, content_hash, trust_level, provenance, metadata, engagement, relevance, freshness, authority, query, extraction_method, backend) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25) ON CONFLICT (evidence_id) DO NOTHING RETURNING evidence_id',
      [evidence.evidence_id, evidence.project_id, evidence.run_id, evidence.source, evidence.provider, evidence.capability, evidence.url ?? null, evidence.canonical_url ?? null, evidence.title ?? null, evidence.body ?? null, evidence.snippet ?? null, evidence.author ?? null, evidence.published_at ?? null, evidence.fetched_at, evidence.content_hash, evidence.trust_level, evidence.provenance, evidence.metadata ?? {}, evidence.engagement ?? null, evidence.relevance ?? null, evidence.freshness ?? null, evidence.authority ?? null, evidence.query ?? null, evidence.extraction_method ?? null, evidence.backend ?? null]
    );
    return { inserted: result.rowCount === 1, evidence_id: evidence.evidence_id };
  }

  async recordEvidenceSighting(sighting) {
    if (!validateContract('memory-sighting', sighting).valid) throw new Error('Evidence sighting failed the versioned memory-sighting contract.');
    const result = await this.pool.query(
      'INSERT INTO nexus_evidence_sightings (sighting_id, evidence_id, project_id, run_id, observed_at, source, content_hash, provenance, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (sighting_id) DO NOTHING RETURNING sighting_id',
      [sighting.sighting_id, sighting.evidence_id, sighting.project_id, sighting.run_id, sighting.observed_at, sighting.source, sighting.content_hash, sighting.provenance, sighting.metadata ?? {}]
    );
    return { inserted: result.rowCount === 1, sighting_id: sighting.sighting_id };
  }

  async searchEvidence({ project_id, task_id, agent_id, query, limit = 10 } = {}) {
    if (!project_id || !task_id || !agent_id || typeof query !== 'string' || !query.trim()) throw new Error('Research evidence lookup requires project, task, agent, and query scope.');
    const boundedLimit = Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, 100) : 10;
    const result = await this.pool.query(
      `SELECT e.evidence_id, e.project_id, e.run_id, e.source, e.provider, e.capability,
        e.url, e.canonical_url, e.title, e.body, e.snippet, e.author, e.published_at,
        e.fetched_at, e.engagement, e.relevance, e.freshness, e.authority, e.query,
        e.extraction_method, e.backend, e.content_hash, e.trust_level,
        e.provenance || jsonb_build_object('task_id', r.task_id, 'agent_id', r.agent_id) AS provenance
      FROM nexus_evidence_records e
      JOIN nexus_research_runs r ON r.run_id = e.run_id AND r.project_id = e.project_id
      WHERE e.project_id = $1 AND r.task_id = $2 AND r.agent_id = $3
        AND r.status IN ('OK', 'PARTIAL') AND e.trust_level = 'UNTRUSTED'
        AND position(lower($4) in lower(concat_ws(' ', e.title, e.snippet, e.body))) > 0
      ORDER BY e.relevance DESC NULLS LAST, e.fetched_at DESC, e.evidence_id
      LIMIT $5`,
      [project_id, task_id, agent_id, query.trim().slice(0, 4_000), boundedLimit]
    );
    return result.rows;
  }

  async persistRecord(record, { actor = { actor_id: 'system', actor_type: 'system' } } = {}) {
    const validation = validateContract('memory-record', record);
    if (!validation.valid) throw new Error('Canonical memory record failed the versioned memory-record contract.');
    assertScopeBindings(record);
    if (['VERIFIED', 'CANONICAL'].includes(record.status) && await this.authorizePromotion({ record }) !== true) throw new Error('Canonical memory promotion requires explicit validation approval.');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const values = [record.memory_id, record.project_id ?? null, record.scope, record.scope_id, record.status, record.content, record.content_hash, record.data_classification, record.evidence_ids, record.provenance, record.temporal.observed_at, record.temporal.recorded_at, record.temporal.valid_from, record.temporal.valid_until ?? null, record.acl, record.task_id ?? null, record.session_id ?? null, record.tags ?? [], record.supersedes ?? null, record.superseded_by ?? null, record.version];
      const saved = await client.query(
        'INSERT INTO nexus_memory_records (memory_id, project_id, scope, scope_id, status, content, content_hash, data_classification, evidence_ids, provenance, observed_at, recorded_at, valid_from, valid_until, acl, task_id, session_id, tags, supersedes, superseded_by, version) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) ON CONFLICT (memory_id) DO UPDATE SET project_id=EXCLUDED.project_id, scope=EXCLUDED.scope, scope_id=EXCLUDED.scope_id, status=EXCLUDED.status, content=EXCLUDED.content, content_hash=EXCLUDED.content_hash, data_classification=EXCLUDED.data_classification, evidence_ids=EXCLUDED.evidence_ids, provenance=EXCLUDED.provenance, observed_at=EXCLUDED.observed_at, recorded_at=EXCLUDED.recorded_at, valid_from=EXCLUDED.valid_from, valid_until=EXCLUDED.valid_until, acl=EXCLUDED.acl, task_id=EXCLUDED.task_id, session_id=EXCLUDED.session_id, tags=EXCLUDED.tags, supersedes=EXCLUDED.supersedes, superseded_by=EXCLUDED.superseded_by, version=EXCLUDED.version WHERE EXCLUDED.version > nexus_memory_records.version RETURNING memory_id, version, content_hash',
        values
      );
      if (saved.rowCount === 0) {
        const current = await client.query('SELECT version, content_hash FROM nexus_memory_records WHERE memory_id = $1', [record.memory_id]);
        if (current.rows[0]?.version !== record.version || current.rows[0]?.content_hash !== record.content_hash) throw new Error('stale-or-conflicting-version');
      }
      const event = { event_id: eventId(record.memory_id, record.version, record.status), memory_id: record.memory_id, project_id: record.project_id ?? undefined, scope: record.scope, scope_id: record.scope_id, event_type: record.status, recorded_at: record.temporal.recorded_at, valid_at: record.temporal.valid_from, task_id: record.task_id, session_id: record.session_id, agent_id: record.scope === 'TASK' ? record.provenance.actor_id : undefined, actor, provenance: { source_type: record.provenance.source_type, source_id: record.provenance.source_id, evidence_ids: record.evidence_ids, attributes: { data_classification: record.data_classification } }, payload: { version: record.version, content_hash: record.content_hash } };
      await this.insertEvent(client, event);
      await client.query('COMMIT');
      return record;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      if (error?.message === 'stale-or-conflicting-version') throw new Error('Canonical memory version is stale or conflicts with the stored version.');
      if (error?.message?.includes('memory-event')) throw error;
      throw new Error('Canonical memory transaction failed; no partial write was committed.');
    } finally { client.release(); }
  }

  async insertEvent(client, event) {
    const validation = validateContract('memory-event', event);
    if (!validation.valid) throw new Error('Canonical memory event failed the versioned memory-event contract.');
    await client.query('INSERT INTO nexus_memory_events (event_id, memory_id, project_id, scope, scope_id, event_type, recorded_at, valid_at, task_id, session_id, agent_id, trace_id, actor, provenance, payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT (event_id) DO NOTHING', [event.event_id, event.memory_id, event.project_id ?? null, event.scope, event.scope_id, event.event_type, event.recorded_at, event.valid_at ?? null, event.task_id ?? null, event.session_id ?? null, event.agent_id ?? null, event.trace_id ?? null, event.actor, event.provenance, event.payload]);
  }

  async recordEvent(event) {
    const client = await this.pool.connect();
    try { await client.query('BEGIN'); await this.insertEvent(client, event); await client.query('COMMIT'); return event; }
    catch { await client.query('ROLLBACK').catch(() => {}); throw new Error('Canonical memory event transaction failed.'); }
    finally { client.release(); }
  }

  async getByIds(ids, { project_id, scope, scope_id, session_id, task_id, agent_id } = {}) {
    if (!['GLOBAL', 'PROJECT', 'SESSION', 'TASK'].includes(scope)) throw new Error('Canonical memory lookup requires an explicit scope.');
    if (scope !== 'GLOBAL' && !project_id) throw new Error('Canonical project memory lookup requires project_id.');
    const canonicalScopeId = scope_id || (scope === 'GLOBAL' ? 'global' : scope === 'PROJECT' ? project_id : scope === 'SESSION' ? session_id : task_id);
    if (!canonicalScopeId) throw new Error('Canonical memory lookup requires scope_id.');
    if (scope === 'SESSION' && !session_id) throw new Error('Canonical session memory lookup requires session_id.');
    if (scope === 'TASK' && (!task_id || !agent_id)) throw new Error('Canonical task memory lookup requires task_id and agent_id.');
    const uniqueIds = [...new Set((ids || []).filter(value => typeof value === 'string' && value.length > 0))];
    if (!uniqueIds.length) return [];
    const result = await this.pool.query("SELECT memory_id, project_id, scope, scope_id, status, content, content_hash, data_classification, evidence_ids, provenance, observed_at, recorded_at, valid_from, valid_until, acl, task_id, session_id, tags, supersedes, superseded_by, version FROM nexus_memory_records WHERE memory_id = ANY($1::text[]) AND scope = $2 AND (($2 = 'GLOBAL' AND project_id IS NULL) OR ($2 <> 'GLOBAL' AND project_id = $3)) AND scope_id = $4 AND ($2 <> 'SESSION' OR session_id = $5) AND ($2 <> 'TASK' OR (task_id = $6 AND provenance->>'actor_id' = $7)) AND status <> ALL($8::text[]) AND (valid_until IS NULL OR valid_until > now())", [uniqueIds, scope, project_id ?? null, canonicalScopeId, session_id ?? null, task_id ?? null, agent_id ?? null, ["SUPERSEDED", "CONFLICTED", "REVOKED"]]);
    return result.rows;
  }

  async close() { await this.pool.end(); }
}

function assertScopeBindings(record) {
  const valid = record.scope === 'GLOBAL'
    ? !record.project_id && record.scope_id === 'global'
    : record.scope === 'PROJECT'
      ? Boolean(record.project_id) && record.scope_id === record.project_id
      : record.scope === 'SESSION'
        ? Boolean(record.project_id && record.session_id) && record.scope_id === record.session_id
        : record.scope === 'TASK'
          ? Boolean(record.project_id && record.task_id && record.provenance.actor_id) && record.scope_id === record.task_id
          : false;
  if (!valid) throw new Error('Canonical memory scope identifiers do not match the record scope.');
}

function eventId(memoryId, version, eventType) { return 'memory-' + memoryId + ':' + version + ':' + eventType; }
