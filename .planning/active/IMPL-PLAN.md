# Rider Settlement System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add rider settlement tracking so the owner can mark weekly payouts as paid, view settlement history, and riders can see their settlement status.

**Architecture:** New `rider_settlements` table stores each settlement record (rider, week range, amount, date paid, optional notes). Owner sees a "Settle" button on the existing `RiderPayoutsPanel`. Settlement history accessible from a new admin page. Rider sees "Week Settled" badge in their earnings view.

**Tech Stack:** Next.js 15 Server Actions, Supabase PostgreSQL, React, Tailwind CSS v4, Lucide icons, Framer Motion

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/weekRange.ts` | Create | Shared IST week calculation |
| `supabase/migrations/20260616000000_create_rider_settlements.sql` | Create | New table + RLS |
| `src/types/database.types.ts` | Modify | Add `rider_settlements` type definitions |
| `src/app/actions/settlementActions.ts` | Create | Server actions: settle, history, rider status |
| `src/components/owner/RiderPayoutsPanel.tsx` | Modify | Add "Settle" button per rider row |
| `src/app/admin/settlements/page.tsx` | Create | Settlement history page |
| `src/components/owner/SettlementHistory.tsx` | Create | History table component |
| `src/app/admin/layout.tsx` | Modify | Add "Settlements" nav item |
| `src/components/rider/EarningsView.tsx` | Modify | Show settlement status badge |

---

## Task 1: Create Week Range Helper

Centralizes IST week calculation so we don't duplicate logic across components.

**Files:**
- Create: `src/lib/weekRange.ts`

- [ ] **Step 1: Create the helper file**

```typescript
export function getCurrentWeekRange(): { weekStart: string; weekEnd: string } {
  const now = new Date();
  const indiaTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const dayOfWeek = indiaTime.getUTCDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(indiaTime);
  monday.setUTCDate(monday.getUTCDate() - daysSinceMonday);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { weekStart: fmt(monday), weekEnd: fmt(sunday) };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/weekRange.ts
git commit -m "feat: add getCurrentWeekRange helper for IST week calculation"
```

---

## Task 2: Database Migration — Create `rider_settlements` Table

**Files:**
- Create: `supabase/migrations/20260616000000_create_rider_settlements.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Create rider_settlements table
CREATE TABLE IF NOT EXISTS public.rider_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID NOT NULL REFERENCES public.riders(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    total_deliveries INTEGER NOT NULL DEFAULT 0,
    total_earnings NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_bonus NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    settled_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rider_settlements_rider_week
    ON public.rider_settlements(rider_id, week_start);

CREATE INDEX IF NOT EXISTS idx_rider_settlements_rider_id
    ON public.rider_settlements(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_settlements_week_start
    ON public.rider_settlements(week_start DESC);

ALTER TABLE public.rider_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for rider_settlements" ON public.rider_settlements
    FOR SELECT USING (true);

CREATE POLICY "Allow insert for rider_settlements" ON public.rider_settlements
    FOR INSERT WITH CHECK (true);
```

- [ ] **Step 2: Apply migration**

Run: `npx supabase db push`
Expected: Migration applied successfully

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260616000000_create_rider_settlements.sql
git commit -m "feat: add rider_settlements table for weekly payout tracking"
```

---

## Task 3: Update Database Types

**Files:**
- Modify: `src/types/database.types.ts`

- [ ] **Step 1: Add rider_settlements type definitions**

In `src/types/database.types.ts`, find the closing of the `riders:` definition (after line 770 where `Relationships: []` ends). Add this block right after it:

```typescript
      rider_settlements: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          rider_id: string
          settled_at: string
          total_amount: number
          total_bonus: number
          total_deliveries: number
          total_earnings: number
          week_end: string
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          rider_id: string
          settled_at?: string
          total_amount?: number
          total_bonus?: number
          total_deliveries?: number
          total_earnings?: number
          week_end: string
          week_start: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          rider_id?: string
          settled_at?: string
          total_amount?: number
          total_bonus?: number
          total_deliveries?: number
          total_earnings?: number
          week_end?: string
          week_start?: string
        }
        Relationships: []
      }
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/types/database.types.ts
git commit -m "feat: add rider_settlements type definitions"
```

---

## Task 4: Server Actions — Settle & Get History

**Files:**
- Create: `src/app/actions/settlementActions.ts`

- [ ] **Step 1: Create the file with all 4 actions**

```typescript
'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminSession, verifyRiderSession } from '@/lib/auth';

interface SettlePayload {
  riderId: string;
  weekStart: string;
  weekEnd: string;
  totalDeliveries: number;
  totalEarnings: number;
  totalBonus: number;
  totalAmount: number;
  notes?: string;
}

export async function settleWeeklyPayout(payload: SettlePayload) {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  const { data, error } = await supabaseAdmin
    .from('rider_settlements')
    .insert({
      rider_id: payload.riderId,
      week_start: payload.weekStart,
      week_end: payload.weekEnd,
      total_deliveries: payload.totalDeliveries,
      total_earnings: payload.totalEarnings,
      total_bonus: payload.totalBonus,
      total_amount: payload.totalAmount,
      notes: payload.notes || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'This week is already settled for this rider' };
    }
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

export async function getSettlementHistory(riderId?: string) {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  let query = supabaseAdmin
    .from('rider_settlements')
    .select('*, riders(name, phone)')
    .order('week_start', { ascending: false });

  if (riderId) {
    query = query.eq('rider_id', riderId);
  }

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function getAdminSettlementStatus(riderIds: string[], weekStart: string) {
  const auth = await verifyAdminSession();
  if (!auth.success) return { success: false, error: auth.error };

  const { data, error } = await supabaseAdmin
    .from('rider_settlements')
    .select('rider_id, week_start')
    .in('rider_id', riderIds)
    .eq('week_start', weekStart);

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

export async function getRiderWeekSettlementStatus(riderId: string, weekStart: string) {
  const auth = await verifyRiderSession();
  if (!auth.success) return { success: false, error: auth.error };

  if (auth.session?.id !== riderId) {
    return { success: false, error: 'Forbidden' };
  }

  const { data, error } = await supabaseAdmin
    .from('rider_settlements')
    .select('id, settled_at, total_amount, notes')
    .eq('rider_id', riderId)
    .eq('week_start', weekStart)
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/actions/settlementActions.ts
git commit -m "feat: add settlement server actions (admin + rider scoped)"
```

---

## Task 5: Update RiderPayoutsPanel — Add Settle Button

**Files:**
- Modify: `src/components/owner/RiderPayoutsPanel.tsx`

- [ ] **Step 1: Replace the entire file with this version**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Bike, Check, Clock, AlertCircle } from 'lucide-react';
import { getWeeklyRiderPayouts } from '@/app/actions/ownerActions';
import { settleWeeklyPayout, getAdminSettlementStatus } from '@/app/actions/settlementActions';
import { getCurrentWeekRange } from '@/lib/weekRange';

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
  const [settledIds, setSettledIds] = useState<Set<string>>(new Set());
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { weekStart, weekEnd } = getCurrentWeekRange();

  useEffect(() => {
    getWeeklyRiderPayouts().then(async (res) => {
      if (res && res.success && res.data) {
        setPayouts(res.data);
        const riderIds = res.data.map((p: RiderPayout) => p.riderId);
        if (riderIds.length > 0) {
          const settled = await getAdminSettlementStatus(riderIds, weekStart);
          if (settled.success && settled.data) {
            setSettledIds(new Set(settled.data.map((s: { rider_id: string }) => s.rider_id)));
          }
        }
      } else {
        setPayouts([]);
      }
      setLoading(false);
    });
  }, [weekStart]);

  const handleSettle = async (payout: RiderPayout) => {
    if (!confirm(`Settle ${payout.riderName} for ${formatCurrency(payout.weekTotalDue)}?`)) return;

    setSettlingId(payout.riderId);
    setError(null);
    const result = await settleWeeklyPayout({
      riderId: payout.riderId,
      weekStart,
      weekEnd,
      totalDeliveries: payout.weekDeliveries,
      totalEarnings: payout.weekDeliveryFees + payout.weekPickupPay,
      totalBonus: payout.weekBonus,
      totalAmount: payout.weekTotalDue,
      notes: notes[payout.riderId] || undefined,
    });

    if (result.success) {
      setSettledIds(new Set([...settledIds, payout.riderId]));
    } else {
      setError(result.error || 'Failed to settle');
    }
    setSettlingId(null);
  };

  if (loading) {
    return (
      <div className="glass-card p-6 animate-pulse">
        <div className="h-5 w-48 bg-slate-200 rounded mb-4" />
        <div className="h-32 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  if (payouts.length === 0) {
    return (
      <section className="glass-card p-12 text-center">
        <Bike size={32} className="mx-auto text-slate-300 mb-3" />
        <p className="text-sm font-bold text-slate-400">No rider payouts this week</p>
        <p className="text-xs text-slate-300 mt-1">Riders with deliveries will appear here</p>
      </section>
    );
  }

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

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-xs font-bold">
          <AlertCircle size={14} /> {error}
        </div>
      )}

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
              <th className="text-center px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Action</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((p, idx) => {
              const isSettled = settledIds.has(p.riderId);
              return (
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
                  <td className="text-center px-4 py-3">
                    {isSettled ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
                        <Check size={12} /> Settled
                      </span>
                    ) : (
                      <div className="flex items-center gap-2 justify-center">
                        <input
                          type="text"
                          placeholder="Note"
                          value={notes[p.riderId] || ''}
                          onChange={(e) => setNotes({ ...notes, [p.riderId]: e.target.value })}
                          className="w-20 sm:w-28 text-xs px-2 py-1.5 border border-slate-200 rounded focus:outline-none focus:border-primary"
                        />
                        <button
                          onClick={() => handleSettle(p)}
                          disabled={settlingId === p.riderId}
                          className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-white bg-primary hover:bg-primary/90 px-3 py-1.5 rounded-full disabled:opacity-50 transition-colors"
                        >
                          {settlingId === p.riderId ? (
                            <Clock size={12} className="animate-spin" />
                          ) : (
                            <Check size={12} />
                          )}
                          Settle
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t-2 border-slate-200">
              <td className="px-6 py-3 text-xs font-black text-slate-600 uppercase">Total</td>
              <td className="text-right px-4 py-3 text-xs font-black text-slate-600">{totals.deliveries}</td>
              <td className="text-right px-4 py-3 text-xs font-black text-slate-600">{formatCurrency(totals.deliveryFees)}</td>
              <td className="text-right px-4 py-3 text-xs font-black text-slate-600">{formatCurrency(totals.pickupPay)}</td>
              <td className="text-right px-4 py-3 text-xs font-black text-emerald-600">{formatCurrency(totals.bonus)}</td>
              <td className="text-right px-6 py-3 text-sm font-black text-slate-900">{formatCurrency(totals.total)}</td>
              <td className="px-4 py-3" />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build passes

- [ ] **Step 3: Commit**

```bash
git add src/components/owner/RiderPayoutsPanel.tsx
git commit -m "feat: add settle button + confirm dialog + empty state to payout panel"
```

---

## Task 6: Settlement History Page

**Files:**
- Create: `src/components/owner/SettlementHistory.tsx`
- Create: `src/app/admin/settlements/page.tsx`

- [ ] **Step 1: Create SettlementHistory component**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { History, Search, Inbox } from 'lucide-react';
import { getSettlementHistory } from '@/app/actions/settlementActions';

interface Settlement {
  id: string;
  rider_id: string;
  week_start: string;
  week_end: string;
  total_deliveries: number;
  total_earnings: number;
  total_bonus: number;
  total_amount: number;
  settled_at: string;
  notes: string | null;
  riders: { name: string; phone: string } | null;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function formatWeek(weekStart: string, weekEnd: string): string {
  const fmt = { day: 'numeric', month: 'short' } as const;
  const start = new Date(weekStart).toLocaleDateString('en-IN', fmt);
  const end = new Date(weekEnd).toLocaleDateString('en-IN', fmt);
  return `${start} – ${end}`;
}

export default function SettlementHistory() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    getSettlementHistory().then((res) => {
      if (res.success && res.data) {
        setSettlements(res.data);
      }
      setLoading(false);
    });
  }, []);

  const filtered = settlements.filter((s) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    const name = s.riders?.name?.toLowerCase() || '';
    const phone = s.riders?.phone || '';
    return name.includes(q) || phone.includes(q);
  });

  if (loading) {
    return (
      <div className="glass-card p-6 animate-pulse">
        <div className="h-5 w-48 bg-slate-200 rounded mb-4" />
        <div className="h-64 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  return (
    <section className="glass-card overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
          <History size={16} /> Settlement History
        </h3>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search rider..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-8 pr-4 py-2 text-xs font-bold border border-slate-200 rounded-lg focus:outline-none focus:border-primary w-48"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-12 text-center">
          <Inbox size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-bold text-slate-400">
            {filter ? 'No matches found' : 'No settlements yet'}
          </p>
          <p className="text-xs text-slate-300 mt-1">
            {filter ? 'Try a different search' : 'Settled weeks will appear here'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Rider</th>
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Week</th>
                <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Orders</th>
                <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Earnings</th>
                <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Bonus</th>
                <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Total Paid</th>
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Settled On</th>
                <th className="text-left px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, idx) => (
                <tr key={s.id} className={`border-b border-slate-50 last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                  <td className="px-6 py-3">
                    <p className="text-sm font-bold text-slate-800">{s.riders?.name || 'Unknown'}</p>
                    <p className="text-[10px] text-slate-400 font-bold">{s.riders?.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-xs font-bold text-slate-600">{formatWeek(s.week_start, s.week_end)}</td>
                  <td className="text-right px-4 py-3 text-sm font-bold text-slate-600">{s.total_deliveries}</td>
                  <td className="text-right px-4 py-3 text-sm font-bold text-slate-600">{formatCurrency(s.total_earnings)}</td>
                  <td className="text-right px-4 py-3 text-sm font-bold text-emerald-600">{formatCurrency(s.total_bonus)}</td>
                  <td className="text-right px-6 py-3 text-sm font-black text-slate-900">{formatCurrency(s.total_amount)}</td>
                  <td className="px-4 py-3 text-xs font-bold text-slate-500">{formatDate(s.settled_at)}</td>
                  <td className="px-6 py-3 text-xs text-slate-400">{s.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Create settlements page**

```tsx
import SettlementHistory from '@/components/owner/SettlementHistory';

export const metadata = {
  title: 'Settlements | Goodrest Admin',
};

export const dynamic = 'force-dynamic';

export default function SettlementsPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Rider Settlements</h1>
        <p className="text-sm text-slate-400 font-bold mt-1">Weekly payout history for all riders</p>
      </div>
      <SettlementHistory />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/settlements/page.tsx src/components/owner/SettlementHistory.tsx
git commit -m "feat: add settlement history page with search and empty states"
```

---

## Task 7: Add Settlements to Admin Sidebar

**Files:**
- Modify: `src/app/admin/layout.tsx:7-21, 151-156`

- [ ] **Step 1: Add History to lucide imports**

In `src/app/admin/layout.tsx`, the imports from `lucide-react` start at line 7. Add `History` to that import block:

```tsx
import {
  ShoppingBag,
  LogOut,
  Bell,
  ChefHat,
  ChevronRight,
  Menu,
  X,
  BarChart3,
  Phone,
  MessageSquare,
  AlertTriangle,
  Clock,
  ExternalLink,
  History,
} from 'lucide-react';
```

- [ ] **Step 2: Add Settlements to menu items array**

Find the `menuItems` array (around lines 151-156). Update it to:

```tsx
const menuItems = [
  { name: 'Orders', icon: ShoppingBag, href: '/admin/orders' },
  { name: 'Cancelled Orders', icon: AlertTriangle, href: '/admin/cancelled-orders' },
  { name: 'Menu Editor', icon: ChefHat, href: '/admin/menu' },
  { name: 'Reports', icon: BarChart3, href: '/admin/reports' },
  { name: 'Settlements', icon: History, href: '/admin/settlements' },
];
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build passes

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/layout.tsx
git commit -m "feat: add Settlements link to admin sidebar nav"
```

---

## Task 8: Show Settlement Status in Rider Earnings View

**Files:**
- Modify: `src/components/rider/EarningsView.tsx`

- [ ] **Step 1: Add imports at the top of the file**

After the existing imports (line 7), add:

```tsx
import { CheckCircle } from 'lucide-react';
import { getRiderWeekSettlementStatus } from '@/app/actions/settlementActions';
import { getCurrentWeekRange } from '@/lib/weekRange';
```

- [ ] **Step 2: Add state for settlement status**

In the component function (around line 50), add this state declaration after `loading`:

```tsx
  const [settlement, setSettlement] = useState<{ settled_at: string; total_amount: number; notes: string | null } | null>(null);
```

- [ ] **Step 3: Update useEffect to also fetch settlement status**

Replace the existing useEffect (lines 54-60) with:

```tsx
  useEffect(() => {
    getRiderEarningHistory(riderId).then(async (result) => {
      setWeekly(result.weekly);
      setWeekTotal(result.weekTotal);
      setLoading(false);

      const { weekStart } = getCurrentWeekRange();
      const status = await getRiderWeekSettlementStatus(riderId, weekStart);
      if (status.success && status.data) {
        setSettlement(status.data);
      }
    });
  }, [riderId]);
```

- [ ] **Step 4: Add the "Week Settled" badge before the Week Total footer**

Find the "Week Total Footer" section in the JSX (the `<div>` with "This Week" text). Add this block right BEFORE it:

```tsx
      {/* Week Settled Badge */}
      {!loading && settlement && (
        <div className="bg-[#252525] border border-[#3AB757] border-l-4 border-l-[#3AB757] rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#3AB757]/10 rounded-xl flex items-center justify-center">
            <CheckCircle size={20} className="text-[#3AB757]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-white">This Week is Settled</p>
            <p className="text-xs text-[#9C9C9C] font-medium mt-0.5">
              Paid {formatCurrency(settlement.total_amount)} on{' '}
              {new Date(settlement.settled_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </p>
            {settlement.notes && (
              <p className="text-[10px] text-[#696969] font-medium mt-1 italic">"{settlement.notes}"</p>
            )}
          </div>
        </div>
      )}
```

The `formatCurrency` function already exists in this file (line 35), no need to redefine.

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: Build passes

- [ ] **Step 6: Commit**

```bash
git add src/components/rider/EarningsView.tsx
git commit -m "feat: show 'Week Settled' badge in rider earnings view"
```

---

## Task 9: Full Verification

- [ ] **Step 1: Run build**

Run: `npm run build`
Expected: Build passes with no errors

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Run tests**

Run: `npm run test`
Expected: All tests pass

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: settlement system lint/build fixes"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** All 8 requirements mapped to tasks
- [x] **No placeholders:** All code blocks are complete; no "TBD" / "implement later" / "similar to"
- [x] **Type consistency:** `getAdminSettlementStatus` and `getRiderWeekSettlementStatus` named consistently across Tasks 4, 5, 8
- [x] **Auth separation:** Admin actions use `verifyAdminSession`, rider-facing action uses `verifyRiderSession`
- [x] **Import paths verified:** `@/lib/auth` (not `./ownerActions`), `@/lib/supabaseAdmin` (camelCase)
- [x] **Mobile-friendly:** Button sizes are `text-xs`/`py-1.5`, inputs use `sm:w-28` for responsive width
- [x] **Helper extracted:** `getCurrentWeekRange` in `lib/weekRange.ts`, used by both admin and rider components
- [x] **Safety:** Unique index + confirm dialog + error banner

---

## Summary

| What | Where |
|------|-------|
| **Helper** | `src/lib/weekRange.ts` — shared IST week calculation |
| **DB table** | `rider_settlements` — unique constraint prevents double-settle |
| **Admin actions** | `settleWeeklyPayout`, `getSettlementHistory`, `getAdminSettlementStatus` |
| **Rider action** | `getRiderWeekSettlementStatus` — scoped to logged-in rider |
| **Settle button** | `RiderPayoutsPanel` — confirm dialog, note input, empty state, mobile-friendly |
| **History page** | `/admin/settlements` — search + empty state + dynamic empty messaging |
| **Sidebar nav** | "Settlements" added to admin menu |
| **Rider view** | Green "Week Settled" badge in earnings with paid date + notes |
