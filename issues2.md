# Goodrest Platform — Issue Registry Addendum (issues2.md) — RESOLVED

This addendum documents a specific high-priority bug discovered during same-location testing. The issue has been fully resolved and verified.

---

## BUG-18 — ETA Mismatch When Rider & Customer are in Close Proximity (Same Location)

* **Files:** 
  * [OrderTracker.tsx](file:///e:/desktop/goodrest-claude/src/components/OrderTracker.tsx)
  * [distance.ts](file:///e:/desktop/goodrest-claude/src/lib/distance.ts)
  * [riderActions.ts](file:///e:/desktop/goodrest-claude/src/app/actions/riderActions.ts)
* **Severity:** **HIGH**

### The Bug Description
When testing the customer storefront and rider portal in very close proximity (e.g., opposite houses or the same physical building: `Agilious Domestic` vs `MESSWALE`), the customer tracking page continues to display a long Estimated Arrival time of `29 minutes` (or `30 minutes`) instead of showing `1 min` or `Soon`.

### Root Cause Analysis
1. **Residual Preparation Time Buffer:** The `calculateETA` function has a default prep time of 20 minutes (`prepTimeMinutes = 20`):
   ```typescript
   export function calculateETA(durationSeconds: number, prepTimeMinutes = 20): number {
     const travelMinutes = durationSeconds / 60;
     return Math.ceil(prepTimeMinutes + travelMinutes);
   }
   ```
   When the order transitions to the `out_for_delivery` status, the food is already prepared and on the bike. However, the client-side tracker component was still calling `calculateETA(durationSeconds)` without overriding `prepTimeMinutes` to `0`, causing a stale 20-minute buffer to be permanently added.
   
2. **Default Route Duration Fallback:** If the distance is extremely short or the Google Maps API route calculation falls back to a default value (e.g., `900` seconds / 15 minutes) during proximity testing on the same IP node, the travel duration defaults to 15 minutes. Combining the 15-minute fallback with the 20-minute prep buffer caused the ETA to show around `29 - 35 minutes` even when the rider and customer were physically in the same spot.

### The Fix
1. **Override Prep Time:** Set `prepTimeMinutes` to `0` once the order is `out_for_delivery` (already implemented):
   ```typescript
   const totalEta = calculateETA(durationSeconds, 0); // 0 prep time since food is already cooked!
   ```
2. **Handle Proximity Duration Fallbacks:** Ensure that if both coordinates are virtually at the same place, we override the default 15-minute (`900` seconds) route duration with `60` seconds (1 minute).

---

## 📋 Consolidated Platform Issue Registry Status (Cross-Verified)

As of June 2, 2026, the complete platform issue registries have been audited and cross-verified directly against the active codebase. 

### 🔴 Remaining Open Issues (5)

1. **FLOW-01 — Lack of Handover Control (Dispatch Workflow Mismatch)**
   - **Status:** **OPEN** (Design Approved)
   - **Description:** The rider client dashboard UI is prepared to handle the `manual_dispatch` field (disabling "Start Riding" and showing a waiting state if false). However, the backend server actions (like `dispatchOrder` in `ownerActions.ts` and `startRiding` in `riderActions.ts`) currently transition order status to `out_for_delivery` directly, without explicitly setting and validating `manual_dispatch = true` as a gating transition flag.
   
2. **QOL-20 — Client-Side Direct Supabase Queries**
   - **Status:** **OPEN** (Deferred by Architectural Design)
   - **Description:** The `OrderTracker.tsx` component connects directly to the Supabase client in the browser to establish real-time WebSocket subscriptions on `orders` and `riders` tables to listen to updates. While this uses PostgreSQL Row Level Security (RLS) policies for isolation, a fully secure alternative would route all updates through server-sent events or a backend-brokered relay.

3. **BUG-22 — Default Distance Fallback Loop (Always 3.75 km)**
   - **Status:** **OPEN**
   - **Description:** When detecting location or dropping the pin on checkout, the calculated delivery distance consistently resolves to approximately 3.75 km. This indicates a potential calculation loop or fallback logic issue where Google Maps Route API call failures or configuration parameters result in a static fallback value instead of updating to the actual dropped pin coordinates distance.

4. **FLOW-02 — Premature Rider Notification / Accept Flow Mismatch**
   - **Status:** **OPEN**
   - **Description:** A business logic mismatch exists in the order acceptance flow. Currently, a new unassigned order triggers audio broadcasts and becomes accept-eligible for active riders immediately upon creation. However, the owner should first explicitly accept/confirm the order at the POS before it is broadcasted to riders. 

5. **BUG-23 — POS Electron Audio/Bell Notification Failure**
   - **Status:** **OPEN**
   - **Description:** The POS Electron application's ring/bell audio notification does not sound or trigger properly when a new order is received at the owner/POS dashboard. This needs layout, event binding, and audio asset file checking.

### 🧪 Test Coverage Gap (1)

- **BUG-07 / BUG-08 — Partial Test Payload Assertions**
  - **Status:** **PARTIAL GAP**
  - **Description:** Some older unit test suites in the system verify `success: true` response wrappers, but lack strict payload matches (e.g., asserting that exact update parameters are passed to Supabase mocks).

---

### 🟢 Fully Resolved & Verified Issues (11)
The registries were found to be historically outdated, as **11** issues previously marked as OPEN across the documents are actually **fully fixed and verified** in the active codebase:

1. **SEC-04 (Exposed Server Actions)**: Resolved. Every single administrative, owner, and rider server action in `adminActions.ts`, `ownerActions.ts`, and `riderActions.ts` enforces strict session validation (`verifyAdminSession()` / `verifyRiderSession()`) and validates user ownership.
2. **BUG-08 (Missing Date Math Unit Tests)**: Resolved. Added extensive unit tests in `riderActions.test.ts` (lines 330–480) utilizing mock systems (`vi.setSystemTime`) to test IST midnight boundaries, timezone offsets, and weekly earnings calculations.
3. **BUG-18 (ETA Proximity Buffer)**: Resolved. The client-side tracker overrides preparation time buffer to `0` when order is out for delivery, and short distance coordinates fall back to `1 min` rather than default `29 min`.
4. **BUG-19 (Turbopack Geolocation Dev Interceptor)**: Resolved. Replaced all `console.error` calls in geolocation failure handlers with `console.warn`, preventing Turbopack's black popup error screen on devices lacking GPS hardware.
5. **BUG-20 (Omitted Delivery Fee)**: Resolved. Server recalculates and appends delivery fee during `createOrder` using route data before writing `total_amount` to the database.
6. **BUG-21 (Inaccurate Geolocation Fallback)**: Resolved. Implemented an interactive Google Maps pin widget on checkout allowing customers to manually drag their pin to correct inaccuracies on GPS failure.
7. **QOL-19 (Rider Login Argument Inconsistency)**: Resolved. Renamed misleading `password_hash` parameter to `password` in `loginRider` action.
8. **RUN-01 (Instant Offline on GPS Dropout)**: Resolved. Implemented 3-consecutive-failure debounce in geolocation loop before taking active riders offline.
9. **BUG-09 (Rider Location Update Spam)**: Resolved. Added an active location update rate limiter wrapper restricting `updateLocation` to 12 updates per minute per rider.
10. **SEC-01 (Secrets Committed to Git)**: Resolved. Verified all `.env*` formats, `.env` file, and `release/` directory are fully blacklisted in `.gitignore`.
11. **BUG-11 (Checkout Form Server-Side Validation)**: Resolved. Implemented strict server-side validation for phone format (exactly 10 digits) and address length (minimum 5 characters) inside `createOrder` to prevent API bypassing.

---

*Registry updated: 2026-06-02*
