ALTER TABLE nexus_research_runs
  ADD CONSTRAINT nexus_research_runs_id_project_key UNIQUE (run_id, project_id);

ALTER TABLE nexus_evidence_records
  DROP CONSTRAINT IF EXISTS nexus_evidence_records_run_id_fkey;
ALTER TABLE nexus_evidence_records
  ADD CONSTRAINT nexus_evidence_records_run_project_fkey
  FOREIGN KEY (run_id, project_id) REFERENCES nexus_research_runs(run_id, project_id);

ALTER TABLE nexus_evidence_sightings
  DROP CONSTRAINT IF EXISTS nexus_evidence_sightings_run_id_fkey;
ALTER TABLE nexus_evidence_sightings
  ADD CONSTRAINT nexus_evidence_sightings_run_project_fkey
  FOREIGN KEY (run_id, project_id) REFERENCES nexus_research_runs(run_id, project_id);

ALTER TABLE nexus_evidence_records
  ADD COLUMN IF NOT EXISTS engagement jsonb,
  ADD COLUMN IF NOT EXISTS relevance double precision CHECK (relevance IS NULL OR relevance BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS freshness double precision CHECK (freshness IS NULL OR freshness BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS authority double precision CHECK (authority IS NULL OR authority BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS query text,
  ADD COLUMN IF NOT EXISTS extraction_method text,
  ADD COLUMN IF NOT EXISTS backend text;

CREATE OR REPLACE FUNCTION nexus_reject_memory_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Nexus provenance and event records are append-only';
END;
$$;

CREATE OR REPLACE FUNCTION nexus_reject_append_only_truncate()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Nexus provenance and event records are append-only';
END;
$$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'nexus_research_runs', 'nexus_evidence_records', 'nexus_evidence_sightings', 'nexus_memory_events'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', table_name || '_no_truncate', table_name);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION nexus_reject_append_only_truncate()',
      table_name || '_no_truncate', table_name
    );
  END LOOP;
END;
$$;
