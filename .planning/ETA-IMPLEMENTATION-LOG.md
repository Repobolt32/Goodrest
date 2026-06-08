# ETA Buffer — Implementation Log

**Date:** 2026-06-08
**Commit:** `08-06-after-final` (pre-change baseline)
**Branch:** `geolocation-added-8/6`

## What Changed

Added a 5-minute buffer to ETA calculation so customers see a slightly longer countdown (Zomato-style cushion).

## Files Modified

### 1. `src/lib/distance.ts` (line 12)

```diff
- return Math.ceil(prepTimeMinutes + travelMinutes);
+ return Math.ceil(prepTimeMinutes + travelMinutes + 5); // 5min buffer
```

Single line change. The `+ 5` is hardcoded — not admin-configurable.

### 2. `src/tests/unit/lib/distance.test.ts`

Four expected values updated (each +5):

| Test | Line | Before | After |
|------|------|--------|-------|
| `calculateETA(600)` | 8 | `30` | `35` |
| `calculateETA(0)` | 13 | `20` | `25` |
| `calculateETA(90)` | 18 | `22` | `27` |
| `calculateETA(600, 15)` | 23 | `25` | `30` |

## Files NOT Modified (and why)

- **`OrderTracker.tsx:149`** — Calls `calculateETA(durationSeconds, 0)`. After the fix, the `0` prep time is still correct because prep is already done when rider starts. The buffer is baked into the function, so countdown naturally includes it.
- **`ownerActions.ts:103`** — Calls `calculateETA(durationSeconds, prepTimeMinutes)`. Buffer flows through automatically.
- **DB schema** — No new columns needed. `eta_minutes` and `duration_seconds` are sufficient.
- **Admin controls** — Prep time UI unchanged. Buffer is not admin-configurable.

## How It Works End-to-End

1. **Order created** → `duration_seconds` saved (Google Maps travel time)
2. **Owner accepts** → `eta_minutes = calculateETA(durationSeconds, prepTimeMinutes)` → now includes +5 buffer
3. **Customer views `/track/order/[id]`** → countdown = `eta_minutes - elapsed` → naturally shows buffer
4. **Rider starts delivery** → `OrderTracker` calls `calculateETA(durationSeconds, 0)` → returns `travelMinutes + 5` → countdown starts with buffer
5. **Countdown hits 0** → shows "Soon"

## Verification

- `npm run build` — ✅ passed
- `npm run test` — ✅ 426/426 passed (including 4 updated distance tests)
