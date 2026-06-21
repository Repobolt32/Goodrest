# Handoff: Rider App Issues & TDD Progress

## Problem Statement
The user reported three specific issues:
1. **Admin Bell issue:** The "bell" notification sound/popup for new orders in the admin panel was not working properly outside the Orders page, but triggered unexpectedly when revisiting the Orders page.
2. **Rider Bell issue:** The Rider app rang the bell for unassigned orders even when the rider was logged in but marked as "offline." It should only ring if the rider is online.
3. **Rider Authorization error:** The `markOrderAsDeliveredRider` function returned "Unauthorized: rider session does not match" upon successful delivery.

## What Was Investigated
- **Admin Bell:** The `OwnerDashboardClient.tsx` contained logic that hooked up the Electron IPC for bell sounds. Because this client is only mounted on the `Orders` page, the bell only rang there. If mounted again, it flushed missed messages, causing a sudden ring. 
- **Rider Bell:** `OrderBroadcast.tsx` listened to Supabase database changes for unassigned orders, but it lacked a check to see if the current rider was actually online before playing the `goodrest-bill.mp3` audio.
- **Rider Authorization:** The `riderActions.ts` verification process compared `session.session.id` to `riderId`. However, the session JWT contains the user's phone number as the ID depending on the auth flow used, causing a mismatch with the actual UUID `riderId`. 

## What Was Done (TDD Implementation)
Following `tdd` guidelines:
1. **Admin Bell:** Understood root cause but have not yet refactored to a global layout context.
2. **Rider Bell offline fix:** Modified `src/components/rider/OrderBroadcast.tsx` to explicitly fetch the `is_online` status of the rider from the database before showing the broadcast popup or playing the bell sound.
3. **Rider Authorization fix:** Modified `src/app/actions/riderActions.ts` (specifically `markOrderAsDeliveredRider`, `startRiding`, `updateLocation`, `setRiderOnline`, and `getRiderPendingDeliveries`) to fallback to verifying the phone number from the session against the database if the direct UUID comparison fails.
4. **Test Adjustments:** Updated `src/tests/unit/actions/riderActions.test.ts` to mock and expect the phone number fallback verification for `markOrderAsDeliveredRider`. The unit tests pass.
5. **E2E Test Blocking:** The `npx playwright test src/tests/e2e/cod-happy-path.spec.ts` E2E test began failing due to the new rider online checks. I updated the test script to:
    - Automatically set the rider online in the database.
    - Added retry logic / page reloads to ensure the broadcast websocket picks up the new status.
    - Updated the login bypass to use standard UI login instead of local storage injection, as JWT signing is necessary for the new auth checks. 

## Current State & Blockers
- The fixes for the rider issues are implemented in code.
- The unit tests pass. 
- The Playwright E2E test `cod-happy-path.spec.ts` is currently hanging/failing because of race conditions with the websocket broadcasting the order to the rider after setting them online.
- Have not yet started refactoring the Admin Bell issue to global state.

## Next Steps for the Next Agent
1. **Fix E2E Test:** Resolve the Playwright hang/failure in `src/tests/e2e/cod-happy-path.spec.ts` caused by the rider broadcast modal not appearing or the Accept button click failing. (It might require adjusting how the order transitions to 'preparing' or how the test rider logs in).
2. **Admin Bell Refactor:** Move the Electron IPC bell logic from `OwnerDashboardClient.tsx` to a more global component (like `src/app/admin/layout.tsx` or a dedicated context provider) so the bell rings reliably across all admin pages.
3. **Run Full Verification:** Run `npm run build`, `npm run test`, `npx playwright test`, and `npm run lint` before claiming completion.

## Suggested Skills to Invoke
- `systematic-debugging`
- `tdd` 
- `caveman` (optional, for brevity)