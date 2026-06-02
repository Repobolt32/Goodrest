'use server';

import { RouteData } from '@/lib/distance';

const getGoogleMapsApiKey = () => process.env.GOOGLE_MAPS_API_KEY;

interface GoogleRoute {
  distanceMeters?: number;
  duration?: string;
}

export async function getGoogleMapsRouteData(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<RouteData | null> {
  // Proximity coordinates check (BUG-18) — ~22 meters threshold in decimal degrees
  const latDiff = Math.abs(originLat - destLat);
  const lngDiff = Math.abs(originLng - destLng);
  if (latDiff < 0.0002 && lngDiff < 0.0002) {
    console.log('[getGoogleMapsRouteData] PROXIMITY OVERRIDE: Coordinates are virtually identical.');
    return { distanceKm: 0.01, durationSeconds: 60 };
  }

  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    console.warn('[getGoogleMapsRouteData] GOOGLE_MAPS_API_KEY not set');
    return null;
  }
  try {
    const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.routeLabels',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: originLat, longitude: originLng } } },
        destination: { location: { latLng: { latitude: destLat, longitude: destLng } } },
        travelMode: 'TWO_WHEELER',
        requestedReferenceRoutes: ['SHORTER_DISTANCE'],
      }),
      next: { revalidate: 0 },
    });
    const data = await res.json();
    const routes = data.routes as GoogleRoute[] | undefined;
    if (routes && Array.isArray(routes) && routes.length > 0) {
      const validRoutes = routes.filter(
        (r): r is GoogleRoute & { distanceMeters: number; duration: string } =>
          r.distanceMeters != null && r.duration != null
      );
      if (validRoutes.length > 0) {
        // Choose the route with the shortest physical distance
        const shortestRoute = validRoutes.reduce((prev, curr) =>
          curr.distanceMeters < prev.distanceMeters ? curr : prev
        );
        const distanceKm = shortestRoute.distanceMeters / 1000;
        // duration comes as "337s" — parse to seconds
        const durationSeconds = parseInt(shortestRoute.duration.replace('s', ''), 10) || 0;
        return { distanceKm, durationSeconds };
      }
    }
    return null;
  } catch (err) {
    console.error('[getGoogleMapsRouteData] API error:', err);
    return null;
  }
}
