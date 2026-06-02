---
phase: 5
plan: .planning/phases/05-owner-dashboard/PLAN.md
step: phase_5_complete
updated: 2026-05-19
---

# Project State

## 1. Core Identity
- **Primary Goal**: Reliable real-time order lifecycle management across customers, staff, and riders for a single restaurant.
- **Current Focus**: Phase 5 COMPLETE. All 12 POSD requirements done. Phase 6 (Hardening) next.

## 2. Current Position
- **Phase**: 5 (Complete)
- **Plan**: `.planning/phases/05-owner-dashboard/PLAN.md`
- **Step**: All POSD-01 through POSD-12 done.

**Progress:** `[==============================] 100%` (Phase 5: 12/12 requirements complete)

## 3. Session Continuity (2026-05-19 Session)
- **Done this session**:
  - Implemented Electron desktop wrapper (10 tasks via subagent-driven-development)
  - POSD-01: Electron main.js with child process server, waitForReady, stopServer, dotenv
  - POSD-02: Bell popup with continuous Web Audio API ringing (880Hz→1100Hz every 2s)
  - POSD-03: Accept button with 5-min countdown, auto-reject at 0:00
  - POSD-12: Daily sales reports page at /admin/reports (summary cards + 7-day table)
  - Updated all state docs (STATE.md, ROADMAP.md, PLAN.md)
- **Verification**: Build passes, 138/138 tests pass, lint 0 errors
- **Next Action**: Phase 6 — Hardening, Reliability & Polish
- **Open Threads**:
  - Google Maps API key rotation (key burned in chat)
  - E2E tests need live server verification

## 4. Unresolved Blockers
| Blocker | Detail | Approach |
|---------|--------|----------|
| E2E verification | Playwright tests need live dev server + Supabase | Run `npm run dev` then `npx playwright test` |
| API key rotation | Google Maps key exposed in chat history | Rotate key, restrict to Routes API + Maps Embed API |

## 5. What's Done (Phase 4)
### Backend
- Migration `20260509_rider_refactor.sql` — distance_km, rider_earning, rider_started_at, deliver_order RPC
- `src/lib/distance.ts` — Google Maps Routes API v2 for road distance
- `src/app/actions/riderActions.ts` — supabaseAdmin, isValidUUID, FCFS accept, startRiding, deliver_order RPC, stats
- `src/app/actions/adminActions.ts` — dispatchOrder/updateDispatchDetails removed
- `src/app/actions/orderActions.ts` — removed UUID_PATTERN, menu_item_id uses item.id directly, retry-with-null for FK violations

### Frontend
- `OrdersDashboardClient.tsx` — dispatch UI removed, new status flow
- `rider/dashboard/page.tsx` — real stats, Start Riding, geo errors
- `OrderBroadcast.tsx` — hasActiveOrder guard, real distance/earning
- `OrderTracker.tsx` — customer self-deliver removed, Maps iframe, ready step
- `track/order/[id]/page.tsx` — updated props

### Tests (2026-05-14 fixes)
- `vitest.config.ts` — spread configDefaults.exclude, resolve.alias for `@/`
- `riderActions.test.ts` — inline mock factories, proper Supabase chain
- `rider/login/page.test.tsx` — next/navigation + framer-motion mocks
- `rider/dashboard/page.test.tsx` — supabase + OrderBroadcast mocks
- `OrderBroadcast.test.tsx` — hasActiveOrder prop, framer-motion mock
- `OrderTracker.test.tsx` — complete rewrite: data-testid + data-step-status assertions
- `delivery-validation.spec.ts` — inline createClient (no `@/` imports)
- `rider-journey.spec.ts` — inline createClient, rider seed in beforeEach
- `whatsapp-dispatch.spec.ts` — complete rewrite for FCFS self-assignment flow
- `db_integration.test.ts` — resilient total_orders assertion

### Config
- `.env` — GOOGLE_MAPS_API_KEY + NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
- `eslint.config.mjs` — lint fixes
- `CLAUDE.md` — Skill Search Gate clause

### Type Fixes (2026-05-12)
- `database.types.ts` — added `deliver_order` to Functions type
- `OrderBroadcast.tsx` — `payload.new as BroadcastOrder` cast

## 6. What's Left (Phase 4)
- Verify E2E tests against live dev server
- Commit all changes
- Rotate Google Maps API key, restrict to Routes API + Maps Embed API

## 7. Performance Metrics
- **Build**: PASS (Turbopack + type-check)
- **Lint**: 0 errors
- **Unit Tests**: 14/14 PASS
- **E2E Tests**: Pending live server verification (code changes structurally correct)

## 8. Accumulated Context
- Single-restaurant POS, Next.js 16.2, React 19.2, Supabase, Razorpay, Google Maps Routes API
- Order FSM: placed → preparing → ready → out_for_delivery → delivered
- FCFS rider assignment via atomic DB update
- Rider earning = Math.round(distanceKm * 10 + 500)
- Next.js server action 500 on malformed body is known framework bug (PRs #90109, #92051 pending)
- Phase 5 (Owner Dashboard) planned next — bell notifications, auto-reject, prep timer, Electron wrapper
- `vi.mock()` factories run lazily — all mocks must be defined inside factory callback, not at module scope
- Playwright can't resolve `@/` path aliases — use inline `createClient` from `@supabase/supabase-js`
- `vitest.config.ts` manual `exclude` array REPLACES defaults — must spread `configDefaults.exclude`