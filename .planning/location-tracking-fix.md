# Rider Location Tracking — Fix Report

## Problem
Rider location stops updating when the Capacitor Android app goes to background (e.g., rider opens Google Maps for navigation). Location only resumes when the app is reopened — web-like behavior, not native.

## Root Cause

`src/hooks/useBackgroundLocation.ts` has two code paths:

| Path | When | Behavior |
|------|------|----------|
| **Native** (Capacitor `BackgroundGeolocation.addWatcher`) | `window.Capacitor?.isNativePlatform()` → true | Foreground service, should track in background |
| **Web fallback** (`navigator.geolocation.watchPosition`) | Capacitor unavailable OR on web | **Stops in background** (W3C spec) |

**What was happening:** When the native plugin path failed (line 144-153), the code set `geoError` and died. No web fallback was attempted. If `window.Capacitor` was absent (Vercel-loaded page), the web path ran but had no visibility recovery — once paused in background, `watchPosition` callbacks never resumed.

**Verified on live:** `window.Capacitor` is `undefined` when loading `https://goodrest-claude.vercel.app/rider/login` in a browser. In the Capacitor APK WebView it should be injected, but if it's not (or native fails), tracking dies.

## What Was Fixed

### File: `src/hooks/useBackgroundLocation.ts`

**Change 1 — Native failure now falls back to web (line 144-150)**
```
Before: catch → setGeoError → dead
After:  catch → console.warn → startWebTracking()
```

**Change 2 — Visibility recovery (new `visibilitychange` listener)**
```
When document.visibilityState becomes 'visible':
  1. Clear existing webWatcherId
  2. Call startWebTracking() → new watchPosition + immediate fresh location
```
Fires when rider returns from Google Maps to the app.

**Change 3 — Removed `maximumAge: 10000`** from web `watchPosition` options for fresher positions.

### File: `src/tests/unit/hooks/useBackgroundLocation.test.tsx`

Updated tests: 8 tests (was 7). Removed test for old "native failure = error message" behavior. Added tests for:
- "should fallback to web tracking when native addWatcher throws"
- "should restart web watcher on visibility change to visible"

## How an Agent Should Test

### 1. Run unit tests
```
npm run test
```
Focus: `src/tests/unit/hooks/useBackgroundLocation.test.tsx` — all 8 must pass.

### 2. Run build
```
npm run build
```
Must succeed with no new errors.

### 3. Run lint
```
npm run lint
```
Only pre-existing warnings (12). No new warnings from `useBackgroundLocation.ts` or its test file.

### 4. Manual test (web path — easiest to verify)
1. Open `http://localhost:3000/rider/login` (dev server) or the Vercel deployment
2. Open browser DevTools → Console
3. Run: `delete window.Capacitor` (simulate Capacitor not present)
4. Login as a rider, go online
5. Watch for "Falling back to web geolocation" in console
6. Switch to another browser tab (simulate background)
7. Switch back — should see geolocation prompt again, fresh location sent to DB
8. Check Supabase `riders` table → `current_location` should update

### 5. Manual test (APK — native path)
1. Build APK with `npx cap sync && npx cap open android`
2. Install on device
3. Login as rider, go online
4. **Check for persistent notification** "Goodrest Rider — Tracking your delivery location"
   - If notification appears → native plugin is working
   - If no notification → native plugin not activating, web fallback is running
5. Open Google Maps via Navigate button
6. Return to rider app
7. Location should resume immediately (visibility change fires)
8. Check Supabase `riders` table → `current_location` should have fresh timestamps

## What's Still Unresolved

The native Capacitor plugin (`@capacitor-community/background-geolocation`) is configured in gradle + manifest but not activating at runtime (no foreground notification). Without it, true background tracking is impossible — web `watchPosition` pauses per W3C spec. Next step: debug why the native plugin isn't starting in the APK.
