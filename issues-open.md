# Goodrest Platform — Open Issues Registry (Merged)

**Merged from:** `issues-open.md` + `rider_issues.md`
**Last verified:** 2026-06-09
**Total open:** 28 issues

---

## 🟠 HIGH (7)

### BUG-21 — loginRider Never Sets rider_session Cookie
* **File:** `src/app/actions/riderActions.ts:41-69`, `src/lib/auth.ts:38-59`
* **Issue:** `loginRider` compares passwords and returns `{ success: true, rider }` but never calls `cookies().set()` or `signRiderSession()`. The HTTP-only `rider_session` cookie is never created server-side. All subsequent rider actions (`acceptOrder`, `startRiding`, `markOrderAsDeliveredRider`, `getRider24HHistory`) call `verifyRiderSession()` which reads `cookies().get('rider_session')` → returns `undefined` → `Unauthorized`. Entire rider flow is broken after login.
* **Evidence:** `bug-verification.test.ts` proves: `loginRider` does NOT call `cookies()` (test passes). `acceptOrder` without cookie returns `{ success: false, error: 'Unauthorized' }` (test passes). Existing `riderActions.test.ts` mocks `verifyRiderSession` to always succeed, hiding this.
* **Fix:** In `loginRider`, after successful bcrypt compare: `const token = await signRiderSession({ id: rider.id, name: rider.name, phone: rider.phone }); const cookieStore = await cookies(); cookieStore.set('rider_session', token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 7 * 24 * 60 * 60 });`
* **Severity:** CRITICAL — Rider cannot accept, start, or deliver any orders.

### BUG-14 — Rider Accept Order Unauthorized: Tests Mock Real Auth Flow
* **File:** `src/tests/unit/actions/bug-verification.test.ts`, `riderActions.test.ts`
* **Issue:** All tests mock `verifyRiderSession` to always succeed. Real flow: `loginRider` sets HTTP-only cookie via `cookies().set()`, `acceptOrder` reads it via `verifyRiderSession()`. Tests never verify actual cookie persistence. False confidence.
* **Evidence:** `bug-verification.test.ts:109` mocks `verifyRiderSession` instead of testing real JWT verification.
* **Fix:** Remove auth mocks from critical path tests. Test real cookie set → read flow. Add integration test that calls `loginRider` then `acceptOrder` without mocking `verifyRiderSession`.

### BUG-15 — BackgroundGeolocation Plugin Not Synced to Android
* **File:** `src/hooks/useBackgroundLocation.ts:43`, `android/app/src/main/java/com/goodrest/rider/MainActivity.java`
* **Issue:** `@capacitor-community/background-geolocation@1.2.26` is installed but `npx cap sync` was not run. `MainActivity.java` doesn't register the plugin. Error: `"BackgroundGeolocation plugin is not implemented on android"`.
* **Evidence:** `npm list @capacitor-community/background-geolocation` shows installed, but native code not linked.
* **Fix:** Run `npx cap sync` to sync plugin to native projects. Verify `MainActivity.java` auto-registers plugin (Capacitor 6.x should auto-register).

### BUG-16 — FloatingCart Overlaps Dish Cards on Mobile (FIXED)
* **File:** `src/app/page.tsx:34`, `src/components/FloatingCart.tsx:14`
* **Issue:** `FloatingCart` at `fixed bottom-6` overlaps with dish cards on mobile (390px viewport). Users tapping dish cards accidentally tap FloatingCart → navigates to checkout with empty cart.
* **Evidence:** Playwright test with mobile viewport detected bounding box overlap: `Dish card 0 overlaps with FloatingCart`.
* **Fix:** Increased `pb-32` to `pb-40` and added 24px spacer div. FloatingCart no longer overlaps.
* **Status:** ✅ FIXED — All 471 unit tests pass, Playwright overlap test passes.

### BUG-07 — Weak Tests: Assert `success` But Not Payload
* **File:** `tests/unit/actions/orderActions.test.ts`, `ownerActions.test.ts`
* **Issue:** Tests pass even if wrong data sent to DB. False confidence.
* **Fix:** Assert exact arguments: `expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'preparing' }))`.

### BUG-12 — Direct Supabase Queries from Frontend
* **File:** `useMenu.ts:4`, `OrderTracker.tsx:166`, `OwnerDashboardClient.tsx:5`, `admin/layout.tsx:24`, `track/order/[id]/page.tsx:7`, `rider/dashboard/page.tsx:5`, `CheckoutForm.tsx`
* **Issue:** 15+ components/pages query Supabase directly from browser. RLS is the only protection.
* **Fix:** Route sensitive reads through Server Actions. Keep realtime subscriptions only for non-sensitive status updates.

### BUG-13 — Delivery Fee Math Beyond 5km
* **File:** `src/lib/pricing.ts:23`
* **Issue:** `AFTER_5KM_BASE + Math.ceil(distanceKm - 5) * AFTER_5KM_PER_KM`. Need to verify if `Math.ceil(distanceKm - 5)` is intentional (rounds up partial km) or should use raw subtraction.
* **Fix:** Document intent. If exact per-km: `AFTER_5KM_BASE + (distanceKm - 5) * AFTER_5KM_PER_KM`.

---

## 🟡 MEDIUM (11)

### BUG-17 — Offers Table Migration Not Applied to Database
* **File:** `supabase/migrations/20260608000000_create_offers.sql`, `src/app/admin/offers/page.tsx`
* **Issue:** Migration file exists but was never applied. Admin offers page shows: `"Could not find the table 'public.offers' in the schema cache"`. Offers feature completely broken.
* **Evidence:** Navigating to `/admin/offers` returns error. Table doesn't exist in Supabase.
* **Fix:** Apply migration: `npx supabase db push` or run SQL manually in Supabase dashboard.

### BUG-18 — Menu Images Use External Unsplash URLs
* **File:** `src/components/MenuItemCard.tsx:43-49`
* **Issue:** Some menu items use external Unsplash URLs (e.g., `https://images.unsplash.com/photo-...`). Others show "IMAGE NOT AVAILABLE". Inconsistent and fragile — if Unsplash URLs expire or change, images break.
* **Evidence:** Butter Chicken, Garlic Naan use Unsplash. Jeera Rice, Masala Chai show "IMAGE NOT AVAILABLE".
* **Fix:** Replace all external URLs with local PNG files in `/public/images/`. Update database `image_url` columns to point to local paths.

### QOL-03 — Blind Type Cast `as unknown as MenuItem[]`
* **File:** `src/hooks/useMenu.ts`
* **Issue:** Bypasses TypeScript safety. Runtime crash if schema diverges.
* **Fix:** Validate with `zod` or runtime schema check.

### QOL-05 — Categories Fetched on Every Category Change
* **File:** `src/hooks/useMenu.ts:19-23`
* **Issue:** Fetches all categories on every mount/category switch. Should cache.
* **Fix:** Fetch once on mount. Filter client-side.

### QOL-06 — Hardcoded Rating "4.1" on All Menu Items
* **File:** `src/components/MenuItemCard.tsx`
* **Issue:** Fake data. Misleading customers.
* **Fix:** Remove or fetch real rating from reviews table.

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

### QOL-15 — Error Status Uses Emoji String Matching
* **File:** `src/components/CheckoutForm.tsx`
* **Issue:** Fragile logic. `status.includes('❌')` breaks if emoji changes.
* **Fix:** Use error codes, not string/emoji matching.

### QOL-19 — loginRider Parameter Name Misleading
* **File:** `src/app/actions/riderActions.ts:42`
* **Issue:** Parameter named `password_hash` but client sends plaintext. Name causes confusion.
* **Fix:** Rename to `password`.

### QOL-20 — OrderTracker.tsx Direct Supabase Client Query
* **File:** `src/components/OrderTracker.tsx`
* **Issue:** Queries `orders` + `riders` directly from browser. Relies entirely on RLS.
* **Fix:** Move initial fetch to Server Action. Keep realtime subscription for updates only.

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

*Registry updated: 2026-06-09 — Added 5 new DB/security issues from full review. 33 open issues total (8 High, 12 Medium, 5 Low, 2 Runtime, 6 Dependency).*
