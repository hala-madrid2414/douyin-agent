# AI Collaboration System

This document defines how humans and AI agents collaborate in this repository.
It is a control system for repeated failure modes: reading too little, treating
local drafts as policy, expanding scope, showing fake success, skipping
verification, and failing to learn from correction.

## Current Collaboration Picture

Authoritative context:

- `AGENTS.md`: first AI entrypoint and source precedence.
- `README.md`: human project entrypoint and command overview.
- `docs/ARCHITECTURE_CONVENTIONS.md`: engineering structure and coding rules.
- `docs/WEBAPP_TESTING_CONVENTIONS.md`: WebApp and Playwright testing rules.
- `design-system/MASTER.md`: UI visual source of truth.
- `docs/plans/2026-04-08-ai-intent-to-tool-calling-technical-note.md`: current
  Agent/SSE/ThoughtChain runtime explanation.
- `docs/API_SPEC.md`: API contract reference.

Temporary or local context:

- `.trae/specs/`: local task specs and checklists. Useful for history, not
  binding policy.
- `.trae/documents/`: local investigation plans and repair notes. Useful for
  context, not formal rules.
- `reports/`: generated test artifacts, screenshots, traces, and logs.
- Root screenshots, old repair reports, and feature reports: evidence of past
  work, not current authority unless promoted into formal docs.

Current scope gates:

- The project is focused on a travel assistant Agent with Modern.js, React,
  Zustand, Ant Design X, SSE streaming, tool calling, ThoughtChain display, and
  local frontend persistence.
- New databases, auth, CI, cloud services, test frameworks, UI systems, AI
  providers, or orchestration layers require an explicit stage decision.

Behavior and write-path rules:

- User-visible success must map to a traceable result.
- Any save, submit, collect, apply, invite, edit, delete, publish, retry, or
  regenerate behavior must have a state/storage/service/API/event path or be
  labelled as a staged placeholder.
- Tool calls and Agent work must expose honest intermediate state when the UI
  claims the Agent is searching, thinking, retrying, or falling back.

Verification contract:

- Documentation changes require path/link inspection and a focused duplicate
  authority scan.
- Frontend changes require lint plus relevant Playwright coverage.
- Agent, SSE, BFF, or tool changes require the matching contract/integration
  tests and any affected UI tests.
- Build and test commands must respect the single Rspack process rule.

Correction loop:

- Classify misses before changing documents.
- Fix the deliverable first using the current authoritative rule.
- Improve docs or workflow only when the miss came from discovery, ambiguity,
  drift, a gap, or process failure.

## Source Of Truth Map

Use one source of truth for each rule family:

- UI visual system: `design-system/MASTER.md`
- Directory, component, state, import, and service structure:
  `docs/ARCHITECTURE_CONVENTIONS.md`
- Playwright, `reports/`, `.venv/`, testing artifacts, `networkidle`, and
  single Rspack process testing workflow: `docs/WEBAPP_TESTING_CONVENTIONS.md`
- AI collaboration process, local-memory policy, stage gates, verification
  routing, and correction loop: this document plus `AGENTS.md`
- Current runtime Agent/SSE/ThoughtChain behavior:
  `docs/plans/2026-04-08-ai-intent-to-tool-calling-technical-note.md`
- Historical design ideas and future staged capabilities: files under
  `docs/plans/`, unless explicitly promoted by `AGENTS.md` or a current task.

If a secondary document repeats a binding rule, it should link or summarize the
source instead of redefining it. If repeated text disagrees, treat it as a
documentation drift failure.

## Local Memory Policy

Ignored local spaces are allowed and useful:

- Keep temporary specs, implementation notes, exploratory audits, screenshots,
  and generated reports in ignored paths such as `.trae/` and `reports/`.
- Do not cite those local drafts as binding rules unless a formal doc points to
  them.
- Promote durable decisions into `docs/`, `design-system/`, or `AGENTS.md`.
- Keep `.codex/skills/project-collaboration-operating-system` project-local
  unless the user explicitly asks for a global skill installation.

## Verification Routing

Choose checks by changed surface:

- Docs only: run a focused `rg` scan across `README.md`, `AGENTS.md`, `docs/`,
  and `design-system/`; confirm referenced paths exist.
- UI layout or component work: `pnpm run lint` and relevant Playwright tests.
- Store, streaming, or persistence work: lint plus tests covering chat state,
  cache, abort, and ThoughtChain behavior.
- BFF or Agent tool work: relevant Python tests under `tests/`, especially
  LangGraph/runtime/toolchain tests.
- Test harness changes: verify artifacts still write to `reports/` and that
  `.venv/` remains environment-only.

Do not add new verification frameworks just to satisfy process. Use existing
checks first; propose the smallest new guardrail only if the existing project
cannot prove the change.

## Drift Pressure Checks

Use these quick checks when changing project guidance:

- README-only shortcut: can an agent reading `README.md` find `AGENTS.md` and
  the formal docs?
- Draft-policy confusion: does `.trae/` clearly remain local context?
- Duplicate-rule drift: does each repeated rule point to one source of truth?
- Fake-success shortcut: does any user-visible success have a write path?
- Infrastructure temptation: would the change add large new surfaces without a
  stage decision?
- No-verification finish: is there explicit evidence or an explicit skipped
  check?
- User correction: does the next action change, or is it only an apology?
