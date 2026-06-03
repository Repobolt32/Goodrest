// Delivery fee slabs — UNDER 5km (what customer pays)
export const DELIVERY_FEE_SLABS = {
  UPTO_2KM: 30,
  UPTO_3KM: 35,
  UPTO_5KM: 45,
} as const;

// After 5km — per-km pricing
export const AFTER_5KM_BASE = 15;       // customer pays
export const AFTER_5KM_PER_KM = 7;      // customer pays per km

// Dead miles — owner pays
export const DEAD_MILES_PER_KM = 2;

// Nightly bonus — owner pays
export const BONUS_6_ORDERS = 100;
export const BONUS_10_ORDERS = 200;

export function calculateDeliveryFee(distanceKm: number): number {
  if (distanceKm <= 2) return DELIVERY_FEE_SLABS.UPTO_2KM;
  if (distanceKm <= 3) return DELIVERY_FEE_SLABS.UPTO_3KM;
  if (distanceKm <= 5) return DELIVERY_FEE_SLABS.UPTO_5KM;
  return AFTER_5KM_BASE + Math.ceil(distanceKm - 5) * AFTER_5KM_PER_KM;
}

export function calculateRiderEarning(distanceKm: number, isBatchedNonFinal?: boolean): number {
  const deliveryFee = calculateDeliveryFee(distanceKm);
  if (isBatchedNonFinal) {
    return deliveryFee;
  }
  const deadMiles = Math.ceil(distanceKm) * DEAD_MILES_PER_KM;
  return deliveryFee + deadMiles;
}

export function calculateNightlyBonus(ordersCompleted: number): number {
  if (ordersCompleted >= 10) return BONUS_10_ORDERS;
  if (ordersCompleted >= 6) return BONUS_6_ORDERS;
  return 0;
}

export function calculateEarningBreakdown(distanceKm: number): {
  total: number;
  deliveryFee: number;
  pickupPay: number;
} {
  const deliveryFee = calculateDeliveryFee(distanceKm);
  const pickupPay = Math.ceil(distanceKm) * DEAD_MILES_PER_KM;
  return { total: deliveryFee + pickupPay, deliveryFee, pickupPay };
}

export function calculateBonusProgress(todayDeliveries: number): {
  currentBonus: number;
  nextMilestone: 6 | 10 | null;
  deliveriesUntilNext: number;
  progress: number;
  milestoneLabel: string;
} {
  if (todayDeliveries >= 10) {
    return {
      currentBonus: BONUS_10_ORDERS,
      nextMilestone: null,
      deliveriesUntilNext: 0,
      progress: 1,
      milestoneLabel: `₹${BONUS_10_ORDERS} bonus achieved! 🏆`,
    };
  }
  if (todayDeliveries >= 6) {
    const remaining = 10 - todayDeliveries;
    return {
      currentBonus: BONUS_6_ORDERS,
      nextMilestone: 10,
      deliveriesUntilNext: remaining,
      progress: (todayDeliveries - 6) / 4,
      milestoneLabel: `₹${BONUS_6_ORDERS} earned! ₹${BONUS_10_ORDERS} in ${remaining} more`,
    };
  }
  const remaining = 6 - todayDeliveries;
  return {
    currentBonus: 0,
    nextMilestone: 6,
    deliveriesUntilNext: remaining,
    progress: todayDeliveries / 6,
    milestoneLabel: `₹${BONUS_6_ORDERS} bonus in ${remaining} more deliveries`,
  };
}
