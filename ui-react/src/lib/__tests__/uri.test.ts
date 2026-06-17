import { describe, expect, it } from 'vitest';

import { extractUuidFromUri, slugFromUri, slugMatchPattern } from '@/lib/uri';

describe('slugFromUri', () => {
  it('returns the trailing path segment of a MINT URI', () => {
    expect(slugFromUri('https://w3id.org/okn/i/mint/abc-123')).toBe('abc-123');
  });

  it('works for non-mint URIs (different host/namespace)', () => {
    expect(slugFromUri('http://example.org/models/Groundwater_Level')).toBe('Groundwater_Level');
  });

  it('returns the input unchanged when there is no slash', () => {
    expect(slugFromUri('plain-token')).toBe('plain-token');
  });
});

describe('slugMatchPattern', () => {
  it('builds an anchored suffix ilike pattern', () => {
    expect(slugMatchPattern('abc-123')).toBe('%/abc-123');
  });
});

describe('extractUuidFromUri', () => {
  it('still strips the known MINT prefix', () => {
    expect(extractUuidFromUri('https://w3id.org/okn/i/mint/abc-123')).toBe('abc-123');
  });
});
