# Remaining Testing Phases Plan

> **MANDATORY:** Write tests ONLY. Never modify `src/` code. If a test reveals a bug, report it and move on. The goal is a bug report, not bug fixes.

**Current state:** 384/384 tests passing (Phases 1, 3, 4 complete)

**Goal:** Complete Phase 5 (Rider System), Phase 6 (Database Integrity), Phase 7 (Build & Deploy) — producing a detailed findings report.

---

## Phase 5: Rider System — 7 Untested Functions

### Phase 5.1: `sendHelpMessage` (orderActions.ts)

**File:** `src/tests/unit/actions/orderLifecycle.test.ts` (add to existing file)

- [ ] **Step 1:** Write tests for `sendHelpMessage`:
  - should save help message on cancelled order
  - should reject if order not found
  - should reject if order is not cancelled (must be cancelled first)
  - should reject if customer phone doesn't match
  - should reject if message is empty
- [ ] **Step 2:** Run `npx vitest run src/tests/unit/actions/orderLifecycle.test.ts` — record results
- [ ] **Step 3:** Report any failures

### Phase 5.2: `getRiderEarningHistory` (riderActions.ts)

**File:** `src/tests/unit/actions/riderActions.test.ts` (add to existing file)

- [ ] **Step 1:** Write tests for `getRiderEarningHistory`:
  - should return weekly data grouped by IST day
  - should return empty week for rider with no deliveries
  - should handle invalid rider ID gracefully
  - should calculate nightly bonus per day correctly
  - should aggregate week totals (deliveries, earnings, bonus)
- [ ] **Step 2:** Run `npx vitest run src/tests/unit/actions/riderActions.test.ts` — record results
- [ ] **Step 3:** Report any failures

### Phase 5.3: `initiateRefund` (ownerActions.ts)

**File:** `src/tests/unit/actions/ownerActions.test.ts` (add to existing file)

- [ ] **Step 1:** Write tests for `initiateRefund`:
  - should initiate refund for cancelled order
  - should reject if not admin
  - should reject if order not found
  - should reject if order not cancelled
  - should reject if refund already pending/refunded (atomic claim)
  - should handle Razorpay API failure gracefully
  - should handle DB update failure after Razorpay success
- [ ] **Step 2:** Run `npx vitest run src/tests/unit/actions/ownerActions.test.ts` — record results
- [ ] **Step 3:** Report any failures

### Phase 5.4: `getRestaurantSettings` (ownerActions.ts)

**File:** `src/tests/unit/actions/ownerActions.test.ts` (add to existing file)

- [ ] **Step 1:** Write tests for `getRestaurantSettings`:
  - should return settings from DB
  - should return defaults when no settings exist
- [ ] **Step 2:** Run tests — record results

### Phase 5.5: `updatePrepTime` (ownerActions.ts)

**File:** `src/tests/unit/actions/ownerActions.test.ts` (add to existing file)

- [ ] **Step 1:** Write tests for `updatePrepTime`:
  - should update prep time as admin
  - should reject if not admin
  - should reject invalid prep time values
- [ ] **Step 2:** Run tests — record results

### Phase 5.6: `getOrdersForOwner` (ownerActions.ts)

**File:** `src/tests/unit/actions/ownerActions.test.ts` (add to existing file)

- [ ] **Step 1:** Write tests for `getOrdersForOwner`:
  - should return all orders without filter
  - should filter by status
  - should return empty array on error
- [ ] **Step 2:** Run tests — record results

### Phase 5.7: `getConfirmedOrders` (ownerActions.ts)

**File:** `src/tests/unit/actions/ownerActions.test.ts` (add to existing file)

- [ ] **Step 1:** Write tests for `getConfirmedOrders`:
  - should return confirmed orders within 30s grace period
  - should exclude orders past grace period
  - should return empty on error
- [ ] **Step 2:** Run tests — record results

---

## Phase 6: Database Integrity — RBAC Guards & Edge Cases

### Phase 6.1: Auth guard coverage across ALL action files

For each action that requires admin auth, verify the test covers the "not admin" rejection:

- [ ] **Step 1:** Audit existing tests for auth guard coverage:
  - `ownerActions.ts`: `toggleOnlineStatus`, `acceptOrder`, `markFoodReady`, `dispatchOrder`, `initiateRefund`, `updatePrepTime`, `getOrdersForOwner`, `getConfirmedOrders`
  - `adminActions.ts`: all 10 functions
  - `orderActions.ts`: `updateRefundStatus`
- [ ] **Step 2:** For any missing auth guard tests, add them
- [ ] **Step 3:** Run full suite — record results

### Phase 6.2: Input validation edge cases

- [ ] **Step 1:** Test UUID validation across all actions that take ID params:
  - Verify `isValidUUID` rejection for non-UUID inputs
  - Test empty string, null, undefined inputs
- [ ] **Step 2:** Run full suite — record results

### Phase 6.3: Error propagation

- [ ] **Step 1:** For key actions, test that Supabase errors propagate correctly:
  - `createOrder` — RPC failure
  - `acceptOrder` (rider) — FCFS race condition
  - `cancelOrder` — concurrent cancel attempt
- [ ] **Step 2:** Run full suite — record results

---

## Phase 7: Build & Deploy Verification

- [ ] **Step 1:** Run `npx vitest run` — full test suite, record pass/fail count
- [ ] **Step 2:** Run `npm run lint` — record any lint errors
- [ ] **Step 3:** Run `npm run build` — record build success/failure
- [ ] **Step 4:** Generate final summary report

---

## Deliverable: Test Report

After all phases, produce a report with:
1. **Test count** — new tests added, total suite count
2. **Bugs found** — any source code bugs discovered during testing (with file:line)
3. **Coverage gaps** — any remaining untested areas
4. **Build status** — lint + build results
5. **Recommendations** — what to fix before deploy
