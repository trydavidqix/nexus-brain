-- NB-04 Nexus-owned canonical records and events; Hindsight owns derived index mechanics.

create table if not exists nexus_research_runs (
  run_id text primary key,
  project_id text not null,
  task_id text not null,
  agent_id text not null,
  status text not null check (status in ('OK', 'EMPTY', 'PARTIAL', 'DEGRADED', 'BLOCKED', 'TIMEOUT')),
  started_at timestamptz not null,
  completed_at timestamptz not null check (completed_at >= started_at),
  evidence_ids text[] not null default '{}',
  warnings text[] not null default '{}',
  limits jsonb not null,
  budget jsonb not null,
  provenance jsonb not null,
  summary text
);
create index if not exists nexus_research_runs_scope_idx
  on nexus_research_runs (project_id, task_id, completed_at desc);

create table if not exists nexus_evidence_records (
  evidence_id text primary key,
  project_id text not null,
  run_id text not null references nexus_research_runs(run_id),
  source text not null,
  provider text not null,
  capability text not null,
  url text,
  canonical_url text,
  title text,
  body text,
  snippet text,
  author text,
  published_at timestamptz,
  fetched_at timestamptz not null,
  content_hash text not null,
  trust_level text not null check (trust_level = 'UNTRUSTED'),
  provenance jsonb not null,
  metadata jsonb not null default '{}',
  unique (evidence_id, project_id)
);
create index if not exists nexus_evidence_scope_idx
  on nexus_evidence_records (project_id, fetched_at desc);
create index if not exists nexus_evidence_run_idx
  on nexus_evidence_records (run_id, fetched_at desc);

create table if not exists nexus_evidence_sightings (
  sighting_id text primary key,
  evidence_id text not null,
  project_id text not null,
  run_id text not null references nexus_research_runs(run_id),
  observed_at timestamptz not null,
  source text not null,
  content_hash text not null,
  provenance jsonb not null,
  metadata jsonb not null default '{}',
  foreign key (evidence_id, project_id) references nexus_evidence_records(evidence_id, project_id)
);
create index if not exists nexus_evidence_sightings_trend_idx
  on nexus_evidence_sightings (project_id, evidence_id, observed_at desc);

create table if not exists nexus_memory_records (
  memory_id text primary key,
  project_id text,
  scope text not null check (scope in ('GLOBAL', 'PROJECT', 'SESSION', 'TASK')),
  scope_id text not null check (length(scope_id) > 0),
  status text not null check (status in ('OBSERVED', 'CANDIDATE', 'VERIFIED', 'CANONICAL', 'SUPERSEDED', 'CONFLICTED', 'REVOKED')),
  content text not null check (length(content) > 0),
  content_hash text not null check (length(content_hash) > 0),
  data_classification text not null check (data_classification in ('SYNTHETIC', 'NON_SENSITIVE', 'SENSITIVE', 'RESTRICTED')),
  evidence_ids text[] not null default '{}',
  provenance jsonb not null,
  observed_at timestamptz not null,
  recorded_at timestamptz not null,
  valid_from timestamptz not null,
  valid_until timestamptz,
  acl jsonb not null,
  task_id text,
  session_id text,
  tags text[] not null default '{}',
  supersedes text,
  superseded_by text,
  version integer not null check (version > 0),
  check (
    (scope = 'GLOBAL' and project_id is null and scope_id = 'global')
    or (scope = 'PROJECT' and project_id is not null and scope_id = project_id)
    or (scope in ('SESSION', 'TASK') and project_id is not null)
  ),
  check (valid_until is null or valid_until > valid_from),
  check (status not in ('VERIFIED', 'CANONICAL') or cardinality(evidence_ids) > 0)
);

create index if not exists nexus_memory_scope_status_idx
  on nexus_memory_records (project_id, scope, scope_id, status, recorded_at desc);
create index if not exists nexus_memory_valid_time_idx
  on nexus_memory_records (project_id, valid_from desc, valid_until);

create table if not exists nexus_memory_events (
  event_id text primary key,
  memory_id text not null references nexus_memory_records(memory_id),
  project_id text,
  scope text not null check (scope in ('GLOBAL', 'PROJECT', 'SESSION', 'TASK')),
  scope_id text not null check (length(scope_id) > 0),
  event_type text not null check (event_type in (
    'OBSERVED', 'CANDIDATE', 'VERIFIED', 'CANONICAL', 'SUPERSEDED', 'CONFLICTED', 'REVOKED',
    'RECALLED', 'SELECTED', 'INJECTED', 'USED', 'VALIDATED', 'CONTRIBUTED'
  )),
  recorded_at timestamptz not null,
  valid_at timestamptz,
  task_id text,
  session_id text,
  agent_id text,
  trace_id text,
  actor jsonb not null,
  provenance jsonb not null,
  payload jsonb not null,
  check (
    (scope = 'GLOBAL' and project_id is null and scope_id = 'global')
    or (scope = 'PROJECT' and project_id is not null and scope_id = project_id)
    or (scope in ('SESSION', 'TASK') and project_id is not null)
  ),
  check (event_type not in ('RECALLED', 'SELECTED', 'INJECTED', 'USED', 'VALIDATED', 'CONTRIBUTED') or (task_id is not null and agent_id is not null))
);

create index if not exists nexus_memory_events_record_idx
  on nexus_memory_events (memory_id, recorded_at desc);
create index if not exists nexus_memory_events_scope_idx
  on nexus_memory_events (project_id, scope, scope_id, recorded_at desc);

create or replace function nexus_reject_memory_event_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'Nexus memory events are append-only';
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'nexus_research_runs', 'nexus_evidence_records', 'nexus_evidence_sightings', 'nexus_memory_events'
  ] loop
    execute format('drop trigger if exists %I on %I', table_name || '_no_mutation', table_name);
    execute format(
      'create trigger %I before update or delete on %I for each row execute function nexus_reject_memory_event_mutation()',
      table_name || '_no_mutation', table_name
    );
    execute format('revoke update, delete on %I from public', table_name);
  end loop;
end;
$$;
