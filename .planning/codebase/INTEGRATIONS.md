# External Integrations

**Analysis Date:** 2026-05-09

## APIs & External Services

**Payment Processing:**
- Razorpay — Payment gateway for online orders (UPI, cards, wallets)
  - SDK: `razorpay` npm package (`src/lib/razorpay.ts`)
  - Auth: `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` env vars
  - Webhook secret: `RAZORPAY_WEBHOOK_SECRET`
  - Usage: `src/app/actions/orderActions.ts` (order creation, signature verification)
  - Webhook handler: `src/app/api/webhook/razorpay/route.ts`

**Maps / ETA Providers:**
- Google Maps API — Distance/ETA calculation (production, optional)
  - Env: `GOOGLE_MAPS_API_KEY`
- Mapbox — Alternative ETA provider (optional)
  - Env: `MAPBOX_ACCESS_TOKEN`
- Note: Core distance/ETA logic uses Google Maps Routes API in `src/lib/distance.ts` (requires GOOGLE_MAPS_API_KEY)

**Image/CDN:**
- Unsplash — Stock food photography for menu items
  - Configured in `next.config.ts` remotePatterns: `images.unsplash.com`, `unsplash.com`
- Pexels — Alternative stock images
  - Configured in `next.config.ts`: `**.pexels.com`, `pexels.com`
- Pixabay — Alternative stock images
  - Configured in `next.config.ts`: `pixabay.com`

**Fonts:**
- Google Fonts CDN — Inter and Fira Code fonts loaded via `@import` in `src/app/globals.css`

## Data Storage

**Database:**
- PostgreSQL (via Supabase) — Primary database
  - Connection: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public client)
  - Service role: `SUPABASE_SERVICE_ROLE_KEY` (admin client, bypasses RLS)
  - Client: `@supabase/supabase-js`
  - Public client: `src/lib/supabase.ts` (browser + server, RLS-enforced)
  - Admin client: `src/lib/supabaseAdmin.ts` (server-only, bypasses RLS)
  - Schema: `supabase/migrations/` contains SQL migrations

**Tables:**
- `categories` — Menu categories
- `menu_items` — Food items with pricing, availability, images
- `orders` — Order records with customer info, status, payment state
- `order_items` — Normalized line items for auditing
- `customers` — Customer profiles (name, phone, address, order count)
- `app_settings` — Global app configuration (delivery radius, delivery enabled)
- `riders` — Delivery rider accounts (phone, password_hash, location)
- `rider_locations` — Location history breadcrumbs for riders
- `batches` — Delivery batching records

**File Storage:**
- Supabase Storage — Dish image uploads
  - Bucket: `dish-images`
  - Upload logic: `src/app/actions/adminActions.ts` (`uploadDishImage`)
  - Max file size: 2MB
  - Valid types: JPEG, PNG, WebP, AVIF

**Caching:**
- Next.js built-in caching — `revalidatePath()` used in server actions for cache invalidation
- No external caching service (Redis/Memcached) detected

## Authentication & Identity

**Admin Authentication:**
- Custom JWT-based auth (not Supabase Auth)
  - Implementation: `jose` library (`src/app/actions/authActions.ts`)
  - Password check against `ADMIN_PASSWORD` env var
  - JWT signed with `JWT_SECRET` (HS256), 24h expiry
  - HTTP-only cookie `admin_session` with `sameSite: lax`
  - Middleware guard: `src/middleware.ts` protects `/admin/*` routes
  - E2E bypass: `E2E_MODE=true` skips auth in middleware for Playwright tests

**Rider Authentication:**
- Custom password-based auth via Supabase DB
  - Table: `riders` with `password_hash` field
  - Login: `src/app/actions/riderActions.ts` (`loginRider`)
  - No session mechanism detected for riders (stateless phone+password check)

**Customer Authentication:**
- None — Customers identified by phone number only
  - Phone collected at checkout, upserted to `customers` table

## Monitoring & Observability

**Error Tracking:**
- None — No Sentry, Rollbar, or similar service detected
- Errors logged to `console.error` throughout the codebase

**Logs:**
- Structured console logging in server actions (`[createOrder]`, `[verifyPaymentSignature]`, `[Webhook]`)
- No external log aggregation service

## CI/CD & Deployment

**Hosting:**
- Not explicitly configured — Likely Vercel (Next.js app)

**CI Pipeline:**
- None detected — No GitHub Actions, Travis, or similar config found

## Environment Configuration

**Required env vars:**
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Public Supabase key
- `SUPABASE_SERVICE_ROLE_KEY` — Server-side Supabase key
- `RAZORPAY_KEY_ID` — Razorpay API key
- `RAZORPAY_KEY_SECRET` — Razorpay secret
- `RAZORPAY_WEBHOOK_SECRET` — Webhook verification secret
- `JWT_SECRET` — Admin session signing secret
- `ADMIN_PASSWORD` — Admin login password
- `GOOGLE_MAPS_API_KEY` / `MAPBOX_ACCESS_TOKEN` — At least one required for production ETA
- `CRON_SECRET` — Optional cron endpoint protection
- `E2E_MODE` — Set to `true` for Playwright E2E test runs
- `E2E_VERIFICATION_SECRET` — Optional E2E verification secret

**Secrets location:**
- `.env` file (gitignored — noted as present)
- Playwright config injects fallback secrets for test server

## Webhooks & Callbacks

**Incoming:**
- `POST /api/webhook/razorpay` — Razorpay payment webhooks
  - Handler: `src/app/api/webhook/razorpay/route.ts`
  - Events handled: `payment.captured`, `payment.failed`
  - Signature verification: `Razorpay.validateWebhookSignature()`
  - Idempotent updates to `orders` table in Supabase

**Outgoing:**
- None detected — No outgoing webhooks to external systems

## Realtime

**Supabase Realtime:**
- Configured implicitly via Supabase client but not actively used in visible code
- Potential for future order status realtime updates

---

*Integration audit: 2026-05-09*
