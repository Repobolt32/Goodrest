# Offers & Free Delivery — Implementation Plan

## Goal
Add owner-controlled offers (discount %, free delivery) with server-side enforcement in `createOrder`.

## Tasks

### Task 1: Migration — Create `offers` table + alter `orders`
**File:** `supabase/migrations/20260608000000_create_offers.sql`

```sql
CREATE TABLE public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('discount_percent', 'free_delivery')),
  label TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT false,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_time_window CHECK (
    start_time IS NULL OR end_time IS NULL OR start_time < end_time
  )
);

-- Audit columns on orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS applied_offers JSONB;

-- RLS: admin can do everything, anon can read active offers
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on offers"
  ON public.offers FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Anyone can read active offers"
  ON public.offers FOR SELECT
  USING (active = true);
```

**Verify:** Run migration via `supabase db push` or Supabase dashboard. Confirm `offers` table exists with correct columns.

---

### Task 2: Update `database.types.ts`
**File:** `src/types/database.types.ts`

Add `offers` table types and update `orders` Row/Insert/Update with `discount_amount`, `delivery_fee`, `applied_offers`.

**Verify:** `npm run build` passes (TypeScript compiles).

---

### Task 3: Create `src/app/actions/offerActions.ts`
**New file.** Server actions for CRUD + fetching active offers.

```typescript
// Functions to implement:
export async function getActiveOffers()
  // → Select from offers WHERE active=true, check time windows

export async function getAllOffers()
  // → Admin: select all offers

export async function createOffer(input: { type, label?, config, active, start_time?, end_time? })
  // → Verify admin session, insert

export async function updateOffer(id, updates)
  // → Verify admin session, update

export async function toggleOffer(id, active)
  // → Verify admin session, update active flag

export async function deleteOffer(id)
  // → Verify admin session, delete
```

Follow existing pattern from `ownerActions.ts` / `settingsActions.ts` — verify admin session, return `{ success, data?, error? }`.

**Verify:** `npm run build` passes.

---

### Task 4: Server-side enforcement in `createOrder`
**File:** `src/app/actions/orderActions.ts`

After line 113 (`serverTotal += Number(dbPrice) * item.quantity`), before line 148 (`serverTotal += deliveryFee`):

```typescript
// 1. Fetch active offers
const { data: activeOffers } = await supabaseAdmin
  .from('offers')
  .select('*')
  .eq('active', true);

const now = new Date();
const validOffers = (activeOffers || []).filter(offer => {
  if (offer.start_time && now < new Date(offer.start_time)) return false;
  if (offer.end_time && now > new Date(offer.end_time)) return false;
  return true;
});

// 2. Apply discount_percent offers (only one active per type)
let discountAmount = 0;
const discountOffer = validOffers.find(o => o.type === 'discount_percent');
if (discountOffer) {
  const { percent, max_amount } = discountOffer.config;
  discountAmount = Math.min(
    serverTotal * (percent / 100),
    max_amount ?? Infinity
  );
  discountAmount = Math.min(discountAmount, serverTotal); // Clamp to subtotal
}

// 3. After delivery fee calculation, check free_delivery
let freeDelivery = false;
const freeDeliveryOffer = validOffers.find(o => o.type === 'free_delivery');
if (freeDeliveryOffer && serverTotal >= freeDeliveryOffer.config.threshold) {
  deliveryFee = 0;
  freeDelivery = true;
}

// 4. Apply discount to total
serverTotal = Math.max(0, serverTotal - discountAmount);
serverTotal += deliveryFee;

// 5. Add to orderData
const orderData = {
  ...existing,
  discount_amount: discountAmount,
  delivery_fee: deliveryFee,
  applied_offers: validOffers.length > 0 ? validOffers.map(o => ({
    id: o.id, type: o.type, config: o.config
  })) : null,
};
```

**Verify:** `npm run build` passes. Manually test: create order with discount offer active → `discount_amount` column populated in DB.

---

### Task 5: Create `src/components/admin/OfferManager.tsx`
**New file.** Admin offer management component.

```
Renders:
- List of offer cards (each shows: type, label, active toggle, edit, delete)
- "Add New Offer" button → opens modal
- Modal: select type → type-specific form fields → save

For discount_percent: percent input, max_amount input
For free_delivery: threshold input

Time window: optional start/end datetime pickers

Auto-generate label from config (e.g., "10% off" or "Free delivery on ₹200+")
```

**Verify:** `npm run build` passes. UI renders in browser.

---

### Task 6: Create `src/app/admin/offers/page.tsx` + add to sidebar
**New page + modify `src/app/admin/layout.tsx`.**

Page: wraps `OfferManager` component.

Sidebar: add to `menuItems` array:
```typescript
{ name: 'Offers', icon: Tag, href: '/admin/offers' }
```

**Verify:** Navigate to `/admin/offers` in Electron app. Offers page renders. Sidebar shows "Offers" link.

---

### Task 7: Update `CheckoutForm.tsx` — Display active offers
**File:** `src/components/CheckoutForm.tsx`

In the Order Summary section (line 574-598), after "Items Total" line:

```typescript
// Fetch active offers on mount
const [activeOffers, setActiveOffers] = useState([]);
useEffect(() => {
  fetch('/api/offers/active') // or use server action
    .then(res => res.json())
    .then(setActiveOffers);
}, []);

// Calculate discount
const discountOffer = activeOffers.find(o => o.type === 'discount_percent');
const freeDeliveryOffer = activeOffers.find(o => o.type === 'free_delivery');

let discountAmount = 0;
if (discountOffer) {
  const { percent, max_amount } = discountOffer.config;
  discountAmount = Math.min(
    totalPrice * (percent / 100),
    max_amount ?? Infinity
  );
  discountAmount = Math.min(discountAmount, totalPrice);
}

const isFreeDelivery = freeDeliveryOffer && totalPrice >= freeDeliveryOffer.config.threshold;
const finalDeliveryFee = isFreeDelivery ? 0 : deliveryFee;
```

Display in Order Summary:
```
Items Total:                    ₹350
10% off (capped at ₹100):     -₹35
Delivery:                       ₹30  → Free (₹200+ order)
─────────────────────────────────
Grand Total:                    ₹315
```

Also update the "Pay & Order" button total: `totalPrice - discountAmount + finalDeliveryFee`.

**Verify:** `npm run build` passes. Open `/checkout` in browser → discount and free delivery display correctly.

---

### Task 8: Verification
Run full verification:
```bash
npm run build
npm run test
npm run lint
```

Manual test:
1. Open admin → Offers page → Create 10% discount offer → Toggle ON
2. Open admin → Offers page → Create free delivery offer (₹200 threshold) → Toggle ON
3. Open customer checkout → Add items ≥ ₹200 → Verify discount + free delivery shown
4. Place order → Verify `discount_amount`, `delivery_fee`, `applied_offers` in DB
5. Toggle offers OFF → Verify checkout shows no discount

---

## Done When
- [ ] `offers` table exists with correct schema
- [ ] Admin can create/edit/toggle/delete offers
- [ ] Server-side enforcement in `createOrder` applies discounts
- [ ] Checkout displays active offers
- [ ] `orders` table has audit columns (`discount_amount`, `delivery_fee`, `applied_offers`)
- [ ] `npm run build` passes
- [ ] `npm run test` passes
- [ ] `npm run lint` passes

---

## Files Changed

| # | File | Action |
|---|------|--------|
| 1 | `supabase/migrations/20260608000000_create_offers.sql` | **NEW** |
| 2 | `src/types/database.types.ts` | **MODIFY** |
| 3 | `src/app/actions/offerActions.ts` | **NEW** |
| 4 | `src/app/actions/orderActions.ts` | **MODIFY** (lines ~114-165) |
| 5 | `src/components/admin/OfferManager.tsx` | **NEW** |
| 6 | `src/app/admin/offers/page.tsx` | **NEW** |
| 7 | `src/app/admin/layout.tsx` | **MODIFY** (sidebar nav) |
| 8 | `src/components/CheckoutForm.tsx` | **MODIFY** (lines ~574-598) |

---

## Key Design Decisions

1. **Offers table with JSONB config** — flexible for future offer types without schema changes
2. **Single active per type** — only one `discount_percent` and one `free_delivery` active at a time
3. **Server-side enforcement** — `createOrder` recalculates everything, ignores client-submitted totals
4. **Audit columns on orders** — `discount_amount`, `delivery_fee`, `applied_offers` for reports
5. **`max_amount` cap** — prevents huge discounts on large orders
6. **Time window** — nullable start/end for "always active" vs "limited time" offers
7. **Auto-generated labels** — owner doesn't need to type marketing copy
