# Goodrest — Testing Guide

This document defines the testing architecture and execution strategies for the Goodrest platform. Testing is split into two distinct tiers: **Security/Cryptographic Tests** (running with real crypto) and **Advisory Action Tests** (running with mocked environments).

---

## 🏛️ Two-Tier Testing Architecture

```
                      ┌───────────────────────────────────┐
                      │            E2E Tests              │
                      │       (Playwright / Live App)     │
                      │  - Injects real-signed cookies    │
                      │  - Exercises full live crypto     │
                      └─────────────────┬─────────────────┘
                                        │
                                        ▼
                      ┌───────────────────────────────────┐
                      │      Tier 1: Security Tests       │
                      │     (Vitest / Node Environment)   │
                      │  - Real jose JWT verification     │
                      │  - Real HMAC signature validation │
                      │  - Fail-closed rate limiting      │
                      └─────────────────┬─────────────────┘
                                        │
                                        ▼
                      ┌───────────────────────────────────┐
                      │      Tier 2: Advisory Tests       │
                      │     (Vitest / JSDOM Environment)  │
                      │  - Mocked sessions / cookies      │
                      │  - Bypass auth check logic        │
                      │  - Fast business flow validation  │
                      └───────────────────────────────────┘
```

---

## 🔒 Tier 1: Security & Cryptographic Tests

These tests verify access control, cryptographic signature checking, and rate-limiting integrity. They run without mocking the security layer.

*   **Command**: `npm run test:security`
*   **Target Directory**: `src/tests/unit/security/`
*   **Environment**: Must use the native Node environment (`@vitest-environment node`) because `jsdom`'s `Uint8Array` implementation causes type-mismatches with the `jose` encryption library.

### Key Characteristics:
1.  **Real JWT Cryptography**: Uses the actual `jose` library and `JWT_SECRET` keys via [jwt-helpers.ts](file:///e:/desktop/goodrest-claude/src/tests/helpers/jwt-helpers.ts). It generates authentic admin, rider, and customer tokens.
2.  **Strict Role Checks**: Asserts that sending a valid Customer token to an Admin route fails with `401 Unauthorized` or `403 Forbidden` (preventing cross-role privilege escalation).
3.  **Real Webhook Signatures**: Computes real HMAC-SHA256 signatures for Razorpay webhook verification tests instead of mocking the verification function return values.
4.  **Fail-Closed Rate Limiting**: The rate-limiter helper [mock-helpers.ts](file:///e:/desktop/goodrest-claude/src/tests/helpers/mock-helpers.ts) defaults to **blocked**. Tests must explicitly opt in to allow operations.

### Writing a Tier 1 Test:
Always add the node environment directive at the top of the test file:
```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { signTestAdminJWT } from '../../helpers/jwt-helpers';
import { verifyAdminSession } from '@/lib/auth';

describe('Admin Authentication', () => {
  it('should verify a valid admin session cookie', async () => {
    const validCookie = await signTestAdminJWT();
    const result = await verifyAdminSession(validCookie);
    expect(result.success).toBe(true);
  });
});
```

---

## ⚡ Tier 2: Advisory Business Logic Tests

These tests cover the functional logic of Next.js Server Actions and page interactions under the assumption that authentication and rate-limiting have already passed.

*   **Command**: `npm run test:advisory` (or `npm run test` for the complete suite)
*   **Target Directory**: `src/tests/unit/actions/`
*   **Environment**: Typically `jsdom`.

### Key Characteristics:
1.  **Mocked Sessions**: Auth functions like `verifyAdminSession` are mocked via Vitest spy/mock functions to instantly return `{ success: true, session: { role: 'admin' } }`.
2.  **Focus on Logic**: Verifies calculations, state changes, DB payloads, and event emissions.
3.  **Speed**: Runs very fast because it avoids cryptographic signature operations and complex setup.

---

## 🚀 End-to-End (E2E) Testing (Playwright)

E2E tests interact with a live running server. Because the server runs production code, **auth cannot be stubbed out or bypassed in memory**. However, manually logging in via UI fields on every test is slow and causes flakiness.

### The E2E Auth Strategy (Credential Injection)
Instead of executing UI form actions (entering usernames and passwords), the tests **inject valid, cryptographically signed credentials** directly into the browser context.

#### 1. Injected Admin Authentication:
Playwright generates a real signed token using the test secret and loads it directly into the browser cookie jar using `context.addCookies()` before loading the admin routes:
```typescript
import { SignJWT } from 'jose';
import { test, expect } from '@playwright/test';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

async function signAdminJWT(): Promise<string> {
  const encoder = new TextEncoder();
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(encoder.encode(JWT_SECRET));
}

test('Admin Dashboard access', async ({ page, context }) => {
  const adminToken = await signAdminJWT();
  await context.addCookies([
    { name: 'admin_session', value: adminToken, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' },
  ]);
  
  await page.goto('/admin/orders');
  await expect(page.locator('text=Owner Dashboard')).toBeVisible();
});
```

#### 2. Injected Rider Authentication:
Rider sessions rely on `localStorage` in the client browser. Playwright navigates to the page and sets the session value via client-side page evaluation:
```typescript
test('Rider Dashboard access', async ({ page }) => {
  await page.goto('/rider/dashboard');
  await page.evaluate((rider) => {
    localStorage.setItem('rider_session', JSON.stringify(rider));
  }, { id: 'test-rider-id', name: 'Test Rider', phone: '9999999999' });
  
  await page.reload();
  await expect(page.locator('text=Terminal')).toBeVisible();
});
```

### Running E2E Tests:
*   Make sure the dev server is running locally: `npm run dev`
*   Execute E2E tests: `npx playwright test`
