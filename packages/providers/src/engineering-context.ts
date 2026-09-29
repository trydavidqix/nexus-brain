import type { TaskSkillSet } from "@nexus-brain/contracts";
import type { ProviderEngineeringContext } from "@nexus-brain/contracts/execution/port";

export type { ProviderEngineeringContext } from "@nexus-brain/contracts/execution/port";

const CONTEXT_KEYS = ["engineering_plan", "loaded_skills", "task_skill_set", "tool_profile"];
const PLAN_KEYS = ["agent_id", "autonomy_level", "context_budget", "contract_impact", "delivery_policy", "execution_mode", "expected_files", "expected_tests", "risk_level", "scope_size", "skill_policy", "task_id", "task_type", "testability", "tool_profile", "verification_gates"];
const SKILL_SET_KEYS = ["agent_id", "completed", "context_budget", "forbidden", "loaded", "optional", "required", "task_id"];
const SKILL_POLICY_KEYS = ["completed", "forbidden", "loaded", "optional", "required"];
const BUDGET_KEYS = ["input_tokens", "output_tokens", "context_percent", "definitions", "calls", "seconds", "cost_usd"] as const;

function hasExactKeys(value: object, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index]);
}

function sameStrings(left: unknown, right: unknown): boolean {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

/** Fail closed unless the provider input exactly matches the resolved task/agent scope. */
export function validateProviderEngineeringContext(
  taskId: string,
  context: ProviderEngineeringContext | undefined,
): context is ProviderEngineeringContext {
  if (!context || typeof context !== "object" || Array.isArray(context)) return false;
  const keys = Object.keys(context).sort();
  if (keys.length !== CONTEXT_KEYS.length || keys.some((key, index) => key !== CONTEXT_KEYS[index])) return false;

  const { engineering_plan: plan, task_skill_set: skills, tool_profile: toolProfile, loaded_skills: loadedBodies } = context;
  if (!plan || !skills
    || !hasExactKeys(plan, PLAN_KEYS)
    || !hasExactKeys(skills, SKILL_SET_KEYS)
    || !plan.skill_policy
    || !hasExactKeys(plan.skill_policy, SKILL_POLICY_KEYS)
    || plan.task_id !== taskId
    || skills.task_id !== plan.task_id
    || skills.agent_id !== plan.agent_id) return false;
  if (!sameStrings(toolProfile, plan.tool_profile)) return false;

  const policy = plan.skill_policy;
  if (!sameStrings(skills.required, policy.required)
    || !sameStrings(skills.optional, policy.optional)
    || !sameStrings(skills.forbidden, policy.forbidden)
    || !sameStrings(skills.loaded, policy.loaded)
    || !sameStrings(skills.completed, policy.completed)) return false;

  if (!Array.isArray(loadedBodies)) return false;
  const selected = new Set(skills.loaded);
  if (selected.size !== skills.loaded.length) return false;
  const permitted = new Set([...skills.required, ...skills.optional]);
  if (skills.loaded.some((skillId) => !permitted.has(skillId))) return false;
  if (skills.loaded.some((skillId) => skills.forbidden.includes(skillId))) return false;
  if (loadedBodies.length !== selected.size) return false;

  const received = new Set<string>();
  for (const skill of loadedBodies) {
    if (!skill || typeof skill !== "object"
      || typeof skill.skill_id !== "string"
      || typeof skill.version !== "string"
      || typeof skill.body !== "string"
      || !selected.has(skill.skill_id)
      || received.has(skill.skill_id)) return false;
    received.add(skill.skill_id);
  }
  return received.size === selected.size;
}

/** Explicit projection prevents provider runners from receiving attached registry/router fields. */
export function projectProviderEngineeringContext(context: ProviderEngineeringContext): ProviderEngineeringContext {
  const taskSkillSet: TaskSkillSet = {
    task_id: context.task_skill_set.task_id,
    agent_id: context.task_skill_set.agent_id,
    required: [...context.task_skill_set.required],
    optional: [...context.task_skill_set.optional],
    forbidden: [...context.task_skill_set.forbidden],
    loaded: [...context.task_skill_set.loaded],
    completed: [...context.task_skill_set.completed],
    context_budget: Object.fromEntries(
      BUDGET_KEYS.flatMap((key) => key in context.task_skill_set.context_budget
        ? [[key, context.task_skill_set.context_budget[key]]]
        : []),
    ),
  };
  return {
    engineering_plan: context.engineering_plan,
    task_skill_set: taskSkillSet,
    tool_profile: [...context.tool_profile],
    loaded_skills: context.loaded_skills.map(({ skill_id, version, body }) => ({ skill_id, version, body })),
  };
}
