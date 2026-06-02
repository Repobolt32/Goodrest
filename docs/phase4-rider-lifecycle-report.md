# Phase 4: Rider Lifecycle — Full Audit Report

**Date:** 2026-05-18  
**Branch:** master  
**Unit Tests:** 18/18 files pass, 94/94 tests pass  
**Build:** Not re-verified this session (was passing as of prior session)

---

## Executive Summary

Phase 4 (Rider Lifecycle / FCFS Delivery System) is **~90% complete**. All core backend and frontend code is implemented and functional. The main gaps are **E2E test staleness** (2 tests use the old admin-dispatch flow) and **missing unit test coverage** for riderActions.

---

## Component-by-Component Status

### 1. Server Actions: `riderActions.ts` — DONE
| Function | Status | Notes |
|----------|--------|-------|
| `getRiderByPhone` | Implemented | Simple lookup |
| `loginRider` | Implemented | Phone + password_hash auth |
| `acceptOrder` | Implemented | FCFS atomic `.is('rider_id', null)` guard |
| `startRiding` | Implemented | Transitions to `out_for_delivery` |
| `markOrderAsDeliveredRider` | Implemented | Calls `deliver_order` RPC |
| `updateLocation` | Implemented | Writes to `riders` + `rider_locations` |
| `getRiderStats` | Implemented | Lifetime + today aggregation |
| `getRiderActiveOrder` | Implemented | Single active order fetch |
| `getUnassignedOrders` | Implemented | `rider_id IS NULL` + status filter |

### 2. Rider Dashboard: `rider/dashboard/page.tsx` — DONE
- Stats grid (earnings, orders, distance)
- Active order card with status-dependent buttons
- Go Online/Offline toggle with geolocation `watchPosition`
- Supabase realtime subscription on orders
- OrderBroadcast component mounted

### 3. OrderBroadcast: `components/rider/OrderBroadcast.tsx` — DONE
- Supabase realtime `postgres_changes` on orders (INSERT + UPDATE)
- Client-side filter: `rider_id === null && status IN ('preparing','ready')`
- Audio ringtone on new order
- Auto-dismiss when another rider accepts
- `hasActiveOrder` prop hides broadcast

### 4. OrderTracker: `components/OrderTracker.tsx` — DONE
- 5-step status display (placed → preparing → ready → out_for_delivery → delivered)
- Live Google Maps embed iframe during `out_for_delivery`
- ETA countdown using `calculateETA(durationSeconds)`
- Rider location tracking via Supabase realtime on `riders` table
- "Call Rider" `tel:` link
- No "I got my food" customer self-deliver button (correctly removed)
- **Minor issue:** Rider location channel cleanup may not be properly wired in useEffect

### 5. Admin Dashboard: `OrdersDashboardClient.tsx` — DONE
- Manual dispatch UI fully removed (no Rider Phone input, no Tracking Link input, no DISPATCH button)
- Orders show "Waiting for rider assignment..." when ready
- "Delivered" button for admin override on out_for_delivery orders

### 6. Distance/ETA: `distance.ts` — DONE
- Google Maps Routes API (`routes.googleapis.com/directions/v2:computeRoutes`)
- `getGoogleMapsRouteData()` — returns `{ distanceKm, durationSeconds }`
- `calculateETA()` — 20min prep + real Google Maps `durationSeconds / 60` travel

### 7. Database Migrations — DONE
| Migration | What it does |
|-----------|-------------|
| `20260508_add_rider_system.sql` | Creates `riders`, `rider_locations` tables; adds `rider_id`, `rider_accepted_at` to orders |
| `20260509_rider_refactor.sql` | Adds `distance_km`, `rider_earning`, `rider_started_at` to orders; adds `total_deliveries`, `total_earnings` to riders; creates `deliver_order` RPC |
| `20260419071122_add_tracking_to_orders.sql` | Adds `rider_phone`, `tracking_url` to orders (earlier migration) |

### 8. Customer Tracking Page: `track/order/[id]/page.tsx` — DONE
- Passes `durationSeconds`, `riderStartedAt`, `orderLat`, `orderLng` to OrderTracker
- Supabase realtime + 5-second polling fallback

### 9. `adminActions.ts` — DONE
- `dispatchOrder` and `updateDispatchDetails` confirmed REMOVED

---

## Test Coverage

### Unit Tests (Vitest) — PASSING

| File | Tests | Status |
|------|-------|--------|
| `riderActions.test.ts` | 2 | Pass — but only covers `getRiderByPhone` and `updateLocation` |
| `OrderBroadcast.test.tsx` | 1 | Pass — only "renders nothing when no new order" |
| `OrderTracker.test.tsx` | 4 | Pass — step rendering, prop updates, call rider, cancelled state |
| `rider/dashboard/page.test.tsx` | 1 | Pass — only "renders without crashing" |
| `rider/login/page.test.tsx` | 2 | Pass — form renders, placeholder test |
| `distance.test.ts` | ? | Pass — covers `getGoogleMapsRouteData` and `calculateETA` |

**Gap:** 7 of 9 `riderActions` functions have zero unit test coverage (`loginRider`, `acceptOrder`, `startRiding`, `markOrderAsDeliveredRider`, `getRiderStats`, `getRiderActiveOrder`, `getUnassignedOrders`).

### E2E Tests (Playwright)

| File | Status | Issue |
|------|--------|-------|
| `tests/rider-journey.spec.ts` | **Current** | FCFS flow — rider login, go online, accept, start riding, deliver |
| `tests/whatsapp-dispatch.spec.ts` | **Current** | Rewritten for FCFS — verifies no dispatch UI, rider self-assigns |
| `tests/delivery-validation.spec.ts` | **Current** | Delivery radius/toggle verification |
| `src/tests/e2e/rider-flow-full-loop.spec.ts` | **STALE** | Uses old admin-dispatch flow (Rider Phone input, DISPATCH button) — will fail |
| `src/tests/e2e/order-tracking-refactor.spec.ts` | **STALE** | Uses old admin-dispatch flow — will fail |
| `src/tests/e2e/delivery-tracking.spec.ts` | **STALE** | Uses old admin-dispatch flow — will fail |
| `src/tests/e2e/dispatch-bypass.spec.ts` | **STALE** | Uses old dispatch flow — will fail |
| `src/tests/e2e/whatsapp-dispatch.spec.ts` | **STALE** | References WhatsApp dispatch — will fail |
| `src/tests/e2e/eta-verification.spec.ts` | **Likely stale** | References customer "Mark Delivered" button which may have been removed |
| `src/tests/e2e/tracking-edge-cases.spec.ts` | **OK** | Basic phone lookup — likely still valid |
| `src/tests/e2e/route-audit.spec.ts` | **OK** | Route accessibility — likely still valid |

---

## What Remains (Ordered by Priority)

### P0 — Blockers for Launch
1. **Run E2E tests against live server** — `tests/rider-journey.spec.ts`, `tests/whatsapp-dispatch.spec.ts`, `tests/delivery-validation.spec.ts` are the current FCFS tests. Need `npm run dev` + `npx playwright test` to verify they actually pass end-to-end.

### P1 — Should Fix Before Launch
2. **Delete or update 5 stale E2E tests** in `src/tests/e2e/` — These reference the old admin-dispatch flow and will fail. Either delete them or rewrite for FCFS:
   - `rider-flow-full-loop.spec.ts`
   - `order-tracking-refactor.spec.ts`
   - `delivery-tracking.spec.ts`
   - `dispatch-bypass.spec.ts`
   - `whatsapp-dispatch.spec.ts` (the one in `src/tests/e2e/`, not `tests/`)

### P2 — Nice to Have
3. **Add unit tests for riderActions** — 7 of 9 exported functions have no unit tests. Priority functions: `acceptOrder` (FCFS logic), `markOrderAsDeliveredRider` (RPC call), `startRiding`.
4. **OrderBroadcast unit test expansion** — Currently only 1 test (renders nothing). Should test: realtime event handling, accept flow, reject flow, auto-dismiss on other rider accept.
5. **OrderTracker cleanup issue** — Rider location channel cleanup may not be properly wired in the useEffect return.

### P3 — Post-Launch
6. **Google Maps API key rotation** — Key was exposed in chat history during development. Rotate before production.
7. **Scale concern** — OrderBroadcast subscribes to ALL orders table changes client-side. At scale, every rider gets every event. Consider server-side filtering.

---

## Verdict

**NOT fully live-ready.** The code is complete and unit tests pass, but:
- E2E tests have not been verified against a live server
- 5 stale E2E tests will fail if run
- No unit tests for 7/9 riderActions functions

**To get launch-ready:**
1. Run the 3 current E2E tests (`rider-journey`, `whatsapp-dispatch`, `delivery-validation`) against a live dev server
2. Delete or quarantine the 5 stale E2E tests
3. (Optional but recommended) Add unit tests for `acceptOrder`, `markOrderAsDeliveredRider`, `startRiding`
