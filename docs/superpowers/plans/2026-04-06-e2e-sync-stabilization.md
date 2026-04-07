# E2E Sync Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the failing order-tracking E2E flow by identifying the actual failing boundary first, then applying the minimum durable fix for locator robustness or realtime propagation.

**Architecture:** Treat this as a cross-layer debugging problem, not a single test tweak. The flow crosses Playwright, Next.js client rendering, Supabase writes, Supabase realtime subscriptions, and animated glassmorphism UI. The plan instruments each boundary, proves where status propagation stops, and only then applies a focused fix.

**Tech Stack:** Next.js 16.2.2, React 19, Supabase, Playwright, Vitest, Tailwind v4, Framer Motion

---

## Context To Preserve

- Latest repo evidence does **not** fully match the handover summary.
- The handover says the test times out finding `PREPARING`, but the latest recorded failure points at the later assertion waiting for `On the Way` in [`src/tests/e2e/order-tracking-refactor.spec.ts`](/e:/desktop/goodrest/src/tests/e2e/order-tracking-refactor.spec.ts).
- The customer tracking flow spans three separate UI surfaces:
  - order list page: [`src/app/track/[phone]/page.tsx`](/e:/desktop/goodrest/src/app/track/[phone]/page.tsx)
  - single-order page: [`src/app/track/order/[id]/page.tsx`](/e:/desktop/goodrest/src/app/track/order/[id]/page.tsx)
  - tracker widget: [`src/components/OrderTracker.tsx`](/e:/desktop/goodrest/src/components/OrderTracker.tsx)
- The admin status mutation path starts in [`src/components/admin/OrdersDashboardClient.tsx`](/e:/desktop/goodrest/src/components/admin/OrdersDashboardClient.tsx) and writes through [`src/app/actions/adminActions.ts`](/e:/desktop/goodrest/src/app/actions/adminActions.ts).

## File Map

**Investigate first**
- Read: `playwright_results.txt`
- Read: `playwright_full_failure.txt`
- Read: `final_e2e_results.txt`
- Read: `src/tests/e2e/order-tracking-refactor.spec.ts`
- Read: `src/app/track/[phone]/page.tsx`
- Read: `src/app/track/order/[id]/page.tsx`
- Read: `src/components/OrderTracker.tsx`
- Read: `src/components/admin/OrdersDashboardClient.tsx`

**Likely files to modify after root cause is proven**
- Modify: `src/tests/e2e/order-tracking-refactor.spec.ts`
- Modify: `src/components/OrderTracker.tsx`
- Modify: `src/app/track/order/[id]/page.tsx`
- Modify: `src/app/track/[phone]/page.tsx`

**Verification targets**
- Run: `npx playwright test src/tests/e2e/order-tracking-refactor.spec.ts --project=chromium --workers=1`
- Run: `npx playwright test src/tests/e2e/order-tracking-refactor.spec.ts --project=chromium --workers=1 --repeat-each=3`
- Run: `npx playwright test src/tests/e2e/admin-flow.spec.ts src/tests/e2e/customer-flow.spec.ts --project=chromium --workers=1`

### Task 1: Reproduce The Actual Failure And Reconcile The Logs

**Files:**
- Read: `playwright_results.txt`
- Read: `playwright_full_failure.txt`
- Read: `final_e2e_results.txt`
- Read: `src/tests/e2e/order-tracking-refactor.spec.ts`

- [ ] **Step 1: Clear local browser locks before running anything**

Run:
```cmd
taskkill /F /IM chrome.exe /T
```

Expected:
```text
Either Chrome processes are terminated or Windows reports none are running.
```

- [ ] **Step 2: Run only the failing spec in serial mode**

Run:
```cmd
npx playwright test src/tests/e2e/order-tracking-refactor.spec.ts --project=chromium --workers=1
```

Expected:
```text
The run reproduces one concrete failing assertion and one concrete line number.
```

- [ ] **Step 3: Repeat the same spec three times to classify whether the failure point is stable or drifting**

Run:
```cmd
npx playwright test src/tests/e2e/order-tracking-refactor.spec.ts --project=chromium --workers=1 --repeat-each=3
```

Expected:
```text
Either the failure consistently stops at the same assertion or different assertions fail under timing stress.
```

- [ ] **Step 4: Record the exact failing boundary before any edits**

Write down one of these outcomes:
```text
A. Fails before opening the order details page
B. Fails after opening details page, header status changes but tracker text does not
C. Fails because tracker UI updates but Playwright cannot reliably locate the visible text
D. Fails intermittently at different steps, indicating environment instability rather than a single selector problem
```

- [ ] **Step 5: Stop and update the working hypothesis**

Expected:
```text
The team stops referring to the issue as "PREPARING not found" unless the new run proves that is still the current failure.
```

### Task 2: Add Evidence At Each Boundary Before Any Fix

**Files:**
- Modify: `src/tests/e2e/order-tracking-refactor.spec.ts`

- [ ] **Step 1: Add explicit boundary probes to the existing test**

Add the following temporary helpers near the top of the test file:
```ts
const readText = async (locator: ReturnType<typeof customerPage.locator>) => {
  return (await locator.textContent())?.trim() ?? '<empty>';
};
```

Add these probes immediately after each admin status click:
```ts
const adminBadge = adminOrderCard.locator('[class*="rounded-full"]').first();
console.log('ADMIN_STATUS_AFTER_CLICK:', await readText(adminBadge));
```

Add these probes on the customer order details page:
```ts
const headerStatus = customerPage.locator('span').filter({ hasText: /placed|preparing|out for delivery|delivered/i }).last();
console.log('CUSTOMER_HEADER_STATUS:', await readText(headerStatus));
```

Expected:
```text
The test output shows whether the admin card updated, whether the customer header updated, and whether the tracker copy updated.
```

- [ ] **Step 2: Add a DOM-state probe for the tracker instead of relying only on presentational copy**

Temporarily probe for the tracker step containers:
```ts
const trackerPanel = customerPage.locator('.glass-panel').first();
console.log('TRACKER_PANEL_TEXT:', await readText(trackerPanel));
```

Expected:
```text
The captured tracker text reveals whether "On the Way" exists in the DOM but is not being matched robustly.
```

- [ ] **Step 3: Capture a screenshot and trace exactly at the failing wait**

Add this immediately before the failing expectation:
```ts
await customerPage.screenshot({ path: 'test-results/order-tracker-pre-assert.png', fullPage: true });
```

Run:
```cmd
npx playwright test src/tests/e2e/order-tracking-refactor.spec.ts --project=chromium --workers=1
```

Expected:
```text
There is a screenshot plus console evidence for the precise moment the assertion fails.
```

- [ ] **Step 4: Classify the boundary that breaks**

Decision table:
```text
If admin status stays old -> problem is write path or optimistic UI masking a failed write
If admin status changes but customer header stays old -> problem is data propagation to customer page
If customer header changes but tracker panel stays old -> problem is tracker component state/subscription
If tracker panel text is correct but expect().toBeVisible() fails -> problem is locator/visibility strategy
```

### Task 3: Apply The Minimum Fix Based On The Proven Boundary

**Files:**
- Modify: `src/tests/e2e/order-tracking-refactor.spec.ts`
- Modify: `src/components/OrderTracker.tsx`
- Modify: `src/app/track/order/[id]/page.tsx`
- Modify: `src/app/track/[phone]/page.tsx`

- [ ] **Step 1: If the problem is locator brittleness, add stable attributes and query those instead of styled text**

Add stable attributes in [`src/components/OrderTracker.tsx`](/e:/desktop/goodrest/src/components/OrderTracker.tsx):
```tsx
<div
  key={step.id}
  data-testid={`tracker-step-${step.id}`}
  data-step-status={stepStatus}
  className="flex items-start gap-8 relative z-10"
>
```

Add a current-status hook in the single-order page [`src/app/track/order/[id]/page.tsx`](/e:/desktop/goodrest/src/app/track/order/[id]/page.tsx):
```tsx
<span
  data-testid="order-status-heading"
  className="text-sm font-black text-primary uppercase tracking-widest"
>
  {order.order_status.replace(/_/g, ' ')}
</span>
```

Update the test to assert state, not styling:
```ts
await expect(customerPage.getByTestId('order-status-heading')).toHaveText(/out for delivery/i);
await expect(customerPage.getByTestId('tracker-step-out_for_delivery')).toHaveAttribute('data-step-status', 'current');
```

Expected:
```text
The E2E test stops depending on glass-panel layering, blur, animation timing, or duplicate visible text.
```

- [ ] **Step 2: If the problem is stale customer data after navigation, make the order details page refetch once on mount after navigation and again on realtime update**

In [`src/app/track/order/[id]/page.tsx`](/e:/desktop/goodrest/src/app/track/order/[id]/page.tsx), extract fetch logic into a reusable function:
```tsx
const fetchOrder = async () => {
  if (!params.id) return;
  const data = await getOrderById(params.id as string);
  setOrder(data);
  setLoading(false);
};
```

Reuse it both on initial mount and inside the realtime callback:
```tsx
if (payload.new && payload.new.order_status) {
  setOrder((prev: any) => ({ ...prev, order_status: payload.new.order_status }));
  void fetchOrder();
}
```

Expected:
```text
The details page no longer depends on a single optimistic state change and heals itself from missed or delayed realtime messages.
```

- [ ] **Step 3: If the order list page is stale after the phone lookup, add a lightweight refresh path there instead of assuming the first fetch is enough**

In [`src/app/track/[phone]/page.tsx`](/e:/desktop/goodrest/src/app/track/[phone]/page.tsx), extract the existing fetch into a named function:
```tsx
const fetchOrders = async () => {
  const data = await getOrdersByPhone(unwrappedParams.phone);
  setOrders(data);
  setLoading(false);
};
```

Then use one of these minimal hardening strategies:
```text
Option A: call fetchOrders() again after a short condition-based wait in the test flow
Option B: add a realtime subscription for this customer's orders and refetch on UPDATE
```

Expected:
```text
The order selected by phone reflects the latest status before the user clicks through to details.
```

- [ ] **Step 4: If the failure is pure timing under load, replace fixed waits in the spec with condition-based waits**

Replace brittle waits like this:
```ts
await customerPage.waitForTimeout(5000);
```

With polling against the actual state:
```ts
await expect.poll(async () => {
  return await customerPage.getByTestId('order-status-heading').textContent();
}, { timeout: 20000 }).toMatch(/preparing|out for delivery/i);
```

Expected:
```text
The test waits only as long as needed and fails with the last observed state, not with an opaque timeout.
```

### Task 4: Lock In The Fix With Focused Regression Coverage

**Files:**
- Modify: `src/tests/e2e/order-tracking-refactor.spec.ts`
- Modify: `src/tests/e2e/billing-realtime.spec.ts`
- Modify: `src/tests/e2e/customer-flow.spec.ts`

- [ ] **Step 1: Keep only durable assertions in the refactor spec**

The final assertions should cover:
```text
- admin sees the new order
- admin changes status to preparing
- customer sees preparing state on tracking
- admin changes status to out_for_delivery
- customer sees out_for_delivery state on tracking
```

Expected:
```text
The spec proves the realtime contract without depending on decorative copy that may change during UI polish.
```

- [ ] **Step 2: Add one regression assertion in another customer-facing E2E path**

Use either [`src/tests/e2e/customer-flow.spec.ts`](/e:/desktop/goodrest/src/tests/e2e/customer-flow.spec.ts) or [`src/tests/e2e/billing-realtime.spec.ts`](/e:/desktop/goodrest/src/tests/e2e/billing-realtime.spec.ts) to verify the order status surface still renders after checkout success.

Example assertion:
```ts
await expect(page.getByTestId('order-status-heading')).toBeVisible();
```

Expected:
```text
A future UI refactor cannot silently break the tracking contract without tripping another test.
```

- [ ] **Step 3: Remove temporary console probes once the root cause is proven and the final assertions are stable**

Run:
```cmd
npx playwright test src/tests/e2e/order-tracking-refactor.spec.ts --project=chromium --workers=1 --repeat-each=3
```

Expected:
```text
Three consecutive green runs with no temporary debug logging left in committed code.
```

### Task 5: Final Verification And Exit Criteria

**Files:**
- Verify: `src/tests/e2e/order-tracking-refactor.spec.ts`
- Verify: `src/components/OrderTracker.tsx`
- Verify: `src/app/track/order/[id]/page.tsx`
- Verify: `src/app/track/[phone]/page.tsx`

- [ ] **Step 1: Verify the targeted spec repeatedly**

Run:
```cmd
npx playwright test src/tests/e2e/order-tracking-refactor.spec.ts --project=chromium --workers=1 --repeat-each=5
```

Expected:
```text
Five green runs with the same code and no manual intervention.
```

- [ ] **Step 2: Verify adjacent E2E flows**

Run:
```cmd
npx playwright test src/tests/e2e/admin-flow.spec.ts src/tests/e2e/customer-flow.spec.ts src/tests/e2e/billing-realtime.spec.ts --project=chromium --workers=1
```

Expected:
```text
The hardening work does not regress checkout, admin status updates, or customer browsing.
```

- [ ] **Step 3: Record the root cause and the chosen fix**

Write a short note with:
```text
- exact failing boundary
- exact fix chosen
- why the rejected hypotheses were rejected
- which selectors are now considered part of the E2E contract
```

Expected:
```text
Future debugging starts from evidence instead of re-litigating the same guesses about blur overlays.
```

## Exit Criteria

- The team can state the real root cause in one sentence.
- The refactor spec passes repeatedly without `waitForTimeout()`-driven luck.
- The final assertions target stable state surfaces, not decorative copy alone.
- Any temporary probes added during investigation are removed before completion.

## Notes For The Implementer

- Do not start by changing selectors and hoping for green. The latest local logs point to a later failure than the handover summary.
- Prefer `data-testid` plus semantic text together for E2E stability.
- If three fix attempts fail, stop and reassess whether the customer tracking pages need a stronger synchronization model instead of more Playwright waiting.

Plan complete and saved to `docs/superpowers/plans/2026-04-06-e2e-sync-stabilization.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints
