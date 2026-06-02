import { describe, it, expect } from 'vitest';
import {
  calculateDeliveryFee,
  calculateRiderEarning,
  calculateNightlyBonus,
  calculateEarningBreakdown,
  calculateBonusProgress,
  DELIVERY_FEE_SLABS,
  AFTER_5KM_BASE,
  AFTER_5KM_PER_KM,
  DEAD_MILES_PER_KM,
  BONUS_6_ORDERS,
  BONUS_10_ORDERS,
} from '@/lib/pricing';

describe('pricing utility logic', () => {
  describe('calculateDeliveryFee', () => {
    it('should return ₹30 delivery fee for distance <= 2km', () => {
      // Arrange
      const distance = 1.5;

      // Act
      const fee = calculateDeliveryFee(distance);

      // Assert
      expect(fee).toBe(DELIVERY_FEE_SLABS.UPTO_2KM);
    });

    it('should return ₹35 delivery fee for distance between 2km and 3km', () => {
      // Arrange
      const distance = 2.5;

      // Act
      const fee = calculateDeliveryFee(distance);

      // Assert
      expect(fee).toBe(DELIVERY_FEE_SLABS.UPTO_3KM);
    });

    it('should return ₹45 delivery fee for distance between 3km and 5km', () => {
      // Arrange
      const distance = 4.8;

      // Act
      const fee = calculateDeliveryFee(distance);

      // Assert
      expect(fee).toBe(DELIVERY_FEE_SLABS.UPTO_5KM);
    });

    it('should return slab fee exactly at boundary limits', () => {
      expect(calculateDeliveryFee(2)).toBe(DELIVERY_FEE_SLABS.UPTO_2KM);
      expect(calculateDeliveryFee(3)).toBe(DELIVERY_FEE_SLABS.UPTO_3KM);
      expect(calculateDeliveryFee(5)).toBe(DELIVERY_FEE_SLABS.UPTO_5KM);
    });

    it('should calculate per-km delivery fee dynamically for distance > 5km', () => {
      // Arrange
      const distance = 7.2; // ceiling of (7.2 - 5) is 3km

      // Act
      const fee = calculateDeliveryFee(distance);

      // Assert
      // Expected: 15 + Math.ceil(7.2 - 5) * 7 = 15 + 3 * 7 = 36
      expect(fee).toBe(AFTER_5KM_BASE + Math.ceil(distance - 5) * AFTER_5KM_PER_KM);
      expect(fee).toBe(36);
    });
  });

  describe('calculateRiderEarning', () => {
    it('should calculate rider earning with slab delivery fee + dead miles for distance <= 5km', () => {
      // Arrange & Act
      const earning = calculateRiderEarning(2.5); // UPTO_3KM slab is ₹35. Ceiling of 2.5 is 3.

      // Assert
      // Expected: 35 + 3 * 2 (dead miles) = 41
      expect(earning).toBe(35 + Math.ceil(2.5) * DEAD_MILES_PER_KM);
      expect(earning).toBe(41);
    });

    it('should calculate rider earning with per-km delivery fee + dead miles for distance > 5km', () => {
      // Arrange & Act
      const earning = calculateRiderEarning(7.2); // Ceiling of 7.2 is 8.

      // Assert
      // Expected: (15 + 3 * 7) + 8 * 2 = 36 + 16 = 52
      expect(earning).toBe(52);
    });
  });

  describe('calculateNightlyBonus', () => {
    it('should return ₹0 bonus for completing under 6 orders', () => {
      expect(calculateNightlyBonus(0)).toBe(0);
      expect(calculateNightlyBonus(5)).toBe(0);
    });

    it('should return ₹100 bonus for completing between 6 and 9 orders', () => {
      expect(calculateNightlyBonus(6)).toBe(BONUS_6_ORDERS);
      expect(calculateNightlyBonus(9)).toBe(BONUS_6_ORDERS);
    });

    it('should return ₹200 bonus for completing 10 or more orders', () => {
      expect(calculateNightlyBonus(10)).toBe(BONUS_10_ORDERS);
      expect(calculateNightlyBonus(15)).toBe(BONUS_10_ORDERS);
    });
  });

  describe('specific user requested cases (5km, 7km, 210km)', () => {
    it('should correctly calculate delivery fee and earning for 5km', () => {
      // 5km is the boundary of the slab pricing under 5km
      expect(calculateDeliveryFee(5)).toBe(45);
      expect(calculateRiderEarning(5)).toBe(55); // 45 + 5 * 2 = 55
    });

    it('should correctly calculate delivery fee and earning for 7km', () => {
      // 7km is in the per-km pricing slab (>5km)
      expect(calculateDeliveryFee(7)).toBe(29); // 15 + 2 * 7 = 29
      expect(calculateRiderEarning(7)).toBe(43); // 29 + 7 * 2 = 43
    });

    it('should correctly calculate delivery fee and earning for 210km', () => {
      // 210km is extreme distance, but pricing formulas must calculate linearly
      expect(calculateDeliveryFee(210)).toBe(1450); // 15 + 205 * 7 = 1450
      expect(calculateRiderEarning(210)).toBe(1870); // 1450 + 210 * 2 = 1870
    });
  });

  describe('edge cases', () => {
    it('should handle exactly 0km distance gracefully', () => {
      expect(calculateDeliveryFee(0)).toBe(30); // 0km is <= 2km, so ₹30
      expect(calculateRiderEarning(0)).toBe(30); // 30 + 0 * 2 = 30
    });

    it('should handle boundary transition values correctly', () => {
      // 2km boundary transition
      expect(calculateDeliveryFee(2)).toBe(30);
      expect(calculateDeliveryFee(2.0001)).toBe(35); // slightly over 2km triggers UPTO_3KM slab

      // 3km boundary transition
      expect(calculateDeliveryFee(3)).toBe(35);
      expect(calculateDeliveryFee(3.0001)).toBe(45); // slightly over 3km triggers UPTO_5KM slab

      // 5km boundary transition (slab to per-km)
      expect(calculateDeliveryFee(5)).toBe(45);
      expect(calculateDeliveryFee(5.0001)).toBe(22); // 15 + Math.ceil(5.0001 - 5) * 7 = 15 + 7 = 22
    });

    it('should handle extreme huge distances', () => {
      const distance = 1000;
      expect(calculateDeliveryFee(distance)).toBe(15 + 995 * 7); // ₹6980
      expect(calculateRiderEarning(distance)).toBe(6980 + 1000 * 2); // ₹8980
    });

    it('should return ₹0 bonus for negative orders', () => {
      expect(calculateNightlyBonus(-5)).toBe(0);
    });
  });

  describe('calculateEarningBreakdown', () => {
    it('should return total, deliveryFee, and pickupPay for 2.5km', () => {
      const result = calculateEarningBreakdown(2.5);
      expect(result.deliveryFee).toBe(35);       // UPTO_3KM slab
      expect(result.pickupPay).toBe(6);           // ceil(2.5)=3, 3*2=6
      expect(result.total).toBe(41);              // 35+6
    });

    it('should return total, deliveryFee, and pickupPay for 7km', () => {
      const result = calculateEarningBreakdown(7);
      expect(result.deliveryFee).toBe(29);       // 15 + 2*7
      expect(result.pickupPay).toBe(14);          // 7*2
      expect(result.total).toBe(43);
    });

    it('should handle 0km edge case', () => {
      const result = calculateEarningBreakdown(0);
      expect(result.deliveryFee).toBe(30);
      expect(result.pickupPay).toBe(0);
      expect(result.total).toBe(30);
    });
  });

  describe('calculateBonusProgress', () => {
    it('should target ₹100 milestone when under 6 deliveries', () => {
      const result = calculateBonusProgress(3);
      expect(result.currentBonus).toBe(0);
      expect(result.nextMilestone).toBe(6);
      expect(result.deliveriesUntilNext).toBe(3);
      expect(result.progress).toBeCloseTo(0.5);
      expect(result.milestoneLabel).toContain('3 more');
    });

    it('should show ₹100 earned and target ₹200 at 6 deliveries', () => {
      const result = calculateBonusProgress(6);
      expect(result.currentBonus).toBe(100);
      expect(result.nextMilestone).toBe(10);
      expect(result.deliveriesUntilNext).toBe(4);
      expect(result.progress).toBeCloseTo(0);
    });

    it('should show partial progress toward ₹200 at 8 deliveries', () => {
      const result = calculateBonusProgress(8);
      expect(result.currentBonus).toBe(100);
      expect(result.nextMilestone).toBe(10);
      expect(result.deliveriesUntilNext).toBe(2);
      expect(result.progress).toBeCloseTo(0.5);
    });

    it('should show max achieved at 10+ deliveries', () => {
      const result = calculateBonusProgress(12);
      expect(result.currentBonus).toBe(200);
      expect(result.nextMilestone).toBeNull();
      expect(result.deliveriesUntilNext).toBe(0);
      expect(result.progress).toBe(1);
      expect(result.milestoneLabel).toContain('achieved');
    });

    it('should handle 0 deliveries', () => {
      const result = calculateBonusProgress(0);
      expect(result.currentBonus).toBe(0);
      expect(result.nextMilestone).toBe(6);
      expect(result.deliveriesUntilNext).toBe(6);
      expect(result.progress).toBeCloseTo(0);
    });
  });
});
