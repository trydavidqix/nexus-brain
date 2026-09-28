export interface NexusProject {
  project_id: string;
  repo: string;
  default_branch: string;
  workspace_policy: Record<string, unknown>;
  lifecycle: string;
  stack: string[];
  permissions: Record<string, unknown>;
  policies: Record<string, unknown>;
  approvals: Record<string, unknown>;
  budgets: Record<string, unknown>;
  memory_namespace: string;
  task_scope: string;
  session_scope: string;
  evidence_scope: string;
  git_bindings: Record<string, unknown>[];
  ci_bindings: Record<string, unknown>[];
  deployment_bindings: Record<string, unknown>[];
  provider_constraints: Record<string, unknown>[];
}
