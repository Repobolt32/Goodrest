# Deep-Dive Security Audit Plan — Goodrest MVP

> **Scope:** Full-stack security review of the food ordering platform (Next.js + Supabase + Razorpay)  
> **Goal:** Identify critical-to-high vulnerabilities before launch. "Secure enough" for MVP handling real money.  
> **Output:** Prioritized findings with `file:line` references, exploit scenarios, and remediation steps.  
> **Duration:** 1 thorough pass. No code changes during review.

---

## Phase 1: Recon & Attack Surface Mapping

**Goal:** Identify every untrusted input surface before hunting for bugs.

### 1.1 Entry Points Inventory

| Surface | File | Auth Required? | Who Can Reach |
|---------|------|----------------|---------------|
| Customer order creation | `src/app/actions/orderActions.ts:54` | No (public) | Internet |
| Razorpay payment callback | `src/app/actions/orderActions.ts:299` | No (signature only) | Razorpay servers |
| Payment order generation | `src/app/actions/orderActions.ts:219` | No (orderId only) | Internet |
| Razorpay webhook | `src/app/api/webhook/razorpay/route.ts:5` | No (signature only) | Razorpay servers |
| Admin login | `src/app/actions/authActions.ts:18` | No (password only) | Internet |
| Rider login | `src/app/actions/riderActions.ts:39` | No (phone+password) | Internet |
| Customer session auth | `src/lib/auth.ts:76` | Cookie-based | Browser |
| Menu data fetch | `src/app/actions/menuActions.ts` | No | Internet |
| Track order by phone | `src/app/actions/trackActions.ts` | No (phone param) | Internet |
| Admin actions (CRUD) | `src/app/actions/adminActions.ts` | Yes (admin JWT) | Authenticated admin |
| Owner actions (order mgmt) | `src/app/actions/ownerActions.ts` | Yes (admin JWT) | Authenticated admin |
| Rider actions (accept/deliver) | `src/app/actions/riderActions.ts` | Yes (rider JWT) | Authenticated rider |
| Customer cancel/help | `src/app/actions/orderActions.ts:392` | Yes (customer session) | Authenticated customer |
| Image upload | `src/app/actions/adminActions.ts:206` | Yes (admin JWT) | Authenticated admin |
| Settings update | `src/app/actions/settingsActions.ts` | Yes (admin JWT) | Authenticated admin |

### 1.2 Data Flows

```
[Customer] → createOrder() → Supabase (orders table)
    ↓
[Customer Browser] ← Razorpay Checkout ← Razorpay API
    ↓
[Customer] → verifyPaymentSignature() → Supabase (mark paid)
    ↓
[Razorpay Webhook] → POST /api/webhook/razorpay → Supabase (mark paid)
```

### 1.3 Critical Assets

- **Payment data:** Razorpay order IDs, payment IDs, refund status
- **Customer PII:** Names, phone numbers, addresses, locations (lat/lng)
- **Order data:** Order details, amounts, status
- **Rider data:** Location history, earnings, phone numbers
- **Admin credentials:** JWT_SECRET, ADMIN_PASSWORD
- **Razorpay secrets:** RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET

---

## Phase 2: STRIDE Threat Analysis

### 2.1 Spoofing (Identity)

| Finding | Severity | File:Line | Exploit Scenario |
|---------|----------|-----------|------------------|
| **JWT secret shared across all sessions** | **HIGH** | `src/lib/auth.ts:4` | Admin, rider, and customer sessions all use same `JWT_SECRET`. Token from one role could theoretically be reused against another if role validation is missed. Currently mitigated by checking different cookie names, but shared secret increases blast radius if leaked. |
| Customer session tied to phone only | **MEDIUM** | `src/lib/auth.ts:92` | `signCustomerSession()` only stores phone. Any valid customer session cookie for phone X grants access to ALL orders for phone X. No order-specific binding. |
| No JWT token binding to IP/User-Agent | **LOW** | `src/app/actions/authActions.ts:37` | Tokens can be stolen and replayed from different devices/browsers. Not critical for MVP but increases session hijacking risk. |

### 2.2 Tampering (Integrity)

| Finding | Severity | File:Line | Exploit Scenario |
|---------|----------|-----------|------------------|
| **Webhook lacks idempotency key** | **HIGH** | `src/app/api/webhook/razorpay/route.ts:74` | `handlePaymentCaptured()` doesn't check if order is already `paid` before updating. Race condition: webhook fires twice (network retry), payment marked as paid twice (mitigated by Supabase update but no explicit check). |
| Webhook `payment.failed` overwrites paid order | **CRITICAL** | `src/app/api/webhook/razorpay/route.ts:124` | `handlePaymentFailed()` checks `payment_status === 'paid'` and skips, BUT if a `payment.captured` and `payment.failed` webhook fire in race condition, the failed handler could run before the captured handler updates the DB. |
| `total_amount` validation gap | **MEDIUM** | `src/app/actions/orderActions.ts:54` | `createOrder()` re-calculates total from DB prices, BUT `generateRazorpayOrder()` uses `order.total_amount` directly from DB. If DB is compromised or admin manually edits order, wrong amount can be charged. |
| E2E test bypass in production code | **HIGH** | `src/app/actions/orderActions.ts:88` | `isE2EMode` check allows bypassing menu price validation. If `E2E_MODE` env var is accidentally set in production, attacker can pass arbitrary prices. |
| `verifyPaymentSignature` has E2E bypass | **CRITICAL** | `src/app/actions/orderActions.ts:306` | `isTestBypass` allows skipping signature verification if `razorpay_payment_id.startsWith('pay_test_')`. Attacker can forge `pay_test_...` ID and bypass payment verification completely. |
| Cookie `secure` flag env-dependent | **MEDIUM** | `src/app/actions/orderActions.ts:188` | `secure: process.env.NODE_ENV === 'production'` — if NODE_ENV is misconfigured or missing, cookies sent over HTTP. |

### 2.3 Repudiation (Audit Trail)

| Finding | Severity | File:Line | Exploit Scenario |
|---------|----------|-----------|------------------|
| No audit log for admin actions | **MEDIUM** | `src/app/actions/adminActions.ts` | Admin can delete/modify orders without any log trail. No `created_by`, `updated_by`, `deleted_at` patterns. |
| No audit log for payment state changes | **MEDIUM** | `src/app/actions/orderActions.ts` | Payment status transitions (pending → paid → refunded) not logged to a separate audit table. Hard to debug payment disputes. |
| Rider actions lack audit trail | **LOW** | `src/app/actions/riderActions.ts` | Rider accepts/delivers orders — no audit log of who did what when. |

### 2.4 Information Disclosure

| Finding | Severity | File:Line | Exploit Scenario |
|---------|----------|-----------|------------------|
| `getOrdersByPhone()` returns ALL orders for phone | **HIGH** | `src/app/actions/trackActions.ts` | Anyone with a phone number can query all orders for that phone. No rate limit. No OTP verification. Harvesting phone numbers = harvesting order history. |
| `getOrderById()` leaks order existence via timing | **MEDIUM** | `src/app/actions/trackActions.ts` | Returns `null` for both "not found" and "unauthorized". But timing difference between DB miss and auth failure could leak order existence. |
| Error messages expose internal details | **MEDIUM** | `src/app/actions/orderActions.ts:179` | RPC errors returned directly to client: `error: rpcError?.message || 'Failed to save order'`. Could leak Supabase internals. |
| Stack traces in logs (development risk) | **LOW** | Multiple | `console.error(err)` in multiple places may log full stack traces including internal paths. |
| ` razorpay_order_id` exposed in order data | **LOW** | `src/app/api/webhook/razorpay/route.ts` | Webhook payload processed but `razorpay_order_id` stored in DB and potentially readable. Not inherently dangerous but increases surface. |
| `getRiderLocationForOrder()` no auth check | **CRITICAL** | `src/app/actions/orderActions.ts:596` | No authentication check. Anyone with order ID can query rider location. IDOR potential. |

### 2.5 Denial of Service

| Finding | Severity | File:Line | Exploit Scenario |
|---------|----------|-----------|------------------|
| No rate limit on menu fetch | **LOW** | `src/app/actions/menuActions.ts` | `getMenuData()` is public and unthrottled. Can be hit repeatedly to waste DB quota. |
| Rate limit uses in-memory store | **MEDIUM** | `src/lib/rateLimit` (assumed) | If server restarts or scales horizontally, rate limit counters reset. Not effective under distributed attack. |
| `getOrdersForOwner()` fetches 50 records | **LOW** | `src/app/actions/ownerActions.ts:314` | Fixed limit of 50. Could be higher for busy restaurants but not a critical DoS. |
| `getRiderEarningHistory()` unbounded date range | **MEDIUM** | `src/app/actions/riderActions.ts` | Calculates week from Monday. If bug causes wrong date, could query enormous range. |

### 2.6 Elevation of Privilege

| Finding | Severity | File:Line | Exploit Scenario |
|---------|----------|-----------|------------------|
| **Admin password is single global secret** | **CRITICAL** | `src/app/actions/authActions.ts:13` | `ADMIN_PASSWORD` env var. No multi-admin support, no password hashing, no brute-force protection beyond IP rate limit (which is in-memory and brittle). |
| `verifyAdminSession()` doesn't check role claim | **HIGH** | `src/lib/auth.ts:20` | Verifies JWT signature but doesn't explicitly check `payload.role === 'admin'`. Relies on cookie name separation. If attacker crafts token with `role: 'admin'`, it would pass. |
| `verifyRiderSession()` doesn't verify rider exists in DB | **HIGH** | `src/lib/auth.ts:41` | Verifies JWT signature but doesn't check if rider still exists or is active. Deleted rider can still act until token expires. |
| `verifyCustomerSession()` only checks phone | **MEDIUM** | `src/lib/auth.ts:76` | No binding to specific order. Any authenticated customer session can access any order for that phone (mitigated by `getOrderById()` check). |
| `cancelOrder()` allows cancellation without ownership if session spoofed | **MEDIUM** | `src/app/actions/orderActions.ts:392` | Checks `customer_phone !== verifiedPhone`. But if customer session is compromised, attacker can cancel any order for that phone. |
| `updateOrderStatus()` — no status validation | **MEDIUM** | `src/app/actions/adminActions.ts:7` | Accepts any `status` string. Could set invalid status like `hacked`. Database ENUM may reject but not guaranteed. |
| `deleteOrder()` is hard delete | **HIGH** | `src/app/actions/adminActions.ts:45` | Admin can permanently delete orders. No soft delete, no audit trail. Critical for financial records. |
| `processPendingRefunds()` processes ALL refunds in loop | **MEDIUM** | `src/app/actions/ownerActions.ts:445` | If thousands of refunds pile up, this could timeout or hit memory limits. |
| `uploadDishImage()` filename not sanitized | **MEDIUM** | `src/app/actions/adminActions.ts:226` | `Math.random().toString(36)` + user-provided `fileExt`. Could potentially include path traversal if `fileExt` is manipulated (mitigated by Supabase Storage but still a risk). |
| `getUnassignedOrders()` — any rider can see all unassigned orders | **LOW** | `src/app/actions/riderActions.ts:442` | Returns all unassigned orders. Could leak PII (names, addresses) to any authenticated rider. |
| `getRiderStats()` uses `_riderId` param then ignores it | **LOW** | `src/app/actions/riderActions.ts:325` | Parameter `_riderId` is accepted but session rider ID is used. Good defense, but inconsistent API. |

---

## Phase 3: OWASP 2025 Cross-Check

### A01: Broken Access Control (IDOR)

| Finding | Severity | Location |
|---------|----------|----------|
| `getRiderLocationForOrder()` — missing auth | **CRITICAL** | `src/app/actions/orderActions.ts:596` |
| `getOrdersByPhone()` — no phone ownership verification | **HIGH** | `src/app/actions/trackActions.ts` |
| `cancelOrder()` — session checks phone but no order-specific binding | **MEDIUM** | `src/app/actions/orderActions.ts:392` |
| `sendHelpMessage()` — same as above | **MEDIUM** | `src/app/actions/orderActions.ts:470` |

### A02: Security Misconfiguration

| Finding | Severity | Location |
|---------|----------|----------|
| Missing security headers (CSP, HSTS, X-Frame-Options) | **MEDIUM** | `next.config.js` (assumed) |
| Cookie `secure` flag depends on NODE_ENV | **MEDIUM** | `src/app/actions/*.ts` |
| `sameSite: 'lax'` for payment-related cookies | **LOW** | `src/app/actions/orderActions.ts:191` |

### A03: Software Supply Chain

| Finding | Severity | Location |
|---------|----------|----------|
| No lock file (npm/pnpm/yarn) | **HIGH** | Project root |
| `bcryptjs` is pure JS (slower, potentially less secure than native `bcrypt`) | **LOW** | `package.json` |

### A04: Cryptographic Failures

| Finding | Severity | Location |
|---------|----------|----------|
| JWT secret is plain string, not recommended length | **MEDIUM** | `src/lib/auth.ts:4` |
| No key rotation mechanism | **LOW** | Entire auth system |
| `Math.random()` used for filename generation (predictable) | **LOW** | `src/app/actions/adminActions.ts:226` |

### A05: Injection

| Finding | Severity | Location |
|---------|----------|----------|
| Supabase queries use `supabaseAdmin` (RLS bypassed) — no SQL injection risk but privilege escalation if compromised | **MEDIUM** | `src/lib/supabaseAdmin.ts` |
| No input sanitization on `message` param in `sendHelpMessage()` | **LOW** | `src/app/actions/orderActions.ts:470` |

### A06: Insecure Design

| Finding | Severity | Location |
|---------|----------|----------|
| E2E bypass in production code is dangerous design | **CRITICAL** | `src/app/actions/orderActions.ts:88` |
| Payment verification has test bypass | **CRITICAL** | `src/app/actions/orderActions.ts:306` |
| Single password for all admin access | **CRITICAL** | `src/app/actions/authActions.ts:13` |
| Webhook double-processing risk | **HIGH** | `src/app/api/webhook/razorpay/route.ts` |

### A07: Authentication Failures

| Finding | Severity | Location |
|---------|----------|----------|
| Admin password not hashed | **CRITICAL** | `src/app/actions/authActions.ts:26` |
| No 2FA/MFA for admin | **MEDIUM** | Entire admin flow |
| Rider passwords: verification but no account lockout | **MEDIUM** | `src/app/actions/riderActions.ts:39` |
| Customer sessions 7-day expiry, no refresh mechanism | **LOW** | `src/lib/auth.ts:95` |

### A08: Integrity Failures

| Finding | Severity | Location |
|---------|----------|----------|
| Order amount calculated server-side but not double-checked at payment verification | **MEDIUM** | `src/app/actions/orderActions.ts` |
| Refund amount not validated against original order amount | **HIGH** | `src/app/actions/ownerActions.ts:255` |

### A09: Logging & Alerting

| Finding | Severity | Location |
|---------|----------|----------|
| No structured security event logging | **MEDIUM** | Entire codebase |
| No alerting on failed login attempts | **LOW** | `src/app/actions/authActions.ts` |
| No alerting on payment anomalies | **LOW** | Entire payment flow |

### A10: Exceptional Conditions

| Finding | Severity | Location |
|---------|----------|----------|
| `isE2EMode` can accidentally open production to test bypass | **CRITICAL** | `src/app/actions/orderActions.ts:88` |
| `processPendingRefunds()` — if Razorpay fails after claim, rollback may fail silently | **HIGH** | `src/app/actions/ownerActions.ts:515` |
| Webhook returns 200 even on DB errors | **MEDIUM** | `src/app/api/webhook/razorpay/route.ts` |

---

## Phase 4: Prioritized Findings

### CRITICAL (Fix Before Launch)

1. **[TAMP-2] E2E test bypass in production code**  
   - **File:** `src/app/actions/orderActions.ts:88-96`  
   - **Exploit:** Set `E2E_MODE=true` or forge test item IDs → bypass price validation → free/cheap orders  
   - **Fix:** Remove E2E bypass from production. Use separate test server or mock Supabase.

2. **[TAMP-3] Payment verification test bypass**  
   - **File:** `src/app/actions/orderActions.ts:306-310`  
   - **Exploit:** Send forged `pay_test_...` payment ID → skip signature verification → mark any order as paid  
   - **Fix:** Remove test bypass. Use mock Razorpay server for testing.

3. **[ELEV-1] Single admin password, unhashed**  
   - **File:** `src/app/actions/authActions.ts:13,26`  
   - **Exploit:** Brute force or leak of `ADMIN_PASSWORD` env var → full admin access  
   - **Fix:** Hash password with bcrypt, implement account lockout, consider OTP.

4. **[INFO-4] Unauthenticated rider location leak**  
   - **File:** `src/app/actions/orderActions.ts:596`  
   - **Exploit:** Any user with order ID can track rider in real-time without authentication  
   - **Fix:** Add customer session verification or restrict to order owner/admin.

### HIGH (Fix in First Sprint)

5. **[SPOOF-1] Shared JWT secret across roles**  
   - **File:** `src/lib/auth.ts:4`  
   - **Fix:** Use role-specific secrets or HSM. At minimum, validate role claim in each verifier.

6. **[TAMP-1] Webhook race condition / double-processing**  
   - **File:** `src/app/api/webhook/razorpay/route.ts:74`  
   - **Fix:** Add explicit `payment_status === 'pending'` check before setting paid. Use DB transaction.

7. **[TAMP-5] Webhook payment.failed overwrites paid (race)**  
   - **File:** `src/app/api/webhook/razorpay/route.ts:124`  
   - **Fix:** Strengthen the check or use row-level locking.

8. **[ELEV-3] Admin session doesn't verify role claim**  
   - **File:** `src/lib/auth.ts:20`  
   - **Exploit:** Craft JWT with `role: 'admin'` → pass verification  
   - **Fix:** Explicitly check `payload.role === 'admin'`.

9. **[ELEV-4] Rider session doesn't verify rider exists**  
   - **File:** `src/lib/auth.ts:41`  
   - **Exploit:** Deleted rider's token still works until expiry  
   - **Fix:** DB lookup for rider existence/active status.

10. **[ELEV-8] Hard delete for orders**  
    - **File:** `src/app/actions/adminActions.ts:45`  
    - **Fix:** Implement soft delete or require confirmation for financial records.

11. **[INFO-1] Phone-based order history query unprotected**  
    - **File:** `src/app/actions/trackActions.ts`  
    - **Exploit:** Enumerate phone numbers → harvest all order history  
    - **Fix:** Rate limit + require customer session or OTP.

12. **[INTEG-1] Refund amount not validated**  
    - **File:** `src/app/actions/ownerActions.ts:255`  
    - **Exploit:** Potential for refund amount mismatch (mitigated by using order's total_amount but no explicit check)  
    - **Fix:** Explicitly validate refund amount ≤ order total.

### MEDIUM (Fix in First Month)

13. **[SPOOF-3] Cookie secure flag env-dependent**
14. **[TAMP-4] total_amount validation gap**
15. **[INFO-3] Error messages expose internal details**
16. **[ELEV-5] verifyCustomerSession no order binding**
17. **[ELEV-6] updateOrderStatus no status validation**
18. **[ELEV-9] uploadDishImage filename not fully sanitized**
19. **[A02] Missing security headers**
20. **[A03] No lock file for dependency integrity**
21. **[A08] Order amount not double-checked at payment verification**
22. **[A07] No 2FA/MFA for admin**
23. **[A09] No structured security logging**

### LOW (Nice to Have)

24. No JWT token binding to IP/User-Agent
25. Stack traces in logs
26. `sameSite: 'lax'` consideration for payment cookies
27. `getUnassignedOrders()` leaks PII to riders
28. `Math.random()` for filename generation
29. No key rotation mechanism
30. Customer session no refresh mechanism

---

## Phase 5: Verification Checklist

After the security agent completes remediation, verify:

- [ ] E2E bypass code completely removed from production paths
- [ ] Test bypass removed from `verifyPaymentSignature`
- [ ] Admin password hashed with bcrypt (min 10 rounds)
- [ ] `getRiderLocationForOrder()` requires authentication
- [ ] Webhook handlers have explicit idempotency checks
- [ ] `verifyAdminSession()` checks `payload.role === 'admin'`
- [ ] `verifyRiderSession()` checks rider exists in DB
- [ ] `deleteOrder()` implements soft delete or requires additional confirmation
- [ ] `getOrdersByPhone()` rate-limited or requires customer session
- [ ] All new/modified code has tests
- [ ] `npm run build` passes
- [ ] `npm run test` passes
- [ ] `npm run lint` passes

---

> **Note to Agent:** This is a READ-ONLY review. Do not modify code. Report findings to the user and let them decide on remediation. Focus on CRITICAL and HIGH findings first.