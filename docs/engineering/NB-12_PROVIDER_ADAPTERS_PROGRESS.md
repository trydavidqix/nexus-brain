# NB-12 — Provider adapters and project integrations

**Status:** Local implementation and verification complete; PR #128 review, final GitHub checks, and integration remain pending.
**Branch:** `codex/nb12-provider-adapters`
**Owner decision:** Preserve the canonical order NB-12 → NB-13 → NB-14. Use the minimum adapter seam defined below.

## Approved boundary

- `ExecutionPort.execute` carries an optional typed `ProviderEngineeringContext` containing an existing `EngineeringPlan`, the NB-09 Resolver-selected task/agent `TaskSkillSet`, the tool profile, and already-loaded skill bodies.
- Codex and Claude adapters fail closed when context is missing or inconsistent. They validate task/agent identity, exact plan/SkillSet policy and tool-profile agreement, selected-skill membership, and one body per selected skill. Invalid or extra authority-bearing input does not reach the provider runner.
- Provider runners receive an allowlisted projection. Adapters do not read the Skill Registry, load skills, resolve project/task identity, classify, route, schedule, create plans, or dispatch.
- The provider/project instruction layer permanently activates Engineering Control for coding tasks. Maestri remains the sole authority for identity, plan creation, policy, and dispatch. Maestri wiring stays in NB-13.
- The canonical source is `.agents/skills/engineering/core-discipline/SKILL.md`. `tooling/generators/engineering-adapters/generate.mjs` generates deterministic project artifacts for OpenAI plugin, Codex, Claude Code, Gemini CLI, Jules, Cursor, GitHub Copilot, and generic Agent Skills. Generated outputs use provider-supported project paths and never modify provider-global directories.
- OpenAI plugin output uses root `plugin.json` and a single `skills/engineering-control/SKILL.md`. No complete skill catalog is packaged or injected.

The existing `EngineeringPlan.delivery_policy` contract is an opaque Maestri-owned record. The adapter transports the supplied plan; it does not interpret that record as routing or dispatch authority.

## Validation evidence

Fresh local checks on the candidate after the implementation changes:

| Check | Result |
|---|---|
| `packages/providers`: `pnpm test:unit` | PASS — 3 Node tests, 53 Vitest tests |
| `packages/providers`: `pnpm typecheck` | PASS |
| `packages/contracts`: `pnpm test:unit` | PASS — 46 Node tests, 1 Vitest test |
| `packages/contracts`: `pnpm typecheck` | PASS |
| `pnpm check:architecture` | PASS — 16 packages, no undeclared imports or dependency cycles |
| `pnpm check:syntax` | PASS — 177 modules parsed |
| `pnpm scan:sensitive` | PASS — 373 files scanned |
| `pnpm test:integration` | PASS — 26/26 |
| `node --check tooling/generators/engineering-adapters/generate.mjs` | PASS |
| `git diff --check` | PASS |

The independent review confirmed the typed transport seam and Jules output. It noted the open-ended `delivery_policy` field; that field remains Maestri-owned contract data and is not interpreted by the adapter. No NB-13 wiring or provider-global changes were introduced.

## Integration gate

Do not mark NB-12 complete until PR #128 has final required checks, independent review, merge, and synchronized `main`. Record the merge commit and final-head evidence here and in the canonical Blueprint after integration.
