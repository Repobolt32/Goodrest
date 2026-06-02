import * as util from 'node:util';
import '@testing-library/jest-dom';
import dotenv from 'dotenv';
dotenv.config();

// Polyfill for TextEncoder/TextDecoder (required by some tools in Node environment)
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder: TE, TextDecoder: TD } = util as unknown as {
    TextEncoder: typeof global.TextEncoder;
    TextDecoder: typeof global.TextDecoder;
  };
  global.TextEncoder = TE;
  global.TextDecoder = TD;
}

// Mock localStorage for useCart hook tests
const localStorageMock = (function () {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Storage mocks are now handled by individual test setups or global vitest mocks.
