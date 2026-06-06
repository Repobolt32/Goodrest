# Goodrest — Claude Code Rules

## Test Gate

**After any change to shared infrastructure, run the full test suite — not just the relevant subset.**

Shared infrastructure includes: `middleware.ts`, `next.config.ts`, global layouts, `src/lib/` utilities, `supabase/migrations/`, and any file imported by 3+ other files.

Run: `npm run build && npm run test`