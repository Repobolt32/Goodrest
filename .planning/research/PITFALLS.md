# Domain Pitfalls: Restaurant Operating System (ROS)

**Domain:** Restaurant POS & Delivery Management
**Researched:** 2024-05-22
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: The "Happy Path" Order State Machine

**What goes wrong:**
Developers often build a linear state machine (`CREATED` -> `PAID` -> `PREPARING` -> `DELIVERED`). In reality, orders are chaotic: customers cancel after payment, kitchens run out of items mid-prep, or riders reject assignments. If the state machine doesn't handle "reversion" or "exception" states, the system locks up or shows ghost orders.

**Why it happens:**
Focusing on the "ideal" flow during MVP phase and treating edge cases as "Phase 2" problems.

**How to avoid:**
Implement a robust, non-linear state machine with explicit transitions for `CANCELLED`, `REFUNDED`, `PARTIALLY_FULFILLED`, and `RIDER_REJECTED`. Use a library like `XState` or a strict schema-level validation.

**Warning signs:**
Staff complaining they "can't close an order" that was cancelled, or financial reports showing "paid" orders that were never delivered.

**Phase to address:** Order Engine (Core)

---

### Pitfall 2: The Cloud-Only Reliance Gap

**What goes wrong:**
The project is scoped as "Online-Only," but restaurant internet is notoriously flaky. A 30-second internet drop during a rush can lead to lost orders, double-billing, or kitchen confusion if the UI simply "freezes" or fails to save state locally.

**Why it happens:**
Assuming stable fiber-optic level uptime in a commercial kitchen environment with heavy electrical interference and stainless steel "Faraday cages."

**How to avoid:**
Implement **Optimistic UI** updates and a **Local Persistence** layer (e.g., IndexedDB via TanStack Query). Even if the system is "online-only," the client should queue updates and retry automatically without blocking the staff's ability to keep typing.

**Warning signs:**
Staff reporting "the screen spun for a minute and I had to refresh," followed by a duplicate order appearing.

**Phase to address:** POS Core / UI Framework

---

### Pitfall 3: Structured Modifier Fragility

**What goes wrong:**
Treating menu modifiers (e.g., "Extra Cheese," "No Onions," "Medium Rare") as plain text comments. This makes it impossible to:
1. Adjust inventory automatically.
2. Route specific instructions to specific stations (e.g., Grill vs. Prep).
3. Calculate accurate pricing for "add-ons."

**Why it happens:**
Simplifying the data model to get the Menu CRUD done faster.

**How to avoid:**
Use a **Structured Modifier Schema**. Modifiers must be objects with their own IDs, price deltas, and "Station Tags."

**Warning signs:**
Kitchen staff missing "Allergy" notes because they were buried in a long text string, or "Extra Add-ons" being given away for free.

**Phase to address:** Menu Management

---

### Pitfall 4: The Razorpay Webhook "Drop-off"

**What goes wrong:**
Relying on the frontend `onSuccess` callback to mark an order as paid. If a user's phone dies or they close the browser immediately after the bank OTP, the payment succeeds in Razorpay but your database never updates.

**Why it happens:**
Developer convenience; frontend callbacks are easier to test than backend webhooks.

**How to avoid:**
**Mandatory Webhook Verification.** The backend `payment.captured` webhook must be the single source of truth for payment status. Use idempotency keys (`x-razorpay-event-id`) to handle duplicate webhook deliveries.

**Warning signs:**
"Successful" payments in the Razorpay Dashboard that have no corresponding "Paid" order in your system.

**Phase to address:** Payment System

---

### Pitfall 5: Rider PWA Background Execution Limits

**What goes wrong:**
Expecting continuous GPS tracking from a mobile browser (PWA) when the phone is in the rider's pocket or the screen is off. iOS and Android aggressively throttle or kill background browser processes to save battery.

**Why it happens:**
Treating a PWA like a native app regarding background capabilities.

**How to avoid:**
1. Use the **Screen Wake Lock API** to keep the app active while "On Duty."
2. Implement **Batch Syncing**: Store coordinates in IndexedDB and sync in bursts to save radio power.
3. Manage expectations: Inform customers that "Real-time" tracking may have 30-60s latency.

**Warning signs:**
Rider's location "teleporting" across the map only when they unlock their phone.

**Phase to address:** Tracking System

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| String-based modifiers | Faster Menu CRUD | Impossible to automate inventory or kitchen routing | Never (core data model) |
| Frontend-only payment sync | No webhook setup needed | High "lost order" rate and manual reconciliation | Development only |
| Skipping Z-Read logic | Simple "EOD" reporting | Impossible to find where cash/digital totals diverged | MVP for single user |
| Standard Float for Money | Easy JS math | Penny-off errors in tax and high-volume totals | Never (Use Decimals/Integers) |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **Razorpay** | Trusting `amount` from webhook | Re-verify amount against your DB order ID (prevent "Price Manipulation" attacks). |
| **Google Maps** | High-frequency polling | Use "Adaptive Polling" (slow down when rider is stationary) to reduce API costs. |
| **WebSockets** | No "Reconnection" logic | Implement exponential backoff and "State Resync" on every reconnect. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| The "Giant JSON" Menu | Customer UI lags on load | Implement Item/Category pagination or partial hydration. | >500 items |
| Polling for New Orders | Server CPU spikes | Use WebSockets (Pusher/Socket.io) or Server-Sent Events (SSE). | >10 concurrent staff |
| Unindexed `order_status` | Dashboard slow to refresh | Composite index on `(restaurant_id, status, created_at)`. | >5,000 orders |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Insecure State Jumps | Customer marking their own order as `DELIVERED` | Server-side validation: only Riders/Staff can transition to `DELIVERED`. |
| ID Enumeration | Competitors scraping order volume via `/order/101` | Use UUIDs or Cuid2 for all public-facing order URLs. |
| Over-privileged Rider PWA | Riders seeing customer's full order history/address | Strict RBAC: Riders only see active order delivery details. |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| "Thin" buttons on KDS | Kitchen staff struggle with greasy fingers | "Fat Finger" UI: Large touch targets, high contrast, no double-clicks. |
| Intrusive Refreshing | Staff loses place in a list when a new order arrives | Use "Toast" notifications for new orders; don't auto-reorder the active list. |
| Hidden "Out of Stock" | Customer orders item, then gets a call it's gone | Real-time "Sold Out" toggle with immediate broadcast to all open sessions. |

## "Looks Done But Isn't" Checklist

- [ ] **Payment Integration:** Often missing **refund handling** — verify `payment.refunded` webhook.
- [ ] **Menu Management:** Often missing **tax-inclusive vs exclusive** toggles — verify tax calc math.
- [ ] **Rider Tracking:** Often missing **Offline Buffer** — verify coordinates save if signal drops.
- [ ] **Staff Dashboard:** Often missing **Printer Routing** — verify logic for "Kitchen" vs "Bar" tickets.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Financial Desynchronization | HIGH | Manual audit of Razorpay logs vs. Database; manual balance adjustment. |
| Corrupt State Machine | MEDIUM | Hard-reset order states via DB script; alert staff to re-verify status. |
| Menu Data Loss | MEDIUM | Restore from daily backup; re-input items from physical menu. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Happy Path State Machine | Order Engine | Unit tests for all invalid state transitions (e.g., `CREATED` -> `DELIVERED`). |
| Razorpay Webhook Drop-off | Payment System | Simulated "Closed Browser" test during payment flow. |
| Rider PWA Throttling | Tracking System | Field test with device screen off for 5 minutes. |
| Structured Modifiers | Menu Management | Ability to generate a "Station Ticket" with only relevant mods. |

## Sources

- [Razorpay Webhook Documentation](https://razorpay.com/docs/webhooks/)
- [MDN Background Geolocation Limits](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)
- [Post-mortem: The 'Friday Night' Cloud Failure Patterns](https://eats365pos.com)
- [Accounting for POS: Rounding and Taxes](https://safebooksglobal.com)

---
*Pitfalls research for: Restaurant Operating System (ROS)*
*Researched: 2024-05-22*
