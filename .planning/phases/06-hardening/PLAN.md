---
status: draft
milestone: v1.0
---

# Phase 6: Hardening, Reliability & Polish

**Goal**: Close security holes, add missing operational tooling, improve reliability, and remove fake/hardcoded data across all three UIs (Customer, Rider, Owner).

**Depends on**: Phase 4 (complete), Phase 5 (pending)

**Status**: Draft — not started

---

## Current State (2026-05-19)

| Area | Tests | Build | Notes |
|------|-------|-------|-------|
| Vitest | 19/19 files, 126/126 pass | — | All unit tests green |
| Next.js build | — | FAILS | `adminActions.ts:94` type error (insert missing `id`) |
| E2E | — | Not live-verified | Written but not run against dev server |

---

## Security Hardening

### SEC-01: Remove committed `.env` and rotate all secrets
`.env` is in the repo with live Supabase service role key, Razorpay secret, JWT secret, admin password, Google Maps key, GitHub PAT. Add `.env` to `.gitignore`, remove from history, rotate every exposed key.

### SEC-02: Disable `E2E_MODE` in production
`E2E_MODE=true` in `.env` disables Razorpay signature verification. Any `pay_test_*` payment ID bypasses payment. Gate behind `NODE_ENV !== 'production'` or remove entirely.

### SEC-03: Remove hardcoded JWT fallback secret
`src/middleware.ts` line 5 has `'fallback-secret-change-me-in-production'`. Fail loudly if `JWT_SECRET` is missing instead.

### SEC-04: Server-side cart/price validation
`createOrder` trusts client-sent `items`, `prices`, and `total_amount`. Verify menu items exist, are available, and prices match DB before creating order.

### SEC-05: Rate limiting on order creation and tracking lookup
No rate limiting on `createOrder`, `generateRazorpayOrder`, or `/track/{phone}`. Add basic rate limiting to prevent spam and phone enumeration.

### SEC-06: Protect order tracking with OTP/PIN
`/track/{phone}` and `/track/order/{id}` expose full order details (address, items, rider phone) to anyone who knows the phone number or order ID.

### SEC-07: Use `supabaseAdmin` in webhook route
`src/app/api/webhook/razorpay/route.ts` imports the anon client instead of service role. Webhook UPDATEs will silently fail if RLS is restrictive.

### SEC-08: Hash admin password
`ADMIN_PASSWORD=goodrest88` stored as plaintext in env. Hash with bcrypt.

---

## Rider UI Gaps

### RIDE-01: Route-level auth middleware for `/rider/*`
Auth is `localStorage` only — no layout, no server-side verification. Anyone who sets `rider_session` in localStorage can access the dashboard.

### RIDE-02: Rider management UI (admin)
No admin CRUD for creating/editing rider accounts. Riders must be seeded directly in DB.

### RIDE-03: Order history view for riders
Dashboard shows only today's stats and active order. No past delivery list.

### RIDE-04: Push notifications
Broadcast relies entirely on Supabase Realtime + open browser tab. No service worker, no background push.

### RIDE-05: Configurable earning formula
`Math.round(distanceKm * 10 + 500)` is hardcoded in `acceptOrder`. No admin-configurable per-km rate, minimum, or cap.

### RIDE-06: Rider profile/settings page
Riders cannot view/edit profile or change password.

### RIDE-07: Verify `audio/ringtone.mp3` exists
`OrderBroadcast` references `/audio/ringtone.mp3`. If missing, ringtone silently fails.

---

## Customer UI Gaps

### CUST-01: Success page shows no order details
`/checkout/success` shows generic "Order Placed!" — doesn't read `order_id` query param or display summary.

### CUST-02: Server-side price validation (same as SEC-04)
Cart data is fully client-trusted. Manipulated client can place orders with arbitrary prices.

### CUST-03: Zombie order cleanup
If user closes Razorpay modal after `createOrder` but before payment, a zombie order exists with `payment_status: 'pending'` and no cleanup.

### CUST-04: Add delivery fee, tax, tip
Total is pure item sum. No delivery fee, tax, or tip option.

### CUST-05: Remove hardcoded fake data
- "4.1" rating hardcoded in `MenuItemCard.tsx`
- "120+ orders this week" hardcoded for chicken items
- "4.3/5 Verified Rating" in Hero component
- "Loved by 10,000+ people" in Hero component

### CUST-06: Remove "Test Only" badge from COD button
`CheckoutForm.tsx` labels COD as "Test Only" with red badge.

### CUST-07: Remove sandbox UPI config from Razorpay
Checkout config forces UPI ID input with test instructions. Should be conditional on test mode.

### CUST-08: Item descriptions
`MenuItem` type has no `description` field. Customers see only name, price, image.

### CUST-09: Customer order cancellation
No way for customer to cancel an order. `OrderStatus` has no `cancelled` variant.

### CUST-10: `select('*')` leaking internal columns
`getOrderById` returns all columns including `rider_id`, `razorpay_order_id`, `razorpay_payment_id`. Select only needed columns.

### CUST-11: Stop polling after delivery
`track/order/[id]/page.tsx` polls every 5s indefinitely, even after delivered.

### CUST-12: Fix veg/non-veg heuristic
`MenuItemCard` guesses veg/non-veg from category/item name. Add `is_veg` boolean column.

### CUST-13: Fix `colorScheme: 'dark'` on light-themed UI
Root layout sets `style={{ colorScheme: 'dark' }}` but entire customer UI uses light theme.

### CUST-14: Enable Next.js image optimization
Menu images use `unoptimized={true}`, bypassing image optimization.

---

## Owner/Admin UI Gaps

### OWN-01: Fix build error — `adminActions.ts:94` type error
`addMenuItem` insert is missing `id` per generated types. Needs type assertion or schema fix.

### OWN-02: Order detail view (items, amount)
Dashboard shows flat list but never renders the `items` array. Owner can't see what was ordered.

### OWN-03: Notification bell functionality
Bell icon in header has hardcoded red dot but no click handler, no dropdown, no unread count.

### OWN-04: Rider status panel in admin
No panel showing assigned riders, their location, or arrival ETA.

### OWN-05: Daily sales/order reports
No analytics, sales totals, order counts, or date-range filtering.

### OWN-06: Admin route-level auth verification
Admin layout doesn't verify JWT cookie server-side. Middleware exists but layout has no guard.

---

## Code Quality

### QUAL-01: Remove unused `MenuSkeleton` component
`src/components/MenuSkeleton.tsx` exists but is unused — home page uses inline skeleton divs.

### QUAL-02: Add error boundaries
No `error.tsx` for customer or admin routes. Runtime errors show default Next.js error page.

### QUAL-03: Add custom 404 page
No `not-found.tsx` for app root or customer routes.

### QUAL-04: Add SEO metadata on tracking pages
`/track`, `/track/[phone]`, `/track/order/[id]` have no `metadata` exports.

---

## Priority Order

| Priority | Items | Rationale |
|----------|-------|-----------|
| P0 (critical) | SEC-01, SEC-02, SEC-03, SEC-07, OWN-01 | Build broken, secrets exposed, payment bypassable |
| P1 (high) | SEC-04, SEC-05, SEC-06, SEC-08, CUST-05, CUST-06, CUST-07 | Security + trust/legal issues |
| P2 (medium) | RIDE-01, RIDE-02, CUST-01, CUST-03, CUST-10, CUST-11, OWN-02, OWN-04 | Operational gaps |
| P3 (low) | RIDE-03–07, CUST-04, CUST-08, CUST-09, CUST-12–14, OWN-03, OWN-05, OWN-06, QUAL-01–04 | Nice-to-have polish |

---

## Success Criteria

1. All secrets rotated, `.env` removed from git history, `E2E_MODE` gated.
2. Build passes with zero type errors.
3. Server-side price validation on order creation.
4. Admin can manage riders, view order details, see rider status.
5. Customer success page shows order summary.
6. No hardcoded fake data in customer UI.
7. Rate limiting on order creation and tracking.
8. Rider has auth middleware and order history.
