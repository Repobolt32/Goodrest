# Goodrest — Agent Rules

Restaurant ordering platform: customer menu/checkout, admin dashboard, rider delivery tracking.

## Project Map

- `src/app/actions/` — Server Actions: mutations, auth, business logic (**source of truth**)
- `src/app/` — Next.js App Router: pages, API routes, webhook handler
- `src/components/` — React UI (admin dashboards, checkout, tracking widgets)
- `src/lib/` — Infrastructure glue (supabase, razorpay, distance, pricing)
- `src/types/` — Shared interfaces / generated types
- `supabase/migrations/` — DB schema (**canonical data model**)
- `.planning/` — Reference notes (read-only)

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run test` | Unit tests (Vitest) |
| `npx playwright test` | E2E tests |
| `npm run lint` | ESLint + type checking |

## Intelligent Routing (MANDATORY)

**Before ANY code/design work, classify the request and load the right skills.**

### Auto-Route by Task Type

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
| **Animation** | animate, transition, motion, Framer Motion | `framer-motion-animator`, `ui-animation` |

### Enforcement Protocol

1. **Classify silently** — detect domain from keywords
2. **Load skills** — use `skill` tool to load matching skills
3. **Apply principles** — follow the loaded skill's rules
4. **Verify** — run `npm run build && npm run test` before claiming done

### Socratic Gate (Complex Work)

Before implementing complex features, **ask first**:
- What exactly needs to happen?
- What are the edge cases?
- What can go wrong?
- What's the simplest approach?

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
- NEVER delete or move any file or directory of any size in the workspace without obtaining explicit, unambiguous user confirmation and consent.

## Verification Protocol (MANDATORY)

**Every task must end with proof, not claims.**

| Task | Run This | Before Claiming Done |
|------|----------|---------------------|
| Any code change | `npm run build` | Must pass |
| Logic change | `npm run test` | Must pass |
| Code change | `npm run lint` | Must pass |
| Bug fix | `npm run build && npm run test` | Both must pass |
| Pre-deploy | `python .opencode/scripts/checklist.py` | Must pass |

**Rule: "Done" means tests pass, build passes, no regressions. Not "I think it works."**

## Anti-Patterns (Do NOT Do)

- Don't trust client input — validate server-side
- Don't use `any` type
- Don't skip error handling
- Don't claim "done" without verification
- Don't batch multiple unrelated changes
- Don't skip skill loading for complex tasks

## Workflow

For non-trivial work:
1. **Classify** — what domain is this? Load matching skills
2. **Plan** — understand scope before coding
3. **Implement** — with loaded skill principles
4. **Verify** — build + test + lint
5. **Review** — check for security, performance, edge cases
