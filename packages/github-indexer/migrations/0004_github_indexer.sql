create table if not exists nexus_github_webhook_deliveries (
  delivery_id text primary key,
  event_name text not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  status text not null check (status in ('PROCESSING', 'COMPLETED')),
  attempts integer not null default 1 check (attempts > 0),
  started_at timestamptz not null,
  completed_at timestamptz
);

create table if not exists nexus_github_branch_observations (
  project_id text not null,
  repository text not null,
  branch text not null,
  head_sha text not null check (head_sha ~ '^[a-f0-9]{40,64}$'),
  first_observed_at timestamptz not null,
  last_observed_at timestamptz not null,
  source text not null check (source in ('webhook', 'reconciliation')),
  primary key (project_id, repository, branch, head_sha)
);

create table if not exists nexus_github_branch_heads (
  project_id text not null,
  repository text not null,
  branch text not null,
  head_sha text not null check (head_sha ~ '^[a-f0-9]{40,64}$'),
  observed_at timestamptz not null,
  source text not null check (source in ('webhook', 'reconciliation')),
  delivery_id text,
  deleted_at timestamptz,
  primary key (project_id, repository, branch)
);

create table if not exists nexus_github_commits (
  project_id text not null,
  repository text not null,
  commit_sha text not null check (commit_sha ~ '^[a-f0-9]{40,64}$'),
  message text not null,
  author text not null,
  committed_at timestamptz not null,
  commit_url text,
  primary key (project_id, repository, commit_sha)
);

create table if not exists nexus_github_branch_commits (
  project_id text not null,
  repository text not null,
  branch text not null,
  commit_sha text not null,
  observed_at timestamptz not null,
  primary key (project_id, repository, branch, commit_sha),
  foreign key (project_id, repository, commit_sha)
    references nexus_github_commits(project_id, repository, commit_sha)
);

create index if not exists nexus_github_branch_observations_recent_idx
  on nexus_github_branch_observations (project_id, repository, branch, last_observed_at desc);
create index if not exists nexus_github_commits_recent_idx
  on nexus_github_commits (project_id, repository, committed_at desc);
