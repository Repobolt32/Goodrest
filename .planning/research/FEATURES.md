# Feature Research

**Domain:** Restaurant Operating System (ROS) / POS
**Researched:** 2024-05-23
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Real-time Order Dashboard** | Staff must see and manage incoming orders without refreshing. | MEDIUM | Requires WebSockets or Server-Sent Events (SSE). |
| **Menu Management (CRUD)** | Restaurants frequently update availability, items, and prices. | LOW | Needs instant sync to customer-facing UI. |
| **Required/Optional Modifiers** | Basic customization (e.g., "extra cheese", "no onions") is standard. | MEDIUM | Complexity in pricing logic and kitchen communication. |
| **Payment Integration** | Online (Razorpay) and Cash on Delivery (COD) are baseline for ROS. | MEDIUM | Critical for transactional accuracy and order state. |
| **Order Voids & Refunds** | Errors happen; staff must be able to cancel or refund orders. | HIGH | Requires secure role-based access and gateway sync. |
| **Guest Checkout** | Frictionless ordering is expected; requiring an account is a drop-off point. | LOW | Necessary for high conversion on first-party sites. |
| **Status Notifications** | Customers expect to know when an order is "Accepted", "Preparing", or "Out for Delivery". | LOW | Email/SMS or in-app push notifications. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Integrated Rider PWA** | Bypasses 3rd-party delivery apps and fees; provides a dedicated rider tool. | MEDIUM | Mobile-optimized web app with location permissions. |
| **Real-time GPS Tracking** | High-end customer experience; see the rider on a map in real-time. | HIGH | Uses Google Maps API / Leaflet and real-time GPS pings. |
| **Progressive Disclosure UI** | Reduces staff training time by only showing relevant buttons per state. | LOW | UX-focused; keeps the "Spaceship" control panel away. |
| **Unified State Machine** | Guaranteed reliability; prevents invalid states like "Delivered" before "Shipped". | MEDIUM | Backend logic to ensure absolute financial consistency. |
| **Pulse Dashboard** | Actionable KPIs (top items, avg prep time) rather than "Data Vomit". | LOW | Focused on 3-5 key metrics for immediate owner insight. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Offline Mode** | Fear of internet outages. | Massive complexity in conflict resolution and data syncing. | Focus on "Online-Only" stability and local caching. |
| **Multi-Restaurant Support** | Thinking about scaling early. | Complicates database schemas and multi-tenancy before MVP validation. | Hard-scope to Single-Restaurant; scale later. |
| **Native Mobile Apps** | "Feels" more premium. | High maintenance cost (App Store/Play Store) vs PWAs. | Use high-quality PWA for Riders; Web for others. |
| **Automated Rider Dispatch** | Saves manager time. | High logic complexity; manual assignment is more reliable for small fleets. | Manual "Drag & Drop" or selection assignment. |
| **Deeply Nested Menus** | Organize 100s of items. | Slows down order entry during rushes. | Flat UI with "Favorites" and smart search. |

## Feature Dependencies

```
[Customer Ordering]
    └──requires──> [Menu Management]
                       └──requires──> [Order Engine]

[Payment System] ──requires──> [Order Engine]

[Tracking System] ──requires──> [Delivery System]
                       └──requires──> [Order Engine]

[Rider PWA] ──enhances──> [Delivery System]

[Refund Logic] ──conflicts──> [Strict Finalized State]
```

### Dependency Notes

- **Customer Ordering requires Menu Management:** Customers cannot order what doesn't exist or is incorrectly priced.
- **Payment System requires Order Engine:** Payments must be linked to a valid order state to prevent double-charging or ghost orders.
- **Tracking System requires Delivery System:** You cannot track a rider until the order is assigned to one.
- **Rider PWA enhances Delivery System:** While a manager could manually update delivery status, the PWA automates this via the rider's actions.
- **Refund Logic conflicts with Strict Finalized State:** If a state machine marks an order as "Closed", it must still allow for a "Refunded" transition, creating a complexity in the "End of Lifecycle".

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [ ] **Real-time Order Dashboard** — Essential for staff to see orders as they arrive.
- [ ] **Menu CRUD + Availability** — Core operational control.
- [ ] **Guest Checkout + Razorpay/COD** — Essential for generating revenue.
- [ ] **Basic Order State Machine** — Ensuring orders move through the kitchen correctly.
- [ ] **Manual Rider Assignment** — Essential for fulfilling delivery orders.

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] **Rider GPS Tracking** — Significant UX boost for customers.
- [ ] **Order Modifiers** — Required for more complex menu items (addons, variations).
- [ ] **Void/Refund Interface** — Necessary for operational scaling and dispute handling.

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Loyalty/CRM Integration** — Reward repeat customers.
- [ ] **Inventory Management** — Track stock levels of ingredients.
- [ ] **AI Sales Forecasting** — Predictive prep lists based on historical data.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Real-time Dashboard | HIGH | MEDIUM | P1 |
| Payment Integration | HIGH | MEDIUM | P1 |
| Guest Checkout | HIGH | LOW | P1 |
| Menu CRUD | HIGH | LOW | P1 |
| Manual Delivery Assign | MEDIUM | LOW | P1 |
| GPS Tracking | HIGH | HIGH | P2 |
| Order Modifiers | MEDIUM | MEDIUM | P2 |
| Pulse Dashboard | MEDIUM | LOW | P2 |
| Void/Refund UI | MEDIUM | MEDIUM | P2 |
| Inventory Tracking | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Toast / Square | TouchBistro | Our Approach |
|---------|----------------|-------------|--------------|
| Delivery | Often via 3rd party integration. | Integrated, but often complex. | Built-in first-party Rider PWA for single-restaurant efficiency. |
| UI/UX | Busy, legacy feel ("Spaceship"). | Solid, but tablet-centric. | Modern Web/PWA with progressive disclosure (cleaner). |
| Tech Stack | Proprietary hardware focus. | iPad-centric. | Hardware-agnostic Web/PWA (T3 Stack). |
| Real-time | Near-instant. | Strong local sync. | WebSocket-first for all interfaces. |

## Sources

- [Toast POS Features](https://pos.toasttab.com/features)
- [Square for Restaurants](https://squareup.com/us/en/restaurant-pos)
- [TouchBistro Feature List](https://www.touchbistro.com/pos-features/)
- Industry Standard: Modern Restaurant Tech Ecosystem (2024 Research)

---
*Feature research for: Restaurant Operating System (ROS)*
*Researched: 2024-05-23*
