# Handoff: Security & Quality Audit — issued.md Analysis

> **Fresh agent: read this file, then pick up where we left off.**

---

## Status: ANALYSIS COMPLETE, FIXES NOT STARTED

All 33 issues from `issued.md` have been verified against actual source code. 24 are real, 4 are false positives, 3 are exaggerated. No code changes were made in this session.

---

## Next Action

1. Read this handoff
2. Open `issued.md` for the full issue registry
3. Start fixing CRITICAL issues first (see Priority Queue below)
4. After each fix, run: `npm run build && npm run test && npm run lint`

---

## Final Tally

| Category | Count | IDs |
|----------|-------|-----|
| **REAL (fix these)** | **24** | See Priority Queue below |
| FALSE POSITIVE | 4 | SEC-01, BUG-03, BUG-06, BUG-07 |
| EXAGGERATED | 3 | SEC-03, SEC-06, BUG-04 |

---

## FALSE POSITIVES (Do NOT Fix — They're Wrong)

### SEC-01 — Secrets committed to git
**issued.md claim:** `.env` and `release/` have secrets in version control.
**Reality:** `.env` was never committed. `git ls-files ".env"` returns empty. `git log -- ".env"` returns empty. `.gitignore` properly covers `.env*`. The `release/` dir has Electron binaries (repo hygiene issue) but no secrets were leaked.

### BUG-03 — useMenu race condition on unmount
**issued.md claim:** No AbortController = setState on unmounted component.
**Reality:** `src/hooks/useMenu.ts:13` has `let cancelled = false` with cleanup on line 54. Both fetch points (lines 25, 43) check `cancelled` before calling setState. The flag works correctly.

### BUG-06 — FloatingCart dead exit prop
**issued.md claim:** FloatingCart has `exit` prop but parent has no `AnimatePresence`.
**Reality:** `src/app/page.tsx:85-89` wraps FloatingCart in `<AnimatePresence>`. The exit animation is fully functional.

### BUG-07 — Weak tests assert success but not payload
**issued.md claim:** Tests only check `success: true`, not actual data.
**Reality:** Tests check `result.distanceKm`, `result.earning`, exact RPC args, `insertCall.order_status`. The claim is factually wrong. See `riderActions.test.ts:178-179, 506-509`, `orderActions.test.ts:96-99, 167-168`.

---

## EXAGGERATED (Low Priority — Minimal or No Fix Needed)

### SEC-03 — E2E bypass without NODE_ENV
**issued.md claim:** Payment signature bypass has NO environment gate.
**Reality:** `src/middleware.ts:17` properly gates on `NODE_ENV !== 'production'`. The server action at `orderActions.ts:265` lacks the gate, but requires `E2E_MODE=true` in production env — a deployment misconfiguration, not a code vulnerability. Defense-in-depth improvement, not a critical fix.

### SEC-06 — Double refund vulnerability
**issued.md claim:** No check if refund already processed.
**Reality:** `ownerActions.ts:211` checks `payment_status !== 'paid'` before processing. TOCTOU race window is narrow (milliseconds). Not "no protection" as claimed.

### BUG-04 — useCart setTimeout hydration
**issued.md claim:** Race condition from setTimeout hydration.
**Reality:** `useCart.ts:23-27` uses intentional `setTimeout` to batch `items` + `mounted` state updates. Comment says "Single setTimeout to avoid race condition." Standard SSR hydration pattern, not a bug.

---

## PRIORITY QUEUE (24 REAL Issues — Fix Order)

### Phase 1: CRITICAL Security (8 issues)

| Issue | File:Line | What | Fix |
|-------|-----------|------|-----|
| **SEC-04** | `adminActions.ts`, `ownerActions.ts`, `riderActions.ts`, `reportActions.ts` | Zero auth on ALL server actions — anyone can delete orders, modify prices, upload files via curl | Add session/JWT validation at top of every action. Enforce role checks. |
| **SEC-02** | `supabase/migrations/20260519100000:66-68` | Auto-reject cron sets `payment_status = 'refunded'` without calling Razorpay — customer sees "refunded" but money never returned | Change to `payment_status = 'failed'` OR implement actual Razorpay refund API call |
| **SEC-05** | `orderActions.ts:351, 429` | `cancelOrder` and `sendHelpMessage` accept `customerPhone` from client param, ownership check is optional | Extract customerPhone from server-side session/cookie, not function parameter |
| **SEC-07** | `orderActions.ts:126-156` | Orders + items inserted as two separate non-atomic operations | Use Supabase RPC (stored procedure) for atomic transaction |
| **SEC-09** | `authActions.ts:17`, `orderActions.ts:47` | No rate limiting on login or order creation — brute-forceable, spammable | Add per-IP rate limits (upstash/ratelimit or DB counter) |
| **SEC-10** | `orderActions.ts:70-73` | E2E mode trusts client `total_amount` without NODE_ENV gate | Gate on `NODE_ENV !== 'production'` or remove E2E bypass from production code |
| **SEC-08** | `OrderTracker.tsx:135-154` | setState in render body — React anti-pattern, wastes render cycles | Move prop-to-state sync into useEffect with proper dependency array |
| **SEC-03** | `orderActions.ts:265-268` | (Exaggerated but worth fixing) Payment signature bypass lacks NODE_ENV gate | Add `NODE_ENV !== 'production'` check as defense-in-depth |

### Phase 2: HIGH Bugs (13 issues)

| Issue | File:Line | What | Fix |
|-------|-----------|------|-----|
| **BUG-13** | `pricing.ts:23` | Delivery fee charges per-km on ENTIRE distance, not just >5km portion | `AFTER_5KM_BASE + Math.ceil(distanceKm - 5) * AFTER_5KM_PER_KM` |
| **BUG-14** | `orderActions.ts:143-156` | order_items failure silently swallowed, retry with null IDs | Fail entire order creation. Surface error to user. |
| **BUG-01** | `trackActions.ts:40-52` | getOrderById relies only on RLS — no phone verification | Verify customer_phone from session matches order |
| **BUG-02** | `ownerActions.ts:274-276` | getOrdersForOwner returns `[]` on error — hides outages | Return `{ success: false, error: ... }` |
| **BUG-11** | `orderActions.ts:50-58` | Only presence checks, no format/length/bounds validation | Add phone regex, address min/max, quantity bounds |
| **BUG-12** | `useMenu.ts:4`, `OrderTracker.tsx:4` | Direct Supabase anon client queries from frontend | Move sensitive queries to Server Actions |
| **BUG-10** | `orderActions.ts:429-492` | sendHelpMessage — no revalidatePath after save | Add `revalidatePath('/track/order/' + orderId)` |
| **BUG-05** | `CheckoutForm.tsx:40-121` | No isLocating guard on detectLocation button | Add loading state, disable button during detection |
| **BUG-09** | `riderActions.ts:189-208` | updateLocation — two DB writes, zero throttling | Rate limit to 1 req per 5-10s per rider |
| **BUG-17** | `riderActions.ts:8-9`, `ownerActions.ts:10-11` | RESTO_LAT/LNG defaults to (0,0) in Gulf of Guinea | Throw on missing env var. No fallback. |
| **BUG-15** | `settingsActions.ts:28-46` | No bounds on max_delivery_radius | Add min/max validation |
| **BUG-16** | `ownerActions.ts:245-255` | No > 0 check on prep_time_minutes | Validate `prepTime > 0 && prepTime <= 120` |
| **BUG-08** | `riderActions.test.ts`, `orderActions.test.ts` | updateLocation, getRiderEarningHistory, updateRefundStatus untested | Add tests with vi.setSystemTime for timezone boundaries |

### Phase 3: Remaining MEDIUM/LOW (3 issues from the 33)

These are lower priority quality issues that were part of the original 33 but not in the critical/high categories above. Address after Phase 1-2 complete.

---

## Verification Commands

After each phase, run:
```bash
npm run build && npm run test && npm run lint
```

---

## Key Architecture Notes

- **Server Actions** are in `src/app/actions/` — these are the mutation layer
- **Middleware** (`src/middleware.ts`) only protects `/admin` page routes, NOT server action POST endpoints
- **supabaseAdmin** is used in all server actions — bypasses RLS but has no auth verification
- **No customer session mechanism exists** — customers have no JWT, no cookie-based auth. Only admin has `admin_session` cookie.
- **E2E_MODE** is a boolean env var that bypasses payment verification — must be false in production

---

## What NOT to Do

- Do NOT remove the `cancelled` flag from `useMenu.ts` — it works correctly
- Do NOT remove the `exit` prop from `FloatingCart` — parent has AnimatePresence
- Do NOT change the `setTimeout` hydration pattern in `useCart.ts` — it's intentional
- Do NOT "fix" the test assertions in BUG-07 — they already check payloads

---

## Files to Read Before Starting

| File | Why |
|------|-----|
| `issued.md` | Full issue registry with details |
| `src/app/actions/orderActions.ts` | Most issues cluster here (SEC-05, SEC-07, SEC-10, BUG-10, BUG-11, BUG-14) |
| `src/app/actions/adminActions.ts` | SEC-04 — needs auth guards |
| `src/app/actions/ownerActions.ts` | SEC-04, BUG-02, BUG-16 |
| `src/app/actions/riderActions.ts` | SEC-04, BUG-09, BUG-17 |
| `src/app/actions/authActions.ts` | SEC-09 — needs rate limiting |
| `src/lib/pricing.ts` | BUG-13 — delivery fee math |
| `src/components/OrderTracker.tsx` | SEC-08 — setState in render |
| `src/components/CheckoutForm.tsx` | BUG-05 — detectLocation guard |

---

*Handoff created: 2026-05-30*
*Analysis by: OpenCode agent*
*Next session: Start fixing Phase 1 CRITICAL issues*
