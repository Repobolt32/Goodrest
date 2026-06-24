import { useEffect, useRef, useState } from 'react';
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { updateLocation } from '@/app/actions/riderActions';

interface WindowWithCapacitor extends Window {
  Capacitor?: {
    isNativePlatform(): boolean;
  };
}

/** A single GPS fix forwarded from the native foreground service. */
interface LocationFix {
  lat: number;
  lng: number;
}

/**
 * Shape of the native `LocationSync` plugin (see
 * `LocationSyncPlugin.java`). The service captures GPS AND uploads to the
 * backend on its own thread; JS only subscribes to `locationUpdate` to keep
 * `lastLat`/`lastLng` populated for the UI.
 */
interface LocationSyncPlugin {
  startTracking(options: {
    token: string;
    url: string;
    intervalMillis?: number;
    distanceFilterMeters?: number;
  }): Promise<void>;
  stopTracking(): Promise<void>;
  addListener(
    eventName: 'locationUpdate',
    listenerFunc: (data: LocationFix) => void,
  ): Promise<PluginListenerHandle>;
  removeListener(
    eventName: 'locationUpdate',
    listenerFunc: (data: LocationFix) => void,
  ): Promise<void>;
}

export const LocationSync = registerPlugin<LocationSyncPlugin>('LocationSync');

export function useBackgroundLocation(
  riderId: string,
  isOnline: boolean,
  onLocationError?: (message: string) => void,
  sessionToken?: string
) {
  const [geoError, setGeoError] = useState<string | null>(null);
  const [lastLat, setLastLat] = useState<number | null>(null);
  const [lastLng, setLastLng] = useState<number | null>(null);
  const consecutiveErrorsRef = useRef(0);

  const getCurrentPosition = async (): Promise<{ latitude: number; longitude: number }> => {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !navigator.geolocation) {
        reject(new Error('Geolocation not supported by this browser/device.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLastLat(pos.coords.latitude);
          setLastLng(pos.coords.longitude);
          setGeoError(null);
          consecutiveErrorsRef.current = 0;
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        (err) => {
          reject(err);
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
      );
    });
  };

  useEffect(() => {
    if (!isOnline || !riderId) {
      consecutiveErrorsRef.current = 0;
      return;
    }

    let isSubscribed = true;
    let webWatcherId: number | null = null;
    let nativeStarted = false;
    let locationListener: ((data: LocationFix) => void) | null = null;

    const startWebTracking = () => {
      if (typeof window === 'undefined' || !navigator.geolocation) {
        const errorMsg = 'Geolocation not supported by this browser.';
        setGeoError(errorMsg);
        if (onLocationError) onLocationError(errorMsg);
        return;
      }

      webWatcherId = navigator.geolocation.watchPosition(
        (position) => {
          if (!isSubscribed) return;
          const { latitude, longitude } = position.coords;
          setLastLat(latitude);
          setLastLng(longitude);
          setGeoError(null);
          consecutiveErrorsRef.current = 0;
          updateLocation(sessionToken || '', riderId, latitude, longitude);
        },
        (err) => {
          if (!isSubscribed) return;
          console.warn('Web geolocation watch error:', err);
          consecutiveErrorsRef.current += 1;
          if (consecutiveErrorsRef.current >= 3) {
            const errorMsg = err.message || 'Location access denied. Enable GPS to go online.';
            setGeoError(errorMsg);
            if (onLocationError) onLocationError(errorMsg);
          }
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || !isSubscribed) return;
      if (webWatcherId !== null) {
        navigator.geolocation.clearWatch(webWatcherId);
        webWatcherId = null;
      }
      startWebTracking();
    };

    const startTracking = async () => {
      const isNative = typeof window !== 'undefined' &&
        !!(window as WindowWithCapacitor).Capacitor?.isNativePlatform();

      if (isNative) {
        try {
          // The native foreground service uploads each fix to the backend itself,
          // so this listener only mirrors the fix into state for the UI — it does
          // NOT call updateLocation. Service-level errors are logged natively and
          // do not surface here (listener fires on success only).
          locationListener = (data: LocationFix) => {
            if (!isSubscribed) return;
            setLastLat(data.lat);
            setLastLng(data.lng);
            setGeoError(null);
            consecutiveErrorsRef.current = 0;
          };
          await LocationSync.addListener('locationUpdate', locationListener);
          await LocationSync.startTracking({
            url: window.location.origin + '/api/rider/location',
            token: sessionToken || '',
            intervalMillis: 8000,
            distanceFilterMeters: 10,
          });
          nativeStarted = true;
        } catch (err) {
          console.error('Native location sync failed to start:', err);
          // Clean up the listener if startTracking threw after it was registered.
          if (locationListener) {
            LocationSync.removeListener('locationUpdate', locationListener).catch(() => {});
            locationListener = null;
          }
          if (isSubscribed) {
            console.warn('Falling back to web geolocation');
            startWebTracking();
          }
        }
      } else {
        startWebTracking();
      }
    };

    startTracking();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      isSubscribed = false;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (locationListener) {
        LocationSync.removeListener('locationUpdate', locationListener).catch((err) => {
          console.warn('Failed to remove native location listener:', err);
        });
        locationListener = null;
      }
      if (nativeStarted) {
        LocationSync.stopTracking().catch((err) => {
          console.warn('Failed to stop native tracking:', err);
        });
      }
      if (webWatcherId !== null && typeof window !== 'undefined') {
        navigator.geolocation.clearWatch(webWatcherId);
      }
    };
  }, [isOnline, riderId, onLocationError, sessionToken]);

  return {
    geoError,
    setGeoError,
    lastLat,
    lastLng,
    getCurrentPosition,
  };
}
