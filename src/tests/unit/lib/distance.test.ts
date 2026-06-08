import { describe, it, expect } from 'vitest';
import { calculateETA } from '@/lib/distance';

describe('distance', () => {
  describe('calculateETA', () => {
    it('should calculate ETA with 20min prep + travel time from durationSeconds', () => {
      const eta = calculateETA(600);
      expect(eta).toBe(35);
    });

    it('should handle 0 duration (just prep time)', () => {
      const eta = calculateETA(0);
      expect(eta).toBe(25);
    });

    it('should round up fractional minutes', () => {
      const eta = calculateETA(90);
      expect(eta).toBe(27);
    });

    it('should accept custom prep time', () => {
      const eta = calculateETA(600, 15);
      expect(eta).toBe(30);
    });
  });
});
