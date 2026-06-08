# Goodrest Platform — Open Issues Registry (Merged & Verified)

**Merged from:** `issued.md` (2026-05-29) + `issues2.md` (2026-06-02)
**Last verified:** 2026-06-06 against commit `0cddb53`
**Total open:** 30 issues

---

## 🔴 CRITICAL (2)

### SEC-04-1 — Rider Server Actions Lack Session Auth
* **File:** `src/app/actions/riderActions.ts` (acceptOrder, startRiding, markOrderAsDeliveredRider)
* **Issue:** Only `verifyRiderExists` (UUID check) is used, not `verifyRiderSession`. Any valid rider UUID can impersonate any other rider. Admin/owner/report actions are protected.
* **Fix:** Add `verifyRiderSession()` + ownership check (rider_id matches session rider) to all rider mutations.

### SEC-08 — OrderTracker setState Pattern (Residual)
* **File:** `src/components/OrderTracker.tsx:147-161`
* **Issue:** ETA calculation now uses `useEffect`, but the component still subscribes to Supabase realtime directly in browser. Multiple rapid updates can still cause render thrashing.
* **Fix:** Consider throttling state updates or moving realtime subscription to parent with batched updates.

---

## 🟠 HIGH (9)

### BUG-02 — getOrdersForOwner Returns `[]` on Auth Failure
* **File:** `src/app/actions/ownerActions.ts:289`
* **Issue:** When `verifyAdminSession()` fails, returns `[]` instead of `{success:false, error}`. Client sees empty state, not auth error.
* **Fix:** Return explicit error object so UI can show "Access denied" instead of "No orders".

### BUG-05 — detectLocation No Loading Guard
* **File:** `src/components/CheckoutForm.tsx` (geolocation section)
* **Issue:** Parallel geolocation requests possible if user clicks rapidly.
* **Fix:** Add `isLocating` ref guard. Disable button while request in flight.

### BUG-06 — FloatingCart Returns `null` (Breaks AnimatePresence Exit)
* **File:** `src/components/FloatingCart.tsx:13`, `src/app/page.tsx:85-89`
* **Issue:** Component returns `null` when `totalItems === 0`. Parent wraps it in `AnimatePresence`, but since component returns `null` before any `motion.div`, the exit animation never fires.
* **Fix:** Return an empty `motion.div` with `exit` animation instead of `null`, or manage visibility in parent.

### BUG-07 — Weak Tests: Assert `success` But Not Payload
* **File:** `tests/unit/actions/orderActions.test.ts`, `ownerActions.test.ts`
* **Issue:** Tests pass even if wrong data sent to DB. False confidence.
* **Fix:** Assert exact arguments: `expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'preparing' }))`.

### BUG-12 — Direct Supabase Queries from Frontend
* **File:** `useMenu.ts:4`, `OrderTracker.tsx:166`, `OwnerDashboardClient.tsx:5`, `admin/layout.tsx:24`, `track/order/[id]/page.tsx:7`, `rider/dashboard/page.tsx:5`, `CheckoutForm.tsx` (geolocation)
* **Issue:** 15+ components/pages query Supabase directly from browser. RLS is the only protection.
* **Fix:** Route sensitive reads through Server Actions. Keep realtime subscriptions only for non-sensitive status updates.

### BUG-13 — Delivery Fee Math Beyond 5km
* **File:** `src/lib/pricing.ts:23`
* **Issue:** `AFTER_5KM_BASE + Math.ceil(distanceKm - 5) * AFTER_5KM_PER_KM`. Need to verify if `Math.ceil(distanceKm - 5)` is intentional (rounds up partial km) or should use raw subtraction.
* **Fix:** Document intent. If exact per-km: `AFTER_5KM_BASE + (distanceKm - 5) * AFTER_5KM_PER_KM`.

### BUG-15 — updateAppSettings No Bounds Checking
* **File:** `src/app/actions/settingsActions.ts:28-46`
* **Issue:** Accepts any number/value without validation. Negative prep time, 0 auto-reject, etc.
* **Fix:** Add min/max bounds for each setting (e.g., prep_time: 5-120, auto_reject: 1-30).

### BUG-16 — updatePrepTime Accepts Any Number
* **File:** `src/app/actions/ownerActions.ts:270-282`
* **Issue:** No validation. Negative prep time or 9999 minutes possible.
* **Fix:** Validate `minutes > 0 && minutes <= 120`.

### BUG-17 — RESTO_LAT/LNG Silently Defaults to 0,0
* **File:** `riderActions.ts:9-10`, `ownerActions.ts:11-12`
* **Issue:** `parseFloat(process.env.NEXT_PUBLIC_RESTO_LAT || '0')` — missing env var = Atlantic Ocean. Distance calculations break silently.
* **Fix:** Throw on startup if env vars missing. No fallback.

---

## 🟡 MEDIUM (12)

### QOL-01 — Hardcoded ₹45 Fallback Delivery Fee
* **File:** `src/components/CheckoutForm.tsx`
* **Issue:** Falls back to ₹45 if Maps API fails. Bypasses `max_delivery_radius`.
* **Fix:** Reject order or use default distance; no hardcoded fee.

### QOL-02 — updateItemPrice Allows Negative Values
* **File:** `src/app/actions/adminActions.ts`
* **Issue:** No validation. Negative prices possible.
* **Fix:** Validate `price > 0`.

### QOL-03 — Blind Type Cast `as unknown as MenuItem[]`
* **File:** `src/hooks/useMenu.ts`
* **Issue:** Bypasses TypeScript safety. Runtime crash if schema diverges.
* **Fix:** Validate with `zod` or runtime schema check.

### QOL-05 — Categories Fetched on Every Category Change
* **File:** `src/hooks/useMenu.ts:19-23`
* **Issue:** Fetches all categories on every mount/category switch. Should cache.
* **Fix:** Fetch once on mount. Filter client-side.

### QOL-06 — Hardcoded Rating "4.1" on All Menu Items
* **File:** `src/components/MenuItemCard.tsx`
* **Issue:** Fake data. Misleading customers.
* **Fix:** Remove or fetch real rating from reviews table.

### QOL-11 — Duplicated isValidUUID Function
* **File:** `ownerActions.ts:14`, `riderActions.ts:15`
* **Issue:** Copy-paste code. Maintenance burden.
* **Fix:** Extract to `src/lib/validation.ts`.

### QOL-12 — Excessive PII in Production Logs
* **File:** All server actions
* **Issue:** `console.log` / `console.error` dumps full objects with phone numbers, addresses.
* **Fix:** Sanitize logs. Log IDs only in production.

### QOL-14 — Razorpay Script Loaded Per-Form
* **File:** `src/components/CheckoutForm.tsx`
* **Issue:** Script injection pattern on every checkout mount.
* **Fix:** Move to `layout.tsx` or use Next.js `Script` component with `strategy="lazyOnload"`.

### QOL-15 — Error Status Uses Emoji String Matching
* **File:** `src/components/CheckoutForm.tsx`
* **Issue:** Fragile logic. `status.includes('❌')` breaks if emoji changes.
* **Fix:** Use error codes, not string/emoji matching.

### QOL-19 — loginRider Parameter Name Misleading
* **File:** `src/app/actions/riderActions.ts:40`
* **Issue:** Parameter named `password_hash` but client sends plaintext. Name causes confusion.
* **Fix:** Rename to `password`. (Note: `issues2.md` claims fixed — verified NOT fixed in code.)

### QOL-20 — OrderTracker.tsx Direct Supabase Client Query
* **File:** `src/components/OrderTracker.tsx`
* **Issue:** Queries `orders` + `riders` directly from browser. Relies entirely on RLS.
* **Fix:** Move initial fetch to Server Action. Keep realtime subscription for updates only.

---

## 🟢 LOW (6)

### LOW-03 — `.env.example` Missing Required Vars
* **File:** `.env.example`
* **Issue:** Incomplete documentation for new developers.
* **Fix:** Document all required env vars with descriptions.

### LOW-04 — Veg/Non-Veg Detection Uses Hardcoded Keywords
* **File:** `src/components/MenuItemCard.tsx`
* **Issue:** `item.name.toLowerCase().includes('chicken')` — fragile.
* **Fix:** Add `is_veg` boolean column to `menu_items`.

### LOW-06 — CheckoutSummary.tsx Missing `sizes` Prop on Image
* **File:** `src/components/CheckoutSummary.tsx`
* **Issue:** Next.js Image component without responsive sizes.
* **Fix:** Add `sizes` prop for optimization.

### LOW-07 — useCart.ts Writes localStorage on Every Mutation
* **File:** `src/hooks/useCart.ts`
* **Issue:** Synchronous write on every cart mutation.
* **Fix:** Already uses `useEffect` with dependency array. Minor — debounce if jank observed.

### LOW-10 — useCart Hydration Flicker
* **File:** `src/hooks/useCart.ts`
* **Issue:** Empty-state flash before localStorage loads.
* **Fix:** Use loading skeleton or `mounted` flag for initial render.

### LOW-14 — Test Files Use Inconsistent Mock Patterns
* **File:** All `*.test.ts`
* **Issue:** Some use `vi.fn()`, others use manual mocks.
* **Fix:** Standardize on `vi.fn()` + `mockResolvedValue`.

---

## 🔵 FLOW / BUSINESS LOGIC (3)

### FLOW-01 — Lack of Handover Control (Dispatch Workflow Mismatch)
* **File:** `src/app/actions/ownerActions.ts:160-201`, `src/app/actions/riderActions.ts`
* **Issue:** `dispatchOrder` sets `manual_dispatch = true`, but `startRiding` does NOT validate `manual_dispatch === true` before transitioning to `out_for_delivery`. Rider can start riding before owner explicitly dispatches.
* **Fix:** Add `manual_dispatch` gate in `startRiding`. Return error if false.

### FLOW-02 — Premature Rider Notification / Accept Flow Mismatch ✅ NOT A BUG
* **File:** Order creation flow
* **Issue:** Unassigned orders trigger audio broadcasts immediately upon creation. Owner should accept/confirm at POS first before riders see it.
* **Resolution:** Verified not a bug. Rider broadcast (`OrderBroadcast.tsx:99`) already filters `preparing`/`ready` — riders never see `confirmed` orders. 30-second owner dashboard delay works as intended. System functions correctly.

---

## 🔵 RUNTIME / EDGE CASE (2)

### RUN-02 — Grace Period Timer Drift & Client Clock Skew
* **File:** `src/app/track/order/[id]/page.tsx`, `src/components/OrderTracker.tsx`
* **Issue:** `Date.now()` uses client clock. Skewed clock = instant hide or extra-long cancel window.
* **Fix:** Calculate server-client delta on load. Use `serverTimestamp` as ground truth.

### RUN-03 — Owner Grace Period Delay Queue Sync Collisions
* **File:** `src/components/owner/OwnerDashboardClient.tsx`
* **Issue:** `setTimeout` appends order after 30s even if customer cancelled at 15s.
* **Fix:** Store pending orders in ref queue. On realtime UPDATE/DELETE, remove from queue.

---

## 🔵 DEPENDENCY VULNERABILITIES (6)

| Package | Severity | Advisory | Action |
|---------|----------|----------|--------|
| `next` | **High** | DoS via Server Components, middleware bypass, XSS | `npm audit fix --force` → 16.2.6 |
| `vite` | **High** | Path traversal via dev server WebSocket | `npm audit fix` |
| `tmp` | **High** | Path traversal via unsanitized prefix/postfix | `npm audit fix` |
| `postcss` | Moderate | XSS via unescaped `</style>` in CSS | `npm audit fix --force` |
| `brace-expansion` | Moderate | DoS via large numeric range | `npm audit fix` |
| `ws` | Moderate | Uninitialized memory disclosure | `npm audit fix` |

---

## ✅ REMOVED (Issues verified as FIXED in current code)

**From `issued.md` (17 removed):**
SEC-01, SEC-02, SEC-03, SEC-05, SEC-06, SEC-07, SEC-09, SEC-10,
BUG-01, BUG-08, BUG-09, BUG-10, BUG-11, BUG-14, BUG-18, BUG-19, BUG-20

**From `issues2.md` (10 removed):**
BUG-18 (ETA proximity), BUG-19 (Turbopack geolocation), BUG-20 (Omitted delivery fee),
BUG-21 (Inaccurate geolocation fallback), RUN-01 (GPS dropout debounce),
SEC-01 (Secrets in git), BUG-09 (Rate limiting), BUG-11 (Server validation),
BUG-23 (POS audio — fixed in commits `d30ee93` + `f98482f`)

**Note:** `issues2.md` claimed QOL-19 fixed but code still shows `password_hash`. Kept open.

---

*Registry merged: 2026-06-06*
*Open issues: 31 (2 Critical, 9 High, 12 Medium, 6 Low, 3 Flow, 2 Runtime, 6 Dependency)*
