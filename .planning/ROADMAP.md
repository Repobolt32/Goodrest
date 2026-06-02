---
status: active
milestone: v1.0
---

# Project Roadmap

## Phases

- [x] **Phase 1: Foundation & Order Engine** [status::complete]
  Data model, role access, and bulletproof manual state machine
- [x] **Phase 2: Staff Dashboard & POS Core** [status::complete]
  Menu management and real-time order processing UI for staff
- [x] **Phase 3: Customer Web & Payments** [status::complete]
  Customer menu browsing, cart, and Razorpay/COD checkout
- [x] **Phase 4: Delivery & Rider System** [status::complete]
  FCFS rider assignment, rider dashboard, live GPS tracking, Google Maps ETA
- [x] **Phase 5: Owner Dashboard** [status::complete]
  Real-time order acceptance, bell notifications, prep timer, rider dispatch, Electron desktop wrapper. 12/12 POSD requirements done.
- [ ] **Phase 6: Hardening, Reliability & Polish** [status::draft]
  Security hardening, operational tooling, reliability, and fake data removal across all UIs

## Phase Details

### Phase 1: Foundation & Order Engine
**Goal**: System has a stable data model, role access, and a bulletproof manual state machine for order lifecycle.
**Depends on**: Nothing
**Requirements**: ENGI-01, ENGI-02, ENGI-03, ENGI-04
**Success Criteria**:
  1. Database schema is deployed with Users, Menu Items, Orders, and Order Items.
  2. System prevents invalid order state transitions.
  3. Access to different parts of the system is restricted based on user role.
**Status**: Complete
**Completed**: 2026-05-03

### Phase 2: Staff Dashboard & POS Core
**Goal**: Staff can manage menu availability and process real-time incoming orders.
**Depends on**: Phase 1
**Requirements**: STAF-01, STAF-02, STAF-03, STAF-04, STAF-05
**Success Criteria**:
  1. Staff can create, edit, and toggle availability of menu items.
  2. Staff dashboard updates automatically with new orders within 5 seconds.
  3. Staff can accept, reject, and update the status of orders.
**Status**: Complete
**Completed**: 2026-05-03
**UI**: yes

### Phase 3: Customer Web & Payments
**Goal**: Customers can browse the menu, place orders, and pay securely via Razorpay or COD.
**Depends on**: Phase 1
**Requirements**: CUST-01, CUST-02, CUST-03, CUST-04, CUST-05, CUST-06, CUST-07
**Success Criteria**:
  1. Customer can browse active menu items, add to cart, and checkout without creating an account.
  2. Customer can successfully pay for an order online, and the system correctly verifies the payment webhook.
  3. Customer can choose Cash on Delivery and complete the order.
  4. Customer can view their live order status updating via 3-5s polling.
**Status**: Complete
**Completed**: 2026-05-03
**UI**: yes

### Phase 4: Delivery & Rider System
**Goal**: Riders accept orders via FCFS, update delivery status, and provide live GPS tracking with Google Maps ETA.
**Depends on**: Phase 2, Phase 3
**Requirements**: DELI-01 (FCFS, replaced manual assignment), DELI-02, DELI-03, DELI-04, DELI-05
**Success Criteria**:
  1. System atomically assigns orders to first rider who accepts (FCFS, no race conditions).
  2. Rider can view assigned orders on their dashboard, navigate, and mark as delivered.
  3. System receives live GPS updates from the rider and calculates ETA for the customer via Google Maps Routes API.
**Status**: Complete
**Completed**: 2026-05-18
**UI**: yes

### Phase 5: Owner Dashboard
**Goal**: Owner has a real-time order management dashboard following Zomato's POS workflow — bell notifications, accept/reject flow, prep timer, rider dispatch, and Electron desktop wrapper.
**Depends on**: Phase 2, Phase 4
**Requirements**: POSD-01 through POSD-12
**Success Criteria**:
  1. Owner receives persistent bell notification with always-on-top popup on new orders.
  2. 5-min auto-reject timer cancels unaccepted orders and triggers Razorpay refund.
  3. 20-min prep timer starts on Accept; riders can accept in parallel (FCFS).
  4. Owner can dispatch to system riders or record manual (external) dispatch.
  5. Customer sees live rider GPS + ETA (20 min prep + Google Maps travel time).
  6. Owner can toggle online/offline to block new orders at API level.
  7. Dashboard runs as standalone Electron app with system tray badge and native audio.
**Status**: Pending
**UI**: yes

### Phase 6: Hardening, Reliability & Polish
**Goal**: Close security holes, add missing operational tooling, improve reliability, and remove fake/hardcoded data across all three UIs (Customer, Rider, Owner).
**Depends on**: Phase 4, Phase 5
**Requirements**: SEC-01–08, RIDE-01–07, CUST-01–14, OWN-01–06, QUAL-01–04
**Success Criteria**:
  1. All secrets rotated, `.env` removed from git history, `E2E_MODE` gated.
  2. Build passes with zero type errors.
  3. Server-side price validation on order creation.
  4. Admin can manage riders, view order details, see rider status.
  5. Customer success page shows order summary. No hardcoded fake data.
  6. Rate limiting on order creation and tracking.
  7. Rider has auth middleware and order history.
**Status**: Draft
**UI**: yes

## Progress

| Phase | Plans | Status | Completed |
|-------|-------|--------|-----------|
| 1. Foundation & Order Engine | 1/1 | Complete | 2026-05-03 |
| 2. Staff Dashboard & POS Core | 1/1 | Complete | 2026-05-03 |
| 3. Customer Web & Payments | 1/1 | Complete | 2026-05-03 |
| 4. Delivery & Rider System | 2/2 | Complete | 2026-05-18 |
| 5. Owner Dashboard | 1/1 | Complete | 2026-05-19 |
| 6. Hardening, Reliability & Polish | 1/1 | Draft | — |
