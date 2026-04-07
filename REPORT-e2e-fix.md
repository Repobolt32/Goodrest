# E2E Test Fix Report — Goodrest Checkout Flow

## Date: 2026-04-05

## Problem
Playwright E2E tests for Razorpay checkout were failing due to:
1. **Mock timing bug** — `page.addInitScript()` ran too late, after the checkout page had already loaded and evaluated the Razorpay SDK script. The mock never intercepted the `new window.Razorpay()` call.
2. **Implicit bypass** — E2E test bypass relied on `NODE_ENV !== 'production'` which is unreliable in local Next.js builds.
3. **No observability** — `verifyPaymentSignature()` had no branch-level logging, making it impossible to determine which step failed.
4. **Stale server ambiguity** — `reuseExistingServer: true` masked port conflicts and stale builds.
5. **Selector mismatches** — Test assertions used loose regex that matched multiple elements (strict mode violation).

## Changes Made

### 1. Fixed Razorpay Mock Timing (4 spec files)
**Files:** `checkout-payment.spec.ts`, `customer-flow.spec.ts`, `billing-realtime.spec.ts`, `order-tracking-refactor.spec.ts`

Changed from `page.addInitScript()` to `page.evaluate()` — injects the mock **immediately** on the already-loaded page, ensuring `window.Razorpay` exists before `CheckoutForm` calls `new window.Razorpay()`.

### 2. Made E2E Bypass Explicit
**File:** `playwright.config.ts`

Added `E2E_MODE: 'true'` and `E2E_VERIFICATION_SECRET: 'goodrest_test_secret'` to the webServer env config.

**File:** `src/app/actions/orderActions.ts`

Refactored `verifyPaymentSignature()` to check `E2E_MODE === 'true'` as the primary bypass gate, removing the fragile `NODE_ENV` fallback.

### 3. Added Branch-Level Logging
**File:** `src/app/actions/orderActions.ts`

Every execution path in `verifyPaymentSignature()` now logs:
- `[verifyPaymentSignature] BRANCH: E2E BYPASS` or `NORMAL VERIFICATION`
- `[verifyPaymentSignature] FAILURE: RAZORPAY_KEY_SECRET is not configured`
- `[verifyPaymentSignature] FAILURE: Invalid signature`
- `[verifyPaymentSignature] Looking up order in DB by razorpay_order_id`
- `[verifyPaymentSignature] Found order: {id}, payment_status: {status}`
- `[verifyPaymentSignature] Updating DB to mark order {id} as paid...`
- `[verifyPaymentSignature] SUCCESS: Order {id} marked as paid in DB.`

### 4. Fixed Test Selectors
**File:** `checkout-payment.spec.ts`, `customer-flow.spec.ts`

Changed `getByText(/Order Placed|Order Processed Successfully/i)` → `getByRole('heading', { name: 'Order Placed!' })` to avoid strict mode violations.

**File:** `billing-realtime.spec.ts`

Fixed placeholder selectors to match actual form inputs:
- `/Phone Number/i` → `'9876543210'`
- `/Delivery Address/i` → `/Complete Address/i`

### 5. Passed orderId to Success Page
**File:** `src/components/CheckoutForm.tsx`

Changed `router.push('/checkout/success')` → `router.push('/checkout/success?order_id=${orderId}')`

## Verification

Checkout payment tests **passed** when the dev server was stable:
```
[verifyPaymentSignature] BRANCH: E2E BYPASS. Bypassing signature for test payment: pay_test_payment
[verifyPaymentSignature] Looking up order in DB by razorpay_order_id: order_SZon3wFWa5t0Xp
[verifyPaymentSignature] Found order: 5561f29a-..., current payment_status: pending
[verifyPaymentSignature] Updating DB to mark order 5561f29a-... as paid...
[verifyPaymentSignature] SUCCESS: Order 5561f29a-... marked as paid in DB.

✓ checkout-payment.spec.ts: should complete Online Payment and reach success page (11.1s)
✓ checkout-payment.spec.ts: should disable order button when cart is empty (9.7s)
✓ customer-flow.spec.ts: should allow a customer to browse, add items, and checkout (13.1s)
✓ admin-flow.spec.ts: should allow an admin to login, manage orders, and toggle menu items (43.7s)
✓ admin-menu-crud.spec.ts: should perform full CRUD operations on a dish (51.9s)
```

## Current Blocker (Not Code-Related)

Tests now fail due to a **system-level Turbopack crash** on Windows:
```
FATAL: node process exited with exit code: 0xc0000142
Failed to write app endpoint /page
[src/app/globals.css [app-client] (css)]
```

This is a known Next.js 16.2.2 + Turbopack + Windows issue (DLL initialization failure). It is **unrelated to the code changes**. Clearing `.next` cache and killing all node processes does not resolve it — it requires either:
- A system restart, or
- Running `npm run dev` manually in a fresh terminal, then running Playwright with `reuseExistingServer: true`

## Files Modified
| File | Change |
|------|--------|
| `playwright.config.ts` | E2E env vars, reuseExistingServer toggle |
| `src/app/actions/orderActions.ts` | Branch logging, explicit E2E bypass |
| `src/components/CheckoutForm.tsx` | Pass orderId to success page |
| `src/tests/e2e/checkout-payment.spec.ts` | Mock timing, selector fix |
| `src/tests/e2e/customer-flow.spec.ts` | Mock timing, selector fix |
| `src/tests/e2e/billing-realtime.spec.ts` | Mock timing, placeholder selectors |
| `src/tests/e2e/order-tracking-refactor.spec.ts` | Mock timing |
