# Fix Plan: Goodrest E2E + Admin Bell

## Phase 1 — Fix E2E Password Mismatch (P0)

**File:** `src/tests/e2e/cod-happy-path.spec.ts`
**Change:** Line 179 — `'test123'` → `'testpass'`

```diff
-    await page.fill('input[placeholder="Password"]', 'test123');
+    await page.fill('input[placeholder="Password"]', 'testpass');
```

**Why:** Line 43 hashes `'testpass'` with bcrypt. Line 179 fills `'test123'` in the login form. `loginRider` → `bcrypt.compare('test123', hash_of_testpass)` → false → no cookie → no redirect → 120s timeout.

**Verify:** Run `npx playwright test src/tests/e2e/cod-happy-path.spec.ts` — should pass login and redirect to `/rider/dashboard`.

---

## Phase 2 — Fix E2E Broadcast Race Conditions (P1)

**File:** `src/tests/e2e/cod-happy-path.spec.ts`
**Lines affected:** 186–222 (Step 3: Rider broadcast)

### Current Broken Flow

```
line 187: mockGeolocation(page)
line 188: click "Go Online"          → triggers setRiderOnline, sets cookie
line 191: DB: is_online = true       → redundant backup
line 195: page.reload()              → KILLS websocket, forces remount
line 198: mockGeolocation(page)      → re-mock
line 200: try click "Go Online"      → may fail, already online
line 207: poll DB is_online = true
line 213: DB: order_status = 'preparing'   ← NO-OP (already preparing)
line 217: waitForTimeout(2000)             ← blind guess
line 218: DB: order_status = 'preparing'   ← STILL no-op, no realtime event
line 220: poll "New Delivery!" visible
```

**Why it's fragile:** Setting `preparing` → `preparing` triggers NO Supabase realtime UPDATE event. The reload kills the websocket subscription. The 2000ms wait is guesswork.

### New Flow (Hybrid: UI Go Online + DB state + polling)

```ts
// Line 186 — replace lines 186–222 with:

// Mock geolocation for rider and go online
await mockGeolocation(page);
await page.click('button:has-text("Go Online")');

// Poll: wait until rider is actually online (server action + DB sync)
await expect.poll(async () => {
  const { data } = await supabase.from('riders').select('is_online').eq('id', testRiderId).single();
  return data?.is_online;
}, { timeout: 15000 }).toBe(true);

// The OrderBroadcast component's fetchExisting useEffect runs on mount
// and picks up unassigned orders. But the websocket channel may not be
// subscribed yet. Trigger a realtime UPDATE by flipping status:
//   preparing → confirmed → preparing
// This guarantees a postgres_changes UPDATE event fires on the channel.
await supabase.from('orders').update({ order_status: 'confirmed' }).eq('id', testOrderId);
await page.waitForTimeout(500);
await supabase.from('orders').update({ order_status: 'preparing' }).eq('id', testOrderId);

// Poll for broadcast modal with generous timeout for websocket latency
await expect.poll(async () => {
  return await page.locator('text=New Delivery!').isVisible();
}, { timeout: 25000 }).toBe(true);
```

**Key differences:**
| Before | After |
|---|---|
| Reload kills websocket | No reload — channel stays subscribed |
| `preparing` → `preparing` (no-op) | `preparing` → `confirmed` → `preparing` (real UPDATE) |
| `waitForTimeout(2000)` blind wait | `expect.poll` with 25s timeout |
| 35 lines of fragile code | 15 lines of deterministic code |

**What stays the same:** Lines 224–245 (Accept button click, DB rider_id verification).

---

## Phase 3 — Refactor Admin Bell to Layout (P2)

### Problem
`BellNotification.tsx` is rendered in `OwnerDashboardClient.tsx:213` — only visible on `/admin/orders`. The admin needs order alerts on ALL admin pages (menu, riders, reports, etc.).

### Change 3a) Add BellNotification to `src/app/admin/layout.tsx`

Add import at top:
```tsx
import BellNotification from '@/components/owner/BellNotification';
```

Add handler function after existing hooks (after line 295):
```tsx
const handleAcceptFromBell = async (orderId: string) => {
  const { acceptOrder } = await import('@/app/actions/ownerActions');
  const result = await acceptOrder(orderId);
  if (result.success) {
    setConfirmedOrders(prev => prev.filter(o => o.id !== orderId));
    notifiedOrderIdsRef.current.delete(orderId);
  } else {
    alert('Failed to accept: ' + result.error);
  }
};
```

Add BellNotification in JSX (e.g., inside the main section div after line 586):
```tsx
<BellNotification orders={confirmedOrders} onAccept={handleAcceptFromBell} />
```

### Change 3b) Remove BellNotification from `src/components/owner/OwnerDashboardClient.tsx`

Remove line 11:
```tsx
- import BellNotification from './BellNotification';
```

Remove lines 212–213:
```tsx
- {/* Bell Notification Overlay */}
- <BellNotification orders={orders} onAccept={handleAccept} />
```

**Note:** `handleAccept` is still used by `OrderCard` components (line 249+), keep it.

---

## Phase 4 — Full Verification

```bash
npm run build
npm run test
npm run lint
npx playwright test src/tests/e2e/cod-happy-path.spec.ts
```

| Check | Expected |
|---|---|
| Build | Passes |
| Unit tests (50 files) | 605/605 pass |
| Lint | 0 errors |
| E2E (cod-happy-path) | Passes — full COD lifecycle |

---

## File Change Summary

| # | File | Change |
|---|---|---|
| 1 | `src/tests/e2e/cod-happy-path.spec.ts:179` | `'test123'` → `'testpass'` |
| 2 | `src/tests/e2e/cod-happy-path.spec.ts:186-222` | Replace reload loop with status-flip + `expect.poll` |
| 3 | `src/app/admin/layout.tsx` | +import BellNotification, +handler, +JSX |
| 4 | `src/components/owner/OwnerDashboardClient.tsx:11` | -import BellNotification |
| 5 | `src/components/owner/OwnerDashboardClient.tsx:212-213` | -BellNotification JSX |

## Execution Order

1. Password fix → run E2E → confirm login passes
2. If broadcast still fails → fix race conditions → run E2E
3. Admin Bell refactor → lint + build
4. Full verification suite
