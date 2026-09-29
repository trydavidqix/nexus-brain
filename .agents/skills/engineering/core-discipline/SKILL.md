---
name: core-discipline
description: Mandatory Nexus Engineering Control for every coding task in a governed project.
---

# Nexus Engineering Control

For every coding task, automatically apply the Nexus Engineering Control process. The user does not need to name or invoke this skill.

Before changing code, require the task's `EngineeringPlan` from Maestri. Maestri is the sole authority for project and task identity, plan creation, policy, and dispatch. A provider adapter must not create or resolve identity, classify or route a task, schedule work, or dispatch another agent.

Use only the `TaskSkillSet` already selected by the Nexus Skill Resolver for the exact `task_id` and `agent_id`. Skill bodies may enter provider context only after Resolver selection and lazy loading. Keep the provided tool profile and verification gates unchanged. Never load or inject the full skill registry or catalog.

Apply only the loaded skill bodies whose IDs appear in the resolved set. Do not load forbidden skills, self-grant authority, weaken scope or gates, or claim completion without evidence. If the required plan or resolved task/agent SkillSet is missing or inconsistent, stop before invoking the provider.
