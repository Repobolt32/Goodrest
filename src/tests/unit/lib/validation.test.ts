import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isValidUUID, getRestoCoordinates } from '@/lib/validation';

describe('isValidUUID', () => {
  it('should return true for valid UUID v4', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('should return true for valid UUID with uppercase', () => {
    expect(isValidUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
  });

  it('should return true for valid UUID with mixed case', () => {
    expect(isValidUUID('550E8400-e29b-41D4-A716-446655440000')).toBe(true);
  });

  it('should return false for empty string', () => {
    expect(isValidUUID('')).toBe(false);
  });

  it('should return false for non-UUID string', () => {
    expect(isValidUUID('not-a-uuid')).toBe(false);
  });

  it('should return false for partial UUID', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false);
  });

  it('should return false for invalid characters', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-44665544000g')).toBe(false);
  });

  it('should return false for UUID with extra segment', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000-extra')).toBe(false);
  });

  it('should return false for UUID with wrong hex digit count', () => {
    expect(isValidUUID('550e840-e29b-41d4-a716-446655440000')).toBe(false);
  });

  it('should return false for plain number string', () => {
    expect(isValidUUID('12345678')).toBe(false);
  });
});

describe('getRestoCoordinates', () => {
  let originalLat: string | undefined;
  let originalLng: string | undefined;

  beforeEach(() => {
    originalLat = process.env.NEXT_PUBLIC_RESTO_LAT;
    originalLng = process.env.NEXT_PUBLIC_RESTO_LNG;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_RESTO_LAT = originalLat;
    process.env.NEXT_PUBLIC_RESTO_LNG = originalLng;
  });

  it('should return coordinates from env vars', () => {
    process.env.NEXT_PUBLIC_RESTO_LAT = '24.79';
    process.env.NEXT_PUBLIC_RESTO_LNG = '85.01';
    const result = getRestoCoordinates();
    expect(result.lat).toBe(24.79);
    expect(result.lng).toBe(85.01);
  });

  it('should return negative coordinates', () => {
    process.env.NEXT_PUBLIC_RESTO_LAT = '-33.86';
    process.env.NEXT_PUBLIC_RESTO_LNG = '151.20';
    const result = getRestoCoordinates();
    expect(result.lat).toBe(-33.86);
    expect(result.lng).toBe(151.20);
  });

  it('should throw when LAT is missing', () => {
    delete process.env.NEXT_PUBLIC_RESTO_LAT;
    process.env.NEXT_PUBLIC_RESTO_LNG = '85.01';
    expect(() => getRestoCoordinates()).toThrow('CRITICAL: Restaurant coordinates');
  });

  it('should throw when LNG is missing', () => {
    process.env.NEXT_PUBLIC_RESTO_LAT = '24.79';
    delete process.env.NEXT_PUBLIC_RESTO_LNG;
    expect(() => getRestoCoordinates()).toThrow('CRITICAL: Restaurant coordinates');
  });

  it('should throw when both are missing', () => {
    delete process.env.NEXT_PUBLIC_RESTO_LAT;
    delete process.env.NEXT_PUBLIC_RESTO_LNG;
    expect(() => getRestoCoordinates()).toThrow('CRITICAL: Restaurant coordinates');
  });

  it('should throw when LAT is not a valid number', () => {
    process.env.NEXT_PUBLIC_RESTO_LAT = 'abc';
    process.env.NEXT_PUBLIC_RESTO_LNG = '85.01';
    expect(() => getRestoCoordinates()).toThrow('not valid numbers');
  });

  it('should throw when LNG is not a valid number', () => {
    process.env.NEXT_PUBLIC_RESTO_LAT = '24.79';
    process.env.NEXT_PUBLIC_RESTO_LNG = 'xyz';
    expect(() => getRestoCoordinates()).toThrow('not valid numbers');
  });
});
