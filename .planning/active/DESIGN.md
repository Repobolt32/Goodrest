# Rider Settlement System — Frontend Design

**Last updated:** 2026-06-16
**Status:** Final (pending user approval)

---

## Design Tokens Used

| Token | Value | Use |
|-------|-------|-----|
| `bg-primary` | `#E11D48` (rose 600) | Settle button, primary CTAs |
| `text-emerald-600` | `#059669` | Settled badges, success states |
| `bg-emerald-50` | `#ECFDF5` | Settled badge background |
| `text-slate-400` | `#94A3B8` | Table headers, captions |
| `text-slate-800` | `#1E293B` | Primary text |
| `bg-[#252525]` | `#252525` | Rider-side card background |
| `bg-[#3AB757]/10` | `#3AB757` 10% | Rider-side success icon bg |
| `text-[#3AB757]` | `#3AB757` | Rider-side success accent |
| `text-[#9C9C9C]` | `#9C9C9C` | Rider-side secondary text |
| `glass-card` | (project class) | Card containers |

---

## Owner Dashboard — Modified Payout Table

**Location:** `/admin/orders` → `RiderPayoutsPanel` component

### Layout (Desktop ≥ 768px)

```
┌────────────────────────────────────────────────────────────────────────┐
│  🚲 RIDER PAYOUTS (THIS WEEK)                                         │
├──────────┬──────┬─────────┬────────┬─────────┬──────────┬─────────────┤
│ RIDER    │ORDERS│ DELIVERY│ PICKUP │ BONUS   │ TOTAL DUE│ ACTION      │
├──────────┼──────┼─────────┼────────┼─────────┼──────────┼─────────────┤
│ Rahul    │ 12   │ ₹960    │ ₹240   │ ₹100    │ ₹1,300   │ [Note ]     │
│ 98765... │      │         │        │         │          │ [✓ SETTLE]  │
├──────────┼──────┼─────────┼────────┼─────────┼──────────┼─────────────┤
│ Amit     │ 8    │ ₹640    │ ₹160   │ ₹0      │ ₹800     │ ✓ SETTLED   │
│ 91234... │      │         │        │         │          │             │
├──────────┼──────┼─────────┼────────┼─────────┼──────────┼─────────────┤
│ TOTAL    │ 20   │ ₹1,600  │ ₹400   │ ₹100    │ ₹2,100   │             │
└──────────┴──────┴─────────┴────────┴─────────┴──────────┴─────────────┘
```

### Mobile (< 768px)

The table scrolls horizontally. Note input shrinks to `w-20`, button stays at `text-xs px-3 py-1.5`.

### States

| State | Visual |
|-------|--------|
| **Loading** | Skeleton placeholder with `animate-pulse` |
| **Empty** | Bike icon + "No rider payouts this week" message |
| **Unsettled** | Note input + red Settle button |
| **Settling** | Spinner icon replaces check, button disabled (opacity-50) |
| **Settled** | Green pill badge "✓ SETTLED" — no input/button |
| **Error** | Red banner above table with `AlertCircle` icon |

### Confirmation Dialog

Native browser `confirm()` for simplicity:
```
"Settle Rahul for ₹1,300?"
```

### Class Reference (Settle Button)

```tsx
className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-white bg-primary hover:bg-primary/90 px-3 py-1.5 rounded-full disabled:opacity-50 transition-colors"
```

### Class Reference (Settled Badge)

```tsx
className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full"
```

---

## Admin Settlements Page

**Location:** `/admin/settlements` → new page

### Layout

```
┌──────────────────────────────────────────────────────────────┐
│  Rider Settlements                                           │
│  Weekly payout history for all riders                        │
├──────────────────────────────────────────────────────────────┤
│  📜 SETTLEMENT HISTORY                  [🔍 Search rider...] │
├──────────┬─────────────┬───────┬─────────┬────────┬──────────┤
│ RIDER    │ WEEK        │ORDERS │ EARNED  │ PAID   │ ON  NOTES│
├──────────┼─────────────┼───────┼─────────┼────────┼──────────┤
│ Rahul    │ 9–15 Jun    │ 12    │ ₹1,200  │ ₹1,300 │16 Jun    │
│ 98765... │             │       │         │        │"cash"    │
├──────────┼─────────────┼───────┼─────────┼────────┼──────────┤
│ Amit     │ 9–15 Jun    │ 8     │ ₹800    │ ₹800   │16 Jun    │
│ 91234... │             │       │         │        │          │
├──────────┴─────────────┴───────┴─────────┴────────┴──────────┤
│        (scrollable list, no pagination)                      │
└──────────────────────────────────────────────────────────────┘
```

### Empty States

| Condition | Message |
|-----------|---------|
| No data at all | `📥 No settlements yet` / "Settled weeks will appear here" |
| Search has no match | `📥 No matches found` / "Try a different search" |

### Search Behavior

- Real-time client-side filter
- Matches: rider name (lowercase contains) OR phone (contains)
- Width: `w-48` (192px), no debounce needed (small dataset expected)

---

## Rider Earnings View — Modified

**Location:** `/rider/dashboard` → `EarningsView` component

### Added: Week Settled Card (above Week Total footer)

```
┌──────────────────────────────────────────────────┐
│  ✅  This Week is Settled                       │
│      Paid ₹1,300 on 16 Jun                      │
│      "paid cash"                                │
└──────────────────────────────────────────────────┘
```

### Style (matches existing dark theme)

```tsx
className="bg-[#252525] border border-[#3AB757] border-l-4 border-l-[#3AB757] rounded-2xl p-4 flex items-center gap-3"
```

- Background: `#252525` (matches Today Summary card)
- Border accent: `#3AB757` (emerald green, 4px left border)
- Icon: `CheckCircle` size 20, in `#3AB757` on 10% green bg
- Text: white headline, `#9C9C9C` caption, `#696969` italic note
- Rounded 2xl, follows existing card patterns

### When it appears

- Only when `settlement` state is set (week has been settled by admin)
- Hides if no settlement record for current week

---

## Admin Sidebar — Added Item

**Location:** `src/app/admin/layout.tsx`

Add between Reports and (end):

```tsx
{ name: 'Settlements', icon: History, href: '/admin/settlements' }
```

Visual order in sidebar:
1. Orders
2. Cancelled Orders
3. Menu Editor
4. Reports
5. **Settlements** ← new

---

## Responsive Behavior Summary

| Screen | Settle button | Note input | History table | Rider badge |
|--------|---------------|------------|---------------|-------------|
| Mobile (< 640px) | Visible, smaller padding | `w-20` (80px) | Horizontal scroll | Full width |
| Tablet (≥ 640px) | Standard | `w-28` (112px) | Fits | Full width |
| Desktop (≥ 1024px) | Standard | `w-28` (112px) | Fits | Full width |

---

## Accessibility

- All buttons have clear text labels (not icon-only)
- Confirmation required before settle (no accidental clicks)
- Empty states have descriptive text + icon
- Color is not the only indicator (✓ icon + "SETTLED" text together)
- Form inputs have placeholder text
- Tables use `<th>` with `scope` for screen readers (existing pattern)

---

## Future Enhancements (Not in MVP)

- Export history to CSV
- Filter by date range
- Edit/undo settlement (admin)
- Rider view of all past settlements
- PDF receipt generation
