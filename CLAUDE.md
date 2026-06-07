# Goodrest — Claude Code Rules

Restaurant ordering platform: customer menu/checkout, admin dashboard, rider delivery tracking.

## Project Map

- `src/app/actions/` — Server Actions: mutations, auth, business logic (**source of truth**)
- `src/app/` — Next.js App Router: pages, API routes, webhook handler
- `src/components/` — React UI (admin dashboards, checkout, tracking widgets)
- `src/lib/` — Infrastructure glue (supabase, razorpay, distance, pricing)
- `src/types/` — Shared interfaces / generated types
- `supabase/migrations/` — DB schema (**canonical data model**)
- `.planning/` — Reference notes (read-only)

## Test Gate

**After any change to shared infrastructure, run the full test suite — not just the relevant subset.**

Shared infrastructure includes: `middleware.ts`, `next.config.ts`, global layouts, `src/lib/` utilities, `supabase/migrations/`, and any file imported by 3+ other files.

Run: `npm run build && npm run test`

## Skill Routing (MANDATORY)

**Before ANY code/design work, classify the request and load the right skills.**

| Task Type | Keywords | Load These Skills |
|-----------|----------|-------------------|
| **Frontend/UI** | component, button, card, layout, style, CSS, Tailwind, React | `frontend-design`, `react-best-practices`, `tailwind-patterns` |
| **Backend/API** | endpoint, route, API, server, action, mutation | `api-patterns`, `nodejs-best-practices` |
| **Database** | schema, migration, query, table, Supabase, RLS | `database-design`, `supabase-postgres-best-practices` |
| **Security** | auth, login, JWT, password, token, payment, webhook | `vulnerability-scanner`, `security-review` |
| **Bug Fix** | error, bug, crash, not working, broken, fix | `systematic-debugging`, `verify-changes` |
| **Testing** | test, coverage, unit, E2E, Playwright | `testing-patterns`, `tdd-workflow` |
| **Performance** | slow, optimize, speed, lag, Core Web Vitals | `performance-profiling`, `next-best-practices` |
| **Code Review** | review, audit, check quality | `code-review-checklist` |
| **Animation** | animate, transition, motion, Framer Motion | `framer-motion-animator` |

## Code Style

- TypeScript strict mode — no `any` types
- Concise, direct, no over-engineering
- Self-documenting code — minimize comments
- Follow existing patterns in the file you're editing
- Server Actions: always return `{ success, data?, error? }` format
- Error handling: try/catch every async operation

## Safety Rules

- `.planning/` — reference only, do not edit
- `supabase/migrations/` — no destructive changes without confirmation
- `src/lib/razorpay.ts` and auth code — require approval for changes
- Don't claim "fixed" without running verification
- NEVER delete or move any file or directory without explicit user confirmation

## Verification Protocol (MANDATORY)

**Every task must end with proof, not claims.**

| Task | Run This | Before Claiming Done |
|------|----------|---------------------|
| Any code change | `npm run build` | Must pass |
| Logic change | `npm run test` | Must pass |
| Code change | `npm run lint` | Must pass |
| Bug fix | `npm run build && npm run test` | Both must pass |

**Rule: "Done" means tests pass, build passes, no regressions. Not "I think it works."**

## Anti-Patterns (Do NOT Do)

- Don't trust client input — validate server-side
- Don't use `any` type
- Don't skip error handling
- Don't claim "done" without verification
- Don't batch multiple unrelated changes
- Don't skip skill loading for complex tasks

## Socratic Gate (Complex Work)

Before implementing complex features, **ask first**:
- What exactly needs to happen?
- What are the edge cases?
- What can go wrong?
- What's the simplest approach?

## Engineering Guardrails (Karpathy Principles)

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding
**Don't assume. Don't hide confusion. Surface tradeoffs.**
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First
**Minimum code that solves the problem. Nothing speculative.**
- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

### 3. Surgical Changes
**Touch only what you must. Clean up only your own mess.**
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- Remove imports/variables/functions that YOUR changes made unused.

### 4. Goal-Driven Execution
**Define success criteria. Loop until verified.**
- Transform tasks into verifiable goals (e.g., "Write a test that reproduces it, then make it pass").
- For multi-step tasks, state a brief plan with verification steps for each.

---

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run test` | Unit tests (Vitest) |
| `npx playwright test` | E2E tests |
| `npm run lint` | ESLint + type checking |