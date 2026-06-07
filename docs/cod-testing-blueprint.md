# COD Testing Blueprint

## Reader

Internal engineer or agent working on the COD-only Goodrest flow.

## Post-Read Action

After reading this, the reader should be able to decide:

1. which current tests are safe to trust
2. which current tests are only advisory
3. which tests should be replaced
4. which missing high-trust tests must be added next
5. which exact verification gate must pass before claiming a COD change is done

## Scope

This blueprint is for the COD-only system.

Included:

- customer menu and cart
- COD order creation
- admin login and restaurant availability
- owner order lifecycle
- rider accept, handover, delivery, and payout logic
- customer tracking

Excluded for now:

- Razorpay
- online payment
- payment webhooks
- refund workflows

## Trust Model

Use these labels consistently:

- `Keep`: keep this suite and allow it to stay in the COD verification gate
- `Weak`: keep this suite, but treat it as advisory only; it does not prove the COD system works
- `Delete/Replace`: phase this suite out and replace it with a higher-trust test
- `Deferred`: outside the COD pass for now

## Current Test Classification

### Keep

These are the most useful current tests for the COD phase because they are either pure business logic or stable user-visible behavior.

| Test | Why it stays |
| --- | --- |
| `src/tests/unit/lib/pricing.test.ts` | Strongest pure business logic coverage in the repo. Directly protects rider earning, bonus, and fee rules. |
| `src/tests/unit/lib/rateLimit.test.ts` | Pure utility behavior with fake timers. Good signal for throttle-window logic. |
| `src/tests/unit/lib/validation.test.ts` | Good protection for UUID and restaurant coordinate validation. |
| `src/tests/unit/lib/distance.test.ts` | Pure ETA math. Stable and cheap to run. |
| `src/tests/unit/actions/distanceActions.test.ts` | Good boundary checks around route parsing and missing API data. |
| `src/tests/unit/hooks/useCart.test.ts` | Important customer-side cart arithmetic and persistence behavior. |
| `src/components/OrderTracker.test.tsx` | Protects real customer-visible tracking and cancel-window behavior. |

### Weak

These tests still have value, but they are too mocked, too skippable, or too indirect to be treated as proof.

| Test | Why it is weak |
| --- | --- |
| `src/tests/unit/actions/orderActions.test.ts` | High business value, but extremely mocked. Good spec, weak proof. |
| `src/tests/unit/actions/orderLifecycle.test.ts` | Useful state-machine specification, but mostly mocked transition checks. |
| `src/tests/unit/actions/riderActions.test.ts` | Good branch coverage, but heavy mocking hides DB and action wiring failures. |
| `src/tests/unit/actions/ownerActions.test.ts` | Valuable payout and toggle rules, but not high-trust workflow proof. |
| `src/tests/unit/actions/authActions.test.ts` | Good cookie and response-shape checks, but rate limiting and JWT behavior are mocked. |
| `src/tests/unit/actions/trackActions.test.ts` | Useful privacy and projection checks, but not real tracking proof. |
| `src/tests/unit/actions/settingsActions.test.ts` | Good validation coverage, but heavily mocked persistence. |
| `src/tests/unit/actions/menuActions.test.ts` | Helpful mapping checks, but not trustworthy data-flow proof. |
| `src/tests/unit/actions/adminActions.test.ts` | Broad coverage, but mostly mocked admin plumbing and partly outside the core COD gate. |
| `src/tests/unit/components/OwnerDashboardClient.test.tsx` | Good UI intent, but heavy mocks and polling/Electron abstraction make it advisory. |
| `src/hooks/useMenu.test.ts` | Very narrow and fully mocked fetch path. |
| `src/app/rider/dashboard/page.test.tsx` | Basic shell behavior only; not a trusted rider-flow proof. |
| `src/tests/db_integration.test.ts` | Real DB value, but can silently skip and tolerates stale state. Upgrade rather than trust as-is. |
| `src/tests/billing_integration.test.ts` | Real DB value, but narrow and skippable. Keep as an upgrade candidate. |

### Delete/Replace

These either create false confidence or are too weak to justify maintenance.

| Test | Replace with |
| --- | --- |
| `src/tests/e2e/route-audit.spec.ts` | Replace with a real COD happy-path E2E and a cancel/tracking E2E. |
| `src/app/rider/login/page.test.tsx` | Replace with either a meaningful interaction test or a real rider-login E2E. |

### Deferred

These are not part of the COD verification gate right now.

| Test | Reason |
| --- | --- |
| `src/tests/unit/api/webhook/razorpay/route.test.ts` | Payment phase deferred. |
| `src/tests/unit/lib/razorpay.test.ts` | Payment phase deferred. |
| `src/tests/unit/security/env-audit.test.ts` | Useful security signal, but not part of the COD workflow gate. |
| `src/components/rider/WeeklyChart.test.tsx` | Presentation-level rider UI, not part of the minimum COD trust gate. |
| `src/components/rider/TerminalView.test.tsx` | Presentation-level rider UI, not part of the minimum COD trust gate. |
| `src/components/rider/OrderBroadcast.test.tsx` | Presentation-level rider UI, not part of the minimum COD trust gate. |
| `src/components/rider/EarningsView.test.tsx` | Presentation-level rider UI, not part of the minimum COD trust gate. |
| `src/components/rider/BonusProgress.test.tsx` | Presentation-level rider UI, not part of the minimum COD trust gate. |
| `src/components/owner/RiderPayoutsPanel.test.tsx` | Presentation-level owner UI, not part of the minimum COD trust gate. |

## Missing High-Trust Tests

These are the tests that should exist before the COD flow is considered trustworthy.

### P0 Integration

Add these first:

1. `src/tests/integration/cod/create-order.test.ts`
   - create a real COD order
   - verify `order_status=confirmed`
   - verify server-side total calculation
   - verify order rows and order_items rows

2. `src/tests/integration/cod/offline-restaurant.test.ts`
   - set restaurant offline
   - prove customer COD order creation is rejected
   - restore state in cleanup

3. `src/tests/integration/cod/owner-lifecycle.test.ts`
   - confirmed -> preparing -> ready -> manual dispatch
   - verify persisted timestamps and ETA fields

4. `src/tests/integration/cod/rider-flow.test.ts`
   - rider accepts order
   - owner dispatches
   - rider starts delivery
   - rider marks delivered
   - verify final order state and rider earning persistence

5. `src/tests/integration/cod/tracking-location.test.ts`
   - rider location update persists
   - customer tracking lookup returns location only for the right order/state

6. `src/tests/integration/cod/rider-stats-payouts.test.ts`
   - delivered COD orders update rider stats, bonus, and weekly payout numbers consistently

### P0 E2E

Add at least these:

1. `src/tests/e2e/cod-happy-path.spec.ts`
   - customer adds items
   - customer places COD order
   - owner accepts
   - owner marks ready
   - owner dispatches
   - rider starts ride
   - rider marks delivered
   - customer tracking reflects the final state

2. `src/tests/e2e/cod-cancel-window.spec.ts`
   - order can be cancelled during grace window
   - after grace window the customer sees the fallback help path instead of the direct cancel path

### P1 High-Value Follow-Ups

These matter, but can wait until after the P0 suite exists:

1. action-level rate-limit tests for:
   - admin login
   - order creation
   - rider location updates

2. rider batching integration tests:
   - second active order joins a batch
   - first-order dead miles are recalculated correctly

3. settings integration tests:
   - delivery radius behavior
   - online/offline status impact on customer flow

## Proposed COD Verification Gate

The COD gate should stop agents from calling mocked success "done."

### Blocking Rule

If a change touches COD behavior, the task is not complete unless all blocking checks below pass.

COD behavior includes changes to:

- order creation
- owner lifecycle
- rider lifecycle
- tracking
- admin auth for COD operations
- restaurant availability and settings
- pricing, earnings, or bonus rules
- cart or order-tracker UI that changes user-visible behavior

### Blocking Checks

Run these in this order:

1. `npm run lint`
2. `npm run build`
3. trusted COD unit suite
4. trusted COD integration suite
5. critical COD E2E suite

### Exact Commands To Use Until Scripts Exist

```powershell
npm run lint
npm run build
npx vitest run src/tests/unit/lib/pricing.test.ts src/tests/unit/lib/rateLimit.test.ts src/tests/unit/lib/validation.test.ts src/tests/unit/lib/distance.test.ts src/tests/unit/actions/distanceActions.test.ts src/tests/unit/hooks/useCart.test.ts src/components/OrderTracker.test.tsx
npx vitest run src/tests/integration/cod/*.test.ts
npx playwright test src/tests/e2e/cod-happy-path.spec.ts src/tests/e2e/cod-cancel-window.spec.ts
```

### Proposed Script End State

Add these scripts later:

```json
{
  "test:cod:unit": "vitest run src/tests/unit/lib/pricing.test.ts src/tests/unit/lib/rateLimit.test.ts src/tests/unit/lib/validation.test.ts src/tests/unit/lib/distance.test.ts src/tests/unit/actions/distanceActions.test.ts src/tests/unit/hooks/useCart.test.ts src/components/OrderTracker.test.tsx",
  "test:cod:integration": "vitest run src/tests/integration/cod/*.test.ts",
  "test:cod:e2e": "playwright test src/tests/e2e/cod-happy-path.spec.ts src/tests/e2e/cod-cancel-window.spec.ts",
  "verify:cod": "npm run lint && npm run build && npm run test:cod:unit && npm run test:cod:integration && npm run test:cod:e2e"
}
```

## What Does Not Count As Proof

These are explicitly not enough for a COD safety claim:

- `npm run test` by itself
- mocked server-action suites by themselves
- route smoke tests
- build-only success
- manually checking one page

## Role Of Weak Suites

Weak suites should still run because they can catch local regressions early. They should not be treated as the release gate.

Recommended use:

- run weak suites in CI as advisory
- keep them visible in PRs
- do not use them as the only basis for saying the COD flow is safe

## Execution Order

Implement the blueprint in this order:

1. replace the route smoke E2E with one real COD happy-path E2E
2. add the five P0 COD integration tests
3. move trusted unit tests into a dedicated COD unit command
4. demote weak suites from the safety gate
5. keep payment suites deferred until the payment phase resumes

## Definition Of Done For The COD Testing Phase

The COD testing phase is complete only when:

- the Keep suite is separated from the Weak suite
- the P0 integration tests exist and pass
- the COD happy-path E2E exists and passes
- agents have a single COD verification command to run
- a future bug fix must add a regression test at the correct trust level before being called done
