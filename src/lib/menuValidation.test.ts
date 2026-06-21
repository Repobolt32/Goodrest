import { describe, it, expect } from 'vitest';
import { validateMenuItems, validateCategories } from '@/lib/menuValidation';

describe('menuValidation', () => {
  describe('validateMenuItems', () => {
    it('accepts valid menu items', () => {
      const validItems = [
        {
          id: '1',
          name: 'Butter Chicken',
          price: 350,
          category: 'Main Course',
          image_url: '/images/butter-chicken.png',
          tags: ['Recommended'],
          is_available: true,
        },
      ];
      
      const result = validateMenuItems(validItems);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
      }
    });

    it('rejects items with missing required fields', () => {
      const invalidItems = [
        {
          id: '1',
          name: 'Butter Chicken',
          // missing price
          category: 'Main Course',
        },
      ];
      
      const result = validateMenuItems(invalidItems);
      expect(result.success).toBe(false);
    });

    it('rejects items with negative price', () => {
      const invalidItems = [
        {
          id: '1',
          name: 'Butter Chicken',
          price: -100,
          category: 'Main Course',
          tags: [],
          is_available: true,
        },
      ];
      
      const result = validateMenuItems(invalidItems);
      expect(result.success).toBe(false);
    });

    it('handles empty array', () => {
      const result = validateMenuItems([]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });
  });

  describe('validateCategories', () => {
    it('accepts valid categories', () => {
      const validCategories = [
        { id: '1', name: 'Main Course', display_order: 1, is_active: true },
      ];
      
      const result = validateCategories(validCategories);
      expect(result.success).toBe(true);
    });

    it('rejects categories with missing fields', () => {
      const invalidCategories = [
        { id: '1', name: 'Main Course' }, // missing display_order and is_active
      ];
      
      const result = validateCategories(invalidCategories);
      expect(result.success).toBe(false);
    });
  });
});
