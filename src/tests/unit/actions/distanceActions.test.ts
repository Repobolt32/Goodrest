import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.stubGlobal('fetch', vi.fn());

import { getGoogleMapsRouteData } from '@/app/actions/distanceActions';

describe('distanceActions', () => {
  let originalApiKey: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalApiKey = process.env.GOOGLE_MAPS_API_KEY;
  });

  afterEach(() => {
    if (originalApiKey !== undefined) {
      process.env.GOOGLE_MAPS_API_KEY = originalApiKey;
    } else {
      delete process.env.GOOGLE_MAPS_API_KEY;
    }
  });

  it('should return null when API key is missing', async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    const result = await getGoogleMapsRouteData(24.79, 85.01, 24.80, 85.02);
    expect(result).toBeNull();
  });

  it('should parse valid route response', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-key';
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        routes: [
          { distanceMeters: 2500, duration: '180s' },
          { distanceMeters: 3200, duration: '300s' },
        ],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await getGoogleMapsRouteData(24.79, 85.01, 24.80, 85.02);

    expect(result).not.toBeNull();
    expect(result!.distanceKm).toBe(2.5);
    expect(result!.durationSeconds).toBe(180);
  });

  it('should choose shortest route when multiple exist', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-key';
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        routes: [
          { distanceMeters: 5000, duration: '600s' },
          { distanceMeters: 1200, duration: '200s' },
          { distanceMeters: 3500, duration: '450s' },
        ],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await getGoogleMapsRouteData(24.79, 85.01, 24.80, 85.02);

    expect(result).not.toBeNull();
    expect(result!.distanceKm).toBe(1.2);
    expect(result!.durationSeconds).toBe(200);
  });

  it('should return null when routes array is empty', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-key';
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ routes: [] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await getGoogleMapsRouteData(24.79, 85.01, 24.80, 85.02);

    expect(result).toBeNull();
  });

  it('should return null when response has no routes', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-key';
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await getGoogleMapsRouteData(24.79, 85.01, 24.80, 85.02);

    expect(result).toBeNull();
  });

  it('should filter out routes with missing distanceMeters', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-key';
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        routes: [
          { duration: '180s' },
          { distanceMeters: 2500, duration: '300s' },
        ],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await getGoogleMapsRouteData(24.79, 85.01, 24.80, 85.02);

    expect(result).not.toBeNull();
    expect(result!.distanceKm).toBe(2.5);
  });

  it('should return null on fetch failure', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-key';
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network failure'));
    vi.stubGlobal('fetch', mockFetch);

    const result = await getGoogleMapsRouteData(24.79, 85.01, 24.80, 85.02);

    expect(result).toBeNull();
  });

  it('should handle missing duration field gracefully', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-key';
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        routes: [
          { distanceMeters: 2500, duration: 'invalid' },
        ],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await getGoogleMapsRouteData(24.79, 85.01, 24.80, 85.02);

    expect(result).not.toBeNull();
    expect(result!.distanceKm).toBe(2.5);
    expect(result!.durationSeconds).toBe(0);
  });
});
