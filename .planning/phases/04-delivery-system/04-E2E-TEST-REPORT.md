# Phase 4 E2E Test Report — 2026-05-12

**Build:** Turbopack compilation + TypeScript type-check: **PASS**
**Test run:** `npx playwright test` — **5 tests, 5 failed**
**Dev server:** `next dev -p 3005 --webpack` (configured in playwright.config.ts webServer)

---

## Test Suite 1: Delivery Radius & Toggle Verification

**File:** `tests/delivery-validation.spec.ts`
**Suite:** `Delivery Radius & Toggle Verification`

### Configuration

| Variable | Value |
|----------|-------|
| BASE_URL | `http://localhost:3005` (NOTE: was `3001` in original file, fixed this session) |
| ADMIN_PASSWORD | `goodrest88` (from env or default) |

### beforeEach hook (shared by all 3 tests)

```
1. page.goto → /admin/login
2. page.fill → input[type="password"] with ADMIN_PASSWORD
3. page.click → button "Unlock Dashboard"
4. expect URL → /admin/orders (timeout 30s)
```

### Test A: "Scenario A: Blocks delivery when OFFLINE"

**What it does:**
1. Checks toggle status text (ONLINE/OFFLINE) via `.font-bold.leading-none`
2. If ONLINE, clicks toggle button `.relative.w-12.h-6` to go OFFLINE
3. Navigates to `/` (menu), clicks "Add" on first item
4. Scrolls down, clicks checkout link `a[href="/checkout"]`
5. Grants geolocation permission, sets to `(24.7974, 85.0100)` — very close to restaurant
6. Clicks "Detect Location"
7. Expects error text `"Currently online delivery is off."` visible
8. Expects "Pay & Order" button **disabled**

**Result: FAIL** — `ERR_CONNECTION_REFUSED at http://localhost:3001/admin/login`

**Root cause:** `BASE_URL` was hardcoded to `http://localhost:3001` (port mismatch — dev server runs on 3005). `beforeEach` couldn't navigate to login page at all, so test never reached the actual test logic.

**Status after fix:** `BASE_URL` corrected to `http://localhost:3005`. Ready for re-run.

---

### Test B: "Scenario B: Blocks delivery when OUT OF RADIUS"

**What it does:**
1. Checks toggle, ensures ONLINE
2. Navigates to `/admin/menu`, sets `input#maxRadius` to `0.1` (km), clicks "Save Radius"
3. Waits 2s for DB save
4. Goes to `/` → adds item → checkout
5. Sets geolocation to `(24.8000, 85.0100)` — ~300m from restaurant (farther than 0.1km radius)
6. Clicks "Detect Location"
7. Expects error text `"Sorry, we don't deliver in this area."` visible
8. Expects "Pay & Order" button **disabled**

**Result: FAIL** — `ERR_CONNECTION_REFUSED at http://localhost:3001/admin/login`

**Root cause:** Same `BASE_URL` port mismatch. `beforeEach` crashed before test logic.

**Status after fix:** `BASE_URL` corrected. Ready for re-run.

---

### Test C: "Scenario C: Allows delivery when IN RADIUS"

**What it does:**
1. Navigates to `/admin/menu`, sets `input#maxRadius` to `50` (km), clicks "Save Radius"
2. Waits 2s
3. Goes to `/` → adds item → checkout
4. Sets geolocation to `(24.8400, 85.0100)` — ~5km from restaurant (within 50km radius)
5. Clicks "Detect Location"
6. Expects `p:has-text("Location Verified")` visible (timeout 10s)
7. Expects "Pay & Order" button **enabled**

**Result: FAIL** — `ERR_CONNECTION_REFUSED at http://localhost:3001/admin/login`

**Root cause:** Same `BASE_URL` port mismatch.

**Status after fix:** `BASE_URL` corrected. Ready for re-run.

---

### Delivery Validation — Selectors at Risk (needs verification after port fix)

| Selector | Location | Risk |
|----------|----------|------|
| `.font-bold.leading-none` inside `.flex.items-center.gap-3.px-4.py-2` | Toggle status text | High — tight CSS coupling, could break with any layout change |
| `button.relative.w-12.h-6` | Toggle switch button | High — pure Tailwind class chain, no semantic selector |
| `input#maxRadius` | Radius input in admin menu | OK — uses stable `id` |
| `text=Currently online delivery is off.` | Error message | Medium — exact text match, case-sensitive |
| `text=Sorry, we don't deliver in this area.` | Error message | Medium — exact text match |

---

## Test Suite 2: Rider End-to-End Journey

**File:** `tests/rider-journey.spec.ts`
**Suite:** `Rider End-to-End Journey`

### Configuration

| Variable | Value |
|----------|-------|
| BASE_URL | `http://localhost:3005` |
| RIDER_PHONE | `1234567890` |
| RIDER_PASSWORD | `password123` |

### beforeEach hook

```js
page.context().grantPermissions(['geolocation']);
page.context().setGeolocation({ latitude: 24.7974, longitude: 85.0100 });
```

### Test: "Full Rider Loop: Login → Online → Accept → Start Riding → Deliver"

**Step-by-step flow:**

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | `page.goto(/rider/login)` | Login form renders |
| 2 | Fill "Phone Number" = `1234567890` | — |
| 3 | Fill "Password" = `password123` | — |
| 4 | Click "Login" | POST to server action `loginRider` |
| 5 | `expect URL /.*rider\/dashboard/` | Redirected to dashboard |
| 6 | `expect text "Hi,"` visible | Welcome message shown |
| 7 | Click "Go Online" | Rider status → online |
| 8 | `expect text "Online & Ready"` visible | Status confirmed |
| 9 | Open customer page, add item, checkout | Order placed |
| 10 | Fill customer form (Name, Phone, Address) | — |
| 11 | Click "Cash on Delivery" then "Pay & Order" | Order created, redirected to `/track/...` |
| 12 | Extract orderId from URL | — |
| 13 | Open admin page `/admin/orders` | — |
| 14 | Click "Start Cooking" on order card | Status → preparing |
| 15 | Wait 500ms, click "Mark Ready" | Status → ready |
| 16 | Switch to rider page, expect "Accept" button | Broadcast modal shows order |
| 17 | Click "Accept" | `acceptOrder` server action called |
| 18 | `expect text "Active Delivery"` visible | Active order section shown |
| 19 | Click "Start Riding" | `startRiding` server action called |
| 20 | `expect link "Navigate"` visible | Maps link appears |
| 21 | Click "Delivered" | `markOrderAsDeliveredRider` → calls `deliver_order` RPC |
| 22 | `expect "Active Delivery" not visible` | Order cleared from rider UI |
| 23 | Switch to customer page, `expect "Delivered"` | Customer sees final status |

**Result: FAIL at Step 4/5**

**Actual behavior:**
- Navigated to `/rider/login` — page loaded (HTTP 200, 3.6s)
- Filled phone and password fields
- Clicked "Login" button
- Server action `loginRider` was invoked via POST `/rider/login`
- Server returned **HTTP 500** with error:
  ```
  SyntaxError: Unexpected end of JSON input
      at JSON.parse (<anonymous>)
  ```
- Client-side unhandled rejection: `Error: An unexpected response was received from the server.`
- Page stayed at `/rider/login` (no redirect)
- `expect(page).toHaveURL(/.*rider\/dashboard/)` failed — still on `/rider/login`

**Root cause analysis:**

The `loginRider` server action (`src/app/actions/riderActions.ts:24-33`) queries Supabase for a rider matching phone=`1234567890` and password_hash=`password123`:

```ts
export async function loginRider(phone: string, password_hash: string) {
  const { data, error } = await supabaseAdmin
    .from('riders')
    .select('*')
    .eq('phone', phone)
    .eq('password_hash', password_hash)
    .single();
  if (error || !data) return { success: false, error: 'Invalid phone or password' };
  return { success: true, rider: data };
}
```

The `SyntaxError: Unexpected end of JSON input` at `JSON.parse` did NOT come from this function (it would return a plain object `{success: false, error: ...}` on missing rider). The 500 error was thrown **before** or **during** the Next.js server action handler's deserialization of the request.

Possible causes (not confirmed — deferred to debugging agent):
1. **Test rider doesn't exist** in the remote Supabase DB — but this would NOT cause a 500; the function handles that gracefully
2. **Cookie/session issue** — Next.js server actions require a CSRF token or form data integrity. Test environment may not send proper headers.
3. **Supabase client crash** — if `supabaseAdmin` instantiation fails (env vars missing in test mode), but this would throw at module load, not at `JSON.parse`
4. **Server action closure serialization** — Next.js webpack vs turbopack differences. Test uses `--webpack` flag, build uses Turbopack.

**Status:** BLOCKED — requires debugging agent to diagnose 500 root cause.

---

## Test Suite 3: WhatsApp Dispatch Flow

**File:** `tests/whatsapp-dispatch.spec.ts`
**Suite:** `WhatsApp Dispatch Flow`

### Configuration

| Variable | Value |
|----------|-------|
| BASE_URL | `http://localhost:3005` |
| TEST_RIDER_PHONE | `7542011085` |
| TEST_TRACKING_URL | `https://maps.app.goo.gl/playwright-test-location` |

### beforeEach hook

```js
page.goto(/admin/orders);  // E2E_MODE bypasses auth
page.waitForLoadState('networkidle');
```

### Test: "Admin can prepare and dispatch order with rider info"

**Step-by-step flow:**

| Step | Action | Expected |
|------|--------|----------|
| 1 | Locate `.glass-card` filtered by text 'READY' | Card visible |
| 2 | `orderCard.getByPlaceholder('Rider Phone')`, fill `7542011085` | Input filled |
| 3 | Get WhatsApp link `[title="Dispatch via WhatsApp"]`, check `href` | Contains `wa.me/917542011085`, `text=`, `GOODREST DELIVERY ASSIGNMENT`, `Customer Number:` |
| 4 | `orderCard.getByPlaceholder('Tracking Link')`, fill tracking URL | Input filled |
| 5 | Click "DISPATCH" button | Server action called |
| 6 | Expect `h3:has-text("DISPATCHED TODAY")` visible | Section shown |
| 7 | Expect `.glass-card` filtered by 'OUT FOR DELIVERY' | Order moved |
| 8 | Expect dispatched card contains rider phone + "Rider Assigned" text | Info visible |

**Result: FAIL at Step 2**

**Actual behavior:**
```
TimeoutError: locator.fill: Timeout 15000ms exceeded.
waiting for locator('.glass-card').filter({ hasText: 'READY' }).first().getByPlaceholder('Rider Phone')
```

**Root cause: TEST IS STALE — CODE-DELTA MISMATCH**

Phase 4 refactor (`20260509_rider_refactor`) changed the delivery model from **admin manual dispatch** to **FCFS rider self-assignment**. The following changes broke this test:

1. **`dispatchOrder()` removed** from `src/app/actions/adminActions.ts` — the "DISPATCH" button no longer exists
2. **`updateDispatchDetails()` removed** from `src/app/actions/adminActions.ts` — no way to save rider phone/tracking link per-order from admin
3. **"Rider Phone" placeholder removed** from `OrdersDashboardClient.tsx` — the admin no longer inputs rider phone per order
4. **"Tracking Link" placeholder removed** — same reason
5. **"DISPATCH" button removed** — riders now self-assign via `acceptOrder()` with atomic FCFS DB update
6. **WhatsApp link construction moved** — if it still exists, it uses different UI elements

The new Phase 4 flow is:
```
Admin: order → "Start Cooking" → preparing → "Mark Ready" → ready
Rider: broadcast receives ready orders → "Accept" (FCFS) → "Start Riding" → out_for_delivery → "Delivered" (via deliver_order RPC)
```

**Status: NEEDS REWRITE**

This test's intent (WhatsApp dispatch info) must be re-expressed in terms of the new FCFS flow. The WhatsApp link generation may now live in a different component or may have been removed entirely.

---

## Summary

| # | Test | Status | Category | Action |
|---|------|--------|----------|--------|
| 1 | Delivery Validation A (OFFLINE blocks) | FAIL | **Config bug** | `BASE_URL` fixed (3001→3005). Re-run. |
| 2 | Delivery Validation B (Out of radius blocks) | FAIL | **Config bug** | `BASE_URL` fixed. Re-run. |
| 3 | Delivery Validation C (In radius allows) | FAIL | **Config bug** | `BASE_URL` fixed. Re-run. |
| 4 | Rider Journey (full loop) | FAIL | **Runtime 500** | Needs debugging — login server action crashes with JSON parse error. Rider `1234567890`/`password123` may not exist in DB. |
| 5 | WhatsApp Dispatch | FAIL | **Stale test** | Needs rewrite — test assumes manual dispatch UI removed in Phase 4 FCFS refactor. |

## Deterministic reproduction

```bash
# 1. Ensure .env has required vars:
#    NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
#    GOOGLE_MAPS_API_KEY, NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
#    ADMIN_PASSWORD=goodrest88, E2E_VERIFICATION_SECRET, JWT_SECRET

# 2. Build check (passes)
NODE_OPTIONS=--max-old-space-size=4096 npm run build

# 3. Run E2E
npx playwright test

# Expected: 5 tests run. 5 fail with errors documented above.
```

## Environment

| Property | Value |
|----------|-------|
| OS | Windows 11 Home Single Language 10.0.26200 |
| Node | (check `node -v`) |
| Next.js | 16.2.2 |
| Playwright | 1.59.x |
| Browser | Chromium (Desktop Chrome emulation) |
| Dev server port | 3005 |
| Dev server mode | webpack (`--webpack` flag) |
| DB | Remote Supabase (no local Supabase CLI) |
