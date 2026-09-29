# NB-12 — Provider adapters and project integrations

**Status:** DONE — PR #128 squash-merged as `9aa6547b68475b62d41c4fb491fb8d90cfd4c9f8`; `main` synchronized.
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
| `packages/execution`: `pnpm test:unit` | PASS — 4 Node tests, 55 Vitest tests |
| `packages/execution`: `pnpm typecheck` | PASS |
| `node --check tooling/generators/engineering-adapters/generate.mjs` | PASS |
| `git diff --check` | PASS |

The independent review confirmed the typed transport seam and Jules output. It found no blocker at PR head `c2aab69b8872ceaf2cc56d2e284c96edc69404af`. The open-ended `delivery_policy` field remains opaque Maestri-owned data and is not interpreted by adapters. No NB-13 wiring or provider-global changes were introduced.

## Final integration evidence

- PR: [#128](https://github.com/trydavidqix/nexus-brain/pull/128), merged 2026-09-29.
- Final PR head: `c2aab69b8872ceaf2cc56d2e284c96edc69404af`.
- Merge commit: `9aa6547b68475b62d41c4fb491fb8d90cfd4c9f8`.
- Required GitHub checks: PASS — CodeQL, dependency review, MCG, Windows CBM, and OpenTofu. Security workflows (Gitleaks, OSV, Semgrep, ZAP) also passed.
- Independent review: PASS — no blocker against the Owner-approved boundary.
- `main` at merge: synchronized to `9aa6547b68475b62d41c4fb491fb8d90cfd4c9f8`.
