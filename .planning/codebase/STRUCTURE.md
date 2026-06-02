# Directory Structure

**Analysis Date:** 2026-05-09

```
goodrest-claude/
├── .planning/
│   └── codebase/              # GSD codebase maps
├── .claude/
│   └── get-shit-done/         # GSD workflow files
├── public/                    # Static assets
├── scripts/                   # Utility scripts
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── actions/           # Server Actions (mutations, queries, auth)
│   │   ├── admin/             # Admin dashboard pages
│   │   │   ├── login/
│   │   │   ├── menu/
│   │   │   ├── orders/
│   │   │   └── page.tsx
│   │   ├── api/
│   │   │   └── webhook/
│   │   │       └── razorpay/
│   │   │           └── route.ts
│   │   ├── checkout/
│   │   │   ├── page.tsx
│   │   │   └── success/
│   │   │       └── page.tsx
│   │   ├── rider/
│   │   │   ├── login/
│   │   │   └── dashboard/
│   │   ├── track/
│   │   │   ├── page.tsx
│   │   │   ├── [phone]/
│   │   │   └── order/
│   │   │       └── [id]/
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.module.css
│   │   └── page.tsx
│   ├── components/
│   │   ├── admin/
│   │   │   ├── AdminSearchBar.tsx
│   │   │   ├── MenuManagementClient.tsx
│   │   │   └── OrdersDashboardClient.tsx
│   │   ├── rider/
│   │   │   └── OrderBroadcast.tsx
│   │   ├── CategoryTabs.tsx
│   │   ├── CheckoutForm.tsx
│   │   ├── CheckoutSummary.tsx
│   │   ├── FloatingCart.tsx
│   │   ├── Header.tsx
│   │   ├── Hero.tsx
│   │   ├── MenuItemCard.tsx
│   │   ├── MenuSkeleton.tsx
│   │   ├── OrderTracker.tsx
│   │   └── OrderTracker.test.tsx
│   ├── hooks/
│   │   ├── useCart.ts
│   │   ├── useMenu.test.ts
│   │   └── useMenu.ts
│   ├── lib/
│   │   ├── distance.ts
│   │   ├── razorpay.ts
│   │   ├── supabase.ts
│   │   └── supabaseAdmin.ts
│   ├── middleware.ts
│   ├── tests/
│   │   ├── billing_integration.test.ts
│   │   ├── db_integration.test.ts
│   │   ├── setup.ts
│   │   └── e2e/
│   │       ├── admin-flow.spec.ts
│   │       ├── admin-menu-crud.spec.ts
│   │       ├── billing-realtime.spec.ts
│   │       ├── checkout-payment.spec.ts
│   │       ├── checkout-validation.spec.ts
│   │       ├── customer-flow.spec.ts
│   │       ├── delivery-tracking.spec.ts
│   │       ├── dispatch-bypass.spec.ts
│   │       ├── edge-cases.spec.ts
│   │       ├── eta-verification.spec.ts
│   │       ├── menu-management.spec.ts
│   │       ├── order-tracking-refactor.spec.ts
│   │       ├── rider-flow-full-loop.spec.ts
│   │       ├── route-audit.spec.ts
│   │       ├── tracking-edge-cases.spec.ts
│   │       └── whatsapp-dispatch.spec.ts
│   └── types/
│       ├── database.types.ts
│       ├── menu.ts
│       ├── orders.ts
│       └── payment.ts
├── supabase/
│   └── migrations/
├── .env
├── .gitignore
├── README.md
├── check_db.js
├── check_db_orders.js
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── package-lock.json
├── playwright.config.ts
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── vitest.config.ts
```

## Key Locations

| Concern | Location | Notes |
|---------|----------|-------|
| **Menu data** | `src/hooks/useMenu.ts` | Supabase SELECT with category filter |
| **Cart state** | `src/hooks/useCart.ts` | localStorage persistence |
| **Order creation** | `src/app/actions/orderActions.ts` | Razorpay + Supabase |
| **Admin auth** | `src/app/actions/authActions.ts` | JWT cookie |
| **Rider auth** | `src/app/actions/riderActions.ts` | Plain password compare |
| **Razorpay** | `src/lib/razorpay.ts` | SDK wrapper |
| **Webhook** | `src/app/api/webhook/razorpay/route.ts` | Signature verification |
| **DB types** | `src/types/database.types.ts` | Supabase generated types |
| **Menu types** | `src/types/menu.ts` | Category, MenuItem |
| **Order types** | `src/types/orders.ts` | Order, OrderItem, OrderStatus |
| **Payment types** | `src/types/payment.ts` | Razorpay payload types |
| **Distance** | `src/lib/distance.ts` | Google Maps Routes API + ETA calc |
| **Middleware** | `src/middleware.ts` | Admin route guard |
| **Tailwind theme** | `src/app/globals.css` | `@theme` directive (v4) |
| **E2E config** | `playwright.config.ts` | Dev server on port 3005 |
| **Vitest config** | `vitest.config.ts` | jsdom, React plugin, `@` alias |

## Naming Conventions

| Pattern | Example | Where |
|---------|---------|-------|
| Pages | `page.tsx` | Every App Router directory |
| Layouts | `layout.tsx` | `admin/`, root `app/` |
| Server Actions | `*Actions.ts` | `src/app/actions/` |
| Client components | `*Client.tsx` | Admin/rider dashboards |
| Hooks | `use*.ts` | `src/hooks/` |
| Types | `*.types.ts` | `src/types/` |
| Tests (unit) | `*.test.tsx` | Co-located with source |
| Tests (e2e) | `*.spec.ts` | `src/tests/e2e/` |
| Migrations | `YYYYMMDD_*.sql` | `supabase/migrations/` |

---

*Structure analysis: 2026-05-09*
