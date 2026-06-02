# Phase 4: Delivery & Rider System — Context

**Gathered:** 2026-05-09
**Status:** Ready for planning
**Source:** Direct user requirements + codebase analysis

## Phase Boundary

Rebuild the rider system from manual admin dispatch to an automated FCFS (first-click-first-served) assignment model. Add Google Maps distance/ETA, rider earnings calculation, and real live-location customer tracking. Remove manual dispatch from staff dashboard.

## Implementation Decisions

### Order Lifecycle & Status Flow
- `placed` → `preparing` (staff clicks "Start Cooking")
- `preparing` → `ready` (staff clicks "Mark Ready")
- `ready` → rider accepts (sets `rider_id`, keeps status as `ready`)
- `ready` + rider_id → rider clicks "Start Riding" → `out_for_delivery`
- `out_for_delivery` → rider clicks "Delivered" → `delivered`
- Customer UI shows "Cooking" until rider clicks "Start Riding", then shows "On the Way"

### FCFS Dispatch (Fully Automated)
- No manual rider assignment by staff. System handles everything.
- Riders who are online AND have no active order receive broadcast notifications.
- Broadcast triggers on ANY order where `rider_id IS NULL` and `order_status IN ('preparing', 'ready')`.
- First rider to click Accept wins (atomic `.is('rider_id', null)` update).
- When rider marks delivered, immediately check for pending orders. If any, show broadcast to that rider.

### Google Maps Integration
- Use Google Maps Distance Matrix API server-side to calculate restaurant-to-customer distance.
- Distance stored in `orders.distance_km` once per order (calculated when rider accepts).
- ETA shown to customer uses this distance: `prepTime + (distanceKm / speed) * 60`.
- Live tracking uses Google Maps Embed iframe (`/embed/v1/directions`) with rider's current location as origin and customer location as destination. Iframe src updates every time rider location changes.
- All distance calculation uses Google Maps Routes API (road distance).

### Rider Earnings
- Formula per order: `(distance_km × ₹10) + ₹500`
- Distance is restaurant-to-customer only (one way).
- Earning stored in `orders.rider_earning`.
- Rider dashboard shows: today's earnings, today's deliveries, today's distance.
- Also show total lifetime earnings and total deliveries.

### Timestamps
- Add `orders.rider_started_at` (when "Start Riding" clicked).
- `orders.delivered_at` already exists; ensure it's set.
- Customer never clicks or marks anything as delivered.

### Broadcast UI (Rider)
- Show real distance and earning estimate in broadcast popup.
- Remove hardcoded "~2.4 km".

### Customer Tracking UI
- Remove "I got my food (Mark Delivered)" button entirely.
- Simplify step tracker: all pre-delivery statuses show "Cooking".
- When `out_for_delivery`, show Google Maps embed with live rider location.
- Show ETA minutes based on stored distance.

### Admin Dashboard
- Remove `dispatchOrder` and `updateDispatchDetails` functions.
- Remove rider phone input, tracking URL input, WhatsApp dispatch button from orders UI.
- Staff only marks `placed` → `preparing` → `ready`. After that, system takes over.

### Database Schema Changes
**`orders` table:**
- `distance_km NUMERIC(10,2)`
- `rider_earning NUMERIC(10,2)`
- `rider_started_at TIMESTAMPTZ`

**`riders` table:**
- `total_deliveries INTEGER DEFAULT 0`
- `total_earnings NUMERIC(10,2) DEFAULT 0`

## Canonical References

### Architecture
- `.planning/codebase/ARCHITECTURE.md` — Supabase dual-client rule, auth modes
- `.planning/codebase/CONCERNS.md` — Known risks

### Key Files
- `src/app/actions/riderActions.ts` — rider server actions
- `src/app/actions/adminActions.ts` — admin server actions (remove dispatch)
- `src/app/rider/dashboard/page.tsx` — rider dashboard UI
- `src/components/rider/OrderBroadcast.tsx` — broadcast popup
- `src/components/OrderTracker.tsx` — customer tracking
- `src/components/admin/OrdersDashboardClient.tsx` — admin order UI
- `src/lib/distance.ts` — distance/ETA logic
- `src/types/database.types.ts` — Supabase types

## Specific Ideas

- Google Maps Embed iframe is MVP-friendly: no npm package, free tier, real interactive map.
- Rider must keep dashboard open for GPS streaming. If they close the tab, location stops updating. This is acceptable for MVP (3-4 riders). Native app will solve background tracking later.
- If Google Maps API key is missing, fallback: no distance/ETA shown, earning shows flat ₹500 only.

## Deferred Ideas

- Native mobile app with background GPS tracking.
- Real-time remaining distance calculation (requires Directions API with waypoints).
- Batched order assignment (one rider takes multiple orders).
- Automated "Mark Ready" after 20 minutes (staff still manually clicks for now).
