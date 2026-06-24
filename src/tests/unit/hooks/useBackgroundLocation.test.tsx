import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockStartTracking = vi.fn();
const mockStopTracking = vi.fn();
const mockAddListener = vi.fn();
const mockRemoveListener = vi.fn();

vi.mock('@capacitor/core', () => ({
  registerPlugin: vi.fn().mockReturnValue({
    startTracking: mockStartTracking,
    stopTracking: mockStopTracking,
    addListener: mockAddListener,
    removeListener: mockRemoveListener,
  }),
}));

vi.mock('@/app/actions/riderActions', () => ({
  updateLocation: vi.fn(),
}));

describe('useBackgroundLocation', () => {
  let originalGeolocation: Geolocation | undefined;
  let originalCapacitor: unknown;

  beforeEach(() => {
    vi.useFakeTimers();
    mockStartTracking.mockReset();
    mockStopTracking.mockReset();
    mockAddListener.mockReset();
    mockRemoveListener.mockReset();
    mockStartTracking.mockResolvedValue(undefined);
    mockStopTracking.mockResolvedValue(undefined);
    mockAddListener.mockResolvedValue(undefined);
    mockRemoveListener.mockResolvedValue(undefined);

    if (typeof window !== 'undefined') {
      originalGeolocation = window.navigator.geolocation;
      originalCapacitor = (window as Record<string, unknown>).Capacitor;
      (window as Record<string, unknown>).Capacitor = {
        isNativePlatform: () => true,
      };
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    if (typeof window !== 'undefined') {
      if (originalGeolocation) {
        Object.defineProperty(window.navigator, 'geolocation', {
          value: originalGeolocation,
          configurable: true,
          writable: true,
        });
      }
      if (originalCapacitor !== undefined) {
        (window as Record<string, unknown>).Capacitor = originalCapacitor;
      } else {
        delete (window as Record<string, unknown>).Capacitor;
      }
    }
  });

  it('should trigger onLocationError when geolocation is missing on web', async () => {
    delete (window as Record<string, unknown>).Capacitor;

    if (typeof window !== 'undefined') {
      Object.defineProperty(window.navigator, 'geolocation', {
        value: undefined,
        configurable: true,
        writable: true,
      });
    }

    const onLocationErrorMock = vi.fn();
    const { useBackgroundLocation } = await import('@/hooks/useBackgroundLocation');

    const { result } = renderHook(() =>
      useBackgroundLocation('rider-123', true, onLocationErrorMock)
    );

    await act(async () => {});
    await act(async () => { vi.advanceTimersByTime(1); });

    expect(onLocationErrorMock).toHaveBeenCalledWith('Geolocation not supported by this browser.');
    expect(result.current.geoError).toBe('Geolocation not supported by this browser.');
  });

  it('should fallback to web tracking when native startTracking throws', async () => {
    mockStartTracking.mockRejectedValue(new Error('LocationSync plugin is not implemented on android'));

    const watchMock = vi.fn().mockReturnValue(99);
    if (typeof window !== 'undefined') {
      Object.defineProperty(window.navigator, 'geolocation', {
        value: {
          watchPosition: watchMock,
          clearWatch: vi.fn(),
          getCurrentPosition: vi.fn(),
        },
        configurable: true,
        writable: true,
      });
    }

    const { useBackgroundLocation } = await import('@/hooks/useBackgroundLocation');

    renderHook(() => useBackgroundLocation('rider-123', true));

    await act(async () => {});
    await act(async () => { vi.advanceTimersByTime(1); });

    expect(mockStartTracking).toHaveBeenCalled();
    expect(watchMock).toHaveBeenCalled();
  });

  it('should populate lastLat/lastLng from native locationUpdate events', async () => {
    let updateListener: ((data: { lat: number; lng: number }) => void) | undefined;

    mockAddListener.mockImplementation((_event: string, cb: typeof updateListener) => {
      updateListener = cb;
      return Promise.resolve(undefined);
    });

    const { useBackgroundLocation } = await import('@/hooks/useBackgroundLocation');

    const { result } = renderHook(() => useBackgroundLocation('rider-123', true));

    await act(async () => {});
    await act(async () => { vi.advanceTimersByTime(1); });

    expect(updateListener).toBeDefined();

    await act(async () => { updateListener!({ lat: 12.97, lng: 77.59 }); });

    expect(result.current.lastLat).toBe(12.97);
    expect(result.current.lastLng).toBe(77.59);
    expect(result.current.geoError).toBeNull();
  });

  it('should not call updateLocation on the native path (service uploads itself)', async () => {
    const { updateLocation } = await import('@/app/actions/riderActions');
    (updateLocation as unknown as ReturnType<typeof vi.fn>).mockClear();

    let updateListener: ((data: { lat: number; lng: number }) => void) | undefined;
    mockAddListener.mockImplementation((_event: string, cb: typeof updateListener) => {
      updateListener = cb;
      return Promise.resolve(undefined);
    });

    const { useBackgroundLocation } = await import('@/hooks/useBackgroundLocation');

    renderHook(() => useBackgroundLocation('rider-123', true));

    await act(async () => {});
    await act(async () => { vi.advanceTimersByTime(1); });

    await act(async () => { updateListener!({ lat: 12.97, lng: 77.59 }); });

    // Native foreground service uploads coordinates itself; JS must not double-post.
    expect(updateLocation).not.toHaveBeenCalled();
  });

  it('should stop native tracking and remove listener on unmount', async () => {
    const { useBackgroundLocation } = await import('@/hooks/useBackgroundLocation');

    const { unmount } = renderHook(() => useBackgroundLocation('rider-123', true));

    await act(async () => {});
    await act(async () => { vi.advanceTimersByTime(1); });

    unmount();

    expect(mockStopTracking).toHaveBeenCalled();
    expect(mockRemoveListener).toHaveBeenCalled();
  });

  it('should not start tracking when isOnline is false', async () => {
    const { useBackgroundLocation } = await import('@/hooks/useBackgroundLocation');

    renderHook(() => useBackgroundLocation('rider-123', false));

    await act(async () => {});
    await act(async () => { vi.advanceTimersByTime(1); });

    expect(mockStartTracking).not.toHaveBeenCalled();
  });

  it('should not start tracking when riderId is empty', async () => {
    const { useBackgroundLocation } = await import('@/hooks/useBackgroundLocation');

    renderHook(() => useBackgroundLocation('', true));

    await act(async () => {});
    await act(async () => { vi.advanceTimersByTime(1); });

    expect(mockStartTracking).not.toHaveBeenCalled();
  });

  it('should track consecutive web watcher errors and trigger callback after 3', async () => {
    delete (window as Record<string, unknown>).Capacitor;

    let webWatcherCallback: ((error: { code: number; message: string }) => void) | undefined;
    const watchMock = vi.fn().mockImplementation((_successCb: unknown, errorCb: typeof webWatcherCallback) => {
      webWatcherCallback = errorCb;
      return 88;
    });

    if (typeof window !== 'undefined') {
      Object.defineProperty(window.navigator, 'geolocation', {
        value: {
          watchPosition: watchMock,
          clearWatch: vi.fn(),
          getCurrentPosition: vi.fn(),
        },
        configurable: true,
        writable: true,
      });
    }

    const onLocationErrorMock = vi.fn();
    const { useBackgroundLocation } = await import('@/hooks/useBackgroundLocation');

    renderHook(() =>
      useBackgroundLocation('rider-123', true, onLocationErrorMock)
    );

    await act(async () => {});
    await act(async () => { vi.advanceTimersByTime(1); });

    expect(webWatcherCallback).toBeDefined();

    // Trigger web geolocation watch errors
    await act(async () => { webWatcherCallback!({ code: 1, message: 'Web GPS failed' }); });
    await act(async () => { webWatcherCallback!({ code: 1, message: 'Web GPS failed' }); });
    await act(async () => { webWatcherCallback!({ code: 1, message: 'Web GPS failed' }); });

    expect(onLocationErrorMock).toHaveBeenCalledWith('Web GPS failed');
  });

  it('should restart web watcher on visibility change to visible', async () => {
    delete (window as Record<string, unknown>).Capacitor;

    const watchMock = vi.fn().mockReturnValue(77);
    const clearMock = vi.fn();

    if (typeof window !== 'undefined') {
      Object.defineProperty(window.navigator, 'geolocation', {
        value: {
          watchPosition: watchMock,
          clearWatch: clearMock,
          getCurrentPosition: vi.fn(),
        },
        configurable: true,
        writable: true,
      });
    }

    const { useBackgroundLocation } = await import('@/hooks/useBackgroundLocation');

    const { unmount } = renderHook(() => useBackgroundLocation('rider-123', true));

    await act(async () => {});
    await act(async () => { vi.advanceTimersByTime(1); });

    expect(watchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(clearMock).toHaveBeenCalled();
    expect(watchMock).toHaveBeenCalledTimes(2);

    unmount();
  });
});
