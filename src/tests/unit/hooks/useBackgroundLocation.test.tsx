import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockAddWatcher = vi.fn();
const mockRemoveWatcher = vi.fn();

vi.mock('@capacitor/core', () => ({
  registerPlugin: vi.fn().mockReturnValue({
    addWatcher: mockAddWatcher,
    removeWatcher: mockRemoveWatcher,
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
    mockAddWatcher.mockReset();
    mockRemoveWatcher.mockReset();
    mockAddWatcher.mockResolvedValue('native-watcher-123');
    mockRemoveWatcher.mockResolvedValue(undefined);

    if (typeof window !== 'undefined') {
      originalGeolocation = window.navigator.geolocation;
      originalCapacitor = (window as Record<string, unknown>).Capacitor;
      // Set Capacitor to simulate native platform
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

  it('should trigger onLocationError when geolocation is missing/undefined on web', async () => {
    // Remove Capacitor to simulate web platform
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
    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(onLocationErrorMock).toHaveBeenCalledWith('Geolocation not supported by this browser.');
    expect(result.current.geoError).toBe('Geolocation not supported by this browser.');
  });

  it('should handle native plugin initialization failure gracefully', async () => {
    mockAddWatcher.mockRejectedValue(new Error('BackgroundGeolocation plugin is not implemented on android'));

    const onLocationErrorMock = vi.fn();
    const { useBackgroundLocation } = await import('@/hooks/useBackgroundLocation');

    const { result } = renderHook(() =>
      useBackgroundLocation('rider-123', true, onLocationErrorMock)
    );

    await act(async () => {});
    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current.geoError).toBe('Failed to initialize native tracking service.');
    expect(onLocationErrorMock).toHaveBeenCalledWith('Failed to initialize native tracking service.');
  });

  it('should track consecutive native watcher errors and trigger callback after 3', async () => {
    let watcherCallback: ((location: unknown, error: { code: number; message: string } | null) => void) | undefined;

    mockAddWatcher.mockImplementation((_opts: unknown, cb: typeof watcherCallback) => {
      watcherCallback = cb;
      return Promise.resolve('native-watcher-123');
    });

    const onLocationErrorMock = vi.fn();
    const { useBackgroundLocation } = await import('@/hooks/useBackgroundLocation');

    renderHook(() =>
      useBackgroundLocation('rider-123', true, onLocationErrorMock)
    );

    await act(async () => {});
    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(watcherCallback).toBeDefined();

    // 3 consecutive errors should trigger onLocationError
    await act(async () => {
      watcherCallback!(null, { code: 1, message: 'Permission denied' });
    });
    await act(async () => {
      watcherCallback!(null, { code: 1, message: 'Permission denied' });
    });
    await act(async () => {
      watcherCallback!(null, { code: 1, message: 'Permission denied' });
    });

    expect(onLocationErrorMock).toHaveBeenCalledWith('Permission denied');
  });

  it('should reset consecutive error count on successful location update', async () => {
    let watcherCallback: ((location: { latitude: number; longitude: number; accuracy: number; altitude: number; altitudeAccuracy: number; speed: number; bearing: number; simulated: boolean; time: number } | null, error: { code: number; message: string } | null) => void) | undefined;

    mockAddWatcher.mockImplementation((_opts: unknown, cb: typeof watcherCallback) => {
      watcherCallback = cb;
      return Promise.resolve('native-watcher-123');
    });

    const onLocationErrorMock = vi.fn();
    const { useBackgroundLocation } = await import('@/hooks/useBackgroundLocation');

    renderHook(() =>
      useBackgroundLocation('rider-123', true, onLocationErrorMock)
    );

    await act(async () => {});
    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    // 2 errors, then success, then 2 more errors — should NOT trigger callback
    await act(async () => {
      watcherCallback!(null, { code: 1, message: 'Error 1' });
    });
    await act(async () => {
      watcherCallback!(null, { code: 1, message: 'Error 2' });
    });
    await act(async () => {
      watcherCallback!({ latitude: 12.97, longitude: 77.59, accuracy: 10, altitude: 0, altitudeAccuracy: 0, speed: 0, bearing: 0, simulated: false, time: Date.now() }, null);
    });
    await act(async () => {
      watcherCallback!(null, { code: 1, message: 'Error 3' });
    });
    await act(async () => {
      watcherCallback!(null, { code: 1, message: 'Error 4' });
    });

    expect(onLocationErrorMock).not.toHaveBeenCalled();
  });

  it('should remove native watcher on unmount', async () => {
    mockAddWatcher.mockResolvedValue('native-watcher-cleanup');

    const { useBackgroundLocation } = await import('@/hooks/useBackgroundLocation');

    const { unmount } = renderHook(() =>
      useBackgroundLocation('rider-123', true)
    );

    await act(async () => {});
    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    unmount();

    expect(mockRemoveWatcher).toHaveBeenCalledWith({ id: 'native-watcher-cleanup' });
  });

  it('should not start tracking when isOnline is false', async () => {
    const { useBackgroundLocation } = await import('@/hooks/useBackgroundLocation');

    renderHook(() =>
      useBackgroundLocation('rider-123', false)
    );

    await act(async () => {});
    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(mockAddWatcher).not.toHaveBeenCalled();
  });

  it('should not start tracking when riderId is empty', async () => {
    const { useBackgroundLocation } = await import('@/hooks/useBackgroundLocation');

    renderHook(() =>
      useBackgroundLocation('', true)
    );

    await act(async () => {});
    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(mockAddWatcher).not.toHaveBeenCalled();
  });
});
