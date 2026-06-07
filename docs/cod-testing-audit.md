# COD Testing Audit

## Purpose

This note stores the current testing audit for the COD-only version of Goodrest so the team can fix gaps later without losing context.

Related follow-up:

- See `docs/cod-testing-blueprint.md` for the action plan, test classification, and proposed verification gate.

## Scope

- In scope:
  - Customer COD order creation
  - Admin auth and restaurant settings
  - Owner order lifecycle
  - Rider assignment, handover, delivery, earnings, and stats
  - Customer tracking
- Out of scope for now:
  - Razorpay
  - Online payment verification
  - Refund and payment-webhook reliability

## Current Position

The project already has a large number of tests. The main issue is not test count. The issue is trust level.

Strongest areas:

- Pure pricing and rider earning rules
- Order lifecycle state-machine rules
- Rider stats and payout calculations

Weakest areas:

- End-to-end proof of the real COD flow
- Live rider location and tracking behavior
- Action-level rate-limit and abuse protection checks
- DB-backed proof for lifecycle transitions

## Main Findings

### 1. The suite proves isolated logic better than real workflows

Most current tests are unit tests with heavy mocks. That is useful for business-rule specification, but it is weaker proof than integration or end-to-end testing.

Impact:

- An agent can pass many mocked tests while the real system still breaks across action, database, and UI boundaries.

### 2. There is no trusted COD journey test yet

The current browser coverage is a route smoke check, not a true customer-to-owner-to-rider COD journey.

Impact:

- "Tests passed" does not currently prove that a real COD order can be placed, processed, handed over, delivered, and tracked successfully.

### 3. Lifecycle rules are defined, but mostly through mocked state-machine tests

The order lifecycle itself is one of the better-covered business areas, but most of that confidence comes from mocked tests rather than DB-backed proof.

Impact:

- Transition logic is specified.
- Transition wiring is not yet strongly proven.

### 4. Tracking and live location are under-protected

Tracking summary and order-detail behavior are tested more than live location behavior.

Impact:

- Rider live location updates and customer-facing location lookup need stronger direct coverage.

### 5. Throttling and abuse protection are not strongly verified at action level

Some tests mock rate limiting as always allowed, which removes an important production guard from the test path.

Impact:

- Login abuse, order spam, and rider location spam are not yet strongly protected by trusted action tests.

## Business Flow Audit

### Customer creates COD order

Current trust: Medium

What is good:

- Validation rules exist
- COD status behavior is tested
- Some DB-backed order creation checks exist

What is missing:

- Proof that restaurant offline mode blocks order creation
- Proof that order throttling works at action level
- One real COD flow that starts at the customer surface and ends in a usable order

### Restaurant settings and online/offline behavior

Current trust: Low to Medium

What is good:

- Settings update paths are tested
- Online status toggle behavior is tested

What is missing:

- Direct proof that customer ordering is blocked when restaurant is offline
- Stronger tests for settings that change delivery behavior

### Owner lifecycle handling

Current trust: Medium

What is good:

- Confirmed to preparing
- Preparing to ready
- Ready to dispatch
- Invalid transitions are covered

What is missing:

- Real DB-backed lifecycle proof across multiple actions
- COD happy path proof through owner UI or owner-facing workflow

### Rider order handling

Current trust: Medium

What is good:

- Rider accepts order
- Manual handover gate exists
- Start riding and delivered transitions are covered
- Earnings and stats logic are covered

What is missing:

- Real integration around rider active-order limits
- Stronger proof for batching behavior
- DB-backed proof that delivery completion updates all related state

### Customer tracking

Current trust: Low

What is good:

- Order summary and order-detail access rules are partially covered

What is missing:

- Direct tests for rider live location lookup
- Real tracking flow after rider movement and after delivery state changes

### Rider earnings and weekly payouts

Current trust: Medium to High

What is good:

- Pricing and bonus math are the strongest tested part of the system
- Weekly payout grouping and batch-related payout behavior are covered

What is missing:

- Integration proof that the same numbers survive real order lifecycle updates

## Open Questions To Resolve

These are intentionally left open for later fixes.

1. Order item audit model:
   - Is it intentional that stored order items can end up audit-safe while `menu_item_id` is null?
   - If yes, the tests should document that as an invariant.
   - If no, the tests and implementation need correction.

2. Tracking privacy model:
   - Is phone-based order lookup allowed without a session while full order detail requires session ownership?
   - If yes, tests should lock that behavior in as an explicit product decision.
   - If no, tracking access rules need tightening and the tests should change.

## Deferred Area

Payment behavior is intentionally deferred.

Do not mix payment fixes into the current COD testing pass. Keep the current effort focused on COD order flow, lifecycle, rider flow, tracking, auth, settings, and earnings.

## Recommended Next Step

Create a COD-only testing blueprint that does three things:

1. Classify current tests into:
   - keep
   - weak
   - delete or replace
2. Define the minimum trusted COD suite:
   - pure unit tests for business rules
   - a small set of DB-backed integration tests
   - one real COD end-to-end flow
3. Define the verification gate agents must pass before claiming the COD system is safe

## Success Condition For The Next Phase

The next testing phase should end with a setup where:

- mocked unit tests are not the only line of defense
- critical COD flows have at least one trusted proof path
- future bug fixes add regression tests instead of only patching code
- agents cannot confidently pass broken COD behavior with low-trust tests alone
