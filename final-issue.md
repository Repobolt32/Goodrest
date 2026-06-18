# Consolidated Business Logic & Security Vulnerability Audit

This document combines the findings from both agent audits, focusing on critical business logic, security bypasses, and state machine flaws.

## 📝 Strategic Decisions
- **COD Deprecation:** As discussed, Cash on Delivery (COD) was for testing and will be entirely removed. Razorpay will be the exclusive payment method. Any tracking/state issues exclusively related to COD are resolved by completely removing COD support from `orderActions.ts` and the frontend.

---

## 🔴 CRITICAL - Security, Auth & Money Loss

### 1. Admin JWT Verification Bypass
**File:** `src/lib/auth.ts`
**Issue:** `verifyAdminSession` verifies the JWT signature but never actually checks if the role inside the token is admin. It casts it blindly: `role: payload.role as 'admin'`. A valid customer or rider token could potentially access admin routes.
**Fix:** Explicitly assert `if (payload.role !== 'admin') throw Error`.

### 2. Free Delivery Exploit via Missing Coordinates
**File:** `src/app/actions/orderActions.ts`
**Issue:** `lat` and `lng` are optional in `OrderInput`. If stripped from the request, `deliveryFee` stays `0` and is bypassed completely, even while a valid `delivery_address` string is provided.
**Fix:** Enforce `lat` and `lng` as required fields before creating the order.

### 3. Missing `is_available` Check (Ordering Out-of-Stock Items)
**File:** `src/app/actions/orderActions.ts`
**Issue:** `createOrder` fetches item prices from the DB but never checks `is_available`. A customer with stale cache or a crafted API request can order disabled items.
**Fix:** Add `.eq('is_available', true)` to the `menu_items` query.

### 4. Unauthorized Public Data Leaks (Riders & Customers)
**Files:** `src/app/actions/riderActions.ts`, `src/app/actions/trackActions.ts`
**Issue:** Several server actions completely lack `verifyRiderSession()` or `verifyCustomerSession()`.
- `getRiderByPhone`: Leaks the rider's `password_hash` to anyone.
- `getUnassignedOrders`: Leaks customer names, phone numbers, and addresses.
- `getOrdersByPhone`: Allows anyone to query the order history of any phone number.
- `getRiderLocationForOrder`: Allows anyone with an order ID to track a rider's GPS location.
**Fix:** Add strict session verification and assert IDs/phone numbers match the logged-in session.

### 5. Webhook State Machine Lock (Customer Charged but Ignored)
**File:** `src/app/api/webhook/razorpay/route.ts` & `verifyPaymentSignature`
**Issue:** If a customer's payment fails, the webhook sets `payment_status = 'failed'`. If they retry and succeed, the success webhook fails to update the order because it rigidly expects `.eq('payment_status', 'pending')`. The customer is charged, but the order stays failed.
**Fix:** Change the update query to allow `.in('payment_status', ['pending', 'failed'])`.

---

## 🟠 HIGH - Business Logic & State Machine Flaws

### 6. Deactivated Riders Can Still Accept Orders
**File:** `src/app/actions/riderActions.ts`
**Issue:** `verifyRiderExists` only checks if the rider ID exists. If an owner deactivates/fires a rider, but the rider still has an unexpired JWT cookie, they can continue accepting and picking up orders.
**Fix:** Add `.eq('is_active', true)` to `verifyRiderExists`.

### 7. Cancelled Orders Revived by Late Webhooks
**File:** `src/app/api/webhook/razorpay/route.ts`
**Issue:** A customer cancels a pending order. A delayed Razorpay webhook (or a user completing an open tab) arrives and sets `order_status = 'confirmed'`, reviving a cancelled order.
**Fix:** The webhook must add `.neq('order_status', 'cancelled')` before applying the success state.

### 8. `maybeSingle()` Crash on Batched Orders
**File:** `src/app/actions/riderActions.ts`
**Issue:** `getRiderActiveOrder` uses `.maybeSingle()`. Since riders can accept up to 2 orders (batching), this query throws an error when a rider has 2 active orders, causing the app to silently fail and show "No active orders."
**Fix:** Change to `.select().limit(2)` and handle returning an array of active orders.

### 9. Rider Pay Deduction Race Condition (Batching)
**File:** `src/app/actions/riderActions.ts`
**Issue:** When a rider accepts a 2nd order, it retroactively reduces the pay of their 1st order. It updates the 1st order blindly, even if the 1st order was already delivered a millisecond ago.
**Fix:** Ensure the 1st order is still `.in('order_status', ['preparing', 'ready'])` before modifying its earnings.

### 10. Admin `updateOrderStatus` Bypasses Side-Effects
**File:** `src/app/actions/adminActions.ts`
**Issue:** If an admin cancels an order using the generic status dropdown, it just changes the string to `cancelled`. It does *not* refund the customer, unassign the rider, or log the cancellation reason.
**Fix:** Admin cancellation needs a dedicated flow that handles refunds and rider unassignment.

### 11. Refund Initiated on `total_amount` instead of Captured Amount
**File:** `src/app/actions/ownerActions.ts`
**Issue:** The refund uses the DB's `total_amount`. If the admin modified the order or if there were discrepancies, Razorpay will reject the refund because it exceeds the captured amount.
**Fix:** Fetch the actual captured amount from the Razorpay API before initiating the refund.

### 12. Double Settlement Race Condition
**File:** `src/app/actions/settlementActions.ts`
**Issue:** Rider payouts are recorded using a read-modify-write without atomic locking (`const newTotal = oldTotal + added; update({ total_settled: newTotal })`). A double-click pays the rider twice but only increments the balance once.
**Fix:** Use an RPC for atomic increment, or handle the constraint violation cleanly.

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
