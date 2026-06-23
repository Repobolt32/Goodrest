import { useEffect, useRef, useState } from 'react';
import { registerPlugin } from '@capacitor/core';
import { updateLocation } from '@/app/actions/riderActions';

interface WindowWithCapacitor extends Window {
  Capacitor?: {
    isNativePlatform(): boolean;
  };
}

interface GeolocationLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number;
  altitudeAccuracy: number;
  speed: number;
  bearing: number;
  simulated: boolean;
  time: number;
}

interface CallbackError {
  code: number;
  message: string;
}

interface BackgroundGeolocationPlugin {
  addWatcher(
    options: {
      backgroundTitle?: string;
      backgroundMessage?: string;
      requestPermissions?: boolean;
      stale?: boolean;
      distanceFilter?: number;
    },
    callback: (location: GeolocationLocation | null, error: CallbackError | null) => void
  ): Promise<string>;
  removeWatcher(options: { id: string }): Promise<void>;
}

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

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
    let nativeWatcherId: string | null = null;
    let webWatcherId: number | null = null;

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
          nativeWatcherId = await BackgroundGeolocation.addWatcher(
            {
              backgroundTitle: 'Goodrest Rider',
              backgroundMessage: 'Tracking your delivery location.',
              requestPermissions: true,
              stale: false,
              distanceFilter: 10,
            },
            (location, error) => {
              if (!isSubscribed) return;
              if (error) {
                console.warn('Native geolocation error:', error);
                consecutiveErrorsRef.current += 1;
                if (consecutiveErrorsRef.current >= 3) {
                  const errorMsg = error.message || 'Location access denied. Enable GPS to go online.';
                  setGeoError(errorMsg);
                  if (onLocationError) onLocationError(errorMsg);
                }
                return;
              }
              if (location) {
                setLastLat(location.latitude);
                setLastLng(location.longitude);
                setGeoError(null);
                consecutiveErrorsRef.current = 0;
                updateLocation(sessionToken || '', riderId, location.latitude, location.longitude);
              }
            }
          );
        } catch (err) {
          console.error('Native geolocation watcher failed:', err);
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
      if (nativeWatcherId) {
        BackgroundGeolocation.removeWatcher({ id: nativeWatcherId }).catch((err) => {
          console.warn('Failed to remove native watcher:', err);
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
