# Phase 4: Delivery & Rider System

**Goal**: Riders can view assigned orders, update delivery status, and provide live GPS tracking.

## Success Criteria
1. Staff can assign a specific rider to an order ready for delivery.
2. Rider can view their assigned orders on their mobile device and mark them as delivered.
3. System receives live GPS updates from the rider and calculates ETA for the customer.

## Wave 1: Rider Assignment & Dashboard API
- [ ] Implement `orderRouter.assignRider` mutation (Staff/Admin only).
- [ ] Implement `orderRouter.listRiderOrders` query (Rider only).
- [ ] Verify `riderId` is correctly persisted and enforced.

## Wave 2: Delivery Workflow
- [ ] Implement `orderRouter.updateDeliveryStatus` (Rider only).
- [ ] Enforce state machine transitions: `READY` -> `OUT_FOR_DELIVERY` -> `DELIVERED`.
- [ ] Add `deliveredAt` field to `Order` model in `schema.prisma`.

## Wave 3: GPS Tracking & ETA
- [ ] Implement `riderRouter.updateLocation` to store live GPS coordinates (Redis or In-Memory for speed, DB for persistence if needed).
- [ ] Implement `orderRouter.getTracking` for customers to view rider position and ETA.
- [ ] Add basic ETA calculation logic based on distance (Google Maps API placeholder).

## Technical Details
- **Assignment**: Only allowed when order status is `READY` or `CONFIRMED`.
- **Rider Auth**: Ensure `protectedProcedure` correctly identifies `Role.RIDER`.
- **GPS**: Store latest lat/lng in a new `RiderLocation` model or within the `User` model.
