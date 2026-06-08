export interface RouteData {
  distanceKm: number;
  durationSeconds: number;
}

/**
 * Calculate total ETA using REAL Google Maps duration + prep time.
 * No synthetic speed formulas — only API data.
 */
export function calculateETA(durationSeconds: number, prepTimeMinutes = 20): number {
  const travelMinutes = durationSeconds / 60;
  return Math.ceil(prepTimeMinutes + travelMinutes + 5); // 5min buffer
}
