# Douyin Agent

A Modern.js travel assistant Agent experiment with React, Zustand, Ant Design X,
SSE streaming, tool calling, ThoughtChain status display, and local frontend
conversation persistence.

## Quick Start

Install dependencies:

```bash
pnpm install
```

Start the development server:

```bash
pnpm run dev
```

Build for production:

```bash
pnpm run build
```

Preview the production build:

```bash
pnpm run serve
```

Run the configured lint check:

```bash
pnpm run lint
```

## Project Map

- Frontend routes and page composition: `src/routes/`
- Shared chat state: `src/stores/chatStore.ts`
- Session and toolchain types: `src/types/session.ts`
- BFF chat and streaming endpoint: `api/lambda/chat/index.ts`
- LangGraph runtime contracts: `src/server/chat/langgraph/`
- WebApp tests: `tests/`

## Authoritative Docs

- AI agent entry guide: `AGENTS.md`
- AI collaboration system: `docs/AI_COLLABORATION_SYSTEM.md`
- Engineering conventions: `docs/ARCHITECTURE_CONVENTIONS.md`
- WebApp testing conventions: `docs/WEBAPP_TESTING_CONVENTIONS.md`
- UI design source of truth: `design-system/MASTER.md`
- Current Agent/SSE/ThoughtChain runtime notes:
  `docs/plans/2026-04-08-ai-intent-to-tool-calling-technical-note.md`
- API contract reference: `docs/API_SPEC.md`

For AI-assisted development, read `AGENTS.md` first. Local `.trae/` specs and
documents are useful history, but they are not formal project authority unless a
formal doc explicitly promotes them.

## Testing Notes

Python/Playwright tests live under `tests/`. Generated test artifacts belong in
`reports/`, which is ignored by git.

This project uses Modern.js/Rspack. Keep only one dev/build/watch process running
per workspace to avoid persistent cache conflicts.
