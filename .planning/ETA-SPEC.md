# ETA (Estimated Time of Arrival) — Business Spec

## What is ETA?
The estimated delivery time shown to the customer on the order tracking page. It tells them when their food is expected to arrive.

## How ETA is Calculated

```
ETA = Prep Time + Travel Time + Buffer
```

| Component | Value | Who Sets It |
|-----------|-------|-------------|
| Prep Time | 20 minutes (default) | Admin can change (5–120 min) |
| Travel Time | Google Maps driving time from restaurant to customer address | Auto-calculated |
| Buffer | 5 minutes (fixed) | Hardcoded |

**Example:** Google Maps says 12 min drive → ETA = 20 + 12 + 5 = **37 minutes**

## When ETA is Shown to Customer

| Order Status | What Customer Sees |
|-------------|-------------------|
| Confirmed | Nothing — no ETA shown |
| Preparing | Nothing — no ETA shown |
| Ready | Nothing — no ETA shown |
| Out for Delivery | ETA countdown: "Estimated Arrival — 25 Mins" |
| Delivered | ETA disappears |
| Cancelled | N/A |

**Only shown on the order tracking page** (`/track/order/[id]`). Not on menu, not on checkout.

## How the Countdown Works

1. When rider starts delivery, the system knows the total ETA
2. Every minute, the displayed time decreases by 1
3. When it reaches 0 or below, show "Soon"
4. The countdown is based on when the rider picked up the food (`rider_started_at`)

## Admin Controls

- Admin can set prep time from the dashboard (5 to 120 minutes)
- Default is 20 minutes
- Changing prep time affects **future orders only**, not orders already placed

## Data Stored per Order

| Field | When Set | Value |
|-------|----------|-------|
| `duration_seconds` | When order is created | Google Maps travel time in seconds |
| `eta_minutes` | When owner accepts order | Final ETA = prep + travel + buffer (in minutes) |

## Edge Cases

- **No Google Maps data** (missing coordinates): ETA is not shown
- **Rider takes longer than expected**: ETA counts down to 0, shows "Soon" — no live re-estimation
- **Prep time changed by admin mid-order**: Does not affect in-progress orders
