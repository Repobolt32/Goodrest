# Consolidated Business Logic & Security Vulnerability Audit

This document combines the findings from both agent audits, focusing on critical business logic, security bypasses, and state machine flaws.

## 📝 Strategic Decisions
- **COD Deprecation:** As discussed, Cash on Delivery (COD) was for testing and will be entirely removed. Razorpay will be the exclusive payment method. Any tracking/state issues exclusively related to COD are resolved by completely removing COD support from `orderActions.ts` and the frontend.

---



## 🟡 MEDIUM - Gaps & Accounting Inaccuracies

### 13. `dispatchOrder` Doesn't Transition Order Status
**File:** `src/app/actions/ownerActions.ts`
**Issue:** `dispatchOrder` sets `manual_dispatch: true` but leaves the order in `ready` status. The tracking page doesn't show "dispatched" until the rider remembers to hit "Start Riding".
**Fix:** Either auto-transition to `out_for_delivery` or add a `dispatched` state.

### 14. Report Revenue Inflated by Delivery Fees
**File:** `src/app/actions/reportActions.ts`
**Issue:** Owner revenue reports use `total_amount` (which includes delivery fees paid by the customer). This inflates the gross revenue, as the delivery fee is pass-through money meant for the rider.
**Fix:** Deduct `delivery_fee` from the reported Net Revenue.

### 15. Conflicting Active Offers & Missing Validation
**File:** `src/app/actions/offerActions.ts`
**Issue:** 
- The owner can create multiple overlapping discount offers. `.find()` just picks the first one silently.
- `updateOffer` fails to re-validate the config if the admin only updates the `type` or the `config` independently.
**Fix:** Warn admins of active offer overlaps; strictly validate updates.

### 16. Customers Can Cancel `preparing` Orders
**File:** `src/app/actions/orderActions.ts`
**Issue:** Cancellations are only blocked for `out_for_delivery` and `delivered`. Customers can cancel while food is already cooking, wasting food.
**Fix:** Block customer cancellations once status moves to `preparing`.

### 17. Settlement Ignores Active In-Flight Orders
**File:** `src/app/actions/settlementActions.ts`
**Issue:** An owner can click "Settle" while a rider is mid-delivery. The payout will miss the active order, creating accounting drift.
**Fix:** Block settlement for the current week if the rider has active orders.

### 18. `deleteOrder` Ignores Order Status
**File:** `src/app/actions/adminActions.ts`
**Issue:** An admin can soft-delete an active (`preparing` or `out_for_delivery`) order. The rider will still see it but operations on it will fail.
**Fix:** Only allow deletion of `delivered` or `cancelled` orders.

### 19. `getRestaurantSettings` Masks DB Outages
**File:** `src/app/actions/ownerActions.ts`
**Issue:** If the DB query fails, it returns a hardcoded `{ online_status: true }`. If Supabase is down, the frontend stays open, accepting orders that inevitably crash.
**Fix:** Return an error on failure, and let the frontend default to offline.
