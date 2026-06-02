# Project Research Summary

**Project:** POS (Restaurant Operating System)
**Domain:** Restaurant Operations / POS / Delivery
**Researched:** 2026-04-30
**Confidence:** HIGH

## Executive Summary

The Restaurant Operating System (ROS) is a single-restaurant solution designed to manage the entire order lifecycle across customer, staff, and rider interfaces. Research indicates that while many enterprise POS systems utilize complex real-time technologies (like WebSockets) and state management libraries (like XState), a high-reliability, single-restaurant system can be effectively built using a simplified, "logic-first" approach. By prioritizing simplicity and correctness over extreme scalability, the system avoids the overhead of managing third-party real-time services and complex state abstractions.

The recommended approach utilizes a full-stack Next.js architecture with PostgreSQL and Prisma. Real-time updates are achieved through robust 3-5s polling, which significantly reduces architectural complexity while meeting the restaurant's operational needs (approx. 50 orders/day). Order integrity is maintained through a strictly defined manual backend state machine. The primary risks involve handling non-linear order flows (cancellations/refunds) and ensuring payment synchronization via Razorpay webhooks, both of which are mitigated by centralizing the source of truth in the backend logic.

## Key Findings

### Recommended Stack

The stack is optimized for speed of shipping and logic correctness. It uses a single-codebase approach to minimize integration friction between different actor interfaces.

**Core technologies:**
- **Next.js (App Router):** Full-stack Framework — Unified codebase for Customer, Staff, and Rider interfaces.
- **Postgres + Prisma:** Database & ORM — Reliable relational storage with type-safe access for financial accuracy.
- **Polling (3-5s):** Real-time Sync — Replaces Pusher/WebSockets to minimize complexity while maintaining "near-real-time" dashboard updates.
- **Manual State Machine:** Business Logic — Explicit backend transitions for order states without external library dependencies (No XState).
- **Electron:** Desktop Wrapper — Provides a dedicated desktop application experience for the owner dashboard with native audio and system tray.
- **Razorpay:** Payments — Integrated via secure backend webhooks for transactional reliability.
- **Google Maps API:** Geolocation — Essential for rider tracking and distance calculations.

### Expected Features

**Must have (table stakes):**
- **Real-time Order Dashboard:** Staff view of incoming orders (powered by polling).
- **Menu Management (CRUD):** Instant updates for availability and pricing.
- **Guest Checkout:** Frictionless ordering without mandatory account creation.
- **Payment Integration:** Support for Razorpay and Cash on Delivery (COD).
- **Manual Rider Assignment:** Dispatching orders to staff riders.

**Should have (competitive):**
- **Integrated Rider PWA:** Mobile tool for delivery status updates.
- **GPS Tracking:** Real-time (polled) map view for customers to see their delivery progress.
- **Pulse Dashboard:** Actionable KPIs like top items and average preparation time.

**Defer (v2+):**
- **Multi-restaurant support:** Keeping scope tight to a single-restaurant OS.
- **Offline mode:** Prioritizing online stability over the complexity of local sync.

### Architecture Approach

The system follows a monolithic single-repo architecture using Next.js Route Groups to separate concerns for Customers, Staff, and Riders while sharing core business logic.

**Major components:**
1. **Manual Order Engine:** Backend module that enforces state transitions and calculates final prices (source of truth).
2. **Polling Sync Layer:** TanStack Query implementation that fetches updates every 3-5 seconds for the POS and Tracking dashboards.
3. **Actor-Specific Interfaces:** Dedicated UI layouts for Staff (Desktop/Tablet), Riders (Mobile PWA), and Customers (Responsive Web).

### Critical Pitfalls

1. **"Happy Path" State Machine:** Orders are chaotic (cancellations, mid-prep rejections). The manual state machine must explicitly handle exception states like `CANCELLED` and `REFUNDED`.
2. **Webhook Drop-off:** Never trust the frontend payment callback. Razorpay webhooks are the ONLY source of truth for "Paid" status.
3. **Structured Modifiers:** Modifiers (add-ons) must be structured data, not plain text, to ensure accurate pricing and kitchen instruction routing.
4. **PWA Background Limits:** Mobile browsers throttle background tasks. GPS tracking must use adaptive polling and manage customer expectations for 30-60s latency.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation & Order Engine
**Rationale:** Establishing the data model and the manual state machine is the highest priority for correctness.
**Delivers:** DB Schema, Prisma client, Menu CRUD, and core Order transition logic.
**Addresses:** Menu Management, Order Engine, State Transitions.
**Avoids:** Pitfall 1 (Linear state machine errors) and Pitfall 3 (Structured modifiers).

### Phase 2: Staff Dashboard & POS Core
**Rationale:** The restaurant's primary interface. Implements the polling mechanism to validate "real-time" behavior early.
**Delivers:** Staff dashboard UI and Polling integration.
**Uses:** Next.js, Polling.
**Implements:** Staff Interface component.

### Phase 3: Customer Web & Payments
**Rationale:** Enables revenue generation. Requires careful integration with Razorpay.
**Delivers:** Customer menu view, Cart, Guest Checkout, and Razorpay Webhook listener.
**Addresses:** Payment System, Guest Checkout.
**Avoids:** Pitfall 2 (Webhook drop-off).

### Phase 4: Delivery & Rider System
**Rationale:** Adds the fulfillment layer once the core ordering flow is stable.
**Delivers:** Manual assignment UI, Rider PWA, and Tracking page.
**Implements:** Rider interface and Tracking system.
**Avoids:** Pitfall 4 (PWA background limits).

### Phase Ordering Rationale

- **Logic-First:** Order logic and Menu schema are built first to prevent breaking changes in UI phases.
- **Internal before External:** Staff tools are built before Customer tools to ensure operational readiness.
- **Sync Validation:** Polling is implemented in Phase 2 to ensure the performance and UX are acceptable before scaling to the Customer/Rider interfaces.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Manual State Machine):** Needs detailed state-transition mapping to cover all edge cases (cancellation, partial fulfillment).
- **Phase 3 (Razorpay Integration):** Needs precise API research for webhook security and idempotency.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Next.js Dashboard):** Standard App Router and Tailwind patterns.
- **Phase 5 (Owner Dashboard):** Bell notification system, auto-reject timer, prep timer, rider dispatch flow, Electron wrapper.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Standard Next.js/Postgres tools; simplification reduces risk. |
| Features | HIGH | Table stakes for POS are well-documented. |
| Architecture | HIGH | Monolithic approach fits the single-restaurant scope perfectly. |
| Pitfalls | HIGH | Common POS/Delivery pitfalls are well-understood. |

**Overall confidence:** HIGH

### Gaps to Address

- **Hardware Interaction:** Need to verify thermal printer integration requirements (usually handled via standard browser print dialog or Electron-specific node-printer).
- **Polling Load:** Verify database performance impact of 3-5s polling as the order history grows (mitigate with indexes/archiving).

## Sources

### Primary (HIGH confidence)
- **Next.js Documentation:** App Router and Server Actions patterns.
- **Razorpay API Docs:** Webhook implementation and payment verification.
- **Prisma Schema Reference:** Relational modeling best practices.

### Secondary (MEDIUM confidence)
- **POS Industry Research:** Common features and pitfalls in restaurant software.
- **Electron Docs:** Desktop wrapping patterns for web apps.

---
*Research completed: 2026-04-30*
*Ready for roadmap: yes*
