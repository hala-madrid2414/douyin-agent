# Agent Entry Guide

This is the first repository-level guide for AI agents working in this project.
It defines what to read, which documents are authoritative, how to control scope,
and what evidence is required before claiming work is complete.

## Reading Order

Use this precedence when sources disagree:

1. User instructions in the current conversation.
2. This `AGENTS.md` file.
3. Formal project docs in `docs/` and `design-system/`.
4. Decision and plan documents under `docs/plans/`.
5. Local or temporary context under `.trae/`, `reports/`, screenshots, and old audits.
6. Current code reality.

Local notes can explain history, but they do not override formal rules. If code
and docs disagree, treat it as drift: verify the current behavior, then update or
flag the stale document instead of silently choosing one.

## Authoritative Docs

- AI collaboration system: `docs/AI_COLLABORATION_SYSTEM.md`
- Engineering structure and coding rules: `docs/ARCHITECTURE_CONVENTIONS.md`
- WebApp testing rules: `docs/WEBAPP_TESTING_CONVENTIONS.md`
- UI and visual design source of truth: `design-system/MASTER.md`
- Current Agent/SSE/ThoughtChain runtime notes:
  `docs/plans/2026-04-08-ai-intent-to-tool-calling-technical-note.md`
- API contract reference: `docs/API_SPEC.md`

Project-level skills live under `.codex/skills/`. The installed
`project-collaboration-operating-system` skill is intentionally project-local.

## Current Scope Gates

The current product surface is a travel assistant Agent built with Modern.js,
React, Zustand, Ant Design X, SSE chat streaming, tool calling, ThoughtChain
status display, and local frontend persistence.

Do not add these casually without an explicit stage decision:

- Databases or server-side durable storage
- Authentication or account systems
- CI, deployment, cloud services, or new infrastructure
- New test frameworks
- New UI systems or design frameworks
- New AI providers, orchestration layers, or tool ecosystems
- Large cross-cutting refactors unrelated to the active task

When a user-visible action says it saved, submitted, applied, deleted,
published, retried, or collected something, there must be a traceable write path:
state, storage, API, service, event, queue, or an explicit staged placeholder.

## Verification Contract

Use the smallest check that proves the changed surface:

- Documentation-only changes: inspect links and paths, then run a focused `rg`
  check for duplicated authority or stale rule wording.
- Frontend UI or state changes: run `pnpm run lint` and the relevant Playwright
  tests from `tests/`.
- BFF, SSE, tool-calling, or Agent runtime changes: run the relevant Python
  contract/integration tests, plus frontend tests if UI state is affected.
- Testing infrastructure changes: verify `.venv/`, `reports/`, and generated
  artifacts remain outside committed source.
- Build/dev-server checks: only run one `pnpm run dev` or Rspack-writing process
  per workspace at a time.

If a check cannot be run, report exactly what was skipped and why.

## Correction Loop

When the user says the agent missed the documented style, verification fails, or
work drifts from project rules, classify the failure before changing docs:

```text
Miss:
Failure type:
Root cause:
Corrected action:
System change: none / context map / doc clarification / new guidance / workflow
Prevention:
```

Failure types:

- Agent execution failure: the rule existed and was clear, but the agent ignored it.
- Context discovery failure: the rule existed, but was hard to find.
- Documentation ambiguity failure: the rule allowed multiple reasonable readings.
- Documentation drift failure: duplicated rules disagreed.
- Documentation gap failure: no durable rule covered the situation.
- Process failure: verification, feedback, or correction workflow was missing.

Do not edit formal docs as a reflex. Fix the work first, then make the smallest
system change that would prevent the same miss.
