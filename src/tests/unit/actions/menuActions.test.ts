import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: mocks.mockFrom,
  },
}));

import { getMenuData } from '@/app/actions/menuActions';

describe('menuActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return categories and items on success', async () => {
    mocks.mockFrom.mockImplementation((table: string) => {
      if (table === 'categories') {
        return {
          select: () => ({
            order: () => ({
              eq: () => Promise.resolve({
                data: [{ name: 'Main Course' }, { name: 'Starters' }],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'menu_items') {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({
                data: [
                  { id: 'item-1', name: 'Pizza', price: 200, categories: { name: 'Main Course' } },
                  { id: 'item-2', name: 'Salad', price: 150, categories: { name: 'Starters' } },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: () => ({ order: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) };
    });

    const result = await getMenuData();

    expect(result.success).toBe(true);
    expect(result.categories).toEqual(['Main Course', 'Starters']);
    expect(result.items).toHaveLength(2);
  });

  it('should return error when categories fetch fails', async () => {
    mocks.mockFrom.mockImplementation((table: string) => {
      if (table === 'categories') {
        return {
          select: () => ({
            order: () => ({
              eq: () => Promise.resolve({
                data: null,
                error: { message: 'DB error', name: 'PostgrestError' },
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      };
    });

    const result = await getMenuData();

    expect(result.success).toBe(false);
    expect(result.categories).toEqual([]);
  });

  it('should return error when items fetch fails', async () => {
    mocks.mockFrom.mockImplementation((table: string) => {
      if (table === 'categories') {
        return {
          select: () => ({
            order: () => ({
              eq: () => Promise.resolve({
                data: [],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'menu_items') {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({
                data: null,
                error: { message: 'Items fetch error', name: 'PostgrestError' },
              }),
            }),
          }),
        };
      }
      return { select: () => ({ order: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) };
    });

    const result = await getMenuData();

    expect(result.success).toBe(false);
    expect(result.items).toEqual([]);
  });

  it('should return empty arrays when no data returned', async () => {
    mocks.mockFrom.mockImplementation((table: string) => {
      if (table === 'categories') {
        return {
          select: () => ({
            order: () => ({
              eq: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      };
    });

    const result = await getMenuData();

    expect(result.success).toBe(true);
    expect(result.categories).toEqual([]);
    expect(result.items).toEqual([]);
  });

  it('should return error when unexpected exception occurs', async () => {
    mocks.mockFrom.mockImplementation(() => {
      throw new Error('Network error');
    });

    const result = await getMenuData();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });
});