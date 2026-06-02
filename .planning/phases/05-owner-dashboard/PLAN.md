# POS Dashboard Refactor — Design Spec

**Date:** 2026-05-19
**Status:** Approved
**Reference:** Zomato Restaurant Partner App workflow

## Overview

Refactor the admin/owner dashboard to follow Zomato's restaurant POS workflow: persistent bell notification on new orders, accept/dispatch flow, prep timer, rider assignment parallel to cooking, and Electron desktop wrapper. Customer sees only ETA + rider tracking.

## State Machine

| State | Description |
|-------|-------------|
| `created` | Order record created |
| `pending_payment` | Waiting for Razorpay payment verification |
| `confirmed` | Payment verified. Bell ringing on owner dashboard. 5-min auto-reject countdown active. |
| `preparing` | Owner accepted. 20-min prep timer running. Riders can see and accept (FCFS). |
| `ready` | Food prepared. Rider assigned. Waiting for owner to dispatch. |
| `out_for_delivery` | Owner dispatched. Rider delivering. Customer sees live GPS + ETA. |
| `delivered` | Rider completed delivery. |
| `cancelled` | Auto-rejected (5 min no response) or payment failed. |

### State Transitions

| From | To | Trigger | Who |
|------|----|---------|-----|
| `created` | `pending_payment` | Customer submits order | Customer |
| `pending_payment` | `confirmed` | Razorpay webhook verified | System |
| `pending_payment` | `cancelled` | Payment failed / expired | System |
| `confirmed` | `preparing` | Owner clicks **Accept** | Owner |
| `confirmed` | `cancelled` | 5 min auto-reject timer expires | System |
| `preparing` | `ready` | Owner clicks **Food Ready** | Owner |
| `ready` | `out_for_delivery` | Owner clicks **Dispatch** | Owner |
| `out_for_delivery` | `delivered` | Rider clicks **Mark Delivered** | Rider |

### Rider Assignment (Parallel to Cooking)

Rider assignment happens independently during `preparing` state. The moment owner clicks Accept, order is visible to all riders via Supabase Realtime. Rider accepts via FCFS atomic guard. Rider can accept while kitchen is still cooking — they arrive when food is ready or wait at restaurant.

## Owner Actions

| Button | State When Visible | Resulting State | Description |
|--------|-------------------|-----------------|-------------|
| **Accept** | `confirmed` (bell ringing) | `preparing` | Confirms order. Starts 20-min prep timer. Broadcasts to riders. |
| **Food Ready** | `preparing` | `ready` | Food is cooked and packed. Ready for rider pickup. |
| **Dispatch** | `ready` (rider present) | `out_for_delivery` | Hands food to rider. Customer sees ETA + GPS tracking. |

No manual reject button. Owner who doesn't want orders logs off the system via online/offline toggle.

## Auto-Reject (Zomato Pattern)

| Parameter | Value |
|-----------|-------|
| Timer starts | When order enters `confirmed` (bell starts ringing) |
| Duration | 5 minutes |
| On expiry | Order → `cancelled`. Razorpay refund initiated. Customer sees "Restaurant unavailable — refund initiated." |
| Cancel condition | Owner clicks Accept before timer expires |

## Customer-Facing Display

| Shows | Does NOT Show |
|-------|---------------|
| ETA: 20 min + Google Maps ETA (restaurant → delivery address) | Prep countdown timer |
| Order status: Confirmed → Preparing → Rider on the way → Delivered | Color-coded urgency |
| Live rider location on map (when `out_for_delivery`) | Kitchen sub-states |

ETA formula:
```
Customer ETA = 20 min (fixed prep time) + Google Maps ETA (restaurant lat/lng → delivery lat/lng)
```

## Bell Notification System

| Aspect | Detail |
|--------|--------|
| Trigger | Order enters `confirmed` state |
| Sound | Continuous loop until owner acts or auto-reject fires |
| Platform | Electron: native system audio (no browser autoplay restrictions) |
| Visual | Always-on-top popup overlay with order details + Accept button + countdown timer (5 min → 0) |
| Multiple orders | Queue. New orders stack. Each with own countdown. |

## Owner Online/Offline Toggle

| Setting | When ON | When OFF |
|---------|---------|----------|
| `restaurant_settings.online_status` | Orders flow normally | Customer menu shows "Currently unavailable — check back later." Order placement blocked at API level. |

Replaces need for reject button. Owner proactively controls availability.

## Manual Dispatch (External Rider)

| Field | Value |
|-------|-------|
| Trigger | Owner clicks "Manual Dispatch" on a `ready` order with no system rider |
| `rider_id` | `null` |
| `manual_dispatch` | `true` |
| `manual_dispatch_note` | Optional free-text (e.g., "Zomato rider #XYZ") |
| Customer GPS tracking | Disabled for this order (no rider to track) |

## Database Changes

### New Columns (`orders` table)

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| `accepted_at` | `timestamptz` | YES | `null` | When owner clicked Accept |
| `prep_deadline` | `timestamptz` | YES | `null` | `accepted_at + 20 min` |
| `food_ready_at` | `timestamptz` | YES | `null` | When owner clicked Food Ready |
| `manual_dispatch` | `boolean` | NO | `false` | External rider handoff flag |
| `manual_dispatch_note` | `text` | YES | `null` | Optional note for external dispatch |

### New Table (`restaurant_settings`)

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `id` | `int` (PK) | — | Singleton row |
| `online_status` | `boolean` | `true` | Accepting orders toggle |
| `prep_time_minutes` | `int` | `20` | Configurable prep time |
| `auto_reject_minutes` | `int` | `5` | Auto-reject timer duration |
| `updated_at` | `timestamptz` | `now()` | Last modified |

## Electron Desktop App

| Feature | Detail |
|---------|--------|
| Framework | Electron (wraps Next.js admin dashboard) |
| System tray | Icon with pending order count badge |
| Native audio | System-level bell sound (bypasses browser autoplay restrictions) |
| New order popup | Always-on-top overlay window |
| Update mechanism | Auto-update via electron-updater |

## Requirements Traceability

| ID | Requirement | Status |
|----|------------|--------|
| POSD-01 | Electron desktop wrapper for admin dashboard | ✅ Done |
| POSD-02 | Bell notification system with persistent audio loop | ✅ Done |
| POSD-03 | Owner Accept flow with 5-min auto-reject | ✅ Done |
| POSD-04 | Prep timer system (20 min fixed, auto transitions) | ✅ Done |
| POSD-05 | Rider assignment parallel to food preparation | ✅ Done |
| POSD-06 | Owner Dispatch flow + customer ETA (20 min + Google Maps) | ✅ Done |
| POSD-07 | Rider status panel in admin dashboard | ✅ Done |
| POSD-08 | Manual dispatch for external riders | ✅ Done |
| POSD-09 | Owner online/offline toggle | ✅ Done |
| POSD-10 | Customer tracking: live rider GPS + ETA | ✅ Done |
| POSD-11 | Order voids and refunds (Razorpay integration) | ✅ Done |
| POSD-12 | Basic daily sales and order reports | ✅ Done |

## Out of Scope (Phase 5)

| Feature | Reason |
|---------|--------|
| Reject button with reason codes | Owner logs off instead. Single restaurant. |
| ML-based KPT prediction | Fixed 20 min sufficient. Complexity not justified. |
| Rush Hour Mode (extend prep time) | Phase 2 if needed. |
| Auto-Accept mode | Phase 2 if order volume demands it. |
| Multi-outlet support | Out of scope permanently. |

---

*Architecture finalized: 2026-05-19*
*Reference: Zomato Restaurant Partner App + POS Integration API workflow*
