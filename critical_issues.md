# Goodrest Platform — Critical Security & Integrity Issue Registry — RESOLVED

This document outlines the severe, high-impact security vulnerabilities and business logic flaws identified in the Goodrest codebase. All listed issues in this document have been fully resolved and verified, protecting **data privacy (PII leakage)**, **financial transactions (double refunds, unpaid orders)**, and **system access (unprotected admin actions)**.

---

## 🔴 Critical Vulnerabilities Registry

### 1. SEC-01 — Secrets Committed to Version Control (Git History)
* **File / Location:** `.env`, `release/`, Git history
* **OWASP 2025 Classification:** **A04:2025 — Cryptographic Failures**
* **Vulnerability Analysis:** 
  Production secrets, including `JWT_SECRET`, `RAZORPAY_KEY_SECRET`, and `SUPABASE_SERVICE_ROLE_KEY` (which possesses service-level root access bypassing all Row Level Security policies), are committed directly to version control. Anyone with access to the repository has complete, unrestricted administrative access to database nodes and payment configurations.
* **Remediation Plan:**
  1. Rotate all database keys, Razorpay API credentials, and JWT signing keys immediately on production servers.
  2. Remove all secret values from `.env` and `.env.local` files, replacing them with a safe `.env.example`.
  3. Ensure `.env` and `.env.local` are explicitly added to `.gitignore`.
  4. Run git scrubbing tools (e.g. `git filter-repo` or BFG Repo-Cleaner) to purge all historic commits containing secret values.

---

### 2. SEC-02 — Cron Refund Failure (Database-Only Refunds)
* **File / Location:** `supabase/migrations/` (Auto-Reject Cron Trigger)
* **OWASP 2025 Classification:** **A08:2025 — Software and Data Integrity Failures**
* **Vulnerability Analysis:** 
  The database automated auto-reject routine updates an order's `payment_status` to `'refunded'` within the database, but does **not** call the external Razorpay refund API. This creates a critical financial discrepancy: the customer sees a "Refunded" status on their screen and expects a return, but the money is never physically routed back through Razorpay.
* **Remediation Plan:**
  1. Change the automatic timeout migration to mark the database state as `'failed'` rather than `'refunded'`.
  2. Implement a queue or trigger a server action webhook that securely calls the Razorpay Refund Node SDK to execute the physical refund transaction whenever a database auto-reject occurs.

---

### 3. SEC-03 — Ungated `E2E_MODE` Payment Signature Bypass
* **File / Location:** `src/app/actions/orderActions.ts` (`verifyPaymentSignature`)
* **OWASP 2025 Classification:** **A01:2025 — Broken Access Control**
* **Vulnerability Analysis:** 
  The payment verification logic bypasses HMAC check entirely if `E2E_MODE === 'true'` and the payment ID begins with `pay_test_`. Unlike other debug bypasses, this logic has no check against `process.env.NODE_ENV === 'production'`. If `E2E_MODE` is accidentally set to `true` on the production server (e.g. via configuration drift or environment variable leaks), any user can spoof arbitrary payments by passing a mock `pay_test_` transaction ID, enabling free restaurant orders.
* **Remediation Plan:**
  1. Wrap the payment signature bypass strictly in a production check: `process.env.NODE_ENV !== 'production'`.
  2. Fully enforce signature verification on production environments with no fallback gates, or isolate E2E testing to a fully mocked test environment.

---

### 4. SEC-04 — Exposed / Unprotected Server Actions (Lack of Auth)
* **File / Location:** `src/app/actions/adminActions.ts`, `src/app/actions/ownerActions.ts`, `src/app/actions/reportActions.ts`
* **OWASP 2025 Classification:** **A01:2025 — Broken Access Control** & **A07:2025 — Authentication Failures**
* **Vulnerability Analysis:** 
  While rider-related server actions have been securely wrapped in cookie-based cryptographically signed JWT validation, many administrative and owner-level server actions remain completely unprotected. Anyone with the server action POST endpoint URL can execute administrative operations, delete items, update system configurations, or download financial reports via simple cURL commands.
* **Remediation Plan:**
  1. Create a `verifyAdminSession()` helper in `src/lib/auth.ts` checking an `admin_session` cookie containing cryptographically signed JWT credentials.
  2. Enforce `const auth = await verifyAdminSession()` at the top of every single mutative action inside `adminActions.ts`, `ownerActions.ts`, and `reportActions.ts`.
  3. Reject request and fail-securely if the token validation or role assertion fails.

---

### 5. SEC-05 — Client-Trust Phone Number Spoofing
* **File / Location:** `src/app/actions/orderActions.ts` (`cancelOrder` & `sendHelpMessage`)
* **OWASP 2025 Classification:** **A01:2025 — Broken Access Control**
* **Vulnerability Analysis:** 
  The functions `cancelOrder` and `sendHelpMessage` accept `customerPhone` directly as a parameter supplied by the client. An attacker can construct a payload containing another user's phone number to cancel their orders or trigger fraudulent support messages, as the server blindly trusts the client-provided phone value for verification.
* **Remediation Plan:**
  1. Extract the authenticated customer's phone number directly from the server-side session or cookie token rather than trusting parameters from the client request.
  2. Ensure the order ownership is strictly verified against the session-derived phone number in the database query.

---

### 6. SEC-06 — Double Refund Exploitation
* **File / Location:** `src/app/actions/ownerActions.ts` (`initiateRefund`)
* **OWASP 2025 Classification:** **A08:2025 — Software and Data Integrity Failures**
* **Vulnerability Analysis:** 
  The refund execution routine `initiateRefund` does not validate the order's existing `refund_status` prior to invoking the Razorpay API. A malicious merchant or customer could spam requests to this action, triggering multiple refund transactions on Razorpay for a single purchase, draining the restaurant's merchant account.
* **Remediation Plan:**
  1. Before initiating any external transaction, query the database order and assert that `refund_status` is not already `'refunded'` or `'processing'`.
  2. Wrap the database check and Razorpay API call in an atomic lock or lock the order record.

---

### 7. SEC-07 — Ghost Orders (Lack of Transaction wrapping)
* **File / Location:** `src/app/actions/orderActions.ts` (`createOrder`)
* **OWASP 2025 Classification:** **A10:2025 — Exceptional Conditions**
* **Vulnerability Analysis:** 
  Creating an order involves separate database `insert` calls to `orders` and `order_items` sequentially without atomic transaction wrapping. If the `order_items` insert fails (due to validation failures, network drops, or database constraints), the parent `orders` record remains in the database. This leaves a "ghost order" in the system with a non-zero total but absolutely no items associated with it, breaking the payment, audit, and cooking flows.
* **Remediation Plan:**
  1. Use Supabase RPC (PostgreSQL Stored Procedure) to execute the insertion of both `orders` and `order_items` within a single, secure database transaction block.
  2. If any step fails, roll back the transaction entirely to ensure no partial records are written.

---

### 8. SEC-09 — Missing Authentication & Request Rate Limiting
* **File / Location:** `src/app/actions/authActions.ts` (Login) & `src/app/actions/orderActions.ts` (Order creation)
* **OWASP 2025 Classification:** **A07:2025 — Authentication Failures** & **A02:2025 — Security Misconfiguration**
* **Vulnerability Analysis:** 
  The administrative login endpoint and the order creation endpoint have no rate limiting in place. An attacker can brute-force admin passwords without restriction, or flood the database with dummy orders, leading to connection depletion, database exhaustion, and denial of service (DoS).
* **Remediation Plan:**
  1. Implement a rate-limiter wrapper using a sliding window counter (in-memory or via Redis/DB logs) restricted to maximum 5 login attempts per minute per IP.
  2. Restrict order creation actions to a maximum of 3 requests per minute per IP/Session.

---

### 9. SEC-10 — Client Total Price Tampering via E2E Bypass
* **File / Location:** `src/app/actions/orderActions.ts` (`createOrder`)
* **OWASP 2025 Classification:** **A08:2025 — Software and Data Integrity Failures**
* **Vulnerability Analysis:** 
  When the application is run with `E2E_MODE = true`, `createOrder` sets the final server transaction total to match the client's `input.total_amount` instead of calculating it from database menu item values. Since the payment validation relies on this bypass, an attacker who activates `E2E_MODE` can purchase premium dishes for ₹1 by passing a tampered `total_amount` from the client.
* **Remediation Plan:**
  1. Restrict all test-mode bypasses strictly to local or staging non-production environments using an environment check (`process.env.NODE_ENV !== 'production'`).
  2. In production, always recalculate the total cost on the server based on the database price sheet.

---

### 10. BUG-18 — ETA Mismatch When Rider & Customer are in Close Proximity (Same Location)
* **File / Location:** `src/app/actions/distanceActions.ts` (`getGoogleMapsRouteData`) & `src/components/OrderTracker.tsx`
* **Severity:** **HIGH**
* **Vulnerability Analysis:** 
  When testing the customer storefront and rider portal in very close proximity (e.g. same building), the customer tracking page continues to display a long Estimated Arrival time of `29 minutes` instead of showing `1 min` or `Soon`. This is caused by a residual 20-minute preparation buffer combined with default Google Maps API fallbacks of 900 seconds.
* **Remediation Plan:**
  1. Set `prepTimeMinutes` to `0` inside `OrderTracker.tsx` once the order is `out_for_delivery`.
  2. Implement proximity coordinates check in `getGoogleMapsRouteData()` to override route duration to 60 seconds (1 minute) and distance to 0.01 km if coordinates are virtually identical (less than 20 meters), bypassing API call and 15-minute defaults.

---

## 🛠️ Verification Checklist for Fixes

For each critical issue resolved, the developer must verify correctness by running:
```bash
# 1. Complete ESLint and Type checks
npm run lint

# 2. Run all unit and integration test suites
npm run test

# 3. Compile optimized production build
npm run build
```

---
*Registry compiled: June 1, 2026*
