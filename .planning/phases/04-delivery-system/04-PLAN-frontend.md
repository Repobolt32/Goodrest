---
phase: "04"
name: "Delivery & Rider System — Frontend & Tests"
autonomous: true
wave: 2
requirements_addressed:
  - DELI-02
  - DELI-03
  - DELI-04
  - DELI-05
nd_on: []
---

# Plan: Phase 4 — Waves 2-4: Rider Dashboard, Customer Tracking, Tests

## must_haves

1. Rider dashboard shows real stats (today's earnings, deliveries, distance) from DB queries.
2. Rider sees "Start Riding" button after accepting; customer tracker stays on "Cooking".
3. After "Start Riding", customer tracker shows "On the Way" + live map iframe.
4. OrderBroadcast only shows to riders who have no active order.
5. Customer cannot self-mark as delivered.
6. E2E test passes with new FCFS + Start Riding flow.

## verification

- [ ] Rider dashboard renders real stats (not hardcoded 0).
- [ ] Customer tracker shows "Cooking" until `out_for_delivery`, then "On the Way".
- [ ] Live map iframe renders when `out_for_delivery`.
- [ ] E2E test `tests/rider-journey.spec.ts` passes.

---

## Task 2.1: Rewrite Rider Dashboard

**`<read_first>`**
- `src/app/rider/dashboard/page.tsx`
- `src/app/actions/riderActions.ts`
- `src/components/rider/OrderBroadcast.tsx`

**`<action>`**
Rewrite `src/app/rider/dashboard/page.tsx`:

1. State: `rider`, `isOnline`, `activeOrder`, `stats`, `showBroadcast`, `broadcastOrder`.
2. On mount:
   - Load `rider_session` from localStorage; redirect to `/rider/login` if missing.
   - Call `getRiderStats(rider.id)` → set `stats`.
   - Call `getRiderActiveOrder(rider.id)` → set `activeOrder`.
3. Subscribe to Supabase realtime on `orders` table filtered by `rider_id=eq.${rider.id}`.
   - On UPDATE: refresh `activeOrder` and `stats`.
   - If new status is `delivered`: clear `activeOrder`, then call `getUnassignedOrders()`. If array has items, set `broadcastOrder = items[0]` and `showBroadcast = true`.
4. When `isOnline` changes to true:
   - Start `navigator.geolocation.watchPosition(...)` streaming to `updateLocation()`.
   - Add `error` callback that sets `geoError` state and shows a toast/alert:
     ```ts
     navigator.geolocation.watchPosition(
       (pos) => updateLocation(rider.id, pos.coords.latitude, pos.coords.longitude),
       (err) => {
         console.error('Geolocation error:', err);
         setGeoError(err.message || 'Location access denied. Enable GPS to go online.');
         setIsOnline(false);
       },
       { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
     );
     ```
5. Stats grid (top):
   - Today's Earnings: `₹{stats.todayEarnings || 0}`
   - Today's Orders: `{stats.todayDeliveries || 0}`
   - Today's Distance: `{stats.todayDistanceKm || 0} km`
6. Active Order Card (middle):
   - If `activeOrder` exists:
     - Show order ID, customer name, address.
     - Show "You will earn ₹{activeOrder.rider_earning || 0}".
     - Show "Distance: {activeOrder.distance_km || 0} km".
     - If `activeOrder.order_status` is `ready` or `preparing`:
       - Show "Start Riding" button. On click → call `startRiding(activeOrder.id, rider.id)`.
     - If `activeOrder.order_status` is `out_for_delivery`:
       - Show "Navigate" button (link to Google Maps directions).
       - Show "Delivered" button. On click → call `markOrderAsDeliveredRider(activeOrder.id, rider.id)`.
7. Bottom fixed button: "Go Online" / "Go Offline" toggle.
8. Mount `<OrderBroadcast riderId={rider.id} hasActiveOrder={!!activeOrder} onAccept={() => refreshActiveOrder()} />`.

**`<acceptance_criteria>`**
- Dashboard renders `getRiderStats` values (not hardcoded 0).
- "Start Riding" button is visible when `order_status` is `ready` or `preparing`.
- "Navigate" + "Delivered" buttons visible when `order_status` is `out_for_delivery`.
- After marking delivered, if unassigned orders exist, broadcast popup appears automatically.
- Geolocation error callback exists and sets `geoError` state; rider sees clear message when GPS is denied.

---

## Task 2.2: Update OrderBroadcast Component

**`<read_first>`**
- `src/components/rider/OrderBroadcast.tsx`

**`<action>`**
Rewrite `OrderBroadcast.tsx`:

1. Props: `{ riderId: string; hasActiveOrder: boolean; onAccept?: () => void }`
2. If `hasActiveOrder` is true, return `null` (no broadcast while busy).
3. Subscribe to `postgres_changes` on `orders` table with filter `rider_id=eq.null` if Supabase supports it. If not, subscribe broadly and filter client-side.
4. Client-side filter:
   ```ts
   if (payload.new.rider_id === null && ['preparing','ready'].includes(payload.new.order_status)) {
     setBroadcastOrder(payload.new);
   }
   ```
5. Popup UI:
   - "New Delivery!"
   - Distance: "{broadcastOrder.distance_km || '?'} km"
   - Earning: "Earn ₹{broadcastOrder.rider_earning || 500}"
   - Accept / Reject buttons.
6. `handleAccept`:
   - Call `acceptOrder(broadcastOrder.id, riderId)`.
   - If success: close popup, stop audio, call `onAccept()`.
   - If error: show message, close popup.

**`<acceptance_criteria>`**
- Component returns `null` when `hasActiveOrder` is true.
- Broadcast subscribes to `orders` table.
- Client-side filter checks `rider_id === null && order_status IN ('preparing','ready')`.
- Popup shows real `distance_km` and `rider_earning`.
- Does NOT show hardcoded "~2.4 km".

---

## Task 3.1: Rewrite OrderTracker

**`<read_first>`**
- `src/components/OrderTracker.tsx`
- `src/lib/distance.ts`

**`<action>`**
Rewrite `src/components/OrderTracker.tsx`:

1. Props: add `distanceKm?: number | null`, `riderStartedAt?: string | null`.
2. Remove `markOrderAsDeliveredCustomer` import and the "I got my food" button entirely.
3. ETA calculation uses Google Maps distance. Specifically:
   - If `distanceKm` exists, compute `etaMins = calculateETA(distanceKm)`.
   - Show "ETA: {etaMins} mins" when status is `out_for_delivery`.
4. Status steps:
   - Step "placed" — completed if status exists.
   - Step "preparing" (label "Cooking") — active if status is `placed`, `preparing`, `ready`.
   - Step "out_for_delivery" (label "On the Way") — active only if status is `out_for_delivery`.
   - Step "delivered" — active only if status is `delivered`.
5. Live Map (when `status === 'out_for_delivery'`):
   - Subscribe to `riders` table filtered by `id=eq.${riderId}` via Supabase realtime.
   - Extract `current_location.lat`, `current_location.lng`.
   - Render iframe:
     ```html
     <iframe
       width="100%"
       height="300"
       style={{ border: 0 }}
       loading="lazy"
       allowFullScreen
       referrerPolicy="no-referrer-when-downgrade"
       src={`https://www.google.com/maps/embed/v1/directions?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&origin=${riderLat},${riderLng}&destination=${orderLat},${orderLng}&mode=driving`}
     />
     ```
   - **SECURITY NOTE:** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is exposed in client-side bundles. The Google Cloud Console MUST configure HTTP referrer restrictions to `*.yourdomain.com/*` (and `localhost:*/*` for dev) to prevent unauthorized usage.
   - Show text below map: "Rider is on the way" and `riderStartedAt` timestamp.
   - If `GOOGLE_MAPS_API_KEY` missing, show static text with external Google Maps link.
6. Remove "Track Rider Live" external button and "Call Rider" button (keep only if `rider_phone` exists).

**`<acceptance_criteria>`**
- `OrderTracker.tsx` does NOT import `markOrderAsDeliveredCustomer`.
- No "I got my food" button in the rendered output.
- Live map iframe uses `google.com/maps/embed/v1/directions`.
- Status step "Cooking" is active for `placed`, `preparing`, `ready`.
- Status step "On the Way" only active for `out_for_delivery`.
- `.env` documents `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` with a comment warning about referrer restrictions.
- `STACK.md` or setup docs include instructions to restrict the API key to the production domain.

---

## Task 3.2: Update Order Detail Page Props

**`<read_first>`**
- `src/app/track/order/[id]/page.tsx`

**`<action>`**
In `src/app/track/order/[id]/page.tsx`:
1. Pass `distanceKm={order.distance_km}` to `<OrderTracker>`.
2. Pass `riderStartedAt={order.rider_started_at}` to `<OrderTracker>`.
3. Remove any logic that calls `markOrderAsDeliveredCustomer`.

**`<acceptance_criteria>`**
- `page.tsx` passes `distanceKm` and `riderStartedAt` props to `OrderTracker`.
- `page.tsx` does NOT import or call `markOrderAsDeliveredCustomer`.

---

## Task 4.1: Update E2E Tests

**`<read_first>`**
- `tests/rider-journey.spec.ts`

**`<action>`**
Rewrite `tests/rider-journey.spec.ts`:

1. Keep rider login and "Go Online" steps.
2. Keep customer placing COD order.
3. Admin marks order as `preparing` then `ready` (no dispatch).
4. Rider sees broadcast popup → clicks Accept. **Use Playwright `waitFor` before asserting popup visibility** (Supabase realtime may have a small delay).
5. Rider sees "Start Riding" button → clicks it.
6. Verify customer page shows "On the Way".
7. Rider clicks "Delivered".
8. Verify rider dashboard stats show "Today's Orders: 1".
9. Verify customer page shows "Delivered".

Remove all steps that use admin dispatch (rider phone input, tracking URL, WhatsApp, etc.).

**`<acceptance_criteria>`**
- Test file does NOT fill admin rider phone or tracking URL inputs.
- Test file does NOT click a "Dispatch" button.
- Test file clicks "Start Riding" after accepting order.
- Test verifies "On the Way" appears on customer page after "Start Riding".
- Test passes with `npx playwright test tests/rider-journey.spec.ts`.

---

## Task 4.2: Build Verification

**`<read_first>`**
- `package.json`

**`<action>`**
Run:
```bash
npm run build
npm run lint
```
Fix any TypeScript errors from new database columns or removed functions.

**`<acceptance_criteria>`**
- `npm run build` exits 0.
- `npm run lint` exits 0.
