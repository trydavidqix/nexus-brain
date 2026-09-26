# Documentation Sync Policy

GitHub is the persistent source of truth for Nexus project documentation and
versioned project state. Important information must not exist only on a local
machine.

## Canonical records

Information needed to understand the project, resume work, reproduce decisions,
audit changes, or determine architecture, status, and plans must:

1. live in a canonical location inside this repository;
2. be committed to Git;
3. be pushed to the remote;
4. stay synchronized with the branch that owns the change.

Use the existing canonical documents where possible. The master implementation
plan is [`blueprints/NEXUS_BRAIN_MASTER_IMPLEMENTATION_BLUEPRINT.md`](blueprints/NEXUS_BRAIN_MASTER_IMPLEMENTATION_BLUEPRINT.md).
Architecture decisions belong in `docs/adr/` or the relevant architecture
document. Verified operational evidence belongs with the milestone or component
it validates. Do not create competing plans or duplicate canonical state.

## Excluded from Git

Never commit secrets, API keys, `.env` files, caches, `node_modules`, temporary
logs, disposable generated files, external recovery backups, or machine-specific
local state. Keep runtime data in the ignored local state locations documented
by the project.

## Completion check

Before reporting project work complete, verify that every important document,
decision, plan, report, evidence record, and canonical status change is inside
the repository, committed, pushed, and synchronized with its corresponding
branch. Report any remaining synchronization blocker explicitly.
