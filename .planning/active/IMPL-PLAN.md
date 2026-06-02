# Rider Earning UI Update — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give riders full earning transparency (itemized breakdown, dynamic bonus milestones, weekly earning history with charts) and give owners weekly rider payout visibility — all without database migrations.

**Architecture:** Two-view bottom tab navigation on the rider dashboard (`Terminal` for live jobs, `Earnings` for history/charts). All hooks (Supabase realtime, geolocation, session) stay at page level so the connection never drops between tabs. Owner gets a new `RiderPayoutsPanel` and enhanced reports with rider payout columns.

**Tech Stack:** Next.js 16.2 (App Router) · React 19.2 · TypeScript · Tailwind CSS v4 · Supabase (supabaseAdmin for server actions) · Framer Motion (AnimatePresence for accordions) · Custom SVG bar chart (zero external chart deps)

**Spec:** [rider-earning-ui-update.md](file:///e:/desktop/goodrest-claude/.agent/plans/rider-earning-ui-update.md)

---

## Task 1: Add `calculateEarningBreakdown` to pricing.ts

**Files:**
- Modify: `src/lib/pricing.ts`
- Test: `src/tests/unit/lib/pricing.test.ts`

- [ ] **Step 1: Write failing tests for `calculateEarningBreakdown`**

Add to `src/tests/unit/lib/pricing.test.ts`:

```ts
import {
  // ...existing imports...
  calculateEarningBreakdown,
} from '@/lib/pricing';

describe('calculateEarningBreakdown', () => {
  it('should return total, deliveryFee, and pickupPay for 2.5km', () => {
    const result = calculateEarningBreakdown(2.5);
    expect(result.deliveryFee).toBe(35);       // UPTO_3KM slab
    expect(result.pickupPay).toBe(6);           // ceil(2.5)=3, 3*2=6
    expect(result.total).toBe(41);              // 35+6
  });

  it('should return total, deliveryFee, and pickupPay for 7km', () => {
    const result = calculateEarningBreakdown(7);
    expect(result.deliveryFee).toBe(64);       // 15 + 7*7
    expect(result.pickupPay).toBe(14);          // 7*2
    expect(result.total).toBe(78);
  });

  it('should handle 0km edge case', () => {
    const result = calculateEarningBreakdown(0);
    expect(result.deliveryFee).toBe(30);
    expect(result.pickupPay).toBe(0);
    expect(result.total).toBe(30);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/unit/lib/pricing.test.ts`
Expected: FAIL with "calculateEarningBreakdown is not exported"

- [ ] **Step 3: Implement `calculateEarningBreakdown`**

Add to `src/lib/pricing.ts` after existing `calculateRiderEarning`:

```ts
export function calculateEarningBreakdown(distanceKm: number): {
  total: number;
  deliveryFee: number;
  pickupPay: number;
} {
  const deliveryFee = calculateDeliveryFee(distanceKm);
  const pickupPay = Math.ceil(distanceKm) * DEAD_MILES_PER_KM;
  return { total: deliveryFee + pickupPay, deliveryFee, pickupPay };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/unit/lib/pricing.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/pricing.ts src/tests/unit/lib/pricing.test.ts
git commit -m "feat(pricing): add calculateEarningBreakdown for itemized rider payout"
```

---

## Task 2: Add `calculateBonusProgress` to pricing.ts

**Files:**
- Modify: `src/lib/pricing.ts`
- Test: `src/tests/unit/lib/pricing.test.ts`

- [ ] **Step 1: Write failing tests for `calculateBonusProgress`**

Add to `src/tests/unit/lib/pricing.test.ts`:

```ts
import {
  // ...existing imports...
  calculateBonusProgress,
} from '@/lib/pricing';

describe('calculateBonusProgress', () => {
  it('should target ₹100 milestone when under 6 deliveries', () => {
    const result = calculateBonusProgress(3);
    expect(result.currentBonus).toBe(0);
    expect(result.nextMilestone).toBe(6);
    expect(result.deliveriesUntilNext).toBe(3);
    expect(result.progress).toBeCloseTo(0.5);
    expect(result.milestoneLabel).toContain('3 more');
  });

  it('should show ₹100 earned and target ₹200 at 6 deliveries', () => {
    const result = calculateBonusProgress(6);
    expect(result.currentBonus).toBe(100);
    expect(result.nextMilestone).toBe(10);
    expect(result.deliveriesUntilNext).toBe(4);
    expect(result.progress).toBeCloseTo(0);
  });

  it('should show partial progress toward ₹200 at 8 deliveries', () => {
    const result = calculateBonusProgress(8);
    expect(result.currentBonus).toBe(100);
    expect(result.nextMilestone).toBe(10);
    expect(result.deliveriesUntilNext).toBe(2);
    expect(result.progress).toBeCloseTo(0.5);
  });

  it('should show max achieved at 10+ deliveries', () => {
    const result = calculateBonusProgress(12);
    expect(result.currentBonus).toBe(200);
    expect(result.nextMilestone).toBeNull();
    expect(result.deliveriesUntilNext).toBe(0);
    expect(result.progress).toBe(1);
    expect(result.milestoneLabel).toContain('achieved');
  });

  it('should handle 0 deliveries', () => {
    const result = calculateBonusProgress(0);
    expect(result.currentBonus).toBe(0);
    expect(result.nextMilestone).toBe(6);
    expect(result.deliveriesUntilNext).toBe(6);
    expect(result.progress).toBeCloseTo(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/unit/lib/pricing.test.ts`
Expected: FAIL with "calculateBonusProgress is not exported"

- [ ] **Step 3: Implement `calculateBonusProgress`**

Add to `src/lib/pricing.ts` after `calculateEarningBreakdown`:

```ts
export function calculateBonusProgress(todayDeliveries: number): {
  currentBonus: number;
  nextMilestone: 6 | 10 | null;
  deliveriesUntilNext: number;
  progress: number;
  milestoneLabel: string;
} {
  if (todayDeliveries >= 10) {
    return {
      currentBonus: BONUS_10_ORDERS,
      nextMilestone: null,
      deliveriesUntilNext: 0,
      progress: 1,
      milestoneLabel: `₹${BONUS_10_ORDERS} bonus achieved! 🏆`,
    };
  }
  if (todayDeliveries >= 6) {
    const remaining = 10 - todayDeliveries;
    return {
      currentBonus: BONUS_6_ORDERS,
      nextMilestone: 10,
      deliveriesUntilNext: remaining,
      progress: (todayDeliveries - 6) / 4,
      milestoneLabel: `₹${BONUS_6_ORDERS} earned! ₹${BONUS_10_ORDERS} in ${remaining} more`,
    };
  }
  const remaining = 6 - todayDeliveries;
  return {
    currentBonus: 0,
    nextMilestone: 6,
    deliveriesUntilNext: remaining,
    progress: todayDeliveries / 6,
    milestoneLabel: `₹${BONUS_6_ORDERS} bonus in ${remaining} more deliveries`,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/unit/lib/pricing.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/pricing.ts src/tests/unit/lib/pricing.test.ts
git commit -m "feat(pricing): add calculateBonusProgress with dynamic milestone shifting"
```

---

## Task 3: Expand `getRiderStats` return shape

**Files:**
- Modify: `src/app/actions/riderActions.ts`

- [ ] **Step 1: Update the `getRiderStats` function**

In `src/app/actions/riderActions.ts`, add import at the top:

```ts
import { calculateRiderEarning, calculateNightlyBonus, calculateEarningBreakdown, calculateBonusProgress } from '@/lib/pricing';
```

Then replace the `getRiderStats` function body (starting at the `todayAgg` processing section) to compute breakdown fields:

```ts
export async function getRiderStats(riderId: string) {
  if (!isValidUUID(riderId)) {
    return {
      totalDeliveries: 0, totalEarnings: 0, todayDeliveries: 0, todayEarnings: 0,
      todayDistanceKm: 0, todayNightlyBonus: 0,
      todayDeliveryFees: 0, todayPickupPay: 0,
      nextBonusMilestone: 6 as number | null, deliveriesUntilBonus: 6, bonusProgress: 0, bonusLabel: '₹100 bonus in 6 more deliveries',
    };
  }

  const { data: rider } = await supabaseAdmin
    .from('riders')
    .select('total_deliveries, total_earnings')
    .eq('id', riderId)
    .single();

  // IST midnight boundary
  const now = new Date();
  const indiaTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const yyyy = indiaTime.getUTCFullYear();
  const mm = String(indiaTime.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(indiaTime.getUTCDate()).padStart(2, '0');
  const todayIso = new Date(`${yyyy}-${mm}-${dd}T00:00:00+05:30`).toISOString();

  const { count: todayDeliveries } = await supabaseAdmin
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('rider_id', riderId)
    .eq('order_status', 'delivered')
    .gte('delivered_at', todayIso);

  const { data: todayAgg } = await supabaseAdmin
    .from('orders')
    .select('rider_earning, distance_km')
    .eq('rider_id', riderId)
    .eq('order_status', 'delivered')
    .gte('delivered_at', todayIso);

  let todayEarnings = 0;
  let todayDistance = 0;
  let todayDeliveryFees = 0;
  let todayPickupPay = 0;

  for (const o of todayAgg || []) {
    todayEarnings += o.rider_earning || 0;
    todayDistance += o.distance_km || 0;
    if (o.distance_km != null) {
      const breakdown = calculateEarningBreakdown(o.distance_km);
      todayDeliveryFees += breakdown.deliveryFee;
      todayPickupPay += breakdown.pickupPay;
    } else {
      todayDeliveryFees += o.rider_earning || 0;
    }
  }

  const deliveryCount = todayDeliveries || 0;
  const todayNightlyBonus = calculateNightlyBonus(deliveryCount);
  const bonusInfo = calculateBonusProgress(deliveryCount);

  return {
    totalDeliveries: rider?.total_deliveries || 0,
    totalEarnings: (rider?.total_earnings || 0) + todayNightlyBonus,
    todayDeliveries: deliveryCount,
    todayEarnings: todayEarnings + todayNightlyBonus,
    todayDistanceKm: Math.round(todayDistance * 10) / 10,
    todayNightlyBonus,
    todayDeliveryFees,
    todayPickupPay,
    nextBonusMilestone: bonusInfo.nextMilestone,
    deliveriesUntilBonus: bonusInfo.deliveriesUntilNext,
    bonusProgress: bonusInfo.progress,
    bonusLabel: bonusInfo.milestoneLabel,
  };
}
```

- [ ] **Step 2: Verify existing tests still pass**

Run: `npx vitest run`
Expected: ALL PASS (return shape is additive — no breaking changes)

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/riderActions.ts
git commit -m "feat(rider): expand getRiderStats with earning breakdown and bonus progress"
```

---

## Task 4: Add `getRiderEarningHistory` server action

**Files:**
- Modify: `src/app/actions/riderActions.ts`

- [ ] **Step 1: Implement `getRiderEarningHistory`**

Add to the bottom of `src/app/actions/riderActions.ts`:

```ts
export async function getRiderEarningHistory(riderId: string) {
  if (!isValidUUID(riderId)) {
    return { weekly: [], weekTotal: { deliveries: 0, earnings: 0, bonus: 0, total: 0 } };
  }

  // Calculate Monday 00:00 IST of current calendar week
  const now = new Date();
  const indiaTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const dayOfWeek = indiaTime.getUTCDay(); // 0=Sun, 1=Mon, ...
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const mondayIndia = new Date(indiaTime);
  mondayIndia.setUTCDate(mondayIndia.getUTCDate() - daysSinceMonday);
  const mondayYyyy = mondayIndia.getUTCFullYear();
  const mondayMm = String(mondayIndia.getUTCMonth() + 1).padStart(2, '0');
  const mondayDd = String(mondayIndia.getUTCDate()).padStart(2, '0');
  const mondayIso = new Date(`${mondayYyyy}-${mondayMm}-${mondayDd}T00:00:00+05:30`).toISOString();

  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('rider_earning, distance_km, delivered_at')
    .eq('rider_id', riderId)
    .eq('order_status', 'delivered')
    .gte('delivered_at', mondayIso)
    .order('delivered_at', { ascending: true });

  // Group by IST date
  const dayMap = new Map<string, { deliveries: number; earnings: number; deliveryFees: number; pickupPay: number }>();

  // Initialize Mon–Sun
  for (let i = 0; i < 7; i++) {
    const d = new Date(new Date(mondayIso).getTime() + i * 24 * 60 * 60 * 1000);
    const dIndia = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
    const dateKey = dIndia.toISOString().split('T')[0];
    dayMap.set(dateKey, { deliveries: 0, earnings: 0, deliveryFees: 0, pickupPay: 0 });
  }

  for (const order of orders || []) {
    const orderIndia = new Date(new Date(order.delivered_at).getTime() + 5.5 * 60 * 60 * 1000);
    const dateKey = orderIndia.toISOString().split('T')[0];
    const day = dayMap.get(dateKey);
    if (!day) continue;

    day.deliveries += 1;
    day.earnings += order.rider_earning || 0;

    if (order.distance_km != null) {
      const bd = calculateEarningBreakdown(order.distance_km);
      day.deliveryFees += bd.deliveryFee;
      day.pickupPay += bd.pickupPay;
    } else {
      day.deliveryFees += order.rider_earning || 0;
    }
  }

  let totalDeliveries = 0;
  let totalEarnings = 0;
  let totalBonus = 0;

  const weekly = Array.from(dayMap.entries()).map(([date, stats]) => {
    const bonus = calculateNightlyBonus(stats.deliveries);
    totalDeliveries += stats.deliveries;
    totalEarnings += stats.earnings;
    totalBonus += bonus;
    return {
      date,
      deliveries: stats.deliveries,
      deliveryFees: stats.deliveryFees,
      pickupPay: stats.pickupPay,
      bonus,
      total: stats.earnings + bonus,
    };
  });

  return {
    weekly,
    weekTotal: {
      deliveries: totalDeliveries,
      earnings: totalEarnings,
      bonus: totalBonus,
      total: totalEarnings + totalBonus,
    },
  };
}
```

- [ ] **Step 2: Verify all tests pass**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/riderActions.ts
git commit -m "feat(rider): add getRiderEarningHistory for weekly earning dashboard"
```

---

## Task 5: Add `getWeeklyRiderPayouts` owner action

**Files:**
- Modify: `src/app/actions/ownerActions.ts`

- [ ] **Step 1: Implement `getWeeklyRiderPayouts`**

Add import at top of `src/app/actions/ownerActions.ts`:

```ts
import { calculateEarningBreakdown, calculateNightlyBonus } from '@/lib/pricing';
```

Add new function at the bottom:

```ts
export async function getWeeklyRiderPayouts() {
  // Calculate Monday 00:00 IST of current calendar week
  const now = new Date();
  const indiaTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const dayOfWeek = indiaTime.getUTCDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const mondayIndia = new Date(indiaTime);
  mondayIndia.setUTCDate(mondayIndia.getUTCDate() - daysSinceMonday);
  const mondayYyyy = mondayIndia.getUTCFullYear();
  const mondayMm = String(mondayIndia.getUTCMonth() + 1).padStart(2, '0');
  const mondayDd = String(mondayIndia.getUTCDate()).padStart(2, '0');
  const mondayIso = new Date(`${mondayYyyy}-${mondayMm}-${mondayDd}T00:00:00+05:30`).toISOString();

  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('rider_id, rider_earning, distance_km, delivered_at')
    .eq('order_status', 'delivered')
    .not('rider_id', 'is', null)
    .gte('delivered_at', mondayIso)
    .order('delivered_at', { ascending: true });

  if (!orders || orders.length === 0) return [];

  // Group by rider, then by IST day (for bonus calculation)
  const riderMap = new Map<string, {
    deliveries: number;
    deliveryFees: number;
    pickupPay: number;
    earnings: number;
    dailyCounts: Map<string, number>;
  }>();

  for (const order of orders) {
    if (!order.rider_id) continue;
    let rider = riderMap.get(order.rider_id);
    if (!rider) {
      rider = { deliveries: 0, deliveryFees: 0, pickupPay: 0, earnings: 0, dailyCounts: new Map() };
      riderMap.set(order.rider_id, rider);
    }

    rider.deliveries += 1;
    rider.earnings += order.rider_earning || 0;

    if (order.distance_km != null) {
      const bd = calculateEarningBreakdown(order.distance_km);
      rider.deliveryFees += bd.deliveryFee;
      rider.pickupPay += bd.pickupPay;
    } else {
      rider.deliveryFees += order.rider_earning || 0;
    }

    // Track daily counts for bonus calculation
    const orderIndia = new Date(new Date(order.delivered_at).getTime() + 5.5 * 60 * 60 * 1000);
    const dateKey = orderIndia.toISOString().split('T')[0];
    rider.dailyCounts.set(dateKey, (rider.dailyCounts.get(dateKey) || 0) + 1);
  }

  // Fetch rider names
  const riderIds = Array.from(riderMap.keys());
  const { data: riders } = await supabaseAdmin
    .from('riders')
    .select('id, name, phone')
    .in('id', riderIds);

  const riderLookup = new Map((riders || []).map(r => [r.id, r]));

  return Array.from(riderMap.entries()).map(([riderId, stats]) => {
    // Sum nightly bonuses across all days
    let weekBonus = 0;
    for (const count of stats.dailyCounts.values()) {
      weekBonus += calculateNightlyBonus(count);
    }

    const riderInfo = riderLookup.get(riderId);
    return {
      riderId,
      riderName: riderInfo?.name || 'Unknown',
      riderPhone: riderInfo?.phone || '',
      weekDeliveries: stats.deliveries,
      weekDeliveryFees: stats.deliveryFees,
      weekPickupPay: stats.pickupPay,
      weekBonus,
      weekTotalDue: stats.earnings + weekBonus,
    };
  }).sort((a, b) => b.weekTotalDue - a.weekTotalDue);
}
```

- [ ] **Step 2: Verify all tests pass**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/ownerActions.ts
git commit -m "feat(owner): add getWeeklyRiderPayouts for settlement tracking"
```

---

## Task 6: Create `BonusProgress.tsx` component

**Files:**
- Create: `src/components/rider/BonusProgress.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/rider/BonusProgress.tsx`:

```tsx
'use client';

interface BonusProgressProps {
  todayDeliveries: number;
  currentBonus: number;
  nextMilestone: number | null;
  deliveriesUntilNext: number;
  progress: number;
  label: string;
}

export default function BonusProgress({
  todayDeliveries,
  currentBonus,
  nextMilestone,
  deliveriesUntilNext,
  progress,
  label,
}: BonusProgressProps) {
  const maxed = nextMilestone === null;
  const tier2 = currentBonus >= 100 && !maxed;

  // Bar color states: amber (tier1) → gold (tier2) → emerald (maxed)
  const barColor = maxed
    ? 'bg-emerald-500 shadow-emerald-500/40'
    : tier2
      ? 'bg-amber-400 shadow-amber-400/40'
      : 'bg-amber-500/80 shadow-amber-500/20';

  const trackColor = 'bg-slate-800';
  const target = maxed ? 10 : nextMilestone!;
  const filled = maxed
    ? 10
    : nextMilestone === 10
      ? 6 + (todayDeliveries - 6)
      : todayDeliveries;
  const displayProgress = Math.min(progress, 1);

  return (
    <div className="glass-card p-4 border-slate-800/50 mb-8">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
          🏆 Nightly Bonus
        </span>
        <span className="text-[10px] font-black text-slate-400">
          {filled}/{target} deliveries
        </span>
      </div>

      {/* Progress Bar */}
      <div className={`w-full h-3 rounded-full ${trackColor} overflow-hidden`}>
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColor} ${maxed ? 'shadow-lg animate-pulse' : 'shadow-md'}`}
          style={{ width: `${displayProgress * 100}%` }}
        />
      </div>

      {/* Label */}
      <p className={`text-xs font-bold mt-2 ${maxed ? 'text-emerald-400' : 'text-slate-400'}`}>
        {label}
      </p>

      {/* Show earned badge if tier 2+ */}
      {currentBonus > 0 && (
        <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
            ₹{currentBonus} earned
          </span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/rider/BonusProgress.tsx
git commit -m "feat(rider): add BonusProgress milestone component"
```

---

## Task 7: Create `WeeklyChart.tsx` SVG bar chart

**Files:**
- Create: `src/components/rider/WeeklyChart.tsx`

- [ ] **Step 1: Create the SVG chart component**

Create `src/components/rider/WeeklyChart.tsx`:

```tsx
'use client';

import { useState } from 'react';

interface DayData {
  date: string;
  deliveries: number;
  total: number;
  bonus: number;
}

interface WeeklyChartProps {
  data: DayData[];
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function WeeklyChart({ data }: WeeklyChartProps) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const maxVal = Math.max(...data.map(d => d.total), 1);
  const chartHeight = 160;
  const barWidth = 28;
  const gap = 12;
  const totalWidth = data.length * (barWidth + gap) - gap;
  const paddingTop = 30;
  const paddingBottom = 24;
  const svgHeight = chartHeight + paddingTop + paddingBottom;

  return (
    <div className="glass-card p-5 border-slate-800/50 mb-6">
      <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4">
        📊 This Week
      </h3>

      <div className="flex justify-center overflow-x-auto">
        <svg
          width={totalWidth + 20}
          height={svgHeight}
          viewBox={`0 0 ${totalWidth + 20} ${svgHeight}`}
          className="mx-auto"
        >
          {data.map((day, i) => {
            const barHeight = maxVal > 0 ? (day.total / maxVal) * chartHeight : 0;
            const x = 10 + i * (barWidth + gap);
            const y = paddingTop + chartHeight - barHeight;
            const isActive = activeIdx === i;
            const isToday = i === data.length - 1 || (new Date().getDay() === 0 ? i === 6 : i === new Date().getDay() - 1);

            return (
              <g key={day.date} onPointerEnter={() => setActiveIdx(i)} onPointerLeave={() => setActiveIdx(null)}>
                {/* Bar */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(barHeight, 2)}
                  rx={6}
                  fill={day.total > 0 ? (isToday ? 'url(#barGradientToday)' : 'url(#barGradient)') : '#1e293b'}
                  className="transition-all duration-300"
                  opacity={isActive ? 1 : 0.85}
                />

                {/* Day label */}
                <text
                  x={x + barWidth / 2}
                  y={svgHeight - 4}
                  textAnchor="middle"
                  className="fill-slate-500 text-[10px] font-bold"
                >
                  {DAY_LABELS[i]}
                </text>

                {/* Amount on top */}
                {day.total > 0 && (
                  <text
                    x={x + barWidth / 2}
                    y={y - 6}
                    textAnchor="middle"
                    className={`text-[9px] font-black ${isActive ? 'fill-white' : 'fill-slate-500'}`}
                  >
                    ₹{day.total}
                  </text>
                )}

                {/* Tooltip on hover */}
                {isActive && day.total > 0 && (
                  <foreignObject x={x - 40} y={y - 52} width={110} height={40}>
                    <div className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-center shadow-xl">
                      <p className="text-[9px] text-white font-bold">{formatCurrency(day.total)} · {day.deliveries} orders</p>
                      {day.bonus > 0 && (
                        <p className="text-[8px] text-emerald-400 font-bold">+₹{day.bonus} bonus</p>
                      )}
                    </div>
                  </foreignObject>
                )}
              </g>
            );
          })}

          {/* Gradients */}
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#059669" stopOpacity={0.7} />
            </linearGradient>
            <linearGradient id="barGradientToday" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6ee7b7" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/rider/WeeklyChart.tsx
git commit -m "feat(rider): add WeeklyChart custom SVG bar chart component"
```

---

## Task 8: Create `TerminalView.tsx`

**Files:**
- Create: `src/components/rider/TerminalView.tsx`

- [ ] **Step 1: Create the TerminalView component**

Extract the existing terminal UI from `page.tsx` into `src/components/rider/TerminalView.tsx`. This component receives all state/handlers as props from the page:

```tsx
'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  Power, TrendingUp, ShoppingBag, Route, Navigation, CheckCircle, AlertCircle, Sparkles,
} from 'lucide-react';
import OrderBroadcast from './OrderBroadcast';
import BonusProgress from './BonusProgress';
import { calculateEarningBreakdown } from '@/lib/pricing';

interface RiderStats {
  todayEarnings: number;
  todayDeliveries: number;
  todayDistanceKm: number;
  todayNightlyBonus: number;
  todayDeliveryFees: number;
  todayPickupPay: number;
  nextBonusMilestone: number | null;
  deliveriesUntilBonus: number;
  bonusProgress: number;
  bonusLabel: string;
}

interface ActiveOrder {
  id: string;
  friendly_id: string | null;
  order_status: string | null;
  customer_name: string;
  delivery_address: string;
  distance_km: number | null;
  rider_earning: number | null;
  lat: number | null;
  lng: number | null;
}

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

export default function TerminalView({
  riderId, isOnline, geoError, stats, activeOrder, actionLoading,
  onToggleOnline, onStartRiding, onDelivered, onAcceptBroadcast,
}: TerminalViewProps) {
  const todayEarnings = stats?.todayEarnings ?? 0;
  const todayOrders = stats?.todayDeliveries ?? 0;
  const todayDistance = stats?.todayDistanceKm ?? 0;
  const todayBonus = stats?.todayNightlyBonus ?? 0;

  // Earning breakdown for active order
  const orderBreakdown = activeOrder?.distance_km != null
    ? calculateEarningBreakdown(activeOrder.distance_km)
    : null;

  return (
    <>
      {/* Geolocation Error */}
      {geoError && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3">
          <AlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-400">{geoError}</p>
            <p className="text-xs text-red-400/60 mt-1">Enable GPS/location permissions to go online.</p>
          </div>
        </div>
      )}

      {/* Online Toggle */}
      <button
        onClick={onToggleOnline}
        className={`w-full py-4 rounded-2xl flex items-center justify-center gap-4 transition-all active:scale-95 shadow-xl mb-8 ${
          isOnline
            ? 'bg-red-500 text-white shadow-red-500/20'
            : 'bg-white text-slate-950 shadow-white/10'
        }`}
      >
        <Power size={22} className={isOnline ? 'animate-pulse' : ''} />
        <span className="text-sm font-black uppercase tracking-[0.2em]">
          {isOnline ? 'Go Offline' : 'Go Online'}
        </span>
      </button>

      {/* Stats Grid — 4 cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="glass-card p-4 border-slate-800/50">
          <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center mb-3">
            <TrendingUp size={16} className="text-emerald-500" />
          </div>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Earnings</p>
          <p className="text-xl font-black mt-0.5">₹{todayEarnings}</p>
        </div>
        <div className="glass-card p-4 border-slate-800/50">
          <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center mb-3">
            <ShoppingBag size={16} className="text-blue-500" />
          </div>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Orders</p>
          <p className="text-xl font-black mt-0.5">{todayOrders}</p>
        </div>
        <div className="glass-card p-4 border-slate-800/50">
          <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center mb-3">
            <Route size={16} className="text-amber-500" />
          </div>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Distance</p>
          <p className="text-xl font-black mt-0.5">{todayDistance} km</p>
        </div>
        <div className="glass-card p-4 border-slate-800/50">
          <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center mb-3">
            <Sparkles size={16} className="text-purple-400" />
          </div>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Bonus</p>
          <p className="text-xl font-black mt-0.5">₹{todayBonus}</p>
        </div>
      </div>

      {/* Bonus Progress */}
      <BonusProgress
        todayDeliveries={todayOrders}
        currentBonus={stats?.todayNightlyBonus ?? 0}
        nextMilestone={stats?.nextBonusMilestone ?? 6}
        deliveriesUntilNext={stats?.deliveriesUntilBonus ?? 6}
        progress={stats?.bonusProgress ?? 0}
        label={stats?.bonusLabel ?? '₹100 bonus in 6 more deliveries'}
      />

      {/* Active Order Card */}
      <AnimatePresence>
        {activeOrder && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="glass-card p-6 mb-8 border-emerald-500/20 bg-emerald-500/5"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                <ShoppingBag size={24} />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase tracking-widest text-white">Active Delivery</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                  Order #{activeOrder.friendly_id || activeOrder.id?.slice(0, 8)}
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-500 uppercase tracking-widest">Customer</span>
                <span className="text-white">{activeOrder.customer_name || 'Premium Guest'}</span>
              </div>
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-500 uppercase tracking-widest">Address</span>
                <span className="text-white text-right max-w-[200px]">{activeOrder.delivery_address || 'Loading...'}</span>
              </div>
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-500 uppercase tracking-widest">Distance</span>
                <span className="text-white">{activeOrder.distance_km ?? '?'} km</span>
              </div>
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-500 uppercase tracking-widest">You earn</span>
                <span className="text-emerald-400 font-black">₹{activeOrder.rider_earning ?? 0}</span>
              </div>
              {/* Earning breakdown */}
              {orderBreakdown && (
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-slate-600 uppercase tracking-widest">Breakdown</span>
                  <span className="text-slate-400">
                    Delivery ₹{orderBreakdown.deliveryFee} + Pickup ₹{orderBreakdown.pickupPay}
                  </span>
                </div>
              )}
            </div>

            {/* Status-based actions */}
            {(activeOrder.order_status === 'preparing' || activeOrder.order_status === 'ready') && (
              <button
                onClick={onStartRiding}
                disabled={actionLoading}
                className="w-full py-4 bg-emerald-500 text-white rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all disabled:opacity-50"
              >
                {actionLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <><Navigation size={16} /> Start Riding</>
                )}
              </button>
            )}

            {activeOrder.order_status === 'out_for_delivery' && (
              <div className="flex gap-3">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${activeOrder.lat},${activeOrder.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-4 bg-slate-900 text-white border border-slate-800 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
                >
                  <Navigation size={16} /> Navigate
                </a>
                <button
                  onClick={onDelivered}
                  disabled={actionLoading}
                  className="flex-1 py-4 bg-emerald-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all disabled:opacity-50"
                >
                  {actionLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <><CheckCircle size={16} /> Delivered</>
                  )}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Order Broadcast */}
      <OrderBroadcast
        riderId={riderId}
        hasActiveOrder={!!activeOrder}
        onAccept={onAcceptBroadcast}
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/rider/TerminalView.tsx
git commit -m "feat(rider): create TerminalView component with earning breakdown and bonus progress"
```

---

## Task 9: Create `EarningsView.tsx`

**Files:**
- Create: `src/components/rider/EarningsView.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/rider/EarningsView.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, TrendingUp } from 'lucide-react';
import { getRiderEarningHistory } from '@/app/actions/riderActions';
import WeeklyChart from './WeeklyChart';

interface DayEntry {
  date: string;
  deliveries: number;
  deliveryFees: number;
  pickupPay: number;
  bonus: number;
  total: number;
}

interface WeekTotal {
  deliveries: number;
  earnings: number;
  bonus: number;
  total: number;
}

interface EarningsViewProps {
  riderId: string;
  todayEarnings: number;
  todayDeliveries: number;
  todayDistanceKm: number;
  todayBonus: number;
  todayDeliveryFees: number;
  todayPickupPay: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function EarningsView({
  riderId, todayEarnings, todayDeliveries, todayDistanceKm, todayBonus, todayDeliveryFees, todayPickupPay,
}: EarningsViewProps) {
  const [weekly, setWeekly] = useState<DayEntry[]>([]);
  const [weekTotal, setWeekTotal] = useState<WeekTotal>({ deliveries: 0, earnings: 0, bonus: 0, total: 0 });
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRiderEarningHistory(riderId).then((result) => {
      setWeekly(result.weekly);
      setWeekTotal(result.weekTotal);
      setLoading(false);
    });
  }, [riderId]);

  return (
    <div className="space-y-6">
      {/* Today Summary Card */}
      <div className="glass-card p-5 border-slate-800/50 border-l-4 border-l-emerald-500">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
            <TrendingUp size={20} className="text-emerald-500" />
          </div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Today&apos;s Earnings</span>
        </div>
        <p className="text-3xl font-black text-white">{formatCurrency(todayEarnings)}</p>
        <p className="text-xs text-slate-400 font-bold mt-1">
          {todayDeliveries} deliveries · {todayDistanceKm} km · Bonus: {formatCurrency(todayBonus)}
        </p>
        <p className="text-[10px] text-slate-500 font-bold mt-1">
          Delivery: {formatCurrency(todayDeliveryFees)} + Pickup Pay: {formatCurrency(todayPickupPay)}
        </p>
      </div>

      {/* Weekly Chart */}
      {loading ? (
        <div className="glass-card p-5 border-slate-800/50 animate-pulse">
          <div className="h-4 w-24 bg-slate-800 rounded mb-4" />
          <div className="h-40 bg-slate-800/50 rounded-xl" />
        </div>
      ) : (
        <WeeklyChart data={weekly.map(d => ({ date: d.date, deliveries: d.deliveries, total: d.total, bonus: d.bonus }))} />
      )}

      {/* Daily Breakdown Accordion */}
      {!loading && (
        <div className="glass-card border-slate-800/50 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800/50">
            <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
              Daily Breakdown
            </h3>
          </div>

          {weekly.filter(d => d.deliveries > 0).reverse().map((day) => (
            <div key={day.date} className="border-b border-slate-800/30 last:border-0">
              <button
                onClick={() => setExpandedDay(expandedDay === day.date ? null : day.date)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-800/30 transition-colors"
              >
                <span className="text-xs font-bold text-slate-300">📅 {formatDate(day.date)}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-slate-500">{day.deliveries} orders</span>
                  <span className="text-xs font-black text-white">{formatCurrency(day.total)}</span>
                  <ChevronDown
                    size={14}
                    className={`text-slate-500 transition-transform duration-200 ${expandedDay === day.date ? 'rotate-180' : ''}`}
                  />
                </div>
              </button>

              <AnimatePresence>
                {expandedDay === day.date && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-4 space-y-1.5 bg-slate-800/10">
                      <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-slate-500">Delivery Pay</span>
                        <span className="text-slate-300">{formatCurrency(day.deliveryFees)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-slate-500">Pickup Pay</span>
                        <span className="text-slate-300">{formatCurrency(day.pickupPay)}</span>
                      </div>
                      {day.bonus > 0 && (
                        <div className="flex justify-between text-[10px] font-bold">
                          <span className="text-emerald-500">Nightly Bonus</span>
                          <span className="text-emerald-400">{formatCurrency(day.bonus)}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}

          {weekly.every(d => d.deliveries === 0) && (
            <div className="px-5 py-8 text-center">
              <p className="text-xs text-slate-500 font-bold">No deliveries this week yet</p>
            </div>
          )}
        </div>
      )}

      {/* Week Total Footer */}
      {!loading && weekTotal.total > 0 && (
        <div className="glass-card p-4 border-slate-800/50 bg-emerald-500/5 border-emerald-500/20">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">This Week</span>
            <span className="text-lg font-black text-emerald-400">{formatCurrency(weekTotal.total)}</span>
          </div>
          <p className="text-[10px] text-slate-400 font-bold mt-1">
            {weekTotal.deliveries} deliveries · Bonus: {formatCurrency(weekTotal.bonus)}
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/rider/EarningsView.tsx
git commit -m "feat(rider): create EarningsView with today summary, weekly chart, and daily breakdown"
```

---

## Task 10: Refactor `page.tsx` to two-view tab layout

**Files:**
- Modify: `src/app/rider/dashboard/page.tsx`

- [ ] **Step 1: Refactor page.tsx**

Replace the entire content of `src/app/rider/dashboard/page.tsx` with a tab-based layout that imports `TerminalView` and `EarningsView`. All hooks stay at page level. The fixed bottom button is replaced with a bottom tab bar.

Key changes:
- Add `activeTab` state: `'terminal' | 'earnings'`
- Update `RiderStats` interface to include the new fields from Task 3
- Remove the inline terminal UI (replaced by `<TerminalView>`)
- Add `<EarningsView>` for the earnings tab
- Replace the fixed bottom "Go Online/Offline" button with a two-tab bottom nav bar
- Bottom nav bar uses `Bike` and `BarChart3` icons from lucide-react

The bottom nav JSX:
```tsx
<div className="fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-md border-t border-slate-800/50 z-40">
  <div className="flex max-w-lg mx-auto">
    <button
      onClick={() => setActiveTab('terminal')}
      className={`flex-1 py-4 flex flex-col items-center gap-1 transition-colors ${
        activeTab === 'terminal' ? 'text-emerald-400' : 'text-slate-500'
      }`}
    >
      <Bike size={20} />
      <span className="text-[9px] font-black uppercase tracking-widest">Terminal</span>
    </button>
    <button
      onClick={() => setActiveTab('earnings')}
      className={`flex-1 py-4 flex flex-col items-center gap-1 transition-colors ${
        activeTab === 'earnings' ? 'text-emerald-400' : 'text-slate-500'
      }`}
    >
      <BarChart3 size={20} />
      <span className="text-[9px] font-black uppercase tracking-widest">Earnings</span>
    </button>
  </div>
</div>
```

- [ ] **Step 2: Verify the app compiles**

Run: `npx next build` or check with `npm run dev` that the rider dashboard loads without errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/rider/dashboard/page.tsx
git commit -m "feat(rider): refactor dashboard to two-view tab layout (Terminal + Earnings)"
```

---

## Task 11: Add earning breakdown to `OrderBroadcast.tsx`

**Files:**
- Modify: `src/components/rider/OrderBroadcast.tsx`

- [ ] **Step 1: Add breakdown to the broadcast modal**

In `src/components/rider/OrderBroadcast.tsx`:

1. Add import: `import { calculateEarningBreakdown } from '@/lib/pricing';`

2. Inside the modal JSX, replace the flat earning line:
```tsx
// BEFORE:
<p className="text-emerald-400 text-lg font-black mb-8">
  Earn ₹{broadcastOrder.rider_earning ?? 500}
</p>

// AFTER:
{(() => {
  const bd = broadcastOrder.distance_km != null
    ? calculateEarningBreakdown(broadcastOrder.distance_km)
    : null;
  return (
    <div className="mb-8">
      <p className="text-emerald-400 text-2xl font-black">
        ₹{broadcastOrder.rider_earning ?? (bd?.total ?? 0)}
      </p>
      {bd && (
        <p className="text-slate-400 text-xs font-bold mt-1">
          Delivery ₹{bd.deliveryFee} + Pickup Pay ₹{bd.pickupPay}
        </p>
      )}
    </div>
  );
})()}
```

- [ ] **Step 2: Verify existing OrderBroadcast tests pass**

Run: `npx vitest run src/components/rider/OrderBroadcast.test.tsx`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/rider/OrderBroadcast.tsx
git commit -m "feat(rider): add itemized earning breakdown to OrderBroadcast modal"
```

---

## Task 12: Create `RiderPayoutsPanel.tsx` for owner dashboard

**Files:**
- Create: `src/components/owner/RiderPayoutsPanel.tsx`
- Modify: `src/components/owner/OwnerDashboardClient.tsx`

- [ ] **Step 1: Create the panel component**

Create `src/components/owner/RiderPayoutsPanel.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Bike } from 'lucide-react';
import { getWeeklyRiderPayouts } from '@/app/actions/ownerActions';

interface RiderPayout {
  riderId: string;
  riderName: string;
  riderPhone: string;
  weekDeliveries: number;
  weekDeliveryFees: number;
  weekPickupPay: number;
  weekBonus: number;
  weekTotalDue: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(amount);
}

export default function RiderPayoutsPanel() {
  const [payouts, setPayouts] = useState<RiderPayout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getWeeklyRiderPayouts().then((data) => {
      setPayouts(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="glass-card p-6 animate-pulse">
        <div className="h-5 w-48 bg-slate-200 rounded mb-4" />
        <div className="h-32 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  if (payouts.length === 0) return null;

  const totals = payouts.reduce(
    (acc, p) => ({
      deliveries: acc.deliveries + p.weekDeliveries,
      deliveryFees: acc.deliveryFees + p.weekDeliveryFees,
      pickupPay: acc.pickupPay + p.weekPickupPay,
      bonus: acc.bonus + p.weekBonus,
      total: acc.total + p.weekTotalDue,
    }),
    { deliveries: 0, deliveryFees: 0, pickupPay: 0, bonus: 0, total: 0 }
  );

  return (
    <section className="glass-card overflow-hidden">
      <div className="p-6 border-b border-slate-100">
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
          <Bike size={16} /> Rider Payouts (This Week)
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Rider</th>
              <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Orders</th>
              <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Delivery</th>
              <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Pickup</th>
              <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Bonus</th>
              <th className="text-right px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Total Due</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((p, idx) => (
              <tr key={p.riderId} className={`border-b border-slate-50 last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                <td className="px-6 py-3">
                  <p className="text-sm font-bold text-slate-800">{p.riderName}</p>
                  <p className="text-[10px] text-slate-400 font-bold">{p.riderPhone}</p>
                </td>
                <td className="text-right px-4 py-3 text-sm font-bold text-slate-600">{p.weekDeliveries}</td>
                <td className="text-right px-4 py-3 text-sm font-bold text-slate-600">{formatCurrency(p.weekDeliveryFees)}</td>
                <td className="text-right px-4 py-3 text-sm font-bold text-slate-600">{formatCurrency(p.weekPickupPay)}</td>
                <td className="text-right px-4 py-3 text-sm font-bold text-emerald-600">{formatCurrency(p.weekBonus)}</td>
                <td className="text-right px-6 py-3 text-sm font-black text-slate-900">{formatCurrency(p.weekTotalDue)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t-2 border-slate-200">
              <td className="px-6 py-3 text-xs font-black text-slate-600 uppercase">Total</td>
              <td className="text-right px-4 py-3 text-xs font-black text-slate-600">{totals.deliveries}</td>
              <td className="text-right px-4 py-3 text-xs font-black text-slate-600">{formatCurrency(totals.deliveryFees)}</td>
              <td className="text-right px-4 py-3 text-xs font-black text-slate-600">{formatCurrency(totals.pickupPay)}</td>
              <td className="text-right px-4 py-3 text-xs font-black text-emerald-600">{formatCurrency(totals.bonus)}</td>
              <td className="text-right px-6 py-3 text-sm font-black text-slate-900">{formatCurrency(totals.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Integrate into OwnerDashboardClient**

In `src/components/owner/OwnerDashboardClient.tsx`:

1. Add import: `import RiderPayoutsPanel from './RiderPayoutsPanel';`

2. Add `<RiderPayoutsPanel />` at the bottom of the component JSX, just before the closing `</div>`:

```tsx
      {/* Rider Payouts */}
      <RiderPayoutsPanel />
    </div>
  );
```

- [ ] **Step 3: Verify the app compiles**

Run: `npm run dev` and check `/admin/orders` page loads without errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/owner/RiderPayoutsPanel.tsx src/components/owner/OwnerDashboardClient.tsx
git commit -m "feat(owner): add RiderPayoutsPanel weekly settlement table"
```

---

## Task 13: Add rider payout columns to Reports

**Files:**
- Modify: `src/app/actions/reportActions.ts`
- Modify: `src/components/admin/ReportsClient.tsx`

- [ ] **Step 1: Expand `getDailyReport` to include rider payouts**

In `src/app/actions/reportActions.ts`:

1. Add import: `import { calculateNightlyBonus } from '@/lib/pricing';`

2. Update the `DailyReport` interface — add to the `weekly` array item:
```ts
riderPayout: number;
netMargin: number;
```

3. In the weekly processing section, after grouping orders, also sum `rider_earning` per day and calculate the daily nightly bonus by counting delivered orders with a `rider_id` per day. Set `riderPayout = sum(rider_earning) + nightly_bonus` and `netMargin = revenue - riderPayout`.

- [ ] **Step 2: Add columns to ReportsClient weekly table**

In `src/components/admin/ReportsClient.tsx`, add two new `<th>` and `<td>` elements for "Rider Payout" and "Net Margin" in the weekly table.

- [ ] **Step 3: Verify all tests pass**

Run: `npx vitest run`
Expected: ALL PASS (update `reportActions.test.ts` if the mock data needs the new fields)

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/reportActions.ts src/components/admin/ReportsClient.tsx
git commit -m "feat(reports): add rider payout and net margin columns to weekly reports"
```

---

## Task 14: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 2: Run linting**

Run: `npm run lint`
Expected: No new errors in modified files

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup for rider earning UI update"
```
