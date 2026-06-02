# Goodrest Platform — Complete Issue Registry (Verified)

Consolidated audit: 2026-05-29. Cross-verified against source code.

---

## Quick Stats

| Severity | Count |
|---|---|
| CRITICAL | 10 |
| HIGH | 17 |
| MEDIUM | 20 |
| LOW | 15 |
| Dependency Vulns | 6 |
| Runtime / Edge Cases | 5 |
| **Total** | **73** |

---

## CRITICAL ISSUES

### SEC-01 — Secrets Committed to Git
* **File:** `.env`, `release/`
* **Issue:** `JWT_SECRET`, `RAZORPAY_KEY_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` in version control.
* **Fix:** Rotate all secrets immediately. Add `.env` to `.gitignore`. Scrub from git history (`git filter-repo` or BFG).

### SEC-02 — Auto-Reject Cron Marks `payment_status = 'refunded'` Without Calling Razorpay
* **File:** `migrations/20260519100000:66-68`
* **Issue:** Customer gets refund in DB but Razorpay never processes it. Financial loss.
* **Fix:** Change to `payment_status = 'failed'` or implement actual Razorpay refund API call.

### SEC-03 — `E2E_MODE` Bypasses Payment Signature Verification (Ungated)
* **File:** `orderActions.ts:264-269`
* **Issue:** `verifyPaymentSignature` skips HMAC if `E2E_MODE === 'true'` and payment ID starts with `pay_test_`. Unlike middleware bypass (`middleware.ts:17` which gates on `NODE_ENV !== 'production'`), this payment bypass has NO environment gate. Accidental `E2E_MODE=true` in prod = any test payment ID bypasses signature.
* **Fix:** Gate payment signature bypass on `NODE_ENV !== 'production'` explicitly. Or remove entirely and mock in test setup.

### SEC-04 — No Authentication on ANY Server Action
* **File:** `adminActions.ts`, `ownerActions.ts`, `riderActions.ts`, `reportActions.ts`
* **Issue:** Every server action exposed without auth guards. Anyone can delete orders, trigger refunds, view financials via curl.
* **Fix:** Add session validation (cookies + JWT) at top of every action. Enforce role checks.

### SEC-05 — Order Cancellation / Help Message — `customerPhone` from Client, Not Session
* **File:** `orderActions.ts:361-369, 443-450`
* **Issue:** `cancelOrder` and `sendHelpMessage` accept `customerPhone` as function parameter from client. Attacker can spoof any phone number. Ownership check exists but input is untrusted.
* **Fix:** Extract `customerPhone` from secure server-side session/cookie, not from function parameter.

### SEC-06 — Double Refund Vulnerability
* **File:** `ownerActions.ts:196`
* **Issue:** `initiateRefund` doesn't check if refund already processed. Multiple refunds for same order.
* **Fix:** Guard with `refund_status !== 'refunded'` before calling Razorpay.

### SEC-07 — No Transaction Wrapping Order + Items Insert
* **File:** `orderActions.ts:83`
* **Issue:** `orders` inserted, then `order_items`. If second fails, ghost order created.
* **Fix:** Use Supabase RPC (stored procedure) for atomic transaction.

### SEC-08 — `setState` in Render Body Causes Double Renders
* **File:** `src/components/OrderTracker.tsx:135-154`
* **Issue:** `setState` called directly in render to sync props with state. Guard vars (`prevInitialStatus` etc.) prevent infinite loop, but React still re-renders after each setState call. Wastes render cycles.
* **Fix:** Move prop-to-state sync into `useEffect` with proper dependency array.

### SEC-09 — No Rate Limiting on Login or Order Creation
* **File:** `authActions.ts:12`, `orderActions.ts:44`
* **Issue:** Admin login brute-forceable. `updateLocation` spamable.
* **Fix:** Add per-IP rate limits (`upstash/ratelimit` or DB counter).

### SEC-10 — `createOrder` E2E Bypass Trusts Client `total_amount`
* **File:** `orderActions.ts:70-73`
* **Issue:** In `E2E_MODE`, `serverTotal = input.total_amount` bypasses DB price recalculation. If E2E leaked to prod, attacker can manipulate totals.
* **Fix:** Remove E2E bypass from production code path. Use test fixtures or mock DB in tests.

---

## HIGH ISSUES

### BUG-01 — `getOrderById` Relies Only on RLS
* **File:** `trackActions.ts:40`
* **Issue:** Returns full order by ID using public client. If RLS misconfigured = mass PII leak.
* **Fix:** Verify phone number from session matches order before returning.

### BUG-02 — `getOrdersForOwner` Returns `[]` on Error
* **File:** `ownerActions.ts:267`
* **Issue:** Swallows errors. Owner sees empty list instead of error state.
* **Fix:** Return error object, not empty array.

### BUG-03 — `useMenu.ts` Race Condition on Unmount
* **File:** `useMenu.ts:12-49`
* **Issue:** No AbortController. Category switch or unmount = setState on unmounted component.
* **Fix:** Use `AbortController` or `isMounted` flag in `useEffect`.

### BUG-04 — `useCart.ts` Race Condition from `setTimeout` Hydration
* **File:** `useCart.ts:19,25`
* **Issue:** `setTimeout(()=>{},0)` for hydration mismatch causes flicker and potential race.
* **Fix:** Combine into single state update. Use `useEffect` with mount flag.

### BUG-05 — `detectLocation` Has No Loading Guard
* **File:** `CheckoutForm.tsx:40-121`
* **Issue:** Parallel geolocation requests possible if user clicks rapidly.
* **Fix:** Add `isLocating` guard. Disable button while request in flight.

### BUG-06 — `FloatingCart` Dead `exit` Prop (No Parent `AnimatePresence`)
* **File:** `FloatingCart.tsx:13,20`
* **Issue:** Component returns `null` when `totalItems === 0`. Internal `motion.div` has `exit` prop but component unmounts before it can animate. Parent (`page.tsx:87`) does NOT wrap `FloatingCart` in `AnimatePresence`, so `exit` prop is useless dead code.
* **Fix:** Remove `exit` prop (no parent AnimatePresence) or wrap parent in AnimatePresence and return empty `motion.div` instead of `null`.

### BUG-07 — Weak Tests: Assert `success` But Not Payload
* **File:** `tests/unit/actions/orderActions.test.ts`, `ownerActions.test.ts`
* **Issue:** Tests pass even if wrong data sent to DB. False confidence.
* **Fix:** Assert exact arguments: `expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'preparing' }))`.

### BUG-08 — Missing Tests for Critical Functions
* **File:** `riderActions.test.ts` (`updateLocation`, `getRiderEarningHistory`), `orderActions` (`updateRefundStatus`)
* **Issue:** Complex IST date math and weekly aggregation untested.
* **Fix:** Add tests with `vi.setSystemTime` for timezone boundaries.

### BUG-09 — `updateLocation` No Rate Limiting
* **File:** `riderActions.ts`
* **Issue:** Spamable. DoS via DB connection exhaustion.
* **Fix:** Rate limit to 1 req per 5-10s per rider.

### BUG-10 — `sendHelpMessage` Missing `revalidatePath`
* **File:** `orderActions.ts:365-415`
* **Issue:** Next.js cache stale after help message update.
* **Fix:** Call `revalidatePath('/track/order/' + orderId)` after update.

### BUG-11 — `CheckoutForm.tsx` No Server-Side Validation
* **File:** `CheckoutForm.tsx:123-258`
* **Issue:** All form validation client-side only. Bypassable.
* **Fix:** Add server-side validation in `createOrder` action.

### BUG-12 — Direct Supabase Queries from Frontend
* **File:** `useMenu.ts`, `OrderTracker.tsx:220-234`
* **Issue:** Sensitive data fetched client-side. If RLS fails = mass PII exposure.
* **Fix:** Move sensitive queries to Server Actions.

### BUG-13 — Delivery Fee Math Error
* **File:** `pricing.ts:23`
* **Issue:** `Math.ceil(distanceKm) * rate` applies to entire distance, not distance beyond 5km.
* **Fix:** `AFTER_5KM_BASE + Math.ceil(distanceKm - 5) * AFTER_5KM_PER_KM`.

### BUG-14 — `order_items` Failure Silently Swallowed
* **File:** `orderActions.ts:105`
* **Issue:** On insert failure, sets `menu_item_id = null` and continues. Broken audit trail.
* **Fix:** Fail entire order creation. Surface error to user.

### BUG-15 — `updateAppSettings` No Bounds Checking
* **File:** `settingsActions.ts:28-46`
* **Issue:** Accepts any number/value without validation.
* **Fix:** Add min/max bounds for each setting.

### BUG-16 — `updatePrepTime` Accepts Any Number
* **File:** `ownerActions.ts:237-247`
* **Issue:** No validation. Negative prep time possible.
* **Fix:** Validate `prepTime > 0 && prepTime <= 120`.

### BUG-17 — `RESTO_LAT/LNG` Has Fallback to `0`
* **File:** `riderActions.ts:8-9`
* **Issue:** `parseFloat(process.env.NEXT_PUBLIC_RESTO_LAT || '0')` — missing env var silently defaults to 0,0 (Atlantic Ocean). Distance calculations break silently.
* **Fix:** Throw on missing env var. No fallback.

### BUG-18 — Delivery Fee Omitted from Customer Final Bill
* **File:** `orderActions.ts`
* **Issue:** When creating an order server-side, `createOrder` recalculates the total price using DB item prices, but completely forgets to calculate and append the client's delivery fee. As a result, the stored `total_amount` in the DB is just the subtotal of items, and the customer is never charged the delivery fee.
* **Fix:** Recalculate the delivery fee on the server using Google Maps distance API (or a fallback matching the client side) and add it to the final `serverTotal` in `createOrder` action before inserting the record into the database.

### BUG-19 — Inaccurate Pin Location via Geolocation IP Fallback
* **File:** `CheckoutForm.tsx:104-113`
* **Issue:** On devices without physical GPS (or under weak signal / geolocation dropout), the location service times out and triggers low-accuracy/IP triangulation fallback. This results in inaccurate customer coordinate mapping (e.g., placing the pin 2 houses away from actual address).
* **Fix:** Introduce an interactive address-refinement map pin widget on checkout, allowing users to manually drag the pin or search landmarks to align coordinates.

---

## MEDIUM ISSUES

### QOL-01 — Hardcoded Fallback Delivery Fee
* **File:** `CheckoutForm.tsx:81`
* **Issue:** Falls back to ₹45 if Maps API fails. Bypasses `max_delivery_radius`.
* **Fix:** Reject order or use default distance; no hardcoded fee.

### QOL-02 — `updateItemPrice` Allows Negative Values
* **File:** `adminActions.ts:71`
* **Issue:** No validation. Negative prices possible.
* **Fix:** Validate `price > 0`.

### QOL-03 — Blind Type Cast `as unknown as MenuItem[]`
* **File:** `useMenu.ts:43`
* **Issue:** Bypasses TypeScript safety. Runtime crash if schema diverges.
* **Fix:** Validate with `zod` or runtime schema check.

### QOL-04 — Dynamic `import()` on Every Click
* **File:** `CheckoutForm.tsx:44-45`
* **Issue:** Minor perf hit. Re-imports module on every button click.
* **Fix:** Move `import()` to top-level or memoize.

### QOL-05 — Categories Fetched on Every Category Change
* **File:** `useMenu.ts:17-27`
* **Issue:** Should fetch once, filter client-side.
* **Fix:** Fetch all categories on mount. Filter array locally.

### QOL-06 — Hardcoded Rating "4.1" on All Menu Items
* **File:** `MenuItemCard.tsx:62-63`
* **Issue:** Fake data. Misleading customers.
* **Fix:** Remove or fetch real rating from reviews table.

### QOL-07 — `suppressHydrationWarning` Masks Real Issues
* **File:** `layout.tsx:22`
* **Issue:** Without dark mode toggle, this suppresses actual hydration mismatches.
* **Fix:** Remove prop unless dark mode implemented.

### QOL-08 — No DB Indexes on Hot Columns
* **File:** DB schema
* **Issue:** Missing indexes on `orders(order_status)`, `orders(created_at)`, `order_items(order_id)`.
* **Fix:** Add indexes for query performance.

### QOL-09 — `refund_status` Default 'pending' Misleading
* **File:** `migrations/20260527`
* **Issue:** Non-cancelled orders show refund_status='pending'.
* **Fix:** Default to `'not_applicable'` or `'none'`.

### QOL-10 — `payments` Table Has No Foreign Key to `orders`
* **File:** DB schema
* **Issue:** Orphaned payment records possible.
* **Fix:** Add `FOREIGN KEY (order_id) REFERENCES orders(id)`.

### QOL-11 — Duplicated `isValidUUID` Function
* **File:** `ownerActions.ts:13`, `riderActions.ts:12`
* **Issue:** Copy-paste code. Maintenance burden.
* **Fix:** Extract to shared utility `src/lib/validation.ts`.

### QOL-12 — Excessive PII in Production Logs
* **File:** All server actions
* **Issue:** `console.error` dumps full objects with phone numbers, addresses.
* **Fix:** Sanitize logs. Log IDs only, not PII.

### QOL-13 — No Storage Failure Tests for `uploadDishImage`
* **File:** `tests/unit/actions/adminActions.test.ts`
* **Issue:** Happy path only. No error path coverage.
* **Fix:** Mock storage upload returning error.

### QOL-14 — `Razorpay Script` Loaded Inside Form
* **File:** `CheckoutForm.tsx:483-486`
* **Issue:** Script injection pattern. Should load once at app level.
* **Fix:** Move to `layout.tsx` or use Next.js Script component with strategy.

### QOL-15 — Error Status Uses Emoji String Matching
* **File:** `CheckoutForm.tsx:388`
* **Issue:** Fragile logic. `status.includes('❌')` breaks if emoji changes.
* **Fix:** Use error codes, not string/emoji matching.

### QOL-16 — `menu_items` Has Duplicate Category Columns
* **File:** DB types
* **Issue:** `category` TEXT + `category_id` UUID. Redundant, risks inconsistency.
* **Fix:** Use only `category_id` with FK to categories table.

### QOL-17 — `rider_locations.id` Type Mismatch
* **File:** DB types
* **Issue:** `id` defined as number but used as UUID elsewhere.
* **Fix:** Align type with usage (UUID).

### QOL-18 — No `updated_at` Trigger on `orders`
* **File:** DB schema
* **Issue:** `updated_at` column never updates automatically.
* **Fix:** Add trigger or use `DEFAULT now()` + application updates.

### QOL-19 — `loginRider` Parameter Name Misleading
* **File:** `riderActions.ts:27`
* **Issue:** Parameter named `password_hash` but client sends plaintext password. Server hashes with bcrypt. Name causes confusion.
* **Fix:** Rename parameter to `password`. Already uses `bcrypt.compare` correctly.

### QOL-20 — `OrderTracker.tsx` Direct Supabase Client Query
* **File:** `OrderTracker.tsx:220-234`
* **Issue:** Queries `orders` and `riders` directly from browser. Relies entirely on RLS.
* **Fix:** Move to Server Action with ownership check.

---

## LOW ISSUES

### LOW-01 — JWT Uses HS256 (Symmetric)
* **File:** `authActions.ts:19`
* **Issue:** Single secret compromise = forged tokens.
* **Fix:** Consider RS256 or ES256 for asymmetric verification.

### LOW-02 — No Token Revocation / JTI Claim
* **File:** `authActions.ts:18-21`
* **Issue:** Cannot invalidate leaked tokens before expiry.
* **Fix:** Add `jti` claim + revocation list or short expiry + refresh.

### LOW-03 — `.env.example` Missing Required Vars
* **File:** `.env.example`
* **Issue:** Incomplete documentation for new developers.
* **Fix:** Document all required env vars with descriptions.

### LOW-04 — Veg/Non-Veg Detection Uses Hardcoded Keywords
* **File:** `MenuItemCard.tsx:25-26`
* **Issue:** `item.name.toLowerCase().includes('chicken')` — fragile.
* **Fix:** Add `is_veg` boolean column to `menu_items`.

### LOW-05 — `showOrderCount` Only True for Chicken Items
* **File:** `MenuItemCard.tsx:20`
* **Issue:** Arbitrary logic. Should show for all or none.
* **Fix:** Remove condition or make data-driven.

### LOW-06 — `CheckoutSummary.tsx` Missing `sizes` Prop on Image
* **File:** `CheckoutSummary.tsx:46-54`
* **Issue:** Next.js Image component without responsive sizes.
* **Fix:** Add `sizes` prop for optimization.

### LOW-07 — `useCart.ts` `localStorage.setItem` on Every Change
* **File:** `useCart.ts:31`
* **Issue:** Synchronous write on every cart mutation. Slight jank.
* **Fix:** Debounce or use `useEffect` with dependency array.

### LOW-08 — Column Ordering Inconsistency in Types
* **File:** `types/database.types.ts`
* **Issue:** Makes diffs noisy and reviews harder.
* **Fix:** Alphabetize or follow schema order consistently.

### LOW-09 — `delivered_at` Column Added After RPC Referenced It
* **File:** DB migrations
* **Issue:** Migration ordering bug. RPC may fail before column exists.
* **Fix:** Reorder migrations. RPC must come after column migration.

### LOW-10 — `useCart` Hydration Flicker
* **File:** `useCart.ts:19-25`
* **Issue:** `setTimeout` workaround causes visible empty-state flash.
* **Fix:** Use loading skeleton or `useEffect` with mount flag.

### LOW-11 — Missing Dark Mode Toggle
* **File:** `layout.tsx`
* **Issue:** `suppressHydrationWarning` implies dark mode planned but not implemented.
* **Fix:** Implement toggle or remove prop.

### LOW-12 — `CheckoutForm` Dynamic Import Unnecessary
* **File:** `CheckoutForm.tsx:44-45`
* **Issue:** Module small enough for static import.
* **Fix:** Evaluate if dynamic import saves meaningful bytes.

### LOW-13 — `OrderTracker` Prop-to-State Sync in Render
* **File:** `OrderTracker.tsx:135-154`
* **Issue:** Related to SEC-08 but also causes extra renders even without infinite loop.
* **Fix:** Same fix as SEC-08 — use `useEffect`.

### LOW-14 — Test Files Use Inconsistent Mock Patterns
* **File:** All `*.test.ts`
* **Issue:** Some use `vi.fn()`, others use manual mocks. Inconsistent.
* **Fix:** Standardize on `vi.fn()` + `mockResolvedValue`.

### LOW-15 — `getDailyReport` No Authorization
* **File:** `reportActions.ts:25`
* **Issue:** Financial data exposed without auth check. (Also in CRITICAL SEC-04 but worth separate LOW for data classification).
* **Fix:** Restrict to authenticated owner/admin only.

---

## DEPENDENCY VULNERABILITIES

| Package | Severity | Advisory | Fix |
|---|---|---|---|
| `next` | **High** | DoS via Server Components, middleware bypass, XSS in beforeInteractive, cache poisoning | `npm audit fix --force` → 16.2.6 |
| `vite` | **High** | Path traversal, arbitrary file read via dev server WebSocket | `npm audit fix` |
| `tmp` | **High** | Path traversal via unsanitized prefix/postfix | `npm audit fix` |
| `postcss` | Moderate | XSS via unescaped `</style>` in CSS output | `npm audit fix --force` |
| `brace-expansion` | Moderate | DoS via large numeric range | `npm audit fix` |
| `ws` | Moderate | Uninitialized memory disclosure | `npm audit fix` |

---

## RUNTIME / EDGE CASE ISSUES (from original issued.md)

### RUN-01 — Rider Geolocation Dropout Causes Instant Offline
* **File:** `src/app/rider/dashboard/page.tsx`
* **Issue:** `watchPosition` error handler calls `setIsOnline(false)` immediately. Tunnel = offline.
* **Fix:** Implement retry/debounce: 3 consecutive errors or 15s timeout before toggling offline. Show "Weak GPS Signal" warning.

### RUN-02 — Grace Period Timer Drift & Client Clock Skew
* **File:** `src/app/track/order/[id]/page.tsx`, `OrderTracker.tsx`
* **Issue:** `Date.now()` uses client clock. Skewed clock = instant hide or extra-long cancel window.
* **Fix:** Calculate server-client delta on load: `delta = ServerTimestamp - ClientTimestamp`. Evaluate `Date.now() + delta`.

### RUN-03 — Owner Grace Period Delay Queue Sync Collisions
* **File:** `src/components/owner/OwnerDashboardClient.tsx`
* **Issue:** `setTimeout` appends order after 30s even if customer cancelled at 15s.
* **Fix:** Store pending orders in ref queue. On realtime UPDATE/DELETE, remove from queue. Check queue before rendering on timeout.

### RUN-04 — Silent WebSocket Drops on Mobile Tab Sleep
* **File:** Global realtime (all screens)
* **Issue:** Mobile browsers suspend WebSockets in background. Reopening tab shows stale data.
* **Fix:** Add `visibilitychange` listener. On `visible`, tear down stale channel, rebuild subscription, force lightweight server fetch to catch up.

### RUN-05 — Stale Razorpay Order Intents on Cart Modifications
* **File:** `src/app/checkout/page.tsx`
* **Issue:** User modifies cart after creating Razorpay intent. Pays old amount, receipt shows new items.
* **Fix:** Before opening Razorpay, compare cart hash + total against DB order. If mismatch, void old order, clear cached ID, generate new intent.

---

## VERIFICATION NOTES (Cross-Check Log)

| Issue | Original Claim | Verdict | Action |
|---|---|---|---|
| SEC-04 | Weak fallback secrets in code | Code throws on missing. `.env` weakness is ops issue | **Rephrased** to target `.env` values |
| SEC-05 | Server trusts client `total_amount` | Server recalculates from DB prices | **Removed.** E2E bypass kept as SEC-10 |
| SEC-06 | Rider passwords plaintext | Uses `bcrypt.compare()` | **Removed entirely** |
| SEC-07 | Webhook uses anon client | Uses `supabaseAdmin` | **Removed entirely** |
| SEC-09 | `startRiding` revives cancelled | Has `allowedStatuses = ['preparing','ready']` | **Removed entirely** |
| SEC-10 | `markFoodReady` stale update success | Checks `!updated` and returns error | **Removed entirely** |
| SEC-11 | `initiateRefund` fire-and-forget | Checks `dbUpdateError` and returns error | **Removed entirely** |
| SEC-12 (orig) | Payment race condition | Already has `.eq('payment_status','pending')` lock | **Removed entirely** |
| SEC-08 | Infinite loop in OrderTracker | Guard prevents loop; causes double renders | **Reworded** to Medium severity |
| BUG-06 | FloatingCart null in AnimatePresence | Parent not in AnimatePresence; dead `exit` prop | **Reworded** to dead code issue |

---

## FIX PRIORITY

### Phase 1: Security (CRITICAL 1-13)
1. Rotate secrets, scrub git history
2. Fix auto-reject cron (no fake refund)
3. Gate `E2E_MODE` on `NODE_ENV !== 'production'`
4. Add auth guards to ALL server actions
5. Extract `customerPhone` from session, not param
6. Fix double refund
7. Wrap order + items in transaction
8. Fix OrderTracker infinite loop
9. Add status guard to `startRiding`
10. Fix `markFoodReady` stale update check
11. Fix `initiateRefund` fire-and-forget
12. Add rate limiting to login and `updateLocation`
13. Remove `total_amount` E2E bypass from `createOrder`

### Phase 2: Bugs (HIGH 1-17)
- Fix privacy leak in `getOrderById`
- Fix `getOrdersForOwner` error swallowing
- Fix `FloatingCart` animation
- Add server-side form validation
- Move frontend Supabase queries to Server Actions
- Fix delivery fee math
- Fix `order_items` silent swallow
- Strengthen tests with payload assertions
- Add missing critical function tests
- Add `revalidatePath` to `sendHelpMessage`
- Add bounds checking to settings
- Validate `updatePrepTime`
- Fix `RESTO_LAT/LNG` fallback to 0

### Phase 3: Quality (MEDIUM + LOW)
- Remove hardcoded values (rating, fallback fee, veg detection)
- Add DB indexes and FKs
- Fix `.env.example`
- Standardize test mock patterns
- Clean up duplicate functions
- Sanitize production logs
- Remove emoji string matching
- Add `sizes` prop to Images
- Fix type mismatches in DB schema
- Add `updated_at` triggers

### Phase 4: Runtime Edge Cases
- Implement rider geolocation debounce
- Server-calibrated grace period timer
- Owner queue guard with realtime cleanup
- Tab visibility + WebSocket reconnect
- Cart integrity check before Razorpay

---

## VERIFICATION CHECKLIST

After each phase, run:
```bash
npm run build && npm run test && npm run lint
npm audit
python .opencode/scripts/checklist.py
```

---

*Registry updated: 2026-05-29*
*Total issues: 76 (13 Critical, 17 High, 20 Medium, 15 Low, 6 Dependency, 5 Runtime)*
*Cross-verified: 5 false/misleading issues removed, 1 rephrased*
