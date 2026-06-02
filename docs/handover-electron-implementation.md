# Handover: Electron Desktop Wrapper Implementation

**Date:** 2026-05-19  
**Branch:** master  
**Plan file:** `.claude/plans/ethereal-squishing-cook.md`  
**Phase:** 5 — POSD-01 (Electron desktop wrapper for owner dashboard)

---

## 1. What This Document Is

This is the complete handover for implementing the Electron desktop wrapper for the Goodrest owner dashboard. Everything below is what the next session needs to pick up and execute. Read this document first, then follow the task sequence.

---

## 2. Current State of the Codebase

### 2.1 What's Already Done (Phase 5 UI — DO NOT TOUCH)

All owner dashboard UI is implemented and working. These files are DONE:

| Component | File | What It Does |
|-----------|------|--------------|
| OwnerDashboardClient | `src/components/owner/OwnerDashboardClient.tsx` | Main orders page. Supabase Realtime subscription. Has `window.electronAPI` detection at line 16. |
| BellNotification | `src/components/owner/BellNotification.tsx` | Floating overlay with audio loop (Web Audio API 880Hz→1100Hz). Shows when `confirmed` orders exist. |
| OrderCard | `src/components/owner/OrderCard.tsx` | Single order card. Accept/Food Ready/Dispatch buttons. |
| PrepTimer | `src/components/owner/PrepTimer.tsx` | Countdown MM:SS until prep_deadline. Urgent styling <5min. |
| RiderPanel | `src/components/owner/RiderPanel.tsx` | Rider assignment status. Realtime listener. |
| OnlineToggle | `src/components/owner/OnlineToggle.tsx` | ON/OFF toggle for restaurant_settings.online_status. |
| ownerActions | `src/app/actions/ownerActions.ts` | Server actions: acceptOrder, markFoodReady, dispatchOrder, toggleOnlineStatus, etc. |
| settingsActions | `src/app/actions/settingsActions.ts` | Server actions: getAppSettings, updateAppSettings. |
| authActions | `src/app/actions/authActions.ts` | Server actions: login (password→JWT→cookie), logout. |
| DB migration | `supabase/migrations/20260519100000_phase5_owner_dashboard.sql` | Pushed. Adds accepted_at, prep_deadline, food_ready_at, manual_dispatch, manual_dispatch_note columns + restaurant_settings table + pg_cron auto-reject. |
| DB migration | `supabase/migrations/20260519120000_fix_menu_items_id_default.sql` | Pushed. Adds gen_random_uuid() default to menu_items.id. |

### 2.2 What's Broken in electron/ (THE PROBLEMS TO FIX)

The `electron/` directory exists with skeleton files but is NOT functional. Here's every problem:

| # | Problem | Detail |
|---|---------|--------|
| 1 | **Deps not installed** | `electron/package.json` has deps but no `node_modules/` or lock file. Never ran `npm install`. |
| 2 | **No icon assets** | `electron/assets/` is empty. `main.js` references `icon.png` and `tray-icon.png` — app crashes at startup. |
| 3 | **Wrong production strategy** | `main.js:26` loads `file://...out/admin/orders/index.html` but `output: 'export'` is not in `next.config.ts`. Static export won't work anyway — server actions, `force-dynamic`, Realtime, JWT middleware all need a running server. |
| 4 | **Build config wrong** | Root `package.json` `build.files` references `out/**/*` (static export). Should reference standalone server output. |
| 5 | **Unused dep** | `electron-updater` declared in `electron/package.json` but no auto-update logic in main.js. |
| 6 | **IPC listener leak** | `preload.js:9` — `onNewOrder` registers new `ipcRenderer.on` listener every call, never removes. Listeners stack. |
| 7 | **Static countdown** | `bell.html:27` — "Auto-reject in 5 minutes" is plain HTML text, no JS timer. |
| 8 | **No child process logic** | `main.js` has no `child_process` spawning for prod server. |

### 2.3 Files That Exist (Read These)

```
electron/
├── main.js          # 119 lines. Creates mainWindow, bellWindow, tray. IPC handlers. NEEDS REWRITE.
├── preload.js       # 10 lines. contextBridge exposing electronAPI. NEEDS FIX (listener leak).
├── bell.html        # 36 lines. Notification popup. NEEDS REWRITE (add countdown).
├── package.json     # 15 lines. Has deps. NEEDS STRIP to minimal.
└── assets/          # EMPTY. Needs icon.png + tray-icon.png.
```

### 2.4 Existing Icons (Reuse These)

```
public/icons/icon-512x512.png   → Copy to electron/assets/icon.png
public/icons/icon-192x192.png   → Copy to electron/assets/tray-icon.png
```

main.js:63 resizes tray icon to 16x16 via `nativeImage.resize()`, so 192x192 source is fine.

### 2.5 Electron Integration Already in Owner Dashboard

`OwnerDashboardClient.tsx` lines 16 and 21:
```tsx
const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;
// ...
const api = (window as any).electronAPI;
```

The `triggerBell()` function calls:
- `api.playNotificationSound()` — triggers native OS notification
- `api.showBellWindow(orderData)` — shows the always-on-top bell popup
- `api.updateTrayBadge(count)` — updates tray tooltip with pending count

This code works as-is. No changes needed.

---

## 3. Architecture Decision: Child Process (NOT Static Export)

### Why Not Static Export

The admin pages use:
- `export const dynamic = 'force-dynamic'` (orders/page.tsx, menu/page.tsx)
- Server actions (`'use server'`) in authActions, ownerActions, settingsActions
- Supabase Realtime WebSocket subscriptions in OwnerDashboardClient, RiderPanel
- JWT middleware in `src/middleware.ts` protecting `/admin/*`

ALL of these require a running Node.js server. Static export (`output: 'export'`) cannot support any of them.

### The Solution

**`output: 'standalone'`** — Next.js produces `.next/standalone/server.js`, a self-contained Node.js server (~15-20MB) with only the dependencies the app actually imports. Electron spawns this as a child process.

- **Dev mode:** User runs `npm run dev` in Terminal 1 (Next.js dev server). Electron loads `http://localhost:3000/admin/orders`. No child process needed.
- **Prod mode:** Electron spawns `node .next/standalone/server.js` with `PORT=3000`, waits for HTTP readiness, then loads `http://localhost:3000/admin/orders`. On app quit, kills the child process.

---

## 4. Task Sequence (Execute in Order)

### Task 1: Install Electron Deps in Root

**Files to modify:**
- `package.json` (root)
- `electron/package.json`

**Steps:**
1. Look up latest Electron and electron-builder versions via context7:
   ```
   mcp__context7__resolve-library-id → /electron/electron
   mcp__context7__resolve-library-id → /electron-userland/electron-builder
   ```
2. Add to root `package.json` `devDependencies`:
   - `electron` (latest stable, e.g. ^28.0.0 or newer)
   - `electron-builder` (latest stable)
   - `wait-on` (^8.0.0 — used by `electron:dev` script to wait for Next.js)
3. Strip `electron/package.json` to:
   ```json
   {
     "name": "goodrest-desktop",
     "version": "1.0.0",
     "main": "main.js"
   }
   ```
   Remove `dependencies` and `devDependencies` entirely.
4. Run `npm install` from project root.

**Why deps move to root:** electron-builder looks for `package.json` next to `main.js` for the entry point, but the actual build tooling and Electron binary should be at root. Having a separate package in `electron/` caused deps to never be installed.

---

### Task 2: Copy Icons to electron/assets/

**Files to create:**
- `electron/assets/icon.png`
- `electron/assets/tray-icon.png`

**Steps:**
1. Copy `public/icons/icon-512x512.png` → `electron/assets/icon.png`
2. Copy `public/icons/icon-192x192.png` → `electron/assets/tray-icon.png`

That's it. main.js:63 already resizes the tray icon to 16x16.

---

### Task 3: Add `output: 'standalone'` to next.config.ts

**File to modify:** `next.config.ts`

**Current content (38 lines):**
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // ... 7 entries
    ],
  },
};

export default nextConfig;
```

**Change:** Add `output: 'standalone'` inside the config object:
```ts
const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    // ... existing remotePatterns unchanged
  },
};
```

**MCP docs:** Before implementing, look up:
```
mcp__ref-context__ref_search_documentation → "next.js output standalone app router server actions"
```
Confirm that `output: 'standalone'` works with App Router, server actions, and middleware in Next.js 16.

---

### Task 4: Rewrite electron/main.js

**File to rewrite:** `electron/main.js`

**Current file:** 119 lines. Has createMainWindow, createBellWindow, createTray, IPC handlers.

**MCP docs — fetch BEFORE writing:**
```
mcp__context7__query-docs → /electron/electron → "BrowserWindow app.whenReady child process spawn"
mcp__context7__query-docs → /electron-userland/electron-builder → "standalone next.js packaging"
```

**What to KEEP (copy verbatim):**
- createBellWindow() function (lines 39-59)
- createTray() function (lines 61-76)
- All IPC handlers (lines 78-110): get-app-version, show-bell-window, hide-bell-window, update-tray-badge, play-notification-sound
- require statements for electron modules (line 1)

**What to CHANGE:**

1. Add imports at top:
```js
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const dotenv = require('dotenv');
```

2. Add state variable:
```js
let serverProcess = null;
```

3. Change `isDev` detection:
```js
const isDev = !app.isPackaged;
```
(Use `app.isPackaged` instead of `process.env.NODE_ENV` — more reliable in Electron)

4. Change createMainWindow URL (line 24-27). Remove the `file://` path:
```js
const url = 'http://localhost:3000/admin/orders';
```

5. Add `startServer()` function:
```js
function startServer() {
  return new Promise((resolve, reject) => {
    if (isDev) {
      // Dev: assume next dev is running externally, just check readiness
      waitForReady().then(resolve).catch(reject);
      return;
    }

    // Prod: spawn standalone server
    const standaloneDir = path.join(process.resourcesPath, '.next', 'standalone');
    const serverScript = path.join(standaloneDir, 'server.js');

    // Load .env from project root
    const envFile = path.join(__dirname, '..', '.env');
    const envVars = fs.existsSync(envFile)
      ? dotenv.parse(fs.readFileSync(envFile))
      : {};

    serverProcess = spawn(process.execPath, [serverScript], {
      cwd: standaloneDir,
      env: { ...process.env, ...envVars, PORT: '3000', HOSTNAME: '127.0.0.1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    serverProcess.stdout.on('data', (d) => console.log(`[next] ${d.toString().trim()}`));
    serverProcess.stderr.on('data', (d) => console.error(`[next] ${d.toString().trim()}`));
    serverProcess.on('error', (err) => reject(new Error(`Server start failed: ${err.message}`)));
    serverProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`Server exited with code ${code}`));
      }
    });

    waitForReady().then(resolve).catch(reject);
  });
}
```

6. Add `waitForReady()` function:
```js
function waitForReady(port = 3000, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const req = http.get(`http://127.0.0.1:${port}`, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) resolve();
        else retry();
      });
      req.on('error', retry);
      req.setTimeout(1000, () => { req.destroy(); retry(); });
    };
    const retry = () => {
      if (Date.now() - start > timeout) {
        reject(new Error(`Server did not start within ${timeout / 1000}s`));
      } else {
        setTimeout(check, 500);
      }
    };
    check();
  });
}
```

7. Add `stopServer()` function:
```js
function stopServer() {
  if (serverProcess) {
    serverProcess.removeAllListeners('exit');
    serverProcess.kill();
    serverProcess = null;
  }
}
```

8. Replace `app.whenReady()` block (lines 112-119):
```js
app.whenReady().then(async () => {
  try {
    await startServer();
  } catch (err) {
    console.error('Failed to start server:', err);
    const { dialog } = require('electron');
    dialog.showErrorBox('Startup Error', `Failed to start backend server:\n${err.message}`);
    app.quit();
    return;
  }

  createMainWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});
```

9. Replace `window-all-closed` handler (lines 121-123):
```js
app.on('window-all-closed', () => {
  stopServer();
  if (process.platform !== 'darwin') app.quit();
});
```

10. Add `before-quit` handler:
```js
app.on('before-quit', () => {
  stopServer();
});
```

**Key point:** In prod mode, `process.resourcesPath` points to the packaged app's resources directory. The standalone server files will be there after electron-builder packages them. In dev mode, no child process is spawned — the user runs `npm run dev` separately.

---

### Task 5: Update package.json Scripts and Build Config

**File to modify:** `package.json` (root)

**Scripts to add/change:**
```json
"electron:dev": "wait-on http-get://localhost:3000 && electron .",
"electron:start": "electron .",
"electron:build": "next build && node scripts/copy-standalone.js && electron-builder --win",
"electron:icons": "node scripts/generate-icons.js"
```

**Build config to replace** (the existing `"build"` key):
```json
"build": {
  "appId": "com.goodrest.dashboard",
  "productName": "Goodrest Dashboard",
  "directories": {
    "output": "release"
  },
  "files": [
    "electron/main.js",
    "electron/preload.js",
    "electron/bell.html",
    "electron/package.json",
    "electron/assets/**/*",
    "electron/.next/standalone/**/*"
  ],
  "extraResources": [],
  "win": {
    "target": "nsis",
    "icon": "electron/assets/icon.png"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true
  }
}
```

**Key change:** `files` no longer references `out/**/*` (static export). It now references the standalone server output at `electron/.next/standalone/**/*`.

---

### Task 6: Create scripts/copy-standalone.js

**New file:** `scripts/copy-standalone.js`

This script runs after `next build` and before `electron-builder`. It copies the standalone server output + static assets + public assets into the `electron/` directory so electron-builder can package them.

```js
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const standaloneSrc = path.join(root, '.next', 'standalone');
const standaloneDst = path.join(root, 'electron', '.next', 'standalone');
const staticSrc = path.join(root, '.next', 'static');
const staticDst = path.join(standaloneDst, '.next', 'static');
const publicSrc = path.join(root, 'public');
const publicDst = path.join(standaloneDst, 'public');

function copyDirSync(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDirSync(s, d);
    else fs.copyFileSync(s, d);
  }
}

if (fs.existsSync(standaloneDst)) {
  fs.rmSync(standaloneDst, { recursive: true, force: true });
}

console.log('Copying standalone server...');
copyDirSync(standaloneSrc, standaloneDst);

console.log('Copying static assets...');
copyDirSync(staticSrc, staticDst);

console.log('Copying public assets...');
copyDirSync(publicSrc, publicDst);

console.log('Done. Standalone server ready at electron/.next/standalone/');
```

**Why this is needed:** Next.js `output: 'standalone'` does NOT include `.next/static/` or `public/` in the standalone output. Without this copy step, the app has no CSS, no JS chunks, no images.

---

### Task 7: Create scripts/generate-icons.js

**New file:** `scripts/generate-icons.js`

```js
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

fs.copyFileSync(
  path.join(root, 'public', 'icons', 'icon-512x512.png'),
  path.join(root, 'electron', 'assets', 'icon.png')
);

fs.copyFileSync(
  path.join(root, 'public', 'icons', 'icon-192x192.png'),
  path.join(root, 'electron', 'assets', 'tray-icon.png')
);

console.log('Icons copied to electron/assets/');
```

---

### Task 8: Improve bell.html

**File to rewrite:** `electron/bell.html`

**Current file:** 36 lines. Static HTML, no countdown, no Accept button.

**MCP docs:** Look up Electron `ipcRenderer.send` for sending messages from preload.

**Frontend-design skill principles to apply:**
- **Fitts' Law:** Accept button minimum 48px height, easy to click
- **Von Restorff:** Accept button visually distinct (green, bold) vs dismiss (gray)
- **Urgency:** Countdown timer in red as time decreases
- **Doherty Threshold:** Immediate visual feedback on Accept click
- **Peak-End Rule:** Make the notification moment feel urgent and important

**Changes:**
1. Add actual JS countdown timer: `5:00` → `0:00`, decrements every second
2. Style countdown with color urgency: `>3min` = green, `1-3min` = amber, `<1min` = red
3. Add large Accept button (green, 48px+ height)
4. Add dismiss (X) button (top-right corner)
5. On Accept click: send IPC `accept-order` to main, show "Accepted!" feedback
6. On countdown 0:00: show "AUTO-REJECTED" in red
7. Listen for `new-order` data via `window.electronAPI.onNewOrder()`

---

### Task 9: Fix IPC Listener Leak in preload.js

**File to modify:** `electron/preload.js`

**Current code (line 9):**
```js
onNewOrder: (callback) => ipcRenderer.on('new-order', (event, data) => callback(data)),
```

**Problem:** Every call registers a new listener. If the renderer calls this 10 times, 10 listeners stack.

**Fix:** Expose a remove method:
```js
contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('get-app-version'),
  showBellWindow: (orderData) => ipcRenderer.send('show-bell-window', orderData),
  hideBellWindow: () => ipcRenderer.send('hide-bell-window'),
  updateTrayBadge: (count) => ipcRenderer.send('update-tray-badge', count),
  playNotificationSound: () => ipcRenderer.send('play-notification-sound'),
  onNewOrder: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('new-order', handler);
    return () => ipcRenderer.removeListener('new-order', handler);
  },
});
```

The return value is a cleanup function. Callers can call it to remove the listener.

---

### Task 10: Verify End-to-End

**Terminal 1:**
```bash
npm run dev
```

**Terminal 2 (after Terminal 1 shows "Ready"):**
```bash
npx electron .
```

**Verify:**
1. Electron window opens, shows /admin/orders (login page if no session)
2. Login with password `goodrest88` → redirects to orders page
3. Orders page loads with sidebar, header, order cards
4. If a `confirmed` order exists, BellNotification overlay appears with audio
5. Tray icon visible in system tray. Right-click → "Show Dashboard" / "Quit"
6. DevTools opens in detached mode (dev)
7. Closing all windows → app quits, server process killed (prod only)

**Test production build:**
```bash
npm run electron:build
```
Check `release/` directory for installer.

---

## 5. Environment Variables

The `.env` file at project root contains all required variables:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server actions)
- `SUPABASE_DB_PASSWORD` — DB password
- `SUPABASE_ACCESS_TOKEN` — Supabase CLI token (for migrations)
- `JWT_SECRET` — JWT signing secret
- `ADMIN_PASSWORD` — Admin login password
- `GOOGLE_MAPS_API_KEY` — Google Maps Routes API

In prod mode, `electron/main.js` reads `.env` via `dotenv` and merges into the child process env. No special handling needed.

---

## 6. Dependencies Summary

### Root package.json devDependencies (add these)

| Package | Purpose |
|---------|---------|
| `electron` | Desktop app framework |
| `electron-builder` | Packaging and installer creation |
| `wait-on` | Wait for HTTP server before launching Electron |

### Root package.json dependencies (already present)

| Package | Purpose |
|---------|---------|
| `dotenv` (^17.4.0) | Read .env file in main.js |
| `next` (16.2.2) | Standalone server |
| All others | Already present for the web app |

### electron/package.json (strip to minimal)

```json
{
  "name": "goodrest-desktop",
  "version": "1.0.0",
  "main": "main.js"
}
```

---

## 7. File Change Summary

| File | Action | Lines Changed |
|------|--------|--------------|
| `package.json` (root) | Edit | +electron deps, +scripts, replace build config |
| `next.config.ts` | Edit | +1 line (`output: 'standalone'`) |
| `electron/main.js` | Rewrite | ~150 lines (add child process, keep bell/tray/IPC) |
| `electron/package.json` | Edit | Strip to 5 lines |
| `electron/preload.js` | Edit | +4 lines (cleanup function for onNewOrder) |
| `electron/bell.html` | Rewrite | ~80 lines (countdown, Accept button, styling) |
| `electron/assets/icon.png` | Create | Copy from public/icons/icon-512x512.png |
| `electron/assets/tray-icon.png` | Create | Copy from public/icons/icon-192x192.png |
| `scripts/copy-standalone.js` | Create | ~35 lines |
| `scripts/generate-icons.js` | Create | ~12 lines |

**Files NOT changed:** All server actions, all owner components, middleware, database.types.ts, migrations.

---

## 8. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `output: 'standalone'` breaks something | Low | High | Test `next build` after adding. Server actions + middleware should work unchanged. |
| Electron version incompatible with electron-builder | Low | Medium | Look up compatibility via context7 MCP before installing. |
| Standalone server doesn't load .env | Medium | Medium | main.js explicitly reads .env via dotenv and passes to spawn env. |
| Port 3000 conflict | Low | Low | Single-restaurant POS — dedicated PC, no conflicts expected. |
| Tray icon not showing on Windows | Low | Low | nativeImage.resize() handles it. Test on actual Windows machine. |
| Standalone server slow to start | Low | Medium | waitForReady polls for up to 30s. POS user can wait. |

---

## 9. Commands Reference

```bash
# Development
npm run dev                    # Terminal 1: Start Next.js dev server
npx electron .                 # Terminal 2: Launch Electron (after dev server ready)

# Production build
npm run electron:icons         # Copy icons to electron/assets/
npm run electron:build         # Build Next.js + copy standalone + package with electron-builder

# Testing
npm run test                   # Unit tests (vitest)
npm run build                  # Next.js build (verify standalone output works)
npm run lint                   # ESLint

# Supabase (if needed)
npx supabase db push --linked  # Push any new migrations
npx supabase gen types typescript --linked > src/types/database.types.ts  # Regenerate types
```

---

## 10. Success Criteria

The implementation is DONE when:

1. `npm install` — no errors
2. `npm run dev` + `npx electron .` — window opens, loads /admin/orders
3. Login → orders page → bell notification on new order → Accept works
4. Tray icon visible, right-click menu works
5. `npm run electron:build` — produces installer in `release/`
6. Build passes (`npm run build`)
7. Tests pass (`npm run test`)
8. Lint passes (`npm run lint`)

---

## 11. Skills to Consult

| Skill | When |
|-------|------|
| `frontend-design` (`.agent/skills/frontend-design/SKILL.md`) | When improving bell.html — apply Fitts' Law, Von Restorff, urgency design |
| `systematic-debugging` (`.claude/skills/systematic-debugging/`) | If anything breaks during implementation |
| `test-driven-development` (`.claude/skills/test-driven-development/`) | If adding tests for Electron-specific code |
| `verification-before-completion` (`.claude/skills/verification-before-completion/`) | Before claiming done — run build + test + lint |

---

## 12. MCP Doc Lookup Cheat Sheet

Before writing ANY code that touches an external library, look it up:

```
# Electron APIs
mcp__context7__resolve-library-id → libraryName: "electron"
mcp__context7__query-docs → libraryId: "/electron/electron" → query: "BrowserWindow app.whenReady Tray"

# Electron Builder
mcp__context7__resolve-library-id → libraryName: "electron-builder"
mcp__context7__query-docs → libraryId: "/electron-userland/electron-builder" → query: "files config standalone packaging"

# Next.js standalone
mcp__ref-context__ref_search_documentation → "next.js output standalone deployment child process"

# If you hit an error
mcp__ref-context__ref_search_documentation → "<paste the error message here>"
```

**Rule: Never guess an API. Fetch docs first.**

---

*Handover complete. Next session: read this doc, follow the tasks in order, consult MCP docs at every step.*
