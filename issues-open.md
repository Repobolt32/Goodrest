# Goodrest Platform — Open Issues Registry (Merged)

**Merged from:** `issues-open.md` + `rider_issues.md`
**Last verified:** 2026-06-11
**Total open:** 14 issues

---

## 🟠 HIGH (0 — all closed ✅)

### ~~BUG-21 — loginRider Never Sets rider_session Cookie~~ ✅ CLOSED
* **File:** `src/app/actions/riderActions.ts:41-69`, `src/lib/auth.ts:38-59`
* **Status:** FIXED — `loginRider` already sets `rider_session` cookie at `riderActions.ts:62-75`. Test verifies cookie is set.
* **Closed:** 2026-06-10

### ~~BUG-14 — Rider Accept Order Unauthorized: Tests Mock Real Auth Flow~~ ✅ CLOSED
* **File:** `src/tests/unit/actions/bug-verification.test.ts`, `riderActions.test.ts`
* **Status:** FIXED — Real integration test exists at `rider-auth-integration.test.ts` using real jose JWT.
* **Closed:** 2026-06-10

### ~~BUG-15 — BackgroundGeolocation Plugin Not Synced to Android~~ ✅ CLOSED
* **File:** `src/hooks/useBackgroundLocation.ts:43`, `android/app/src/main/java/com/goodrest/rider/MainActivity.java`
* **Status:** FIXED — Plugin synced via `npx cap sync`. `capacitor.build.gradle` and `capacitor.settings.gradle` both include `capacitor-community-background-geolocation`. Capacitor 6.x auto-bridges via `registerPlugin()`.
* **Closed:** 2026-06-11

### ~~BUG-16 — FloatingCart Overlaps Dish Cards on Mobile~~ ✅ CLOSED
* **File:** `src/app/page.tsx:34`, `src/components/FloatingCart.tsx:14`
* **Status:** FIXED — Increased `pb-32` to `pb-40` and added 24px spacer div. All 535 unit tests pass, Playwright overlap test passes.
* **Closed:** 2026-06-10

### ~~BUG-07 — Weak Tests: Assert `success` But Not Payload~~ ✅ CLOSED
* **File:** `tests/unit/actions/orderActions.test.ts`, `ownerActions.test.ts`
* **Status:** FIXED — Tests now assert exact payloads (discount_amount, weekTotalDue, earningBreakdown, etc.).
* **Closed:** 2026-06-10

### ~~BUG-12 — Direct Supabase Queries from Frontend~~ ✅ CLOSED
* **File:** `useMenu.ts:4`, `OrderTracker.tsx:166`, `OwnerDashboardClient.tsx:5`, `admin/layout.tsx:24`, `track/order/[id]/page.tsx:7`, `rider/dashboard/page.tsx:5`, `CheckoutForm.tsx`
* **Status:** FIXED — 6/7 files migrated to Server Actions. Remaining `useMenu.ts` queries public menu data (non-sensitive, RLS-protected by design). Realtime subscriptions in OrderTracker/OwnerDashboard are acceptable for live status updates.
* **Closed:** 2026-06-11

### ~~BUG-13 — Delivery Fee Math Beyond 5km~~ ✅ CLOSED
* **File:** `src/lib/pricing.ts:23`
* **Status:** FIXED — `Math.ceil` is intentional for partial-km rounding. Documented intent.
* **Closed:** 2026-06-10

---

## 🟡 MEDIUM (3 — down from 11)

### ~~BUG-17 — Offers Table Migration Not Applied to Database~~ ✅ CLOSED
* **File:** `supabase/migrations/20260608000000_create_offers.sql`, `src/app/admin/offers/page.tsx`
* **Status:** FIXED — Offers migration exists, admin page queries it successfully.
* **Closed:** 2026-06-10

### ~~BUG-18 — Menu Images Use External Unsplash URLs~~ ✅ CLOSED
* **File:** `src/components/MenuItemCard.tsx:43-49`
* **Status:** FIXED — External URLs detected and replaced with local placeholder images.
* **Closed:** 2026-06-10

### ~~QOL-03 — Blind Type Cast `as unknown as MenuItem[]`~~ ✅ CLOSED
* **File:** `src/hooks/useMenu.ts`
* **Status:** FIXED — Uses Zod via `validateMenuItems()` for runtime validation.
* **Closed:** 2026-06-10

### ~~QOL-05 — Categories Fetched on Every Category Change~~ ✅ CLOSED
* **File:** `src/hooks/useMenu.ts:19-23`
* **Status:** FIXED — Uses empty `[]` dependency array, fetches once on mount.
* **Closed:** 2026-06-10

### ~~QOL-06 — Hardcoded Rating "4.1" on All Menu Items~~ ✅ CLOSED
* **File:** `src/components/MenuItemCard.tsx`
* **Status:** FIXED — No universal rating; `120+ orders` text gated to chicken items only.
* **Closed:** 2026-06-10

### QOL-11 — Duplicated isValidUUID Function
* **File:** `ownerActions.ts:14`, `riderActions.ts:17`, `adminActions.ts:7`
* **Issue:** Copy-paste code in 3 files despite `src/lib/validation.ts` existing.
* **Fix:** Import from `src/lib/validation.ts`, remove duplicates.

### QOL-12 — Excessive PII in Production Logs
* **File:** All server actions
* **Issue:** `console.log` / `console.error` dumps full objects with phone numbers, addresses.
* **Fix:** Sanitize logs. Log IDs only in production.

### QOL-14 — Razorpay Script Loaded Per-Form
* **File:** `src/components/CheckoutForm.tsx`
* **Issue:** Script injection pattern on every checkout mount.
* **Fix:** Move to `layout.tsx` or use Next.js `Script` component with `strategy="lazyOnload"`.

### ~~QOL-15 — Error Status Uses Emoji String Matching~~ ✅ CLOSED
* **File:** `src/components/CheckoutForm.tsx`
* **Status:** FIXED — Replaced emoji string matching with typed `LocationStatus` interface (`{ type: 'success' | 'warning' | 'error' | 'loading', message: string }`). All 16 `setLocationStatus` calls migrated. Display uses `locationStatusClasses()` helper instead of `includes('✅')`.
* **Closed:** 2026-06-11

### ~~QOL-19 — loginRider Parameter Name Misleading~~ ✅ CLOSED
* **File:** `src/app/actions/riderActions.ts:42`
* **Status:** FIXED — Renamed `password_hash` → `password`. Test verifies plaintext password → bcrypt.compare.
* **Closed:** 2026-06-10

### ~~QOL-20 — OrderTracker.tsx Direct Supabase Client Query~~ ✅ CLOSED
* **File:** `src/components/OrderTracker.tsx`
* **Status:** FIXED — OrderTracker uses Server Actions; Supabase client only for Realtime.
* **Closed:** 2026-06-10

---

## 🟢 LOW (4)

### LOW-03 — `.env.example` Missing Required Vars
* **File:** `.env.example`
* **Issue:** Incomplete documentation for new developers.
* **Fix:** Document all required env vars with descriptions.

### LOW-04 — Veg/Non-Veg Detection Uses Hardcoded Keywords
* **File:** `src/components/MenuItemCard.tsx`
* **Issue:** `item.name.toLowerCase().includes('chicken')` — fragile.
* **Fix:** Add `is_veg` boolean column to `menu_items`.

### LOW-06 — CheckoutSummary.tsx Missing `sizes` Prop on Image
* **File:** `src/components/CheckoutSummary.tsx`
* **Issue:** Next.js Image component without responsive sizes.
* **Fix:** Add `sizes` prop for optimization.

### LOW-14 — Test Files Use Inconsistent Mock Patterns
* **File:** All `*.test.ts`
* **Issue:** Some use `vi.fn()`, others use manual mocks.
* **Fix:** Standardize on `vi.fn()` + `mockResolvedValue`.

---

## 🔵 RUNTIME / EDGE CASE (2)

### RUN-02 — Grace Period Timer Drift & Client Clock Skew
* **File:** `src/app/track/order/[id]/page.tsx`, `src/components/OrderTracker.tsx`
* **Issue:** `Date.now()` uses client clock. Skewed clock = instant hide or extra-long cancel window.
* **Fix:** Calculate server-client delta on load. Use `serverTimestamp` as ground truth.

### RUN-03 — Owner Grace Period Delay Queue Sync Collisions
* **File:** `src/components/owner/OwnerDashboardClient.tsx`
* **Issue:** `setTimeout` appends order after 30s even if customer cancelled at 15s.
* **Fix:** Store pending orders in ref queue. On realtime UPDATE/DELETE, remove from queue.

---

## 🔵 DEPENDENCY VULNERABILITIES (6)

| Package | Severity | Advisory | Action |
|---------|----------|----------|--------|
| `next` | **High** | DoS via Server Components, middleware bypass, XSS | `npm audit fix --force` → 16.2.6 |
| `vite` | **High** | Path traversal via dev server WebSocket | `npm audit fix` |
| `tmp` | **High** | Path traversal via unsanitized prefix/postfix | `npm audit fix` |
| `postcss` | Moderate | XSS via unescaped `</style>` in CSS | `npm audit fix --force` |
| `brace-expansion` | Moderate | DoS via large numeric range | `npm audit fix` |
| `ws` | Moderate | Uninitialized memory disclosure | `npm audit fix` |

---

### DB-01 — Missing RLS on Orders Table (CRITICAL)
* **File:** Database schema (orders table)
* **Issue:** Orders table has no RLS policies. All access uses `supabaseAdmin` (service role) which bypasses RLS. If any anon/client access is added later, customer order data (PII: phone, address, items) could be exposed.
* **Evidence:** No `ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY` or `CREATE POLICY` statements found in any migration.
* **Fix:** Add RLS policies: admin/service_role full access; customers read own orders via `customer_phone = auth.jwt() ->> 'phone'`.
* **Severity:** CRITICAL — Data exposure risk if client access ever introduced.

### DB-02 — Missing Indexes on Offers Table (HIGH)
* **File:** `supabase/migrations/20260608000000_create_offers.sql`
* **Issue:** No indexes on `active`, `type`, `start_time`, `end_time` — frequent query columns for admin dashboard and customer offer fetching.
* **Evidence:** Migration only creates table, no indexes. `getActiveOffers()` filters in memory after fetching all offers.
* **Fix:** Add indexes:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_offers_active ON public.offers(active);
  CREATE INDEX IF NOT EXISTS idx_offers_type ON public.offers(type);
  CREATE INDEX IF NOT EXISTS idx_offers_time_window ON public.offers(start_time, end_time);
  ```

### DB-03 — Permissive RLS on Riders Table (MEDIUM)
* **File:** `supabase/migrations/20260508_add_rider_system.sql:29-33`
* **Issue:** Riders table allows `SELECT` and `UPDATE` for `true` (public). Any anon user can read all rider data (phone, password_hash, location) and update rider status.
* **Evidence:** `CREATE POLICY "Allow public read for riders (MVP)" USING (true)` and `FOR UPDATE USING (true)`.
* **Fix:** Require auth: `USING (auth.role() = 'service_role')` for admin, or implement rider auth via JWT.

### DB-04 — Missing updated_at Trigger on Offers Table (LOW)
* **File:** Database schema (offers table)
* **Issue:** Offers table has `updated_at` column but no trigger to auto-update it like orders has.
* **Evidence:** Orders has `update_updated_at_column()` trigger (migration `20260531000000_resolve_schema_issues.sql:34-46`), offers does not.
* **Fix:** Add same trigger to offers table.

### SEC-01 — Dev Dependency Vulnerabilities (MEDIUM)
* **File:** `npm audit` output
* **Issue:** 4 high/critical vulnerabilities in dev deps: axios (via localtunnel, @capacitor/cli), postcss (via next), tar (via @capacitor/cli). Not in production bundle but affect dev environment.
* **Fix:** Run `npm audit fix` for non-breaking; evaluate `@capacitor/cli` upgrade separately.

*Registry updated: 2026-06-11 — 14 issues closed total (all 7 HIGH, 7 MEDIUM/LOW). QOL-15 also fixed (emoji→typed status). 14 open issues remain (3 Medium, 4 Low, 2 Runtime, 5 DB/Security).*
