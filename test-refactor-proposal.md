# Test Suite Refactor Proposal — MVP-Era Assessment

**Date:** 2026-06-10  
**Context:** Pre-launch E2E testing phase. COD-only. Online payment and rate limiting deferred to production hardening.

---

## 1. Preface: Where We Are

We're in MVP mode. Priorities:

1. **COD flow works end-to-end** — customer orders, owner accepts, rider delivers
2. **E2E tests pass** — the critical path is verified in a real browser
3. **No P0 bugs** — the order lifecycle state machine is correct

Things we've consciously deferred:

- Razorpay online payment flow (we're COD-only for MVP)
- Distributed rate limiting (in-memory is fine for single-process)
- Multi-admin auth (single password is acceptable for MVP)
- Role-specific JWT secrets (shared secret is fine)

This proposal is **not** a list of everything to fix. It's a **priority-ranked roadmap** for when to fix what, given our MVP timeline.

---

## 2. What's Actually Trustworthy Today

These tests **do** protect the COD flow:

| Test | Why Trust It |
|------|-------------|
| `pricing.test.ts` | Pure functions, zero mocks. Rider earning math is correct. |
| `rateLimit.test.ts` | Pure utility. window/bucket logic is correct. |
| `validation.test.ts` | UUID regex + coordinate parsing. Correct. |
| `distance.test.ts` | ETA math. Correct. |
| Integration: `create-order.test.ts` | Real DB. Confirms COD order is created. |
| Integration: `owner-lifecycle.test.ts` | Real DB. Confirms state machine: confirmed → delivered. |
| Integration: `offline-restaurant.test.ts` | Real DB. Confirms offline gate works. |
| `env-audit.test.ts` | Scans for leaked secrets in source. Important to keep. |

**These do not need refactoring.** They are the foundation.

---

## 3. What Gives False Confidence (But We Accept for MVP)

These tests pass but don't prove much. We keep them because they catch local regressions, but we **do not** treat them as a safety gate:

### 3.1 Mocked Auth Tests (All Action Tests)

Every action test mocks `@/lib/auth` so that sessions always validate successfully.

**Risk:** If someone accidentally removes an auth check from `acceptOrder` or `dispatchOrder`, these tests still pass.

**Accept for MVP:** Because E2E tests (`rider-journey.spec.ts`, `whatsapp-dispatch.spec.ts`) actually exercise auth through the browser. If auth were broken, E2E would catch it.

**Hardening trigger:** When we add admin accounts (multi-user), rewrite these tests to use real JWTs.

### 3.2 Payment Tests Running via E2E Bypass

`orderActions.test.ts` runs with `E2E_MODE='true'`, which bypasses signature verification.

**Risk:** Tests never exercise real Razorpay signature verification.

**Accept for MVP:** We're COD-only. Online payment logic exists but is dormant. When we turn on payments, these tests must be rewritten to mock only the HTTP layer, not the verification logic.

### 3.3 Rate Limit Always "Allowed"

Every test mocks `@/lib/rateLimit` to return `{ allowed: true }`.

**Risk:** If rate limit logic is broken, no unit test catches it.

**Accept for MVP:** The rate limiter is a simple in-memory Map. We verified it with `rateLimit.test.ts` (the pure utility). The issue is that action-level wiring is untested, but for single-process MVP deployment, this is acceptable.

### 3.4 Integration Tests Skip in CI

All 5 integration tests use `skipIf(!isDBConfigured)`. In CI without Supabase credentials, they silently pass without running.

**Risk:** Someone could break the COD flow and CI would report "all green."

**Accept for MVP:** As long as E2E tests run against a real server in CI, this gap is covered. If E2E tests are not in CI, then integration tests must be.

---

## 4. What Should Be Fixed Before Production

These are genuine gaps that **will** cause problems in production if not addressed:

### P0 (Fix Before Production Launch)

1. **Make integration tests required, not skippable**
   - Either configure Supabase test DB in CI
   - Or move critical assertions into E2E tests
   - Current state: 5 integration tests that prove real DB behavior → all skip in CI

2. **E2E_MODE must not exist in production code**
   - `process.env.E2E_MODE` currently bypasses price validation and payment verification
   - If accidentally set in production, an attacker can place free orders
   - **Fix:** Strip E2E_MODE checks from `orderActions.ts` before production deployment. Use a separate test server instead.

3. **Stop mocking auth in the critical-path integration tests**
   - `owner-lifecycle.test.ts` mocks `verifyAdminSession` and `verifyCustomerSession`
   - This means the integration test proves the DB transitions work but not that auth gates protect them
   - **Fix:** Generate real JWTs using the app's own `jose` utilities, or at minimum add E2E coverage for auth-gated flows

### P1 (Fix Within First Month of Production)

4. **Add lockfile integrity to CI**
   - No `package-lock.json` integrity verification
   - Supply chain attack on `razorpay`, `jose`, or `bcryptjs` would go undetected
   - **Fix:** Add `npm audit` + lockfile hash check to CI pipeline

5. **Rider session doesn't verify rider exists in DB**
   - `verifyRiderSession()` in `auth.ts:41` checks JWT validity but doesn't check if the rider still exists or is active
   - A deleted rider's token works until expiry
   - **Fix:** Add DB lookup in `verifyRiderSession()` + add a test for it

6. **Admin session doesn't verify role claim**
   - `verifyAdminSession()` in `auth.ts:20` doesn't check `payload.role === 'admin'`
   - If the shared `JWT_SECRET` is compromised, a customer token with crafted `role: 'admin'` would pass
   - **Fix:** Add `payload.role === 'admin'` check + test that customer JWT fails admin verification

7. **Rate limit leak in tests**
   - Currently every test file independently mocks `@/lib/rateLimit`
   - If a new action is added without rate limiting, no test enforces it
   - **Fix:** Create a `__tests__/helpers.ts` that exports a `mockRateLimit(defaultAllowed = false)` so the default state is "blocked" rather than "allowed"

### P2 (Hardening, First Quarter)

8. **`getOrdersByPhone()` needs rate limiting + session enforcement**
   - Currently phone-based order lookup has no rate limit or OTP
   - Phone number enumeration could leak order history
   - **Fix:** Add rate limit per IP, or require customer session

9. **Webhook handler tests need real signature verification**
   - Currently `validateWebhookSignature` is mocked
   - A bug in how raw body is extracted for signing would pass tests but fail in production
   - **Fix:** Generate real Razorpay webhook signatures using test secret in tests

10. **Split `orderActions.test.ts`**
    - Currently 918 lines testing 3 separate features (createOrder, payment verification, cancelOrder)
    - Makes it hard to add targeted regression tests
    - **Fix:** Split into 3 files (one per feature) when adding payment flow tests

---

## 5. Recommended Verification Gate for MVP

### Current Gate (runs everything):
```bash
npm run build && npm run test && npx playwright test
```

### Proposed Honest Gate (for COD-only MVP):
```bash
npm run build

# These tests are trustworthy:
npx vitest run src/tests/unit/lib/pricing.test.ts \
  src/tests/unit/lib/validation.test.ts \
  src/tests/unit/lib/distance.test.ts \
  src/tests/unit/lib/rateLimit.test.ts \
  src/tests/unit/security/env-audit.test.ts

# These integration tests prove real DB behavior:
npx vitest run src/tests/integration/cod/*.test.ts

# These E2E tests prove the real user flow works:
npx playwright test tests/cod-happy-path.spec.ts \
  tests/rider-journey.spec.ts \
  tests/whatsapp-dispatch.spec.ts

# Weak tests run as advisory (not blocking):
npx vitest run src/tests/unit/actions/
```

**But more importantly:** The weak unit tests should be moved to a separate `npm run test:advisory` command so the team can see them without confusing "all passing" with "all secure."

---

## 6. Summary

| Layer | Trust Level | Depends On |
|-------|-------------|------------|
| Pure business logic (pricing, validation, rate limit, ETA) | **High** | Nothing — pure functions |
| COD integration tests (real DB) | **Medium** | Supabase credentials in CI |
| E2E tests (real browser) | **Medium** | Dev server running + test data |
| Mocked action tests (auth bypassed, rate limit bypassed) | **Low** | Nothing — they always pass |
| Payment tests (run via E2E bypass) | **Very Low** | Only meaningful when payments active |

**The honest truth:** Our current test suite gives us confidence in the COD business logic and DB persistence. It does **not** give us confidence in auth enforcement, rate limiting, or payment security. That's acceptable for MVP if we know it. The danger is forgetting.

---

## 7. What "Done" Means For Each Phase

| Phase | Done Means |
|-------|-----------|
| **MVP Launch** | COD E2E passes + integration tests pass + no P0 bugs |
| **First Sprint After Launch** | Integration tests don't skip in CI + E2E_MODE removed from production |
| **Payment Enablement** | Payment tests rewritten with real HMAC verification |
| **Production Hardening** | Auth tests use real JWTs + rate limit tests don't mock to "always allowed" |
