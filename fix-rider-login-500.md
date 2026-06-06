# Fix Rider Login 500 Error (LAN Testing)

## Goal
Identify the exact root cause of the HTTP 500 error on `/rider/login` when accessed via LAN IP, then apply a minimal, verified fix.

## Tasks

- [ ] **Task 1: Inspect `loginRider` server action**
  Read `src/app/actions/riderActions.ts` around line 40. Understand the data flow: inputs → validation → Supabase query → bcrypt compare → session set.
  → Verify: Can explain every line of `loginRider` to a stranger.

- [ ] **Task 2: Add surgical logging**
  Wrap the entire `loginRider` body in a `try/catch`. Inside `catch`, `console.error` the full error object including `.message`, `.stack`, and any arguments received. Do NOT change logic yet.
  → Verify: `npm run build` passes with the added logs.

- [ ] **Task 3: Reproduce and capture the real error**
  Start `npm run dev` (if not running). Open `http://192.168.29.229:3000/rider/login` in a browser, submit credentials `9999999999 / test123`. Watch the server terminal for the `console.error` output. Save the exact stack trace.
  → Verify: Terminal shows a detailed error message/stack trace, not just "500".

- [ ] **Task 4: Compare with a working login action**
  Find a working server action (e.g., customer login or admin login). Compare: how does it initialize Supabase? How does it handle bcrypt? How does it set cookies/session? List every difference, however small.
  → Verify: A written list of differences exists.

- [ ] **Task 5: Form a single root-cause hypothesis**
  Based on the stack trace from Task 3 and the comparison from Task 4, state one clear hypothesis: "I think X is the root cause because Y."
  → Verify: Hypothesis is written down before any code change.

- [ ] **Task 6: Apply minimal fix**
  Make the smallest possible code change to test the hypothesis. One variable at a time.
  → Verify: Only one logical change is made in the diff.

- [ ] **Task 7: Verify the fix**
  Submit rider login again via browser. Confirm it succeeds (no 500, rider dashboard loads). Re-run the direct Node.js script test to ensure it still passes.
  → Verify: Browser login works + direct script returns `{ success: true }`.

- [ ] **Task 8: Regression check**
  Run `npm run build` and `npm run test`. Ensure no new failures.
  → Verify: Both commands exit with code 0.

## Done When
- [ ] Rider login works over LAN IP without 500 errors.
- [ ] The exact root cause is documented in a comment or this plan.
- [ ] Build and tests pass.

## Notes
- **NO FIXES BEFORE ROOT CAUSE.** If the stack trace from Task 3 is ambiguous, repeat Task 3 with more granular logging.
- If 3+ fix attempts fail, stop and question the architecture (session handling vs. server actions) with the user.
