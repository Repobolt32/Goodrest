# Phase 2 Handoff: Rider Earning UI Update (Tasks 8-14)

> **Pick up from here in next chat.** Phase 1 (Tasks 1-7) is DONE — all code exists on disk but is **uncommitted** (bash was broken during Phase 1 session).

---

## Phase 1 Status: COMPLETE (uncommitted)

All Phase 1 code changes are on disk. Run `git add -A && git commit` first thing.

### Files modified/created in Phase 1:

| Task | File | Status |
|------|------|--------|
| 1 | `src/lib/pricing.ts` — added `calculateEarningBreakdown()` | Done |
| 2 | `src/lib/pricing.ts` — added `calculateBonusProgress()` | Done |
| 1-2 | `src/tests/unit/lib/pricing.test.ts` — tests for both | Done |
| 3 | `src/app/actions/riderActions.ts` — expanded `getRiderStats` (IST timezone, breakdown fields, bonus progress) | Done |
| 4 | `src/app/actions/riderActions.ts` — added `getRiderEarningHistory` server action | Done |
| 5 | `src/app/actions/ownerActions.ts` — added `getWeeklyRiderPayouts` server action | Done |
| 6 | `src/components/rider/BonusProgress.tsx` — new component | Done |
| 7 | `src/components/rider/WeeklyChart.tsx` — new SVG bar chart component | Done |

### Before starting Phase 2, commit Phase 1:

```bash
git add src/lib/pricing.ts src/tests/unit/lib/pricing.test.ts src/app/actions/riderActions.ts src/app/actions/ownerActions.ts src/components/rider/BonusProgress.tsx src/components/rider/WeeklyChart.tsx
git commit -m "feat(rider): Phase 1 — pricing breakdown, bonus progress, earning history, weekly chart"
```

---

## Phase 2: Tasks 8-14

### Task 8: Create `TerminalView.tsx`

**File:** `src/components/rider/TerminalView.tsx` (NEW)

Extract the terminal UI from `src/app/rider/dashboard/page.tsx` into a standalone component. Receives all state/handlers as props.

Key props interface:
```ts
interface TerminalViewProps {
  riderId: string;
  isOnline: boolean;
  geoError: string | null;
  stats: RiderStats | null;
  activeOrder: ActiveOrder | null;
  actionLoading: boolean;
  onToggleOnline: () => void;
  onStartRiding: () => void;
  onDelivered: () => void;
  onAcceptBroadcast: () => void;
}
```

Includes: online toggle, stats grid (4 cards), BonusProgress, active order card with earning breakdown, OrderBroadcast. Full spec in IMPL-PLAN.md Task 8.

### Task 9: Create `EarningsView.tsx`

**File:** `src/components/rider/EarningsView.tsx` (NEW)

Today summary card, WeeklyChart, daily breakdown accordion (Framer Motion AnimatePresence), week total footer. Calls `getRiderEarningHistory(riderId)` in useEffect. Full spec in IMPL-PLAN.md Task 9.

### Task 10: Refactor `page.tsx` to two-view tab layout

**File:** `src/app/rider/dashboard/page.tsx` (MODIFY)

- Add `activeTab` state: `'terminal' | 'earnings'`
- Update `RiderStats` interface to include new fields from Task 3
- Remove inline terminal UI, replace with `<TerminalView>` and `<EarningsView>`
- Replace fixed bottom button with two-tab bottom nav (Bike + BarChart3 icons)
- All hooks (Supabase realtime, geolocation, session) stay at page level

### Task 11: Add earning breakdown to `OrderBroadcast.tsx`

**File:** `src/components/rider/OrderBroadcast.tsx` (MODIFY)

Import `calculateEarningBreakdown`, replace flat earning line with itemized breakdown (Delivery ₹X + Pickup Pay ₹Y). Full spec in IMPL-PLAN.md Task 11.

### Task 12: Create `RiderPayoutsPanel.tsx` + integrate into OwnerDashboardClient

**Files:**
- NEW: `src/components/owner/RiderPayoutsPanel.tsx`
- MODIFY: `src/components/owner/OwnerDashboardClient.tsx`

Weekly rider payout table (rider name, orders, delivery fees, pickup pay, bonus, total due). Fetches via `getWeeklyRiderPayouts()`. Full spec in IMPL-PLAN.md Task 12.

### Task 13: Add rider payout columns to Reports

**Files:**
- MODIFY: `src/app/actions/reportActions.ts`
- MODIFY: `src/components/admin/ReportsClient.tsx`

Add `riderPayout` and `netMargin` columns to weekly report. Import `calculateNightlyBonus`. Full spec in IMPL-PLAN.md Task 13.

### Task 14: Final verification

- Run `npx vitest run` — all tests pass
- Run `npm run lint` — no new errors
- Final commit

---

## Key Context for Phase 2

### Architecture
- **Two-view bottom tab navigation**: Terminal (live jobs) + Earnings (history/charts)
- All hooks stay at page level (Supabase realtime, geolocation, session)
- Components receive data via props

### Pricing formulas (in `src/lib/pricing.ts`)
- Delivery fee slabs: ≤2km=₹30, ≤3km=₹35, ≤5km=₹45, >5km=15+7*ceil(km)
- Dead miles: ceil(distanceKm) * 2
- `calculateEarningBreakdown(distanceKm)` → {total, deliveryFee, pickupPay}
- Nightly bonus: 6 orders=₹100, 10 orders=₹200
- `calculateBonusProgress(todayDeliveries)` → {currentBonus, nextMilestone, deliveriesUntilNext, progress, milestoneLabel}

### Server actions available
- `getRiderStats(riderId)` → includes breakdown fields + bonus progress
- `getRiderEarningHistory(riderId)` → {weekly: DayEntry[], weekTotal}
- `getWeeklyRiderPayouts()` → rider payout array for owner

### Existing files to read before starting
- `src/app/rider/dashboard/page.tsx` — must read to extract terminal UI for Task 8
- `src/components/rider/OrderBroadcast.tsx` — must read to modify for Task 11
- `src/components/owner/OwnerDashboardClient.tsx` — must read to integrate Task 12
- `src/app/actions/reportActions.ts` — must read to modify for Task 13
- `src/components/admin/ReportsClient.tsx` — must read to modify for Task 13

### Tech stack
- Next.js 16.2 App Router, React 19.2, TypeScript, Tailwind CSS v4
- Framer Motion (AnimatePresence for accordions)
- Custom SVG bar chart (zero external chart deps)
- Supabase `supabaseAdmin` for server actions
- IST timezone (UTC+5:30) for all date boundaries

---

## Full plan reference
See `.planning/active/IMPL-PLAN.md` for complete specs of each task.