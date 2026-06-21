/**
 * Validates whether a string is a valid UUID v4 format.
 * 
 * @param id The string to validate
 * @returns True if valid UUID, false otherwise
 */
export function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Validates whether a string is a valid menu item ID (slug or UUID).
 * 
 * @param id The string to validate
 * @returns True if valid slug or UUID, false otherwise
 */
export function isValidMenuItemId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  return /^[a-zA-Z0-9-_]+$/.test(id);
}


/**
 * Returns the restaurant coordinates from environment variables.
 * Throws a descriptive error if variables are missing. (BUG-17)
 * 
 * @returns The restaurant latitude and longitude
 */
export function getRestoCoordinates(): { lat: number; lng: number } {
  const latStr = process.env.NEXT_PUBLIC_RESTO_LAT;
  const lngStr = process.env.NEXT_PUBLIC_RESTO_LNG;

  if (!latStr || !lngStr) {
    throw new Error(
      'CRITICAL: Restaurant coordinates (NEXT_PUBLIC_RESTO_LAT and NEXT_PUBLIC_RESTO_LNG) ' +
      'are missing from environment variables!'
    );
  }

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (isNaN(lat) || isNaN(lng)) {
    throw new Error('CRITICAL: Restaurant coordinates in environment variables are not valid numbers!');
  }

  return { lat, lng };
}
