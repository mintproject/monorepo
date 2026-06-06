import '@testing-library/jest-dom/vitest';

import { afterAll, afterEach, beforeAll } from 'vitest';

// ---------------------------------------------------------------------------
// ResizeObserver polyfill — jsdom does not implement ResizeObserver, but
// cmdk (used by the Command/combobox components) requires it. Provide a
// no-op stub so components can mount without crashing.
// ---------------------------------------------------------------------------
if (typeof ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// ---------------------------------------------------------------------------
// scrollIntoView polyfill — jsdom stubs this as a no-op but cmdk calls it
// on list items during keyboard navigation and the popover open lifecycle.
// ---------------------------------------------------------------------------
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {};
}

import { server } from './msw/server';

// ---------------------------------------------------------------------------
// Web Storage mock — jsdom does not provide localStorage/sessionStorage by
// default when running under Node.js. This lightweight mock covers all
// methods used by token-store.ts and the auth tests.
// ---------------------------------------------------------------------------

function createStorageMock(): Storage {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  } as Storage;
}

const localStorageMock = createStorageMock();
const sessionStorageMock = createStorageMock();

// Only install the mocks if the real APIs are missing (they're unavailable
// in the jsdom worker context when no URL is provided to jsdom).
if (typeof localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });
}

if (typeof sessionStorage === 'undefined') {
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: sessionStorageMock,
    writable: true,
  });
}

// Reset storage between tests to avoid cross-test pollution
afterEach(() => {
  localStorageMock.clear();
  sessionStorageMock.clear();
});

// ---------------------------------------------------------------------------
// MSW request interception
// ---------------------------------------------------------------------------

// Start MSW server before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' });
});

// Reset handlers after each test (avoids cross-test pollution)
afterEach(() => {
  server.resetHandlers();
});

// Stop server after all tests
afterAll(() => {
  server.close();
});
