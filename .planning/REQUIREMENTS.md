# Requirements: POS (Restaurant Operating System)

**Defined:** 30 April 2026
**Core Value:** Reliable real-time order lifecycle management across customers, staff, and riders to ensure a seamless restaurant operation with absolute financial and transactional accuracy.

## v1 Requirements

### Foundation & Order Engine

- [x] **ENGI-01**: Define Prisma schema for Users, Menu Items, Orders, and Order Items.
- [x] **ENGI-02**: Implement backend manual state machine for order transitions (created → pending_payment → confirmed → preparing → ready → out_for_delivery → delivered).
- [x] **ENGI-03**: Enforce transition validation rules to prevent invalid state jumps.
- [x] **ENGI-04**: Implement role-based access control (Customer, Staff, Rider).

### Staff Dashboard (POS)

- [x] **STAF-01**: Staff can view a real-time order dashboard updating via 3-5s polling.
- [x] **STAF-02**: Staff can manually accept (confirm) or reject new orders.
- [x] **STAF-03**: Staff can manually update order status (preparing → ready).
- [x] **STAF-04**: Staff can manage menu items (CRUD, categories).
- [x] **STAF-05**: Staff can toggle menu item availability with instant effect on new orders.

### Customer Shop

- [x] **CUST-01**: Customer can browse the menu organized by categories.
- [x] **CUST-02**: Customer can add items to a cart and manage quantities.
- [x] **CUST-03**: Customer can place an order via guest checkout.
- [x] **CUST-04**: Customer can choose between Online Payment or Cash on Delivery (COD).
- [x] **CUST-05**: System integrates with Razorpay for online payments.
- [x] **CUST-06**: System verifies Razorpay webhooks to confirm payment before transitioning order to `confirmed`.
- [x] **CUST-07**: Customer can view order status and ETA via 3-5s polling.

### Delivery Fleet

- [x] **DELI-01**: System atomically assigns orders via FCFS — first rider to accept gets the order (replaced manual staff assignment per 04-CONTEXT.md design decision).
- [x] **DELI-02**: Rider can view their assigned deliveries in a PWA interface.
- [x] **DELI-03**: Rider can update delivery status (out_for_delivery → delivered).
- [x] **DELI-04**: Rider PWA sends GPS location updates to backend.
- [x] **DELI-05**: System calculates ETA using Google Maps Platform.

### Owner Dashboard (Phase 5)

- [ ] **POSD-01**: Electron desktop wrapper for admin dashboard with system tray + native audio.
- [ ] **POSD-02**: Bell notification system — persistent audio loop on new orders with always-on-top popup.
- [ ] **POSD-03**: Owner Accept flow with 5-min auto-reject countdown (Zomato pattern).
- [ ] **POSD-04**: Prep timer system — 20-min fixed timer, auto-transitions to ready state.
- [ ] **POSD-05**: Rider assignment parallel to food preparation (FCFS during `preparing` state).
- [ ] **POSD-06**: Owner Dispatch flow + customer ETA (20 min prep + Google Maps travel ETA).
- [ ] **POSD-07**: Rider status panel in admin dashboard showing assigned/accepted riders.
- [ ] **POSD-08**: Manual dispatch for external riders (bypasses in-app rider system).
- [ ] **POSD-09**: Owner online/offline toggle — blocks ordering at API level when offline.
- [ ] **POSD-10**: Customer tracking: live rider GPS + ETA display (when `out_for_delivery`).
- [ ] **POSD-11**: Order voids and refunds with Razorpay integration.
- [ ] **POSD-12**: Basic daily sales and order reports.

## v2 Requirements

### Offline Operations
- **OFFL-01**: Staff dashboard functions offline and syncs when reconnected.

### Automated Dispatch
- **DISP-01**: System automatically assigns orders to the nearest available rider.

### Real-time Infra
- **REAL-01**: Replace 3-5s polling with WebSocket/Pusher for instant updates if scale demands it.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-restaurant support | Built exclusively for a single restaurant to keep logic simple and fast. |
| Native iOS/Android Apps | Too much overhead. PWA is sufficient for Riders; Desktop wrapper for Staff. |
| XState or complex state libraries | Premature abstraction. Clear backend rules are safer and simpler for this scale. |
| Pusher/WebSockets for MVP | Polling is adequate for 50 orders/day and removes infrastructure complexity. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENGI-01 | Phase 1 | Complete |
| ENGI-02 | Phase 1 | Complete |
| ENGI-03 | Phase 1 | Complete |
| ENGI-04 | Phase 1 | Complete |
| STAF-01 | Phase 2 | Complete |
| STAF-02 | Phase 2 | Complete |
| STAF-03 | Phase 2 | Complete |
| STAF-04 | Phase 2 | Complete |
| STAF-05 | Phase 2 | Complete |
| CUST-01 | Phase 3 | Complete |
| CUST-02 | Phase 3 | Complete |
| CUST-03 | Phase 3 | Complete |
| CUST-04 | Phase 3 | Complete |
| CUST-05 | Phase 3 | Complete |
| CUST-06 | Phase 3 | Complete |
| CUST-07 | Phase 3 | Complete |
| DELI-01 | Phase 4 | Complete |
| DELI-02 | Phase 4 | Complete |
| DELI-03 | Phase 4 | Complete |
| DELI-04 | Phase 4 | Complete |
| DELI-05 | Phase 4 | Complete |
| POSD-01 | Phase 5 | Pending |
| POSD-02 | Phase 5 | Pending |
| POSD-03 | Phase 5 | Pending |
| POSD-04 | Phase 5 | Pending |
| POSD-05 | Phase 5 | Pending |
| POSD-06 | Phase 5 | Pending |
| POSD-07 | Phase 5 | Pending |
| POSD-08 | Phase 5 | Pending |
| POSD-09 | Phase 5 | Pending |
| POSD-10 | Phase 5 | Pending |
| POSD-11 | Phase 5 | Pending |
| POSD-12 | Phase 5 | Pending |

---
*Requirements defined: 30 April 2026*
*Last updated: 2026-05-18 — Phase 4 launch: FCFS delivery system, GPS tracking, Google Maps ETA*