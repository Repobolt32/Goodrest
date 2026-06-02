---
status: active
---

# Goodrest — Restaurant Ordering Platform

## What This Is

A full-stack restaurant ordering platform built with Next.js, featuring a customer-facing menu and checkout, an admin dashboard for order and menu management, and a rider portal for delivery tracking.

## Core Value

Enable a single restaurant to accept online orders (Razorpay + COD), manage them in real time through a staff dashboard, and dispatch deliveries with live rider tracking.

## Requirements

### Validated

- Customer can browse the menu, add items to cart, and check out without creating an account.
- Customer can pay online via Razorpay or choose Cash on Delivery.
- Staff can log in to a secure dashboard and manage menu items and orders.
- Staff dashboard updates automatically with new orders via polling.
- Staff can accept, reject, and update order status.
- Rider can log in with phone + password and view assigned orders.
- Rider can update their live GPS location and mark orders as delivered.
- System enforces strict order state transitions via a backend state machine.

### Active

- [ ] Owner dashboard with real-time bell notifications, auto-reject countdown, and prep timer.
- [ ] Electron desktop wrapper with system tray badge and native audio.
- [ ] Rider dispatch (FCFS + manual external) with live GPS tracking for customers.
- [ ] Order voids and refunds with Razorpay integration.
- [ ] Daily sales and order volume reports.

### Out of Scope

- Multi-tenant / multi-restaurant support — MVP is strictly single-restaurant.
- Real-time websockets — 3-5s polling is used instead to reduce infrastructure complexity.
- Native mobile apps — Rider and Customer interfaces are mobile-responsive web apps.

## Context

- **Target Audience**: Single restaurant owners, their staff, delivery riders, and customers.
- **Workflow**: Customer places order → Staff receives and confirms → Rider is assigned → Rider delivers → Customer tracks live.
- **Environment**: Next.js (App Router), Supabase (PostgreSQL), Razorpay, deployed on Vercel.

## Constraints

- **Auth**: Admin uses JWT cookie-based sessions; Rider uses phone+password (no session cookies in MVP).
- **Payments**: Razorpay only (India-focused).
- **Database**: Supabase with Row Level Security; server-side writes use service role key.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase over Prisma + self-hosted Postgres | Simpler auth, real-time subscriptions, managed infrastructure | Reduced DevOps overhead |
| Polling over WebSockets | Easier to deploy, no extra infrastructure, sufficient for 3-5s freshness | Simpler stack |
| Manual state machine over XState library | Backend-only logic, no client bundle overhead, easier to audit | `orderStateMachine.ts` |
| Razorpay only | Target market is India; Razorpay dominates | Integrated |
| Rider auth without sessions | MVP simplification; rider data returned directly on login | Working |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-09 after GSD 1 → 2 migration*
