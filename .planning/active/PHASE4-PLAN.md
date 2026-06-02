# Phase 4: Order Lifecycle State Machine Tests

## Goal
Write 16 tests covering order state transitions (`placed` → `confirmed` → `preparing` → `ready` → `out_for_delivery` → `delivered`).

## Order States
```
placed → confirmed → preparing → ready → out_for_delivery → delivered
   ↓         ↓          ↓         ↓            ↓
cancelled  cancelled  cancelled  cancelled   cancelled
```

## Functions to Test

### 1. `markPreparing` (ownerActions)
Transitions: `confirmed` → `preparing`

### 2. `markReady` (ownerActions)
Transitions: `preparing` → `ready`

### 3. `assignRider` (riderActions)
Transitions: `ready` → `out_for_delivery`

### 4. `markDelivered` (riderActions)
Transitions: `out_for_delivery` → `delivered`

### 5. `cancelOrder` (orderActions)
Transitions valid states → `cancelled` (with proper guards)

---

## Test Cases (16 tests)

### cancelOrder transitions (4 tests)

| # | Test | From State | Expected |
|---|------|------------|----------|
| 1 | should allow cancel from `placed` | placed | → cancelled |
| 2 | should allow cancel from `confirmed` | confirmed | → cancelled |
| 3 | should allow cancel from `preparing` | preparing | → cancelled |
| 4 | should reject cancel from `out_for_delivery` | out_for_delivery | → error |
| 5 | should reject cancel from `delivered` | delivered | → error |
| 6 | should reject cancel from `cancelled` (idempotent) | cancelled | → success (no-op) |

### markPreparing transitions (2 tests)

| # | Test | From State | Expected |
|---|------|------------|----------|
| 7 | should transition confirmed → preparing | confirmed | → preparing |
| 8 | should reject if not confirmed | placed | → error |

### markReady transitions (2 tests)

| # | Test | From State | Expected |
|---|------|------------|----------|
| 9 | should transition preparing → ready | preparing | → ready |
| 10 | should reject if not preparing | confirmed | → error |

### assignRider transitions (2 tests)

| # | Test | From State | Expected |
|---|------|------------|----------|
| 11 | should transition ready → out_for_delivery | ready | → out_for_delivery |
| 12 | should reject if not ready | preparing | → error |

### markDelivered transitions (2 tests)

| # | Test | From State | Expected |
|---|------|------------|----------|
| 13 | should transition out_for_delivery → delivered | out_for_delivery | → delivered |
| 14 | should reject if not out_for_delivery | ready | → error |

### Edge cases (2 tests)

| # | Test | Scenario | Expected |
|---|------|----------|----------|
| 15 | should allow cancel with reason and phone verification | any cancellable | → cancelled with reason saved |
| 16 | should preserve rider_earning on transition | out_for_delivery → delivered | → earning preserved |

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/tests/unit/actions/orderLifecycle.test.ts` | Create (cancelOrder state tests) |
| `src/tests/unit/actions/ownerActions.test.ts` | Extend (markPreparing, markReady) |
| `src/tests/unit/actions/riderActions.test.ts` | Extend (assignRider, markDelivered) |

---

## Dependencies
- Existing: `cancelOrder` (orderActions.ts), `markPreparing/markReady` (ownerActions.ts), `assignRider/markDelivered` (riderActions.ts)
- All functions already exist and are called by admin/rider dashboards
- No new functions needed

---

## Verification

```bash
npx vitest run src/tests/unit/actions/orderLifecycle.test.ts
npx vitest run src/tests/unit/actions/ownerActions.test.ts
npx vitest run src/tests/unit/actions/riderActions.test.ts
# Target: ALL PASS
```

---

## Notes

- Tests must mock `supabaseAdmin.from().select().eq().single()` for order lookups
- Tests must verify `order_status` in the update payload
- Tests should verify phone authorization for cancelOrder
- Rider earning preservation: verify `rider_earning` is NOT overwritten during delivery transition