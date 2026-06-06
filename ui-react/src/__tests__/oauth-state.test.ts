// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { encodeState, decodeState } from '@/lib/auth/oauth-state';

describe('oauth-state codec', () => {
  it('round-trips nonce and origin', () => {
    const encoded = encodeState({ nonce: 'abc123', origin: 'https://example.com' });
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
    expect(decodeState(encoded)).toEqual({ nonce: 'abc123', origin: 'https://example.com' });
  });

  it('returns null for null/empty input', () => {
    expect(decodeState(null)).toBeNull();
    expect(decodeState('')).toBeNull();
  });

  it('returns null for non-base64 garbage', () => {
    expect(decodeState('!!!not base64!!!')).toBeNull();
  });

  it('returns null when decoded JSON lacks required fields', () => {
    const encoded = btoa(JSON.stringify({ foo: 'bar' }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(decodeState(encoded)).toBeNull();
  });

  it('returns null for oversized input', () => {
    expect(decodeState('a'.repeat(5000))).toBeNull();
  });
});
