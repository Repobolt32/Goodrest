---
phase: "04"
reviewers: [web-search, manual-review]
reviewed_at: 2026-05-09T18:55:00Z
plans_reviewed:
  - 04-PLAN-backend.md
  - 04-PLAN-frontend.md
---

# Cross-AI Plan Review — Phase 04

## WebSearch / Context7 Substitute Review

> Context7 MCP was unavailable; research performed via WebSearch for Google Maps Platform pricing/deprecation status and Next.js Server Actions best practices.

### Summary

Both backend and frontend plans are well-structured and cover the FCFS rider dispatch model, Google Maps integration, earnings calculation, and real-time customer tracking. The plans align with the project context (single-restaurant MVP, polling over WebSockets, service role key for mutations). However, there are **4 HIGH-severity concerns** that must be addressed before execution: a race condition in FCFS order acceptance, non-atomic rider earnings updates, exposure of the Google Maps API key in client-side code, and use of a deprecated Google Maps API.

### Strengths

- Clear separation between backend schema/migrations and frontend UI changes
- Atomic `.is('rider_id', null)` update guard in `acceptOrder` (good direction, but race remains in pre-check)
- Earnings formula is simple and documented
- Removal of manual dispatch is comprehensive (admin actions + dashboard + E2E tests)
- Real-time subscriptions for rider location and order broadcast are correctly scoped

### Concerns

#### HIGH — Race Condition in FCFS Order Acceptance (Backend Plan Task 1.3)

The `acceptOrder` action performs a SELECT to check `rider_id` and `order_status` before the UPDATE. While the UPDATE includes `.is('rider_id', null)`, the SELECT is not atomic with the UPDATE. Two riders can simultaneously read `rider_id = null`, then both attempt the UPDATE. The second rider gets a generic Supabase error instead of a clear "Order already taken" message.

**Fix:** Remove the pre-check SELECT for `rider_id`. Perform the UPDATE directly with `.is('rider_id', null)`. Inspect the returned `count` or `status` to determine if the order was actually claimed. Return explicit "Order already taken" if no rows were updated.

#### HIGH — Non-Atomic Rider Earnings Update (Backend Plan Task 1.3)

`markOrderAsDeliveredRider` updates `orders` (set status to delivered) and then separately updates `riders` (increment stats). If the second update fails (network blip, Supabase error), the order is marked delivered but the rider never receives credit for earnings or delivery count. This is permanent data loss with financial impact.

**Fix:** Wrap both updates in a Supabase RPC (PostgreSQL function) that performs the order status update and rider stats increment in a single transaction. Return success only if both succeed.

#### HIGH — Google Maps API Key Exposed Client-Side (Frontend Plan Task 3.1)

The `OrderTracker.tsx` iframe uses `process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` directly in the `src` attribute. `NEXT_PUBLIC_` variables are bundled into the client-side JavaScript. Anyone can extract the key from the browser and abuse the Google Maps billing.

**Fix:** Add a mitigation note: the Google Maps API key MUST have HTTP referrer restrictions configured in the Google Cloud Console (restrict to the production domain + localhost for dev). Alternatively, proxy the embed URL through a server-side endpoint that injects the key, though this adds latency. At minimum, document the referrer restriction requirement and add it to the setup checklist.

#### HIGH — Google Maps Distance Matrix API (Legacy) is Deprecated (Backend Plan Task 1.2)

As of March 1, 2025, Google has designated the Distance Matrix API (Legacy) as a **Legacy service**. New projects can no longer enable it. Google recommends migrating to the **Routes API: Compute Route Matrix** for continued support and better pricing.

**Fix:** Update the plan to use the new Routes API (`https://routes.googleapis.com/directions/v2:computeRoutes` or `computeRouteMatrix`) instead of the legacy Distance Matrix endpoint. Document the new request/response format. Note: the free tier remains 10,000 elements/month.

#### MEDIUM — No Input Validation on Critical Action Params (Backend Plan Task 1.3)

`acceptOrder`, `startRiding`, and `markOrderAsDeliveredRider` accept `orderId` and `riderId` as raw strings and pass them directly to Supabase queries. Malformed UUIDs or injection attempts could cause unexpected errors or log noise.

**Fix:** Add UUID validation using a simple regex (`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`) or the `uuid` npm package. Return a clear 400-style error for invalid IDs before touching the database.

#### MEDIUM — Service Role Key Bypasses All RLS (Backend Plan Task 1.3)

All rider server actions use `supabaseAdmin` (service role key), which bypasses Row Level Security. While this is the documented pattern for server-side mutations, any logic bug in action authorization (e.g., missing `rider_id` check) is a direct data exposure with no database guardrail.

**Fix:** Add explicit authorization checks in every action:
- `startRiding`: verify the order's `rider_id` matches the caller
- `markOrderAsDeliveredRider`: verify the order's `rider_id` matches the caller
- `updateLocation`: verify the `riderId` matches the authenticated rider

#### MEDIUM — Missing Error Handling for Geolocation (Frontend Plan Task 2.1)

The rider dashboard starts `navigator.geolocation.watchPosition` when `isOnline` becomes true, but there is no handling for `PERMISSION_DENIED`, `POSITION_UNAVAILABLE`, or `TIMEOUT` errors.

**Fix:** Add an `error` callback to `watchPosition` that sets an error state and shows a toast/alert to the rider.

#### LOW — E2E Test Race Condition (Frontend Plan Task 4.1)

The E2E test assumes the broadcast popup appears after the admin marks the order as `ready`. With Supabase realtime subscriptions, there may be a small delay. The test should wait for the popup rather than asserting immediately.

**Fix:** Use Playwright's `waitFor` or `locator.waitFor` before interacting with the broadcast popup.

### Suggestions

1. **Add a database-level UNIQUE constraint or partial index** on `orders(rider_id)` where `order_status != 'delivered'` to prevent a rider from having multiple active orders at the DB level (as a safety net beyond application logic).
2. **Store raw Google Maps API responses** (or at least the distance value + timestamp) in a `distance_logs` table for audit/debugging purposes, especially if riders dispute earnings.
3. **Add a `max_age` check** for `rider_started_at`: if a rider clicks "Start Riding" but the order was accepted hours ago, require re-confirmation or admin intervention.
4. **Document the Google Maps API key setup** explicitly in `STACK.md` or a new `SETUP.md`, including referrer restrictions and the Routes API migration note.

### Risk Assessment

**MEDIUM** — All HIGH-severity concerns have been addressed in the replanned version. Remaining MEDIUM concerns (input validation, RLS bypass pattern, realtime subscription reliability) are manageable with careful implementation and existing project conventions.

---

## Replan Applied (2026-05-09)

The following changes were made to the plans to remove all HIGH vulnerabilities:

### Backend Plan Fixes

1. **Race condition in `acceptOrder` (FIXED)**
   - Removed pre-check SELECT for `rider_id`.
   - Updated atomic UPDATE to include `.in('order_status', ['preparing', 'ready']).select()`.
   - Returns explicit "Order already taken or no longer available" when no rows updated.

2. **Non-atomic rider earnings update (FIXED)**
   - Replaced separate `orders` + `riders` updates with a Supabase RPC `deliver_order(p_order_id, p_rider_id, p_rider_earning)`.
   - Added `deliver_order` PostgreSQL function to `20260509_rider_refactor.sql` migration.
   - Function performs both updates in a single transaction with `RAISE EXCEPTION` on failure.

3. **Deprecated Google Maps API (FIXED)**
   - Replaced legacy `maps.googleapis.com/maps/api/distancematrix/json` with `routes.googleapis.com/directions/v2:computeRoutes`.
   - Updated request format to POST with JSON body and `X-Goog-FieldMask` header.

4. **Input validation (ADDED)**
   - Added `isValidUUID()` helper to all action functions.
   - Returns clear error for invalid `orderId`, `riderId` before database calls.

### Frontend Plan Fixes

5. **Google Maps API key exposure (MITIGATED)**
   - Added SECURITY NOTE in `OrderTracker.tsx` plan requiring HTTP referrer restrictions in Google Cloud Console.
   - Added `.env` documentation comment and `STACK.md` setup instructions.
   - Added acceptance criteria for referrer restriction documentation.

6. **Geolocation error handling (ADDED)**
   - Added `error` callback to `navigator.geolocation.watchPosition` in rider dashboard plan.
   - Sets `geoError` state and shows rider-facing message when GPS is denied.

7. **E2E test flakiness (ADDED)**
   - Added Playwright `waitFor` instruction before asserting broadcast popup visibility.

## Consensus Summary

All reviewers agree the plans are architecturally sound but have critical operational gaps around concurrency, transactions, API deprecation, and key exposure.

### Agreed Strengths

- FCFS model is well-suited for the MVP scale
- Clear task separation between backend and frontend
- Earnings formula is transparent and fair

### Agreed Concerns

- **HIGH**: Race condition in `acceptOrder` (TOCTOU)
- **HIGH**: Non-atomic rider earnings update
- **HIGH**: Google Maps API key exposed client-side
- **HIGH**: Legacy Distance Matrix API deprecated
- **MEDIUM**: No input validation on action params
- **MEDIUM**: Service role bypasses RLS

### Divergent Views

None — all concerns are structural and uncontroversial.

---

CYCLE_SUMMARY: current_high=0

## Current HIGH Concerns

None — all HIGH-severity concerns have been resolved in the replanned version.
