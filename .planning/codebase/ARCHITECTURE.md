# Architecture

**Analysis Date:** 2026-05-09

## Pattern

**Full-stack monolith with Next.js App Router.**

Single Next.js 16 application using the App Router pattern (`src/app/`). No separate backend service — all data access flows through Next.js Server Actions or API Routes.

## Layers

| Layer | Responsibility | Key Files |
|-------|----------------|-----------|
| **Presentation** | React components, pages, client state | `src/app/**/*.tsx`, `src/components/**/*.tsx` |
| **Hooks** | Reusable client-side data fetching and state | `src/hooks/*.ts` |
| **Actions** | Server Actions — mutations, auth, business logic | `src/app/actions/*.ts` |
| **API Routes** | Webhooks, external callbacks | `src/app/api/**/*.ts` |
| **Library** | Clients, utilities, config | `src/lib/*.ts` |
| **Types** | Shared TypeScript interfaces | `src/types/*.ts` |
| **Database** | Supabase PostgreSQL schema + migrations | `supabase/migrations/*.sql` |

## Data Flow

### Customer Order Flow

```
Home (page.tsx)
  → useMenu hook → Supabase SELECT menu_items
  → useCart hook → localStorage
  → CheckoutForm (client)
    → createOrder Server Action
      → Supabase INSERT orders + order_items
      → Razorpay order creation
    → Razorpay checkout.js (client redirect)
    → Payment success
      → verifyPaymentSignature Server Action
      → Supabase UPDATE orders.payment_status='paid'
      → Razorpay webhook (async)
        → POST /api/webhook/razorpay
        → Supabase UPDATE orders.order_status='preparing'
```

### Admin Order Management Flow

```
Admin dashboard (admin/orders/page.tsx)
  → fetchOrders Server Action
    → Supabase SELECT orders (limit 10)
  → Supabase Realtime subscription
    → new orders pushed to OrdersDashboardClient
    → Audio notification + visual badge
  → Dispatch rider
    → assignRider Server Action
    → Supabase UPDATE orders.rider_id
  → Mark delivered
    → markOrderAsDelivered Server Action
    → Supabase UPDATE orders.status='delivered'
```

### Rider Flow

```
Rider login (rider/login/page.tsx)
  → phone + password → loginRider Server Action
    → Supabase SELECT riders WHERE phone = ?
    → plain password comparison
  → localStorage setItem('rider')
Rider dashboard (rider/dashboard/page.tsx)
  → fetchAssignedOrders
  → Supabase Realtime channel for new orders
  → acceptOrder Server Action (race condition risk)
  → GPS watchPosition → updateLocation Server Action
```

## Entry Points

| Entry | Path | Role |
|-------|------|------|
| **Customer home** | `/` | Browse menu, add to cart, navigate to checkout |
| **Checkout** | `/checkout` | Cart review, Razorpay payment |
| **Order success** | `/checkout/success` | Post-payment confirmation |
| **Order tracking (phone)** | `/track/[phone]` | Phone lookup → order list |
| **Single order track** | `/track/order/[id]` | Realtime order status + ETA |
| **Admin login** | `/admin/login` | JWT-based admin auth |
| **Admin orders** | `/admin/orders` | Realtime order table, dispatch UI |
| **Admin menu** | `/admin/menu` | Menu CRUD, image upload |
| **Rider login** | `/rider/login` | Phone+password auth |
| **Rider dashboard** | `/rider/dashboard` | Assigned orders, GPS tracking |
| **Webhook** | `/api/webhook/razorpay` | Razorpay payment events |

## Abstractions

### Supabase Client Duality

Two clients handle different trust boundaries:

- **`src/lib/supabase.ts`** — Public anon key, RLS-enforced. Used in browser and server actions for user-facing reads.
- **`src/lib/supabaseAdmin.ts`** — Service role key, bypasses RLS. Used for admin mutations (delete, raw SELECT/UPDATE).

### Authentication Patterns

| Role | Mechanism | Storage | Guard |
|------|-----------|---------|-------|
| Admin | JWT (`jose`, HS256, 24h) | HTTP-only cookie `admin_session` | `src/middleware.ts` |
| Rider | Plain password compare | `localStorage` | None (client-side only) |
| Customer | Phone number (no auth) | `localStorage` cart | None |

### Cart State

- `useCart` hook manages cart in `localStorage`.
- Schema: `{ id, name, price, quantity, category_id }[]`.
- No versioning — schema changes risk parse errors.

### Distance / ETA

- `src/lib/distance.ts` — Google Maps Routes API for road distance between restaurant and customer.
- Requires `GOOGLE_MAPS_API_KEY` environment variable.

## Component Boundaries

### Shared Components

- `Header`, `Hero`, `MenuItemCard`, `CategoryTabs`, `FloatingCart` — Customer-facing
- `CheckoutForm`, `CheckoutSummary` — Checkout flow
- `OrderTracker` — Tracking widget (customer + rider views)

### Admin Components

- `OrdersDashboardClient` — Realtime order table, dispatch UI, notifications
- `MenuManagementClient` — CRUD for menu items, image upload
- `AdminSearchBar` — Order search by phone/name

### Rider Components

- `OrderBroadcast` — Realtime new-order popup with accept button

## Middleware

`src/middleware.ts` guards `/admin/*` routes:

1. Skip if `E2E_MODE === 'true'`
2. Allow `/admin/login`
3. Check `admin_session` cookie
4. Verify JWT with `jose`
5. Redirect to login on failure

Matcher: `/admin/:path*` only.

## State Management

- **Server state:** Supabase (primary source of truth)
- **Client state:** React `useState` + `useEffect` (no Zustand/Redux)
- **Realtime:** Supabase Realtime subscriptions in `useEffect` (admin orders, rider dashboard, order tracking)
- **Cart:** `localStorage` via `useCart` hook

## File Upload Flow

1. Admin selects image in `MenuManagementClient`
2. Client uploads to Supabase Storage bucket `dish-images`
3. Public URL returned and stored in `menu_items.image_url`
4. `next.config.ts` whitelists `*.supabase.co` for remote images

---

*Architecture analysis: 2026-05-09*
