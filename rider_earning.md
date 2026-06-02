# Rider Payout — Final Pricing

## Operational Model

- **Restaurant hours**: 5 PM – 11 PM (dinner only)
- **Riders**: 2–4 part-time (students), not permanent
- **Fleet**: Rider's own motorcycle, own fuel
- **Orders/day**: 25–30 (variable, not fixed)
- **Payout cycle**: Weekly bank transfer
- **Location**: Gaya, Bihar

---

## Rider Earning Per Delivery

### Under 5km — Slab Pricing

| Distance | Delivery fee (customer) | Dead miles (owner, ₹2/km) | Rider earns total |
|---|---|---|---|
| 0–2 km | ₹30 | ₹4 | ₹34 |
| 2–3 km | ₹35 | ₹6 | ₹41 |
| 3–5 km | ₹45 | ₹10 | ₹55 |

### After 5km — Per-km Pricing

| Component | Who pays | Amount |
|---|---|---|
| Base pay | Customer | ₹15 |
| Per-km delivery fee | Customer | ₹7/km |
| Dead miles | Owner | ₹2/km |

**After 5km formula**: `riderEarning = 15 + (distance × 7) + (distance × 2)`

| Distance | Customer pays | Owner pays (dead miles) | Rider earns total |
|---|---|---|---|
| 7 km | ₹15 + ₹49 = ₹64 | ₹14 | ₹78 |
| 10 km | ₹15 + ₹70 = ₹85 | ₹20 | ₹105 |
| 15 km | ₹15 + ₹105 = ₹120 | ₹30 | ₹150 |

---

## Nightly Bonus (Owner Pays)

| Orders completed | Bonus |
|---|---|
| 6+ | ₹100 |
| 10+ | ₹200 |

Paid nightly. No other bonuses (no peak, no weekly, no rainy day, no attendance).

---

## Rider Nightly Income Examples

| Orders | Avg earning/order | Base earning | Bonus | Total/night | Monthly (26 days) |
|---|---|---|---|---|---|
| 6 | ₹47 | ₹282 | ₹100 | ₹382 | ₹9,932 |
| 8 | ₹47 | ₹376 | ₹100 | ₹476 | ₹12,376 |
| 10 | ₹47 | ₹470 | ₹200 | ₹670 | ₹17,420 |
| 12 | ₹47 | ₹564 | ₹200 | ₹764 | ₹19,864 |
| 15 | ₹47 | ₹705 | ₹200 | ₹905 | ₹23,530 |

---

## Owner Cost Breakdown

### What Owner Pays (Only 2 Things)

1. **Dead miles**: ₹2/km per delivery
2. **Nightly bonus**: ₹100–₹200 per rider

### Owner Cost Per Day

| Orders/day | Dead miles (avg 5km) | Bonus (4 riders) | Total/day | Total/month (26 days) |
|---|---|---|---|---|
| 30 | 30 × ₹10 = ₹300 | 3×₹100 + 1×₹200 = ₹500 | ₹800 | ₹20,800 |

---

## Complete Formula (Code-Ready)

```typescript
// Delivery fee slabs — UNDER 5km (what customer pays)
const DELIVERY_FEE_SLABS = {
  UPTO_2KM: 30,
  UPTO_3KM: 35,
  UPTO_5KM: 45,
} as const;

// After 5km — per-km pricing
const AFTER_5KM_BASE = 15;       // customer pays
const AFTER_5KM_PER_KM = 7;      // customer pays per km

// Dead miles — owner pays
const DEAD_MILES_PER_KM = 2;

// Nightly bonus — owner pays
const BONUS_6_ORDERS = 100;
const BONUS_10_ORDERS = 200;

function calculateDeliveryFee(distanceKm: number): number {
  if (distanceKm <= 2) return DELIVERY_FEE_SLABS.UPTO_2KM;
  if (distanceKm <= 3) return DELIVERY_FEE_SLABS.UPTO_3KM;
  if (distanceKm <= 5) return DELIVERY_FEE_SLABS.UPTO_5KM;
  return AFTER_5KM_BASE + Math.ceil(distanceKm) * AFTER_5KM_PER_KM;
}

function calculateRiderEarning(distanceKm: number): number {
  const deliveryFee = calculateDeliveryFee(distanceKm);
  const deadMiles = Math.ceil(distanceKm) * DEAD_MILES_PER_KM;
  return deliveryFee + deadMiles;
}

function calculateNightlyBonus(ordersCompleted: number): number {
  if (ordersCompleted >= 10) return BONUS_10_ORDERS;
  if (ordersCompleted >= 6) return BONUS_6_ORDERS;
  return 0;
}
```

---

## Key Assumptions

1. Most Gaya orders within 5km radius
2. Riders return after every delivery (dead miles)
3. Fuel cost: ~₹2.38/km (rider bears fuel)
4. No batching — each order independent
5. Orders/day: 25–30 (variable)
6. 2–4 part-time riders (students)
7. Restaurant operates dinner only (5–11 PM)

---

## Implementation Checklist

1. **riderActions.ts** — Replace placeholder formula with:
   - `calculateDeliveryFee(distanceKm)` function
   - `calculateRiderEarning(distanceKm)` function
   - `calculateNightlyBonus(ordersCompleted)` function
   - Update `acceptOrder` to use new formula
   - Update default `earning = 500` on line 44
   - Update fallback `p_rider_earning: order?.rider_earning || 500` on line 158

2. **Customer-facing delivery fee** — Display slab pricing at checkout (₹30/₹35/₹45 under 5km, ₹15 + ₹7/km after 5km)

3. **Nightly bonus tracking** — Track order count per rider per night, calculate bonus at day end

4. **distance_km field** — Ensure populated correctly before rider accepts (Google Maps fallback exists)