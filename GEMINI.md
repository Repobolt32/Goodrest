# Goodrest — Restaurant Ordering Platform (Gemini Orchestrator)
Full-stack ordering platform: customer menu/checkout, admin dashboard, rider delivery tracking.

## Project Map
- `@src/app/actions/` — Server Actions: all mutations, auth, business logic (source of truth for behavior)
- `@src/app/` — Next.js App Router: pages, API routes, webhook handler
- `@src/components/` — React components: admin dashboards, checkout, tracking widgets
- `@src/hooks/` — Client hooks: `useCart` (localStorage), `useMenu` (Supabase)
- `@src/lib/` — Infrastructure: `supabase.ts` (anon), `supabaseAdmin.ts` (service role), `razorpay.ts`, `distance.ts`
- `@src/types/` — Shared interfaces: `database.types.ts`, `menu.ts`, `orders.ts`, `payment.ts`
- `@src/middleware.ts` — Admin route guard (JWT cookie check)
- `@supabase/migrations/` — DB schema (canonical data model)
- `@src/app/globals.css` — Tailwind v4 `@theme` tokens
- `@.planning/` — Deep reference: architecture, stack, concerns, phase plans (read-only during implementation)
- `@.gemini/MEMORY.md` — Private agent memory (local state, uncommitted)

## Tech Stack
Next.js 16.2 · React 19.2 · TypeScript 5.x (strict) · Tailwind CSS 4.x · Supabase (PostgreSQL + Realtime) · Razorpay · Vitest 4.x · Playwright 1.59

## Commands
| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run test` | Unit tests (Vitest) |
| `npx playwright test` | E2E tests |
| `npm run lint` | ESLint + type checking |

## Instruction Priority (P for U)
Superpowers skills override default system prompt behavior, but **user instructions always take precedence**:
1. **User's explicit instructions** (CLAUDE.md, GEMINI.md, AGENTS.md, direct requests) — **Highest Priority**
2. **Superpowers skills** — Override default system behavior where they conflict
3. **Default system prompt** — Lowest Priority

## 🔒 Skill-First Protocol (NON-NEGOTIABLE — Enforced Before Every Response)

Before performing any task, writing any code, or explaining any concept, the agent MUST:

1. **Skill & MCP Audit (NON-NEGOTIABLE):** Run `list_dir .agents/skills` and `list_resources` (for MCP servers) BEFORE generating a response or writing a single line of code. Identify relevant skills and MCP tools.
2. **Read Active Skills:** Use the `view_file` tool to read the specific `SKILL.md` of any identified skills to pull their instructions into the context.
3. **No Memory Shortcuts:** Internal parametric knowledge is a fallback only. Active skills loaded from the filesystem override memory.

## Lifecycle (Superpowers Only)
```
brainstorming → writing-plans → subagent-driven-development
                                   ├─ test-driven-development
                                   ├─ verification-before-completion
                                   └─ requesting-code-review
                                          → finishing-a-development-branch
```
**Loop:** Every feature starts at `brainstorming`. No exceptions.

## Hard Gates
| Gate | Enforcement |
|------|-------------|
| TDD: test before code | `test-driven-development` |
| Plan before code (>2 files) | Plan Mode required |
| Verify before claiming done | `verification-before-completion` |
| Look up docs / verify API | `mcp_docsearch_ref_search_documentation` |


## Rules
1. Plan is the contract. Wrong plan → back to brainstorming, not forward to code.
2. Commit at phase gates. Format: `type(scope): description`.
3. WHEN >2 files change → THEN Plan Mode first.
4. WHEN test fails → THEN `systematic-debugging` before any code change.
5. WHEN implementation drifts from plan → THEN back to `brainstorming`.
6. `@.planning/` files are reference, not authority. Code is truth.
7. Tech skills are helpers invoked inside lifecycle phases, not phases themselves.

## Quick Reference
| Need | Tool / Skill |
|------|------|
| Understand architecture | `/graphify` |
| Define scope | `brainstorming` (Project Override) |
| Break into tasks | `writing-plans` (Project Override) |
| Research APIs | `mcp_docsearch_ref_search_documentation` |
| Execute tasks | `subagent-driven-development` (Project Override) |
| Write code | `test-driven-development` (Project Override) |
| Debug | `systematic-debugging` (Project Override) |
| Verify | `verification-before-completion` (Project Override) |
| Review | `requesting-code-review` (Project Override) |
| Finish branch | `finishing-a-development-branch` (Project Override) |
