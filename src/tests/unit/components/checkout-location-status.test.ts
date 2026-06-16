import { describe, it, expect } from 'vitest';

type LocationStatusType = 'success' | 'warning' | 'error' | 'info' | 'loading';

interface LocationStatus {
  type: LocationStatusType;
  message: string;
}

function getLocationStatusColor(type: LocationStatusType): string {
  switch (type) {
    case 'success':
      return 'text-green-600';
    case 'warning':
    case 'error':
    case 'info':
    case 'loading':
      return 'text-amber-600';
  }
}

function parseLocationStatus(raw: string): LocationStatus {
  if (raw.startsWith('✅')) return { type: 'success', message: raw.replace(/^✅\s*/, '') };
  if (raw.startsWith('📍')) return { type: 'warning', message: raw.replace(/^📍\s*/, '') };
  if (raw.startsWith('❌')) return { type: 'error', message: raw.replace(/^❌\s*/, '') };
  if (raw.includes('Detecting')) return { type: 'loading', message: raw };
  return { type: 'info', message: raw };
}

describe('QOL-15: Location status color mapping', () => {
  it('maps success type to green', () => {
    expect(getLocationStatusColor('success')).toBe('text-green-600');
  });

  it('maps warning type to amber', () => {
    expect(getLocationStatusColor('warning')).toBe('text-amber-600');
  });

  it('maps error type to amber', () => {
    expect(getLocationStatusColor('error')).toBe('text-amber-600');
  });

  it('maps info type to amber', () => {
    expect(getLocationStatusColor('info')).toBe('text-amber-600');
  });

  it('maps loading type to amber', () => {
    expect(getLocationStatusColor('loading')).toBe('text-amber-600');
  });
});

describe('QOL-15: parseLocationStatus (backward-compatible migration)', () => {
  it('parses success emoji to success type', () => {
    const result = parseLocationStatus('✅ Location Verified');
    expect(result).toEqual({ type: 'success', message: 'Location Verified' });
  });

  it('parses warning emoji to warning type', () => {
    const result = parseLocationStatus('📍 Location detected');
    expect(result).toEqual({ type: 'warning', message: 'Location detected' });
  });

  it('parses error emoji to error type', () => {
    const result = parseLocationStatus('❌ Delivery not available');
    expect(result).toEqual({ type: 'error', message: 'Delivery not available' });
  });

  it('parses loading text to loading type', () => {
    const result = parseLocationStatus('Detecting...');
    expect(result).toEqual({ type: 'loading', message: 'Detecting...' });
  });

  it('parses plain text to info type', () => {
    const result = parseLocationStatus('Some status');
    expect(result).toEqual({ type: 'info', message: 'Some status' });
  });
});
