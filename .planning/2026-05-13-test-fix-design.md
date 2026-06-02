---
date: 2026-05-13
phase: 4
topic: Fix all unit test failures + src bug (menu_item_id null) + E2E test failures
approach: A (patch fixes)
---

# Design: Test & Src Bug Fixes

## Scope

Fix 1 src bug + 8 unit test failures + 2 E2E test failures. Scope option 3 (everything).

## Section 1 — Src Bug: `menu_item_id` null

**File:** `src/app/actions/orderActions.ts:35`

**Change:**
```
BEFORE: menu_item_id: UUID_PATTERN.test(item.id) ? item.id : null,
AFTER:  menu_item_id: item.id,
```

**Why:** Menu item IDs are slugs (e.g., `paneer-tikka`), not UUIDs. `UUID_PATTERN` rejects all slugs, setting `menu_item_id` to null. IDs come from our own `menu_items` table — trust the data source. If an invalid ID reaches the DB insert, the FK constraint will fail with a clear error, which is better than silently storing null.

Also remove `UUID_PATTERN` constant definition (lines 11-12) — only used in `normalizeOrderItems`.

## Section 2 — Vitest Config: Exclude Playwright Specs

**File:** `vitest.config.ts`

**Change:**
```ts
import { configDefaults, defineConfig } from 'vitest/config';
// ...
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'tests/**'],
  },
});
```

**Why:** `tests/*.spec.ts` files use `@playwright/test` imports. Vitest picks them up and fails. Manual `exclude` array replaces defaults entirely per Vitest docs — must spread `configDefaults.exclude`.

**Ref:** [vitest.dev config/exclude](https://vitest.dev/config/#exclude) — manual `exclude` replaces defaults; use `configDefaults` to extend.

## Section 3 — Unit Test Mock: `riderActions.test.ts`

**File:** `src/app/actions/riderActions.test.ts`

**Change:** Replace mock target from `@/lib/supabase` to `@/lib/supabaseAdmin`.

**Why:** `riderActions.ts` imports `supabaseAdmin` from `@/lib/supabaseAdmin`, not `supabase` from `@/lib/supabase`. Mocking the wrong module leaves the real `supabaseAdmin` to initialize, which creates a Supabase client with undefined config in jsdom.

Mock must match `supabaseAdmin` API shape:
```ts
vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({ select, eq, single, update, insert })),
    rpc: vi.fn(() => Promise.resolve({ error: null })),
  },
}));
```

Also fix `updateLocation` test — current mock returns `{ error: null }` but `updateLocation` chains `.from().update().eq()`. Need proper chain mock.

## Section 4 — Unit Test Mocks: 4 Component Tests

**Files:**
- `src/app/rider/login/page.test.tsx`
- `src/app/rider/dashboard/page.test.tsx`
- `src/components/rider/OrderBroadcast.test.tsx`
- `src/components/OrderTracker.test.tsx`

**Change:** Add `vi.mock('next/navigation')` at top of each file:
```ts
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));
```

Plus mock `@/lib/supabase` for components that read menu/order data from Supabase.

**Why:** These are Next.js client components using `useRouter`, `useSearchParams` from `next/navigation`. Vitest jsdom environment has no App Router provider. Without mock, import chain fails.

## Section 5 — E2E: `delivery-validation.spec.ts` `@/` Import

**File:** `tests/delivery-validation.spec.ts:2`

**Change:** Replace `import { supabaseAdmin } from '@/lib/supabaseAdmin'` with inline `createClient` using `process.env`:
```ts
import { createClient } from '@supabase/supabase-js';
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
```

**Why:** Playwright runs in Node, not through Next.js/Vitest bundler. The `@/` alias is not resolved. Dotenv loads env vars in Playwright config, so `process.env` works.

## Section 6 — E2E: Rider Login 500 (rider-journey.spec.ts)

**File:** `tests/rider-journey.spec.ts`

**Change:** In `beforeEach`, seed test rider directly via `supabaseAdmin` upsert into `riders` table. Then submit login form with known phone/password.

**Why:** Next.js bug #86945 — server action handler `decodeReply()` crashes on empty/malformed body with `SyntaxError: Unexpected end of JSON input`. Root cause is framework-level, cannot fix locally. Workaround: ensure rider row exists, ensure page fully compiled before form submit, use valid credentials.

## Section 7 — E2E: WhatsApp Dispatch Rewrite

**File:** `tests/whatsapp-dispatch.spec.ts`

**Change:** Full rewrite for FCFS rider self-assignment flow:
1. Create order, move to `ready` status
2. Rider login → dashboard → sees unassigned order
3. Rider clicks Accept → order status updates
4. Verify order assigned to rider (rider_id populated)
5. Remove all references to removed UI: DISPATCH button, Rider Phone input, Tracking Link input, `dispatchOrder()`, `updateDispatchDetails()`

**Why:** Phase 4 FCFS refactor removed manual dispatch UI. Test references elements that no longer exist.

## Verification

- `npm run test` → 0 failures (all Vitest suites pass)
- `npx playwright test` → 5/5 pass (or clear skip/explanation for known framework bugs)
- `npm run build` → still passes
- `npm run lint` → 0 errors
