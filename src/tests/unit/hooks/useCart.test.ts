import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// localStorage mock lives in src/tests/setup.ts

describe('useCart', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should start with empty cart', async () => {
    const { useCart } = await import('@/hooks/useCart');
    const { result } = renderHook(() => useCart());

    // Let mount effects settle
    await act(async () => {});
    await act(async () => { vi.advanceTimersByTime(1); });

    expect(result.current.items).toEqual([]);
    expect(result.current.totalItems).toBe(0);
    expect(result.current.totalPrice).toBe(0);
  });

  it('should add item to cart', async () => {
    const { useCart } = await import('@/hooks/useCart');
    const { result } = renderHook(() => useCart());

    await act(async () => {});
    await act(async () => { vi.advanceTimersByTime(1); });

    const item = {
      id: '1',
      name: 'Pizza',
      price: 200,
      category: 'Main Course' as const,
      tags: [],
      is_available: true,
    };

    await act(async () => {
      result.current.addToCart(item);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(1);
    expect(result.current.totalPrice).toBe(200);
  });

  it('should increment quantity on duplicate add', async () => {
    const { useCart } = await import('@/hooks/useCart');
    const { result } = renderHook(() => useCart());

    await act(async () => {});
    await act(async () => { vi.advanceTimersByTime(1); });

    const item = {
      id: '1',
      name: 'Pizza',
      price: 200,
      category: 'Main Course' as const,
      tags: [],
      is_available: true,
    };

    await act(async () => {
      result.current.addToCart(item);
    });
    await act(async () => {
      result.current.addToCart(item);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(2);
    expect(result.current.totalPrice).toBe(400);
  });

  it('should decrement quantity on removeFromCart', async () => {
    const { useCart } = await import('@/hooks/useCart');
    const { result } = renderHook(() => useCart());

    await act(async () => {});
    await act(async () => { vi.advanceTimersByTime(1); });

    const item = {
      id: '1',
      name: 'Pizza',
      price: 200,
      category: 'Main Course' as const,
      tags: [],
      is_available: true,
    };

    await act(async () => {
      result.current.addToCart(item);
      result.current.addToCart(item);
    });
    await act(async () => {
      result.current.removeFromCart('1');
    });

    expect(result.current.items[0].quantity).toBe(1);
  });

  it('should remove item completely when last decremented', async () => {
    const { useCart } = await import('@/hooks/useCart');
    const { result } = renderHook(() => useCart());

    await act(async () => {});
    await act(async () => { vi.advanceTimersByTime(1); });

    const item = {
      id: '1',
      name: 'Pizza',
      price: 200,
      category: 'Main Course' as const,
      tags: [],
      is_available: true,
    };

    await act(async () => {
      result.current.addToCart(item);
    });
    await act(async () => {
      result.current.removeFromCart('1');
    });

    expect(result.current.items).toHaveLength(0);
  });

  it('should clear cart entirely', async () => {
    const { useCart } = await import('@/hooks/useCart');
    const { result } = renderHook(() => useCart());

    await act(async () => {});
    await act(async () => { vi.advanceTimersByTime(1); });

    await act(async () => {
      result.current.addToCart({
        id: '1',
        name: 'Pizza',
        price: 200,
        category: 'Main Course' as const,
        tags: [],
        is_available: true,
      });
    });
    await act(async () => {
      result.current.clearCart();
    });

    expect(result.current.items).toHaveLength(0);
    expect(result.current.totalItems).toBe(0);
  });

  it('should persist cart to localStorage', async () => {
    const { useCart } = await import('@/hooks/useCart');
    const { result, unmount } = renderHook(() => useCart());

    await act(async () => {});
    await act(async () => { vi.advanceTimersByTime(1); });

    await act(async () => {
      result.current.addToCart({
        id: '1',
        name: 'Pizza',
        price: 200,
        category: 'Main Course' as const,
        tags: [],
        is_available: true,
      });
    });

    unmount();

    const saved = JSON.parse(localStorage.getItem('goodrest_cart') || '[]');
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe('1');
  });

  it('should handle multiple items with correct totals', async () => {
    const { useCart } = await import('@/hooks/useCart');
    const { result } = renderHook(() => useCart());

    await act(async () => {});
    await act(async () => { vi.advanceTimersByTime(1); });

    await act(async () => {
      result.current.addToCart({
        id: '1',
        name: 'Pizza',
        price: 200,
        category: 'Main Course' as const,
        tags: [],
        is_available: true,
      });
    });
    await act(async () => {
      result.current.addToCart({
        id: '2',
        name: 'Burger',
        price: 150,
        category: 'Starters' as const,
        tags: [],
        is_available: true,
      });
    });
    await act(async () => {
      result.current.addToCart({
        id: '1',
        name: 'Pizza',
        price: 200,
        category: 'Main Course' as const,
        tags: [],
        is_available: true,
      });
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.totalItems).toBe(3); // 2 pizzas + 1 burger
    expect(result.current.totalPrice).toBe(550); // 400 + 150
  });
});
