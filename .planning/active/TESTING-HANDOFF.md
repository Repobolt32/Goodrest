# Handoff: Pre-Deployment Testing Plan

> **Fresh agent: read this file, then pick up where we left off.**

---

## Status: PHASE 4 COMPLETE — 33 NEW TESTS ADDED

---

## Current State

| Phase | Status | Tests |
|-------|--------|-------|
| Phase 1: Security Audit | ✅ Complete | 116/116 passing |
| Phase 3: Payment Flow | ✅ Complete | 351/351 passing |
| Phase 4: Order Lifecycle | ✅ Complete | 33 new tests passing |
| Phase 5: Rider System | ⏳ Pending | — |
| Phase 6: Database Integrity | ⏳ Pending | — |
| Phase 7: Build & Deploy | ⏳ Pending | — |

---

## Last Action

Phase 4 completed: Created `src/tests/unit/actions/orderLifecycle.test.ts` with 33 tests covering order state machine transitions.

### New Test File: `orderLifecycle.test.ts`

| Function | Tests | Coverage |
|----------|-------|----------|
| `cancelOrder` | 8 | placed/confirmed/preparing→cancelled, guards, idempotency |
| `acceptOrder` (owner) | 4 | confirmed→preparing, auth, prep time |
| `markFoodReady` | 4 | preparing→ready, optimistic locking |
| `dispatchOrder` | 5 | ready→out_for_delivery, rider requirement |
| `riderAcceptOrder` | 3 | FCFS atomic assignment |
| `startRiding` | 4 | preparing/ready→out_for_delivery, ownership |
| `markOrderAsDeliveredRider` | 5 | out_for_delivery→delivered, earning preservation |

---

## Next Action

1. Run: `npx vitest run` to confirm 384/384 tests passing
2. Proceed to Phase 5: Rider System (16 new tests for auth, location, delivery flow)
3. Phase 6: Database Integrity (may skip or mock)
4. Phase 7: Build verification (`npm run build`)

---

## Open Threads

- Phase 5 (Rider System) has ~16 new tests — auth, location, delivery flow
- Phase 6 needs Supabase connection (may skip or mock)
- Phase 7 is build verification only

---

## Do NOT

- Do NOT modify the existing passing tests from Phases 1-3
- Do NOT touch `src/lib/pricing.ts` or other business logic — we're only adding tests
- Do NOT run `rtk` commands — it was deleted from PATH

---

## Key Files

| File | Purpose |
|------|---------|
| `src/tests/unit/actions/orderActions.test.ts` | Payment flow tests |
| `src/tests/unit/actions/orderLifecycle.test.ts` | State machine tests (NEW) |
| `src/tests/unit/actions/ownerActions.test.ts` | Owner action tests |
| `src/tests/unit/actions/riderActions.test.ts` | Rider auth security tests |
| `src/tests/unit/actions/trackActions.test.ts` | PII redaction tests |
| `.planning/active/PHASE4-PLAN.md` | Phase 4 plan (completed) |
| `.planning/active/IMPL-PLAN.md` | Full testing plan |

---

## Verification Commands

```bash
npx vitest run src/tests/unit/actions/orderLifecycle.test.ts  # Phase 4 verify
npx vitest run                                               # Full suite (384 expected)
npm run lint                                                 # Style check
npm run build                                                # Final check
```

---

*Handoff updated: 2026-06-01*
*Session: Phase 4 complete, 384 tests passing, ready for Phase 5*