ALTER TABLE nexus_memory_records
  ADD CONSTRAINT nexus_memory_records_scope_binding_check CHECK (
    (scope = 'GLOBAL' AND project_id IS NULL AND scope_id = 'global')
    OR (scope = 'PROJECT' AND project_id IS NOT NULL AND scope_id = project_id)
    OR (scope = 'SESSION' AND project_id IS NOT NULL AND session_id IS NOT NULL AND scope_id = session_id)
    OR (scope = 'TASK' AND project_id IS NOT NULL AND task_id IS NOT NULL AND scope_id = task_id AND length(coalesce(provenance->>'actor_id', '')) > 0)
  );

ALTER TABLE nexus_memory_events
  ADD CONSTRAINT nexus_memory_events_scope_binding_check CHECK (
    (scope = 'GLOBAL' AND project_id IS NULL AND scope_id = 'global')
    OR (scope = 'PROJECT' AND project_id IS NOT NULL AND scope_id = project_id)
    OR (scope = 'SESSION' AND project_id IS NOT NULL AND session_id IS NOT NULL AND scope_id = session_id)
    OR (scope = 'TASK' AND project_id IS NOT NULL AND task_id IS NOT NULL AND scope_id = task_id AND agent_id IS NOT NULL)
  );
