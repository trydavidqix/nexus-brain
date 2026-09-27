export type MemoryScope = 'GLOBAL' | 'PROJECT' | 'SESSION' | 'TASK';
export type MemoryStatus = 'OBSERVED' | 'CANDIDATE' | 'VERIFIED' | 'CANONICAL' | 'SUPERSEDED' | 'CONFLICTED' | 'REVOKED';
export type MemoryDataClassification = 'SYNTHETIC' | 'NON_SENSITIVE' | 'SENSITIVE' | 'RESTRICTED';

export interface NexusMemoryRecord {
  memory_id: string;
  project_id?: string;
  scope: MemoryScope;
  scope_id: string;
  status: MemoryStatus;
  content: string;
  evidence_ids: string[];
  provenance: Record<string, unknown>;
}

export interface MemoryRecordProvenance extends Record<string, unknown> {
  source_type: string;
  source_id: string;
  actor_id: string;
  task_id?: string;
  trace_id?: string;
  attributes?: Record<string, unknown>;
}

export interface MemoryTemporalFacts {
  observed_at: string;
  recorded_at: string;
  valid_from: string;
  valid_until?: string;
}

export interface MemoryAccessControl {
  policy_id: string;
  read_permission_ids: string[];
  write_permission_ids: string[];
}

export interface NexusCanonicalMemoryRecord extends NexusMemoryRecord {
  project_id?: string;
  content_hash: string;
  provenance: MemoryRecordProvenance;
  temporal: MemoryTemporalFacts;
  acl: MemoryAccessControl;
  data_classification: MemoryDataClassification;
  task_id?: string;
  session_id?: string;
  tags?: string[];
  supersedes?: string;
  superseded_by?: string;
  version: number;
}

export type MemoryLifecycleEventType =
  | MemoryStatus
  | 'RECALLED'
  | 'SELECTED'
  | 'INJECTED'
  | 'USED'
  | 'VALIDATED'
  | 'CONTRIBUTED';

export interface NexusMemoryEvent {
  event_id: string;
  memory_id: string;
  project_id?: string;
  scope: MemoryScope;
  scope_id: string;
  event_type: MemoryLifecycleEventType;
  recorded_at: string;
  valid_at?: string;
  task_id?: string;
  session_id?: string;
  agent_id?: string;
  trace_id?: string;
  actor: { actor_id: string; actor_type: 'agent' | 'user' | 'system' | 'policy' };
  provenance: { source_type: string; source_id: string; evidence_ids?: string[]; attributes?: Record<string, unknown> };
  payload: Record<string, unknown>;
}

export interface NexusEvidenceSighting {
  sighting_id: string;
  evidence_id: string;
  project_id: string;
  run_id: string;
  observed_at: string;
  source: string;
  content_hash: string;
  provenance: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}
