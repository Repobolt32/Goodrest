import { describe, it, expect, vi, beforeEach } from 'vitest';
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
      const fee = calculateDeliveryFee(1.5);
      expect(fee).toBe(DELIVERY_FEE_SLABS.UPTO_2KM);
    });

    it('should return ₹35 delivery fee for distance between 2km and 3km', () => {
      const fee = calculateDeliveryFee(2.5);
      expect(fee).toBe(DELIVERY_FEE_SLABS.UPTO_3KM);
    });

    it('should return ₹45 delivery fee for distance between 3km and 5km', () => {
      const fee = calculateDeliveryFee(4.8);
      expect(fee).toBe(DELIVERY_FEE_SLABS.UPTO_5KM);
    });

    it('should return slab fee exactly at boundary limits', () => {
      expect(calculateDeliveryFee(2)).toBe(DELIVERY_FEE_SLABS.UPTO_2KM);
      expect(calculateDeliveryFee(3)).toBe(DELIVERY_FEE_SLABS.UPTO_3KM);
      expect(calculateDeliveryFee(5)).toBe(DELIVERY_FEE_SLABS.UPTO_5KM);
    });

    it('should calculate per-km delivery fee dynamically for distance > 5km', () => {
      const distance = 7.2;
      const fee = calculateDeliveryFee(distance);
      expect(fee).toBe(AFTER_5KM_BASE + Math.ceil(distance - 5) * AFTER_5KM_PER_KM);
      expect(fee).toBe(36);
    });
  });

  describe('calculateRiderEarning', () => {
    it('should calculate rider earning with slab delivery fee + dead miles for distance <= 5km', () => {
      const earning = calculateRiderEarning(2.5);
      expect(earning).toBe(35 + Math.ceil(2.5) * DEAD_MILES_PER_KM);
      expect(earning).toBe(41);
    });

    it('should calculate rider earning with per-km delivery fee + dead miles for distance > 5km', () => {
      const earning = calculateRiderEarning(7.2);
      expect(earning).toBe(52);
    });

    // Tracer bullet: batch earnings exclude dead miles for non-final batched orders
    it('should exclude dead miles when isBatchedNonFinal is true', () => {
      const earning = calculateRiderEarning(2.5, true);
      // deliveryFee only, no dead miles
      expect(earning).toBe(35);
    });

    it('should include dead miles when isBatchedNonFinal is false', () => {
      const earning = calculateRiderEarning(2.5, false);
      expect(earning).toBe(41);
    });

    it('should include dead miles by default (backward compat)', () => {
      const earningDefault = calculateRiderEarning(2.5);
      const earningExplicit = calculateRiderEarning(2.5, false);
      expect(earningDefault).toBe(earningExplicit);
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
      expect(calculateDeliveryFee(5)).toBe(45);
      expect(calculateRiderEarning(5)).toBe(55);
    });

    it('should correctly calculate delivery fee and earning for 7km', () => {
      expect(calculateDeliveryFee(7)).toBe(29);
      expect(calculateRiderEarning(7)).toBe(43);
    });

    it('should correctly calculate delivery fee and earning for 210km', () => {
      expect(calculateDeliveryFee(210)).toBe(1450);
      expect(calculateRiderEarning(210)).toBe(1870);
    });
  });

  describe('edge cases', () => {
    it('should handle exactly 0km distance gracefully', () => {
      expect(calculateDeliveryFee(0)).toBe(30);
      expect(calculateRiderEarning(0)).toBe(30);
    });

    it('should handle boundary transition values correctly', () => {
      expect(calculateDeliveryFee(2)).toBe(30);
      expect(calculateDeliveryFee(2.0001)).toBe(35);
      expect(calculateDeliveryFee(3)).toBe(35);
      expect(calculateDeliveryFee(3.0001)).toBe(45);
      expect(calculateDeliveryFee(5)).toBe(45);
      expect(calculateDeliveryFee(5.0001)).toBe(22);
    });

    it('should handle extreme huge distances', () => {
      const distance = 1000;
      expect(calculateDeliveryFee(distance)).toBe(15 + 995 * 7);
      expect(calculateRiderEarning(distance)).toBe(6980 + 1000 * 2);
    });

    it('should return ₹0 bonus for negative orders', () => {
      expect(calculateNightlyBonus(-5)).toBe(0);
    });
  });

  describe('calculateEarningBreakdown', () => {
    it('should return total, deliveryFee, and pickupPay for 2.5km', () => {
      const result = calculateEarningBreakdown(2.5);
      expect(result.deliveryFee).toBe(35);
      expect(result.pickupPay).toBe(6);
      expect(result.total).toBe(41);
    });

    it('should return total, deliveryFee, and pickupPay for 7km', () => {
      const result = calculateEarningBreakdown(7);
      expect(result.deliveryFee).toBe(29);
      expect(result.pickupPay).toBe(14);
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
