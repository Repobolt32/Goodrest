# Codebase Concerns

**Analysis Date:** 2026-05-09

## Tech Debt

### Hardcoded Fallback Secrets and Passwords

- Issue: JWT secret, admin password, and Razorpay test bypass logic have hardcoded fallbacks that will silently activate if environment variables are missing.
- Files:
  - `src/middleware.ts:6` — `JWT_SECRET` fallback: `'fallback-secret-change-me-in-production'`
  - `src/app/actions/authActions.ts:7` — `JWT_SECRET` fallback: `'fallback-secret-change-me-in-production'`
  - `src/app/actions/authActions.ts:10` — `ADMIN_PASSWORD` fallback: `'goodrest88'`
  - `playwright.config.ts:60` — `ADMIN_PASSWORD` fallback: `'goodrest88'`
  - `playwright.config.ts:61` — `JWT_SECRET` fallback: `'fallback-secret-change-me-in-production'`
- Impact: Production deployment with missing env vars results in trivially guessable admin credentials and forgeable JWT tokens.
- Fix approach: Remove ALL fallbacks. Throw at startup if required secrets are undefined. Use a startup validation module.

### E2E Test Bypasses in Production Code

- Issue: Multiple code paths bypass security checks when `E2E_MODE` is enabled, and the E2E verification bypass for Razorpay signatures lives in production payment verification logic.
- Files:
  - `src/middleware.ts:15` — Completely skips `/admin` auth when `E2E_MODE === 'true'`
  - `src/app/actions/orderActions.ts:208-212` — Skips HMAC signature verification for payments starting with `pay_test_` when `E2E_MODE` is true
  - `playwright.config.ts:58` — Injects `E2E_MODE: 'true'` into the dev server
- Impact: If `E2E_MODE` is accidentally set in production, all admin auth and payment verification are disabled. The payment bypass is particularly dangerous as it accepts any test-looking payment ID.
- Fix approach: Extract E2E bypasses into a separate test-only helper that is never imported by production code. Gate middleware bypass behind both `E2E_MODE` AND `NODE_ENV !== 'production'`.

### Incorrect React Hook Usage

- Issue: `useState` is used with an async initializer function, which is an anti-pattern. The initializer runs but its return value is discarded, and the async side effect never integrates with React's lifecycle.
- File: `src/components/admin/MenuManagementClient.tsx:93-102`
- Impact: Delivery radius settings may not load correctly on first render, causing stale default values. Also triggers a React warning in Strict Mode.
- Fix approach: Replace with `useEffect`:
  ```typescript
  useEffect(() => {
    const init = async () => { /* ... */ };
    init();
  }, []);
  ```

### `any` Type Usage

- Issue: Multiple components use `any` for state, Supabase realtime payloads, and test mocks, erasing TypeScript's safety guarantees.
- Files:
  - `src/components/rider/OrderBroadcast.tsx:10` — `useState<any>(null)` for newOrder
  - `src/components/rider/OrderBroadcast.tsx:26` — `(payload: any)` in realtime callback
  - `src/app/rider/dashboard/page.tsx:22` — `useState<any>(null)` for rider
  - `src/app/rider/dashboard/page.tsx:24` — `useState<any>(null)` for activeOrder
  - `src/app/rider/dashboard/page.tsx:59` — `(payload: any)` in realtime callback
  - `src/components/OrderTracker.test.tsx:10-25` — Multiple icon mocks typed as `any`
  - `src/hooks/useMenu.ts:43` — `data as unknown as MenuItem[]`
- Impact: Runtime type errors in Supabase realtime payloads will crash components. Refactoring becomes dangerous because the compiler provides no assistance.
- Fix approach: Use generated Supabase types (`Database['public']['Tables']['orders']['Row']`) for payloads. Define strict interfaces for rider and active order state.

### Console Logging in Production

- Issue: Extensive `console.log` and `console.error` calls are present throughout production source files, not just tests.
- Files with most logging:
  - `src/app/actions/orderActions.ts` — ~25 log statements tracing every step of order creation and payment
  - `src/app/api/webhook/razorpay/route.ts` — ~10 log statements
  - `src/components/CheckoutForm.tsx` — ~15 log statements
  - `src/components/admin/OrdersDashboardClient.tsx` — console.warn for audio failures
- Impact: Sensitive order data, customer names, phone numbers, and payment IDs may leak into server logs or browser consoles in production.
- Fix approach: Replace all production logging with a proper logger (e.g., `pino`) that supports log levels and redaction. Remove debug logs entirely from production builds.

### Cart localStorage Without Schema Versioning

- Issue: Cart items are serialized to localStorage with no version field. A schema change (e.g., adding `category_id`) will cause `JSON.parse` to produce incompatible objects.
- File: `src/hooks/useCart.ts:16-22`
- Impact: After a menu schema update, returning customers may have corrupted carts that crash the checkout form.
- Fix approach: Add a `__v` field to stored cart data. On load, validate and migrate or clear stale versions.

## Known Bugs

### Race Condition in Order Status Updates

- Issue: Order `payment_status` and `order_status` can be updated simultaneously by the Razorpay webhook (`src/app/api/webhook/razorpay/route.ts`) and the client-side `verifyPaymentSignature` (`src/app/actions/orderActions.ts`). Both paths run `update(...).eq(id, order.id)` without row-level locking.
- Impact: In rare cases, a webhook and a client callback may interleave, resulting in inconsistent state (e.g., `payment_status='paid'` but `order_status='created'`).
- Fix approach: Use a single source of truth for payment transitions. Have the webhook be the authoritative updater, and make client verification return success without writing if the webhook has already processed.

### Order Acceptance Race Condition

- Issue: `acceptOrder` in `src/app/actions/riderActions.ts:33-59` checks `rider_id` in a separate query, then updates in a second query. Another rider could accept between the read and write.
- Impact: Two riders may simultaneously believe they accepted the same order.
- Fix approach: Use a Supabase RPC with `UPDATE ... SET rider_id = ... WHERE id = ... AND rider_id IS NULL` and check `status` of the returned row.

### Missing Order Items on Failure

- Issue: `createOrder` inserts the main order row, then inserts `order_items` separately. If the second insert fails, the order exists but the audit trail does not.
- File: `src/app/actions/orderActions.ts:87-99`
- Impact: Billing reconciliation and menu analytics become inaccurate.
- Fix approach: Wrap both inserts in a database transaction (Supabase does not support multi-table transactions directly; use a Postgres function or RPC).

## Security Considerations

### Plaintext Password Comparison

- Risk: Rider login compares the user-provided password directly against `password_hash` in the database without any hashing. The column name is misleading — the code treats it as plaintext.
- File: `src/app/actions/riderActions.ts:18-31`
- Current mitigation: None. The `riders` table RLS allows public SELECT, so any client with the anon key can read all `password_hash` values.
- Recommendations: Implement bcrypt/argon2 hashing. Store only hashes. Compare using a timing-safe function. Remove the SELECT policy on `riders`.

### Rider Authentication via localStorage

- Risk: Rider session is stored in `localStorage` (`src/app/rider/login/page.tsx:24`), not an HTTP-only cookie. This is vulnerable to XSS exfiltration.
- Files:
  - `src/app/rider/login/page.tsx:24`
  - `src/app/rider/dashboard/page.tsx:28-34`
- Current mitigation: None.
- Recommendations: Move rider auth to server-side sessions (same pattern as admin JWT cookie). Protect `/rider/dashboard` with middleware.

### Customer Can Mark Any Order Delivered

- Risk: `markOrderAsDeliveredCustomer` in `src/app/actions/trackActions.ts:55-67` requires only an order ID. There is no ownership check (no phone number or session verification).
- Impact: Any user with an order ID can mark any order as delivered, including orders belonging to other customers.
- Recommendations: Require the customer's phone number as a secondary parameter and verify it against the order record before updating.

### Open Row Level Security on Riders

- Risk: The `riders` table RLS policies allow unrestricted public SELECT and unrestricted UPDATE.
- File: `supabase/migrations/20260508_add_rider_system.sql:29-33`
- Impact: Any authenticated or unauthenticated Supabase client can read all rider data (including `password_hash`) and update any rider row.
- Recommendations: Replace `USING (true)` with proper auth checks. Use Supabase Auth or custom JWT claims for rider identity.

### Admin Delete Order is Permanent and Unrestricted

- Risk: `deleteOrder` in `src/app/actions/adminActions.ts:76-89` performs a hard `DELETE` with no soft-delete, no audit log, and no confirmation beyond a browser `alert()`.
- Impact: Accidental or malicious deletion permanently removes order history.
- Recommendations: Implement soft delete (`deleted_at` timestamp). Require a confirmation reason. Log deletions to an audit table.

### Search Query String Interpolation

- Risk: Admin order search in `src/app/admin/orders/page.tsx:24` uses `.or(\`customer_phone.ilike.%${query}%,...\`)`. Supabase parameterizes this, but the pattern is fragile.
- Impact: If the query contains `%` or `_` SQL wildcards, search behavior becomes unpredictable.
- Recommendations: Sanitize the query string by escaping wildcards before passing to Supabase.

## Performance Bottlenecks

### No Throttling on Rider Location Updates

- Problem: `navigator.geolocation.watchPosition` calls `updateLocation` on every position change without debouncing or throttling.
- File: `src/app/rider/dashboard/page.tsx:83-101`
- Cause: GPS updates can fire multiple times per second.
- Improvement path: Batch location updates. Send only if position changed by >50m or if 30 seconds elapsed since last update.

### Admin Orders Page Limited to 10 Orders

- Problem: The admin orders page fetches only the 10 most recent orders with no pagination or infinite scroll.
- File: `src/app/admin/orders/page.tsx:32-38`
- Cause: Hardcoded `.limit(10)`.
- Improvement path: Implement cursor-based pagination or an "Load More" button with `range()`.

### Multiple Overlapping Realtime Channels

- Problem: `SingleOrderPage` (`src/app/track/order/[id]/page.tsx`) subscribes to Supabase realtime AND runs a 5-second polling interval simultaneously. The same order data is fetched through two redundant mechanisms.
- Impact: Unnecessary network requests and Supabase connection usage.
- Improvement path: Remove the polling fallback. Rely on realtime with a single reconnection strategy.

### AudioContext Created per Notification

- Problem: `OrdersDashboardClient` instantiates a new `AudioContext` for every new order notification.
- File: `src/components/admin/OrdersDashboardClient.tsx:260-282`
- Cause: The `playNotificationSound` function creates `new AudioContext()` on every call.
- Improvement path: Reuse a single `AudioContext` instance. Modern browsers limit the number of concurrent AudioContexts.

## Fragile Areas

### Friendly ID Dependency on Database Trigger

- Files:
  - `src/components/admin/OrdersDashboardClient.tsx:284-308` — `fetchFullOrder` retries up to 5 times with exponential backoff waiting for `friendly_id` to appear
- Why fragile: If the database trigger that generates `friendly_id` fails or is slow, the admin UI shows incomplete order data or retries excessively.
- Safe modification: Ensure the trigger is idempotent and tested. Consider generating `friendly_id` in application code before insert.
- Test coverage: No direct tests for the trigger logic.

### Dual Storage of Order Items

- Files:
  - `src/app/actions/orderActions.ts:64` — `items` stored as JSONB in `orders` table
  - `src/app/actions/orderActions.ts:87-99` — `order_items` normalized rows
- Why fragile: Two sources of truth for the same data. If `order_items` insert fails (marked "non-fatal"), the JSONB `items` field still contains data, but analytics and audit queries on `order_items` will be incomplete.
- Safe modification: Treat `order_items` as the canonical source. Remove `items` JSONB column or keep it as a read-only cache with a database-level consistency check.
- Test coverage: Integration test verifies `order_items` are created but does not test the failure case.

### Hardcoded Restaurant Coordinates

- Files:
  - `src/components/CheckoutForm.tsx:62-63` — `parseFloat(process.env.NEXT_PUBLIC_RESTO_LAT || '0')`
  - `src/components/OrderTracker.tsx:88-89` — `parseFloat(process.env.NEXT_PUBLIC_RESTO_LAT || '28.6139')` (defaults to Delhi)
- Why fragile: Default coordinates point to a real location in Delhi. If the environment variable is missing, the app calculates distances from Delhi regardless of actual restaurant location.
- Safe modification: Remove all defaults. Throw a configuration error at build time if coordinates are missing.

### Payment Verification Bypass for E2E

- Files: `src/app/actions/orderActions.ts:208-214`
- Why fragile: The test bypass is compiled into production code and activated by an env var. A misconfiguration enables payment fraud.
- Safe modification: Move bypass logic to a test-only module under `src/tests/helpers/` that monkey-patches during E2E setup, never shipping with production.

### File Upload Filename Collision Risk

- File: `src/app/actions/adminActions.ts:221`
- Why fragile: `Math.random().toString(36).substring(2)` is not cryptographically random and has a small but non-zero collision probability.
- Safe modification: Use `crypto.randomUUID()` or a timestamp + random suffix with sufficient entropy.

## Scaling Limits

### Supabase Realtime Connections

- Current capacity: Each admin session, each order tracking page, and each rider dashboard opens a separate Supabase realtime channel.
- Limit: Supabase free tier limits concurrent connections. With ~100 simultaneous users (admins + customers tracking + riders), connections may be throttled.
- Scaling path: Consolidate channels where possible. Use server-sent events or a single shared channel for broadcast updates instead of per-user channels.

### Order Items Audit Table Growth

- Current capacity: `order_items` table grows linearly with orders. No archiving or partitioning.
- Limit: As order volume increases, queries on `order_items` will slow down.
- Scaling path: Add indexes on `order_id` and `menu_item_id`. Implement monthly table partitioning or an archived_orders mechanism.

## Dependencies at Risk

### `razorpay` SDK Version

- Risk: Using `razorpay@^2.9.6`. The SDK has a known deprecation path; Razorpay recommends migrating to their newer `@razorpay/sdk` packages.
- Impact: Future breaking changes in webhook payload structure or API endpoints may not be supported.
- Migration plan: Monitor Razorpay's migration guide. The `validatePaymentVerification` and `validateWebhookSignature` functions are the critical integration points to test during any upgrade.

### `framer-motion` in Server Components Risk

- Risk: `framer-motion` is imported in many client components but the library's bundle size is significant (~40KB gzipped).
- Impact: Initial JS bundle for customer-facing pages is larger than necessary.
- Migration plan: Audit which animations are essential. Consider CSS transitions for simple hover/fade effects, reserving `framer-motion` for complex layout animations only.

## Missing Critical Features

### Input Validation Library

- Problem: No Zod, Yup, or Valibot schemas validate user inputs. Server actions receive raw FormData and objects with only basic null checks.
- Blocks: Safe refactoring of API contracts, automatic OpenAPI generation, robust error messages.
- Priority: High

### Rate Limiting

- Problem: No rate limiting on any endpoint. The webhook route, checkout form submission, rider login, and admin login are all unprotected.
- Blocks: Production deployment is vulnerable to brute-force and DDoS.
- Priority: High

### Error Tracking and Monitoring

- Problem: No Sentry, LogRocket, or similar error tracking. Failures are only visible in console logs or Supabase logs.
- Blocks: Debugging production issues is reactive and dependent on user reports.
- Priority: Medium

## Test Coverage Gaps

### Server Actions Without Unit Tests

- What's not tested:
  - `createOrder` success and failure paths (`src/app/actions/orderActions.ts`)
  - `verifyPaymentSignature` HMAC logic and E2E bypass branch
  - `generateRazorpayOrder` idempotency guard
  - All `adminActions.ts` functions (CRUD, image upload)
  - `authActions.ts` JWT creation and cookie setting
  - `trackActions.ts` order fetching and status updates
  - `settingsActions.ts` settings read/write
- Files: `src/app/actions/orderActions.ts`, `src/app/actions/adminActions.ts`, `src/app/actions/authActions.ts`, `src/app/actions/trackActions.ts`, `src/app/actions/settingsActions.ts`
- Risk: Core business logic changes can break silently. Payment flow regressions are especially dangerous.
- Priority: High

### Webhook Handler Untested

- What's not tested: `src/app/api/webhook/razorpay/route.ts` — signature verification, event routing, idempotency, error handling.
- Risk: A Razorpay payload format change or a bug in signature validation would only be caught in production.
- Priority: High

### Complex Components Untested

- What's not tested:
  - `CheckoutForm.tsx` — form submission, Razorpay integration, COD path
  - `MenuManagementClient.tsx` — modal CRUD, image upload, optimistic updates
  - `OrdersDashboardClient.tsx` — realtime sync, status transitions, dispatch flow
- Risk: UI regressions in critical admin and checkout flows.
- Priority: Medium

### E2E Tests Depend on Flaky Polling

- What's fragile: Multiple E2E specs use `page.reload()` and polling loops with hardcoded timeouts to wait for realtime sync.
- Files:
  - `src/tests/e2e/order-tracking-refactor.spec.ts:112-123` — Reloads page if status not found
  - `src/tests/e2e/billing-realtime.spec.ts:129-138` — Reloads admin page for realtime sync
- Risk: E2E tests are inherently flaky. False positives waste developer time.
- Priority: Medium

---

*Concerns audit: 2026-05-09*
