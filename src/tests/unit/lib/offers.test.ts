import { describe, it, expect } from 'vitest';
import { applyOffers, type ActiveOffer } from '@/lib/offers';

describe('applyOffers', () => {
  describe('no offers', () => {
    it('should return unchanged totals when no offers provided', () => {
      const result = applyOffers(350, 30, []);

      expect(result.discountAmount).toBe(0);
      expect(result.finalDeliveryFee).toBe(30);
      expect(result.finalTotal).toBe(380);
      expect(result.appliedOffers).toEqual([]);
    });

    it('should return unchanged totals when offers array is empty', () => {
      const result = applyOffers(100, 45, []);

      expect(result.discountAmount).toBe(0);
      expect(result.finalDeliveryFee).toBe(45);
      expect(result.finalTotal).toBe(145);
    });
  });

  describe('discount_percent offers', () => {
    it('should apply 10% discount to subtotal', () => {
      const offers: ActiveOffer[] = [
        { id: '1', type: 'discount_percent', config: { percent: 10 } },
      ];

      const result = applyOffers(350, 30, offers);

      expect(result.discountAmount).toBe(35);
      expect(result.finalDeliveryFee).toBe(30);
      expect(result.finalTotal).toBe(345);
    });

    it('should cap discount at max_amount', () => {
      const offers: ActiveOffer[] = [
        { id: '1', type: 'discount_percent', config: { percent: 50, max_amount: 100 } },
      ];

      const result = applyOffers(500, 30, offers);

      expect(result.discountAmount).toBe(100);
      expect(result.finalTotal).toBe(430);
    });

    it('should apply full percentage when below max_amount cap', () => {
      const offers: ActiveOffer[] = [
        { id: '1', type: 'discount_percent', config: { percent: 50, max_amount: 100 } },
      ];

      const result = applyOffers(100, 30, offers);

      expect(result.discountAmount).toBe(50);
      expect(result.finalTotal).toBe(80);
    });

    it('should clamp discount to subtotal (never negative)', () => {
      const offers: ActiveOffer[] = [
        { id: '1', type: 'discount_percent', config: { percent: 100 } },
      ];

      const result = applyOffers(50, 30, offers);

      expect(result.discountAmount).toBe(50);
      expect(result.finalTotal).toBe(30);
    });

    it('should handle 0 subtotal gracefully', () => {
      const offers: ActiveOffer[] = [
        { id: '1', type: 'discount_percent', config: { percent: 10 } },
      ];

      const result = applyOffers(0, 30, offers);

      expect(result.discountAmount).toBe(0);
      expect(result.finalTotal).toBe(30);
    });
  });

  describe('free_delivery offers', () => {
    it('should waive delivery fee when subtotal meets threshold', () => {
      const offers: ActiveOffer[] = [
        { id: '1', type: 'free_delivery', config: { threshold: 200 } },
      ];

      const result = applyOffers(250, 30, offers);

      expect(result.discountAmount).toBe(0);
      expect(result.finalDeliveryFee).toBe(0);
      expect(result.finalTotal).toBe(250);
    });

    it('should waive delivery fee when subtotal equals threshold exactly', () => {
      const offers: ActiveOffer[] = [
        { id: '1', type: 'free_delivery', config: { threshold: 200 } },
      ];

      const result = applyOffers(200, 30, offers);

      expect(result.finalDeliveryFee).toBe(0);
      expect(result.finalTotal).toBe(200);
    });

    it('should NOT waive delivery fee when subtotal is below threshold', () => {
      const offers: ActiveOffer[] = [
        { id: '1', type: 'free_delivery', config: { threshold: 200 } },
      ];

      const result = applyOffers(199, 30, offers);

      expect(result.finalDeliveryFee).toBe(30);
      expect(result.finalTotal).toBe(229);
    });

    it('should handle threshold of 0 (always free delivery)', () => {
      const offers: ActiveOffer[] = [
        { id: '1', type: 'free_delivery', config: { threshold: 0 } },
      ];

      const result = applyOffers(10, 30, offers);

      expect(result.finalDeliveryFee).toBe(0);
      expect(result.finalTotal).toBe(10);
    });
  });

  describe('combined offers', () => {
    it('should apply both discount and free delivery together', () => {
      const offers: ActiveOffer[] = [
        { id: '1', type: 'discount_percent', config: { percent: 10 } },
        { id: '2', type: 'free_delivery', config: { threshold: 200 } },
      ];

      const result = applyOffers(350, 30, offers);

      expect(result.discountAmount).toBe(35);
      expect(result.finalDeliveryFee).toBe(0);
      expect(result.finalTotal).toBe(315);
    });

    it('should apply discount but not free delivery when below threshold', () => {
      const offers: ActiveOffer[] = [
        { id: '1', type: 'discount_percent', config: { percent: 10 } },
        { id: '2', type: 'free_delivery', config: { threshold: 200 } },
      ];

      const result = applyOffers(150, 30, offers);

      expect(result.discountAmount).toBe(15);
      expect(result.finalDeliveryFee).toBe(30);
      expect(result.finalTotal).toBe(165);
    });

    it('should use only first discount offer when multiple exist', () => {
      const offers: ActiveOffer[] = [
        { id: '1', type: 'discount_percent', config: { percent: 10 } },
        { id: '2', type: 'discount_percent', config: { percent: 20 } },
      ];

      const result = applyOffers(100, 30, offers);

      expect(result.discountAmount).toBe(10);
    });

    it('should use only first free_delivery offer when multiple exist', () => {
      const offers: ActiveOffer[] = [
        { id: '1', type: 'free_delivery', config: { threshold: 300 } },
        { id: '2', type: 'free_delivery', config: { threshold: 100 } },
      ];

      const result = applyOffers(200, 30, offers);

      expect(result.finalDeliveryFee).toBe(30);
    });
  });

  describe('appliedOffers tracking', () => {
    it('should track which offers were applied', () => {
      const offers: ActiveOffer[] = [
        { id: 'disc-1', type: 'discount_percent', config: { percent: 10 } },
        { id: 'free-1', type: 'free_delivery', config: { threshold: 200 } },
      ];

      const result = applyOffers(250, 30, offers);

      expect(result.appliedOffers).toHaveLength(2);
      expect(result.appliedOffers[0].id).toBe('disc-1');
      expect(result.appliedOffers[1].id).toBe('free-1');
    });

    it('should not include free_delivery in appliedOffers when threshold not met', () => {
      const offers: ActiveOffer[] = [
        { id: 'disc-1', type: 'discount_percent', config: { percent: 10 } },
        { id: 'free-1', type: 'free_delivery', config: { threshold: 500 } },
      ];

      const result = applyOffers(100, 30, offers);

      expect(result.appliedOffers).toHaveLength(1);
      expect(result.appliedOffers[0].id).toBe('disc-1');
    });
  });

  describe('edge cases', () => {
    it('should handle very large percentages gracefully', () => {
      const offers: ActiveOffer[] = [
        { id: '1', type: 'discount_percent', config: { percent: 200 } },
      ];

      const result = applyOffers(100, 30, offers);

      expect(result.discountAmount).toBe(100);
      expect(result.finalTotal).toBe(30);
    });

    it('should handle decimal percentages correctly', () => {
      const offers: ActiveOffer[] = [
        { id: '1', type: 'discount_percent', config: { percent: 7.5 } },
      ];

      const result = applyOffers(200, 30, offers);

      expect(result.discountAmount).toBe(15);
    });

    it('should handle zero delivery fee gracefully', () => {
      const offers: ActiveOffer[] = [
        { id: '1', type: 'discount_percent', config: { percent: 10 } },
      ];

      const result = applyOffers(100, 0, offers);

      expect(result.discountAmount).toBe(10);
      expect(result.finalDeliveryFee).toBe(0);
      expect(result.finalTotal).toBe(90);
    });
  });
});
