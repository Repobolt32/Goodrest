# Implementation Plan — Security Fixes & Batch Ordering

This plan details the changes required to fix the security vulnerabilities listed in `C:\Users\iamku\Documents\sec_issues_to_fix.txt` and implement the requested rider features, including the batch ordering payout logic.

## User Review Required

> [!IMPORTANT]
> **Production Key Rotation:** SEC-01 concerns historical secrets in the Git repository. While `.gitignore` currently blocks `.env` and `env` files, any previously committed secrets in the history must be rotated on production (Razorpay API keys, Supabase Service Role key, JWT secret).
> 
> **Google Maps Client Key:** The Google Maps API key loaded in `CheckoutForm.tsx` is exposed to the browser. As client-side exposure is required by Google Maps JS SDK, the key **must** be restricted to the production domain (HTTP referrer restriction) in the Google Cloud Console to prevent misuse.

---

## Open Questions
No open questions at this stage. The requirements are fully detailed.

---

## Proposed Changes

### 1. Server Actions & Authentication Guards

#### [MODIFY] [authActions.ts](file:///e:/desktop/goodrest-claude/src/app/actions/authActions.ts)
- **Plaintext Timing Attack & Secure IP Rate Limit (SEC-07 / Issue 7):**
  - Use Node's `crypto.timingSafeEqual` or `bcrypt.compare` to compare the admin password instead of the default `!==` operator to prevent timing attacks.
  - Retrieve the client IP securely using a combination of headers (`x-real-ip`, fallback `x-forwarded-for` split, and standard connection headers) to prevent rate limit bypassing via custom `X-Forwarded-For` injection.

#### [MODIFY] [settingsActions.ts](file:///e:/desktop/goodrest-claude/src/app/actions/settingsActions.ts)
- **Unprotected settings updates (SEC-04 / Issue 18):**
  - Enforce `const auth = await verifyAdminSession(); if (!auth.success) return { success: false, error: auth.error };` at the top of `updateAppSettings`.

#### [MODIFY] [adminActions.ts](file:///e:/desktop/goodrest-claude/src/app/actions/adminActions.ts)
- **Status Whitelisting (Issue 5) & UUID Checks (Issue 13):**
  - Whitelist order statuses in `updateOrderStatus`: allow only `['created', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled']`.
  - Whitelist payment statuses in `updatePaymentStatus`: allow only `['pending', 'paid', 'requires_refund', 'refund_processing', 'refunded']`.
  - Validate UUID format for all `orderId` and `id` parameters before DB queries.

#### [MODIFY] [orderActions.ts](file:///e:/desktop/goodrest-claude/src/app/actions/orderActions.ts)
- **Secure Customer Session & Input Sanitization (SEC-05 / SEC-11 / Issues 8, 12):**
  - Update `cancelOrder` and `sendHelpMessage` to use `verifyCustomerSession()`. Extract the customer's phone number directly from the secure session cookie rather than trusting the client-provided `customerPhone` parameter.
  - Sanitize customer-supplied strings (`customer_name`, `delivery_address`) inside `createOrder` using a trimming and basic HTML-escaping regex to prevent script injection.
  - **Server-Side Delivery Fee & Initial Distance Saving (Issue 5 / BUG-18):**
    - Call `getGoogleMapsRouteData` inside `createOrder` to calculate route distance and duration *during* order creation.
    - Recalculate delivery fee server-side using `calculateDeliveryFee(distanceKm)`, add it to `serverTotal` (so `total_amount` in the DB includes delivery fee), and save both `distance_km` and `duration_seconds` under `orderData` on insert.

#### [MODIFY] [trackActions.ts](file:///e:/desktop/goodrest-claude/src/app/actions/trackActions.ts)
- **Access Control & select(*) Exposure (Issue 14):**
  - Enforce `verifyCustomerSession()` inside `getOrderById`. Verify that the session phone matches the order's `customer_phone` before returning details.
  - Replace `select('*')` with explicit fields to prevent leaking internal/sensitive metadata (like `batch_id`, `deleted_at`, `razorpay_payment_id`) to the client.

#### [MODIFY] [riderActions.ts](file:///e:/desktop/goodrest-claude/src/app/actions/riderActions.ts)
- **Order Acceptance Race Condition (Issue 11):**
  - Add an early check for `rider_id` null state in `acceptOrder` *before* calling Google Maps API.
  - Double-gate the final update query using `.is('rider_id', null).in('order_status', ['preparing', 'ready'])` to guarantee atomicity.
  - **Batch Order Assignments (2 Batch Order Thing):**
    - Allow a rider to have up to 2 active orders (status not `delivered` or `cancelled`).
    - If a rider accepts a second order, query the first active order.
    - Generate a unique `batch_id` and update both orders with it.
    - Recalculate the first order's earning without dead miles: `rider_earning = calculateRiderEarning(distance_km, true)` (where `isBatchedNonFinal = true` returns ₹0 dead miles).
    - Set the second (final) order's earning with dead miles: `rider_earning = calculateRiderEarning(distance_km, false)`.

---

### 2. Client Components & UX Features

#### [MODIFY] [OrderBroadcast.tsx](file:///e:/desktop/goodrest-claude/src/components/rider/OrderBroadcast.tsx)
- **Vibration & Sound Alerts (Issue 4):**
  - Verify that the notification loop utilizes the correct path `/audio/goodrest-bill.mp3`.
  - Ensure vibration triggers `navigator.vibrate([500, 200, 500, 200, 500])` on new order events.
  - Allow broadcasts to display when `activeOrdersCount < 2` (rather than blocking if a single active order exists).

#### [MODIFY] [TerminalView.tsx](file:///e:/desktop/goodrest-claude/src/components/rider/TerminalView.tsx)
- **Rider Batch Support:**
  - Update `TerminalView` and rider dashboard pages to support rendering and starting/delivering multiple active orders simultaneously if a batch is active.

#### [MODIFY] [page.tsx](file:///e:/desktop/goodrest-claude/src/app/track/order/%5Bid%5D/page.tsx)
- **Delivery Bill Summary (Issue 5):**
  - Since `distance_km` is now stored in the database on order creation, `order.distance_km` will be populated immediately. The tracking page will correctly render the itemized breakdown (Subtotal, Delivery Fee, and Grand Total) without defaulting the delivery fee to zero.

---

### 3. Pricing & Weekly Payouts Logic

#### [MODIFY] [pricing.ts](file:///e:/desktop/goodrest-claude/src/lib/pricing.ts)
- **Batch Pricing Calculation:**
  - Update `calculateRiderEarning(distanceKm, isBatchedNonFinal?: boolean)` to accept `isBatchedNonFinal`. If `true`, set dead miles to `0`.
- **Payout Deduplication:**
  - Update `getWeeklyRiderPayouts` and `getRiderEarningHistory` to track `seenBatches` Set during iteration over orders.
  - If an order has a non-null `batch_id` and the batch has been seen, count `pickupPay` as `0` and `deliveryFee` as the entire `rider_earning` to prevent double-counting the dead miles in the owner's billing reports.

---

### 4. Configuration & Security Headers

#### [MODIFY] [next.config.ts](file:///e:/desktop/goodrest-claude/next.config.ts)
- **Security Headers (Issue 15):**
  - Add secure headers configuration:
    - `Content-Security-Policy` (CSP)
    - `Strict-Transport-Security` (HSTS)
    - `X-Frame-Options: DENY`
    - `X-Content-Type-Options: nosniff`
    - `Referrer-Policy: strict-origin-when-cross-origin`

---

## Verification Plan

### Automated Tests
- Run full unit tests to verify existing logic and newly added tests for input sanitization, timing attacks, status validation, and batch pricing:
  ```bash
  npm run test
  ```
- Validate types and linting:
  ```bash
  npm run lint
  ```
- Build the Next.js bundle:
  ```bash
  npm run build
  ```

### Manual Verification
- Staging and deployment verification:
  1. Login to admin console, try passing non-UUIDs or wrong status strings to verify rejection.
  2. Create an order with simulated lat/lng, track it to verify subtotal and delivery fee render instantly.
  3. Accept two orders sequentially on the rider portal, verify they share a `batch_id`, and verify that the first order's earning drops to exclude dead miles while the second order retains them.
