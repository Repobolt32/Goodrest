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

// Register the native plugin. Fallback to web if running on web platform.
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

  // Expose a helper to fetch the current position (useful when toggling online)
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

    const startTracking = async () => {
      const isNative = typeof window !== 'undefined' && 
        !!(window as WindowWithCapacitor).Capacitor?.isNativePlatform();

      if (isNative) {
        try {
          // Native background geolocation
          const watcherId = await BackgroundGeolocation.addWatcher(
            {
              backgroundTitle: 'Goodrest Rider',
              backgroundMessage: 'Tracking your delivery location.',
              requestPermissions: true,
              stale: false,
              distanceFilter: 10, // 10 meters
            },
            (location, error) => {
              if (!isSubscribed) return;

              if (error) {
                console.warn('Native geolocation error:', error);
                consecutiveErrorsRef.current += 1;
                if (consecutiveErrorsRef.current >= 3) {
                  const errorMsg = error.message || 'Location access denied. Enable GPS to go online.';
                  setGeoError(errorMsg);
                  if (onLocationError) {
                    onLocationError(errorMsg);
                  }
                }
                return;
              }

              if (location) {
                const { latitude, longitude } = location;
                setLastLat(latitude);
                setLastLng(longitude);
                setGeoError(null);
                consecutiveErrorsRef.current = 0;

                // Fire server action to update DB
                updateLocation(sessionToken || '', riderId, latitude, longitude);
              }
            }
          );

          if (isSubscribed) {
            nativeWatcherId = watcherId;
          } else {
            // Cleared while promise was resolving
            BackgroundGeolocation.removeWatcher({ id: watcherId }).catch((err) => {
              console.warn('Failed to remove native watcher on cleanup:', err);
            });
          }
        } catch (err) {
          console.error('Error starting native background geolocation watcher:', err);
          if (isSubscribed) {
            const errorMsg = 'Failed to initialize native tracking service.';
            setGeoError(errorMsg);
            if (onLocationError) {
              onLocationError(errorMsg);
            }
          }
        }
      } else {
        // Fallback to web browser Geolocation API
        if (typeof window === 'undefined' || !navigator.geolocation) {
          const errorMsg = 'Geolocation not supported by this browser.';
          setGeoError(errorMsg);
          if (onLocationError) {
            onLocationError(errorMsg);
          }
          return;
        }

        const watchId = navigator.geolocation.watchPosition(
          (position) => {
            if (!isSubscribed) return;
            const { latitude, longitude } = position.coords;
            setLastLat(latitude);
            setLastLng(longitude);
            setGeoError(null);
            consecutiveErrorsRef.current = 0;

            // Fire server action to update DB
            updateLocation(sessionToken || '', riderId, latitude, longitude);
          },
          (err) => {
            if (!isSubscribed) return;
            console.warn('Web geolocation watch error:', err);
            consecutiveErrorsRef.current += 1;
            if (consecutiveErrorsRef.current >= 3) {
              const errorMsg = err.message || 'Location access denied. Enable GPS to go online.';
              setGeoError(errorMsg);
              if (onLocationError) {
                onLocationError(errorMsg);
              }
            }
          },
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
        );

        webWatcherId = watchId;
      }
    };

    startTracking();

    return () => {
      isSubscribed = false;
      if (nativeWatcherId) {
        BackgroundGeolocation.removeWatcher({ id: nativeWatcherId }).catch((err) => {
          console.warn('Failed to remove native background location watcher:', err);
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
