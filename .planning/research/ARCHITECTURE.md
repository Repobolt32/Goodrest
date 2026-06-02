# Architecture Research: Restaurant Operating System (ROS)

**Domain:** Restaurant Operations & Real-time POS
**Researched:** 2026-04-30
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interfaces (Next.js)                 │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐      ┌──────────────┐      ┌──────────┐        │
│  │ Customer│      │ Staff        │      │ Rider    │        │
│  │ Web     │      │ Dashboard    │      │ PWA      │        │
│  └────┬────┘      └──────┬───────┘      └────┬─────┘        │
│       │                  │                   │              │
├───────┴──────────────────┴───────────────────┴──────────────┤
│                   API & Business Logic (TRPC)               │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │             Real-time Order State Engine            │    │
│  │  (State Machine, Price Calculator, Event Emitter)   │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│                   Data & Infrastructure                     │
│  ┌──────────┐      ┌──────────┐      ┌──────────────┐       │
│  │ Postgres │      │ Redis    │      │ External APIs│       │
│  │ (Prisma) │      │ (PubSub) │      │ (Razorpay,   │       │
│  │          │      │          │      │  Maps)       │       │
│  └──────────┘      └──────────┘      └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Order Engine** | Validates state transitions, calculates totals, and enforces business rules. | Shared library/module using `XState` or custom state machine. |
| **Real-time Layer** | Pushes updates to all connected clients (Staff, Rider, Customer). | TRPC Subscriptions or Pusher/Supabase Realtime. |
| **Menu Manager** | Handles menu hierarchy (Categories > Items > Modifiers). | Next.js Server Actions or TRPC procedures with Cache invalidation. |
| **Payment Handler** | Orchestrates checkout, payment verification, and webhook handling. | Razorpay Node.js SDK + Webhook listener. |
| **Rider Dispatcher**| Manages rider availability, assignment, and delivery lifecycle. | Background jobs (e.g., Inngest/BullMQ) or simple TRPC triggers. |

## Recommended Project Structure

```
src/
├── app/                  # Next.js App Router
│   ├── (customer)/       # Customer-facing routes
│   ├── (staff)/          # Dashboard routes
│   └── (rider)/          # PWA routes
├── components/           # UI Components
│   ├── shared/           # Common components (Buttons, Inputs)
│   ├── customer/         # Customer-specific UI
│   ├── staff/            # Dashboard widgets
│   └── rider/            # Mobile-optimized rider UI
├── server/               # Backend logic
│   ├── api/              # TRPC Routers
│   │   ├── routers/
│   │   │   ├── order.ts
│   │   │   ├── menu.ts
│   │   │   └── delivery.ts
│   │   └── trpc.ts       # Context & initialization
│   ├── db/               # Prisma client & schema
│   └── logic/            # Domain logic (State machine, Pricing)
├── lib/                  # Shared utilities
│   ├── validators/       # Zod schemas (shared Frentend/Backend)
│   └── utils/            # Formatters, constants
└── hooks/                # Custom React hooks (Real-time sync)
```

### Structure Rationale

- **src/app/(groups)/:** Uses Next.js Route Groups to separate layouts and concerns for different actors while sharing the same underlying auth/api.
- **src/server/logic/:** Decouples business rules (like "How much is tax?") from the API transport layer (TRPC). This makes testing easier.
- **src/lib/validators/:** Essential for T3 stack. Ensures that the data shape is identical from the database to the form inputs.

## Architectural Patterns

### Pattern 1: Event-Driven State Machine

**What:** The "Order" object is managed by a strict state machine. Any status change triggers an event.
**When to use:** Crucial for restaurant systems where orders move through many hands (Customer -> Kitchen -> Rider).
**Trade-offs:** Adds initial complexity but prevents impossible states (e.g., a "Delivered" order being marked as "Cancelled").

**Example:**
```typescript
type OrderState = 'PLACED' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';

const transition = (current: OrderState, event: string): OrderState => {
  const allowed: Record<OrderState, Partial<Record<string, OrderState>>> = {
    PLACED: { STAFF_ACCEPT: 'ACCEPTED', CANCEL: 'CANCELLED' },
    ACCEPTED: { START_COOKING: 'PREPARING', CANCEL: 'CANCELLED' },
    // ...
  };
  return allowed[current]?.[event] ?? current;
};
```

### Pattern 2: Pub/Sub for UI Sync

**What:** Instead of clients polling for updates, the server broadcasts "Order Updated" messages to specific rooms/channels.
**When to use:** Real-time visibility in the kitchen and for customer tracking.
**Trade-offs:** Requires a WebSocket provider or long-polling mechanism; can be tricky in serverless environments.

### Pattern 3: Financial Source of Truth

**What:** Pricing is never calculated on the client for final transactions. The client sends IDs, and the server re-fetches prices from the DB to calculate the total.
**When to use:** Always, for security and financial accuracy.
**Trade-offs:** Slight performance hit (extra DB reads), but non-negotiable for POS.

## Data Flow

### Request Flow (Placing an Order)

```
[Customer clicks 'Pay']
    ↓
[TRPC checkout] → [Create Order in DB (PENDING)] → [Initiate Razorpay]
    ↓                      ↓                           ↓
[Redirect to Gateway] ← [Update Payment ID] ← [Return Razorpay Order ID]
    ↓
[Payment Success] → [Razorpay Webhook] → [Mark Order PLACED] → [Broadcast to Staff]
```

### Key Data Flows

1. **Real-time Tracking:** Rider PWA sends GPS pings → Server updates Cache/Redis → Broadcasts to Customer Socket → Customer Tracking Map updates.
2. **Menu Sync:** Admin updates price in Dashboard → DB Update → `revalidatePath` (Next.js) or WebSocket broadcast → Customer UI updates prices instantly.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1 Restaurant (MVP) | Monolith with Postgres. Serverless (Vercel) + Pusher for real-time. |
| 10-50 Restaurants | Add Redis for faster state lookups. Move real-time to dedicated WebSocket servers. |
| 100+ Restaurants | Microservices: Split "Menu Service", "Order Service", and "Payment Service". |

### Scaling Priorities

1. **First bottleneck:** Database connection pooling in serverless environments. (Fix: Prisma Accelerate or a dedicated DB proxy).
2. **Second bottleneck:** Real-time message volume. (Fix: Move from generic WebSockets to a dedicated message broker like RabbitMQ or NATS).

## Anti-Patterns

### Anti-Pattern 1: Client-Side Totals

**What people do:** Calculate the order total in React and send the final amount to the API.
**Why it's wrong:** Vulnerable to manipulation (users can change the price via devtools).
**Do this instead:** Send only item IDs and quantities; calculate the total on the server.

### Anti-Pattern 2: Auto-Incrementing IDs for Orders

**What people do:** Use standard DB IDs (1, 2, 3...) for order numbers shown to customers.
**Why it's wrong:** Competitors can guess order volume; potential collisions if moving to offline-first later.
**Do this instead:** Use human-readable short codes (e.g., #A4B2) for staff/customer interaction and UUIDs for the database.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Razorpay** | Redirect + Webhook | Webhooks are essential; never trust the client-side callback alone. |
| **Google Maps** | Client-side SDK + Server-side Distance Matrix | Use server-side for ETA calculations to prevent API key exposure. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **Order Engine ↔ Notification** | Event Emitter | Decouple order logic from "How we notify" (SMS, Email, Push). |
| **Staff ↔ Rider** | Manual Assignment | State transition from READY to DISPATCHED requires `riderId` link. |

## Sources

- [Vercel Real-time Patterns](https://vercel.com/docs/concepts/solutions/real-time)
- [Razorpay Best Practices](https://razorpay.com/docs/payments/best-practices/)
- [Domain-Driven Design for POS Systems](https://medium.com/design-microservices-architecture-with-patterns/pos-system-design-case-study-87a2a07c11f7)

---
*Architecture research for: Restaurant Operating System (ROS)*
*Researched: 2026-04-30*
