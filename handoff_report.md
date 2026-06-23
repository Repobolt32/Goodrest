# Handoff Report: Issues Audit & What Remains to Fix

## Verification Results

| Check | Status |
|---|---|
| `npm run build` | ✅ Passes |
| `npm run test` (unit) | ✅ 605/605 passed (50 files) |
| `npx playwright test cod-happy-path.spec.ts` | ❌ Fails — password mismatch |

---

## Issue 1: Rider Bell — Offline Broadcast Guard
**Claimed fixed in handoff_bug.md:** ✅ **Confirmed implemented**

`src/components/rider/OrderBroadcast.tsx` — Checks `is_online` before playing bell sound at 3 locations (lines 48-49, 99-100, 121-122):
```ts
const { data: riderData } = await supabase.from('riders').select('is_online').eq('id', riderId).single();
if (!riderData?.is_online) return;
```
**No further work needed.**

---

## Issue 2: Rider Auth — Phone Fallback
**Claimed fixed in handoff_bug.md:** ✅ **Confirmed implemented**

`src/app/actions/riderActions.ts` — Uses `session.session.phone !== riderData.data.phone` fallback in 8 functions (lines 32, 109, 236, 299, 302, 346, 384, 623).
**No further work needed.**

---

## Issue 3: Admin Bell — Global Notification
**Partially implemented — remaining work:**

- `src/components/owner/BellNotification.tsx` still exists and is **still rendered** in `OwnerDashboardClient.tsx:213`. It handles:
  - Audio loop (`/audio/goodrest-bill.mp3`) for non-Electron
  - Popup overlay for new confirmed orders
- `src/app/admin/layout.tsx` has **separate** Electron IPC bell logic (lines 212-258) with `playNotificationSound`, `showBellWindow`, `updateTrayBadge`.

**What's wrong:** The bell notification popup and audio only appear on the `/admin/orders` page because `OwnerDashboardClient` is mounted only there. If the admin navigates to `/admin/riders` or `/admin/menu`, new orders won't trigger the popup or sound.

**Remaining work:**
- Decide whether `BellNotification.tsx` should be moved to `layout.tsx` (for browser) or if Electron-only is sufficient
- Clean up duplicate logic between `BellNotification.tsx` and `layout.tsx`
- Remove `BellNotification` import/usage from `OwnerDashboardClient.tsx` after migration

---

## Issue 4: E2E Test — `cod-happy-path.spec.ts` Failing

### Bug A: Password Mismatch (BLOCKER)
`src/tests/e2e/cod-happy-path.spec.ts`:
- **Line 43:** `bcrypt.hash('testpass', 10)` — rider created with password `testpass`
- **Line 179:** `page.fill('...Password', 'test123')` — login tries `test123`

**Fix:** Change one to match the other. Easiest: line 179 → `'testpass'`.

### Bug B: Potential Broadcast Race Conditions
After the password fix, the test may encounter issues at Step 3 (lines 188-245):
1. **Reload after go-offline:** The test clicks "Go Online", then directly sets DB `is_online=true`, then reloads the page. After reload, it must re-mock geolocation and click Go Online again. This is fragile.
2. **WebSocket broadcast timing:** Setting order status to `preparing` relies on Supabase Realtime — the `waitForTimeout(2000)` + double-update pattern is a guess, not reliable.
3. **Accept button interaction:** Line 239 uses `force: true` click — may fail if modal hasn't fully rendered.

**Potential mitigation:** Instead of UI login + Go Online flow, inject the rider session + set online status directly via Supabase admin client to reduce race conditions.

---

## Priority Order for Fix Agent

1. **Fix password mismatch** in `cod-happy-path.spec.ts:179` — change `'test123'` → `'testpass'`
2. **Run E2E test** to verify login now works, identify remaining broadcast issues
3. **Fix broadcast race conditions** if E2E still fails after password fix
4. **Refactor Admin Bell** — consolidate into one place (recommend: move to `layout.tsx`, remove from `OwnerDashboardClient.tsx`)
5. **Full verification:** `npm run build && npm run test && npx playwright test && npm run lint`
