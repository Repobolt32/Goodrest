---
phase: "04"
name: "Delivery & Rider System — Backend & Schema"
autonomous: true
wave: 1
requirements_addressed:
  - DELI-01
  - DELI-03
---

# Plan: Phase 4 — Wave 1: Backend & Schema

## must_haves

1. Database migration adds `distance_km`, `rider_earning`, `rider_started_at` to orders and `total_deliveries`, `total_earnings` to riders.
2. Google Maps Distance Matrix API used for all distance calculation.
3. Rider actions support FCFS accept, Start Riding, and delivery completion with earnings.
4. Manual admin dispatch functions are removed without breaking the build.
5. Admin dashboard no longer imports removed functions.

## verification

- [ ] `npm run build` exits 0 after all backend changes.
- [ ] `supabase/migrations/20260509_rider_refactor.sql` exists with correct ALTER statements.
- [ ] `database.types.ts` includes new columns.

---

## Task 1.1: Database Migration

**`<read_first>`**
- `supabase/migrations/` (existing migration patterns)
- `src/types/database.types.ts`

**`<action>`**
Create file `supabase/migrations/20260509_rider_refactor.sql`:
```sql
-- Add distance, earning, and start-riding timestamp to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS distance_km NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS rider_earning NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS rider_started_at TIMESTAMPTZ;

-- Add lifetime stats to riders
ALTER TABLE public.riders
  ADD COLUMN IF NOT EXISTS total_deliveries INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_earnings NUMERIC(10,2) DEFAULT 0;
```

Update `src/types/database.types.ts` to include these new columns in the `orders` and `riders` Row/Insert/Update types.

**`<acceptance_criteria>`**
- `20260509_rider_refactor.sql` exists in `supabase/migrations/`.
- Migration contains exactly the 5 ALTER TABLE statements above.
- `database.types.ts` contains `distance_km`, `rider_earning`, `rider_started_at` in `orders` row type.
- `database.types.ts` contains `total_deliveries`, `total_earnings` in `riders` row type.

---

## Task 1.2: Implement Google Maps Routes API for distance

**`<read_first>`**
- `src/lib/distance.ts`
- `.env`
- `src/components/CheckoutForm.tsx` (to integrate Google Maps distance)

**`<action>`**
Replace `src/lib/distance.ts` entirely. Use the **Routes API: Compute Route Matrix** (not the deprecated Legacy Distance Matrix API).

```ts
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

export async function getGoogleMapsDistance(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<number | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('[getGoogleMapsDistance] GOOGLE_MAPS_API_KEY not set');
    return null;
  }
  try {
    const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'routes.distanceMeters',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: originLat, longitude: originLng } } },
        destination: { location: { latLng: { latitude: destLat, longitude: destLng } } },
        travelMode: 'DRIVE',
      }),
      next: { revalidate: 0 },
    });
    const data = await res.json();
    if (data.routes?.[0]?.distanceMeters) {
      return data.routes[0].distanceMeters / 1000;
    }
    return null;
  } catch (err) {
    console.error('[getGoogleMapsDistance] API error:', err);
    return null;
  }
}

export function calculateETA(distanceKm: number): number {
  const prepTimeMins = 15;
  const speedKmph = 20;
  const travelTimeMins = (distanceKm / speedKmph) * 60;
  return Math.ceil(prepTimeMins + travelTimeMins);
}

- `calculateDistance` and `deg2rad` helper functions removed entirely — checkout now uses `getGoogleMapsDistance`.

**`<acceptance_criteria>`**
- `src/lib/distance.ts` exports `getGoogleMapsDistance` and `calculateETA`.
- `getGoogleMapsDistance` accepts 4 number params and returns `Promise<number | null>`.
- `getGoogleMapsDistance` calls `routes.googleapis.com/directions/v2:computeRoutes` (not legacy `maps.googleapis.com/maps/api/distancematrix`).
- `calculateDistance` and `deg2rad` removed — no longer needed.
- `.env` updated with `GOOGLE_MAPS_API_KEY` (server-side only, no `NEXT_PUBLIC_` prefix).

---

## Task 1.3: Rewrite Rider Server Actions

**`<read_first>`**
- `src/app/actions/riderActions.ts`
- `src/lib/distance.ts`
- `src/lib/supabaseAdmin.ts`
- `src/types/database.types.ts`

**`<action>`**
Rewrite `src/app/actions/riderActions.ts`:

```ts
'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getGoogleMapsDistance } from '@/lib/distance';
import { revalidatePath } from 'next/cache';

const RESTO_LAT = parseFloat(process.env.NEXT_PUBLIC_RESTO_LAT || '0');
const RESTO_LNG = parseFloat(process.env.NEXT_PUBLIC_RESTO_LNG || '0');

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export async function getRiderByPhone(phone: string) {
  const { data, error } = await supabaseAdmin
    .from('riders')
    .select('*')
    .eq('phone', phone)
    .single();
  if (error) return null;
  return data;
}

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

export async function acceptOrder(orderId: string, riderId: string) {
  if (!isValidUUID(orderId) || !isValidUUID(riderId)) {
    return { success: false, error: 'Invalid order or rider ID' };
  }

  // Atomic UPDATE with .is('rider_id', null) eliminates race conditions.
  // Pre-check SELECT removed — the UPDATE itself is the authority.
  let distanceKm: number | null = null;
  let earning = 500;

  // Pre-fetch distance if not already stored (non-atomic, OK for UX only)
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('distance_km, lat, lng')
    .eq('id', orderId)
    .single();

  if (order?.distance_km != null) {
    distanceKm = order.distance_km;
    earning = Math.round(distanceKm * 10 + 500);
  } else if (order?.lat != null && order?.lng != null) {
    distanceKm = await getGoogleMapsDistance(RESTO_LAT, RESTO_LNG, order.lat, order.lng);
    if (distanceKm) earning = Math.round(distanceKm * 10 + 500);
  }

  const { data: rider } = await supabaseAdmin
    .from('riders')
    .select('phone')
    .eq('id', riderId)
    .single();

  const { data: updatedRows, error } = await supabaseAdmin
    .from('orders')
    .update({
      rider_id: riderId,
      rider_accepted_at: new Date().toISOString(),
      distance_km: distanceKm,
      rider_earning: earning,
      rider_phone: rider?.phone || null,
    })
    .eq('id', orderId)
    .is('rider_id', null)
    .in('order_status', ['preparing', 'ready'])
    .select();

  if (!updatedRows || updatedRows.length === 0) {
    return { success: false, error: 'Order already taken or no longer available' };
  }
  if (error) return { success: false, error: error.message };

  revalidatePath('/admin/orders');
  revalidatePath(`/track/order/${orderId}`);
  return { success: true, distanceKm, earning };
}

export async function startRiding(orderId: string, riderId: string) {
  if (!isValidUUID(orderId) || !isValidUUID(riderId)) {
    return { success: false, error: 'Invalid order or rider ID' };
  }

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('rider_id, order_status')
    .eq('id', orderId)
    .single();

  if (order?.rider_id !== riderId) {
    return { success: false, error: 'Not your order' };
  }
  if (order?.order_status === 'out_for_delivery') {
    return { success: true };
  }

  const { error } = await supabaseAdmin
    .from('orders')
    .update({
      order_status: 'out_for_delivery',
      rider_started_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('rider_id', riderId);

  if (error) return { success: false, error: error.message };
  revalidatePath('/admin/orders');
  revalidatePath(`/track/order/${orderId}`);
  return { success: true };
}

export async function markOrderAsDeliveredRider(orderId: string, riderId: string) {
  if (!isValidUUID(orderId) || !isValidUUID(riderId)) {
    return { success: false, error: 'Invalid order or rider ID' };
  }

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('rider_id, order_status, rider_earning')
    .eq('id', orderId)
    .single();

  if (order?.rider_id !== riderId) {
    return { success: false, error: 'Not your order' };
  }
  if (order?.order_status !== 'out_for_delivery') {
    return { success: false, error: 'Order must be out for delivery' };
  }

  // Atomic transaction via Supabase RPC — prevents data loss if rider update fails
  const { error } = await supabaseAdmin.rpc('deliver_order', {
    p_order_id: orderId,
    p_rider_id: riderId,
    p_rider_earning: order?.rider_earning || 500,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath('/admin/orders');
  revalidatePath(`/track/order/${orderId}`);
  return { success: true };
}

export async function updateLocation(riderId: string, lat: number, lng: number) {
  if (!isValidUUID(riderId)) {
    return { success: false, error: 'Invalid rider ID' };
  }

  const location = { lat, lng };
  const { error: updateError } = await supabaseAdmin
    .from('riders')
    .update({ current_location: location })
    .eq('id', riderId);

  if (updateError) return { success: false, error: updateError.message };

  const { error: historyError } = await supabaseAdmin
    .from('rider_locations')
    .insert({ rider_id: riderId, location });

  if (historyError) console.warn('History logging failed:', historyError.message);
  return { success: true };
}

export async function getRiderStats(riderId: string) {
  if (!isValidUUID(riderId)) {
    return { totalDeliveries: 0, totalEarnings: 0, todayDeliveries: 0, todayEarnings: 0, todayDistanceKm: 0 };
  }

  const { data: rider } = await supabaseAdmin
    .from('riders')
    .select('total_deliveries, total_earnings')
    .eq('id', riderId)
    .single();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();

  const { count: todayDeliveries } = await supabaseAdmin
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('rider_id', riderId)
    .gte('delivered_at', todayIso);

  const { data: todayAgg } = await supabaseAdmin
    .from('orders')
    .select('rider_earning, distance_km')
    .eq('rider_id', riderId)
    .gte('delivered_at', todayIso);

  const todayEarnings = (todayAgg || []).reduce((sum, o) => sum + (o.rider_earning || 0), 0);
  const todayDistance = (todayAgg || []).reduce((sum, o) => sum + (o.distance_km || 0), 0);

  return {
    totalDeliveries: rider?.total_deliveries || 0,
    totalEarnings: rider?.total_earnings || 0,
    todayDeliveries: todayDeliveries || 0,
    todayEarnings,
    todayDistanceKm: Math.round(todayDistance * 10) / 10,
  };
}

export async function getRiderActiveOrder(riderId: string) {
  if (!isValidUUID(riderId)) return null;

  const { data } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('rider_id', riderId)
    .not('order_status', 'in', "('delivered','cancelled')")
    .maybeSingle();
  return data || null;
}

export async function getUnassignedOrders() {
  const { data } = await supabaseAdmin
    .from('orders')
    .select('*')
    .is('rider_id', null)
    .in('order_status', ['preparing', 'ready'])
    .order('created_at', { ascending: true });
  return data || [];
}
```

**`<action>`** (additional, Task 1.3b)
Create the atomic delivery PostgreSQL function in Supabase. Add to `supabase/migrations/20260509_rider_refactor.sql`:

```sql
-- Atomic deliver_order RPC: updates order status AND rider stats in one transaction
CREATE OR REPLACE FUNCTION public.deliver_order(
  p_order_id UUID,
  p_rider_id UUID,
  p_rider_earning NUMERIC
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update order status (must be out_for_delivery and belong to rider)
  UPDATE public.orders
  SET order_status = 'delivered',
      delivered_at = NOW()
  WHERE id = p_order_id
    AND rider_id = p_rider_id
    AND order_status = 'out_for_delivery';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or not eligible for delivery';
  END IF;

  -- Increment rider stats atomically
  UPDATE public.riders
  SET total_deliveries = total_deliveries + 1,
      total_earnings = total_earnings + p_rider_earning
  WHERE id = p_rider_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rider not found';
  END IF;
END;
$$;
```

**`<acceptance_criteria>`**
- `riderActions.ts` exports `acceptOrder`, `startRiding`, `markOrderAsDeliveredRider`, `updateLocation`, `getRiderStats`, `getRiderActiveOrder`, `getUnassignedOrders`, `loginRider`, `getRiderByPhone`.
- `isValidUUID` helper validates all `orderId`, `riderId` params before database calls.
- `acceptOrder` uses `.eq('id', orderId).is('rider_id', null).in('order_status', ['preparing', 'ready']).select()` for atomic update.
- `acceptOrder` returns explicit "Order already taken or no longer available" when no rows updated.
- `acceptOrder` does NOT do a pre-check SELECT for `rider_id` (eliminates TOCTOU race).
- `markOrderAsDeliveredRider` calls `supabaseAdmin.rpc('deliver_order', ...)` for atomic transaction.
- `startRiding` sets `order_status = 'out_for_delivery'`.
- `getRiderStats` uses Supabase JS client syntax (`.eq`, `.gte`, `.select`) not raw SQL placeholders.
- All mutating actions call `revalidatePath` for `/admin/orders` and `/track/order/${orderId}`.
- `supabase/migrations/20260509_rider_refactor.sql` contains `deliver_order` function.

---

## Task 1.4: Remove Manual Dispatch from Admin Actions

**`<read_first>`**
- `src/app/actions/adminActions.ts`

**`<action>`**
Delete `dispatchOrder` and `updateDispatchDetails` functions from `src/app/actions/adminActions.ts`.
Keep all other functions.

**`<acceptance_criteria>`**
- `adminActions.ts` does NOT contain `dispatchOrder` or `updateDispatchDetails`.
- `adminActions.ts` still exports `updateOrderStatus`.

---

## Task 1.5: Remove Dispatch Imports from Admin Dashboard (Immediate)

**`<read_first>`**
- `src/components/admin/OrdersDashboardClient.tsx`

**`<action>`**
In `src/components/admin/OrdersDashboardClient.tsx`:
1. Remove `dispatchOrder` and `updateDispatchDetails` from the import on line 6.
2. Remove `handleDispatch` and `handleUpdateDispatchDetails` functions.
3. Remove `riderPhone`, `trackingUrl` state, inputs, and buttons from `OrderRow`.
4. Remove WhatsApp link and Copy link buttons.
5. For `order_status === 'ready'`, replace dispatch UI with text: "Waiting for rider assignment..."
6. For `order_status === 'out_for_delivery'`, show read-only "Rider assigned" text.
7. Remove `isDispatched` prop from `OrderRow`.
8. Remove `generateWhatsAppLink` helper if unused.

**`<acceptance_criteria>`**
- `OrdersDashboardClient.tsx` does NOT import `dispatchOrder` or `updateDispatchDetails`.
- No `<input>` fields for rider phone or tracking URL.
- No "Dispatch" button.
- "Waiting for rider assignment..." visible for `ready` orders.
- `npm run build` exits 0.
