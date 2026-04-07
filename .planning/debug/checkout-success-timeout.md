---
status: investigating
trigger: "Investigate issue: checkout-success-timeout"
created: 2026-04-05T00:00:00+05:30
updated: 2026-04-06T00:22:00+05:30
---

## Current Focus

hypothesis: the active blocker is either Playwright waiting for the wrong readiness signal, Next.js 16/Turbopack on Windows hanging while compiling `/`, or repo code causing the root route compile to stall under the Playwright webServer process
test: compare `playwright.config.ts` readiness settings with direct `next dev` startup behavior and inspect which app route or dependency is reached during the stalled `Compiling / ...` phase
expecting: if direct startup also stalls, the issue is in Next.js/runtime code; if direct startup succeeds but Playwright times out, the issue is in `webServer` settings or process environment
next_action: inspect Playwright and Next config plus existing startup artifacts, then run isolated startup commands outside Playwright

## Symptoms

expected: After mocked online payment success, the app should verify payment, mark the order paid, and navigate to /checkout/success.
actual: Playwright times out waiting for /checkout/success. Frontend success handler appears to run, but backend success is not confirmed.
errors: Timeout 30000ms exceeded waiting for URL to contain /checkout/success. Suspected env propagation or race condition around DB update.
reproduction: Run Playwright checkout E2E flow with mocked Razorpay callback using pay_test_* payment ids.
started: Started after migration to mandatory online-only Razorpay flow with test bypass in verifyPaymentSignature.

## Eliminated

## Evidence

- timestamp: 2026-04-06T00:02:00+05:30
  checked: debug knowledge base presence
  found: `.planning/debug/knowledge-base.md` does not exist
  implication: there is no prior resolved pattern to bias the investigation

- timestamp: 2026-04-06T00:06:00+05:30
  checked: current checkout E2E specs and payment verification code
  found: `src/tests/e2e/checkout-payment.spec.ts` and `src/tests/e2e/customer-flow.spec.ts` now replace `window.Razorpay` with `page.evaluate(...)` after `/checkout` loads, and `verifyPaymentSignature` checks the E2E bypass before enforcing `RAZORPAY_KEY_SECRET`
  implication: both key assumptions in the saved hypothesis are stale for the current checkout path; direct reproduction is required

- timestamp: 2026-04-06T00:10:00+05:30
  checked: repository worktree state
  found: the checkout spec, payment verification code, and several related files are locally modified, so the active investigation is against a dirty but internally consistent working tree
  implication: reproduction must be interpreted against current local code, not the earlier snapshot represented by the saved evidence alone

- timestamp: 2026-04-06T00:20:00+05:30
  checked: targeted Playwright reproduction for `src/tests/e2e/checkout-payment.spec.ts`
  found: the run failed before test execution with `Timed out waiting 60000ms from config.webServer` while the Next dev server output remained at `Compiling / ...`
  implication: the current local blocker is upstream of checkout interaction, so the saved checkout-success timeout cannot be validated until startup/compilation is understood

- timestamp: 2026-04-06T00:31:00+05:30
  checked: `playwright.config.ts` webServer settings and existing startup artifacts
  found: Playwright starts `npm run dev` against `http://localhost:3000` with `reuseExistingServer: true`, and multiple saved logs in the repo (`playwright_repro_output.txt`, `playwright_full_failure.txt`, `final_debug*.log`) show the same stack reaching `Ready` in about 1-3 seconds and serving `GET /` successfully
  implication: the reported startup hang is not a deterministic consequence of the current Playwright config alone; either local state is intermittently poisoning startup or the earlier hang came from a different transient condition

- timestamp: 2026-04-05T00:06:00+05:30
  checked: playwright config and root env loading
  found: `playwright.config.ts` calls `dotenv.config({ path: path.resolve(__dirname, '.env') })` and the repository `.env` includes `E2E_VERIFICATION_SECRET=goodrest_test_secret`, `RAZORPAY_KEY_SECRET`, and Supabase credentials
  implication: the config process itself knows about the E2E secret; env absence is not established from static config alone

- timestamp: 2026-04-05T00:07:00+05:30
  checked: server action payment verification code
  found: `verifyPaymentSignature` hard-fails if `RAZORPAY_KEY_SECRET` is missing before the test bypass logic is considered
  implication: even test payments depend on server runtime having `RAZORPAY_KEY_SECRET`; `E2E_VERIFICATION_SECRET` is only an additional allow condition for bypass, not a replacement for the real secret

- timestamp: 2026-04-05T00:08:00+05:30
  checked: checkout form redirect path
  found: `CheckoutForm` only calls `router.push('/checkout/success')` after `await verifyPaymentSignature(response)` returns `{ success: true }`
  implication: frontend navigation is gated on server verification success; a timeout on success URL is consistent with server verification failure and not with a pure success-page mismatch

- timestamp: 2026-04-05T00:09:00+05:30
  checked: E2E specs versus page lifecycle
  found: all checkout-related specs call `page.addInitScript(...)` only after they already navigated to `/checkout`, and `CheckoutForm` injects Razorpay via `<Script src=\"https://checkout.razorpay.com/v1/checkout.js\" />`
  implication: the mock is registered too late to affect the current document load; it will only apply to future navigations/child frames, making the test setup structurally unreliable

## Resolution

root_cause:
fix:
verification:
files_changed: []
