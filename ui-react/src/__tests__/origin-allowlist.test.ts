// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { isAllowedOrigin, DEFAULT_PREVIEW_ORIGIN_PATTERN } from '@/lib/auth/origin-allowlist';

const PREVIEW = 'https://monorepo-git-feat-modeling-datasets-mosoriobs-projects.vercel.app';
const PROD = 'https://monorepo-mosoriobs-projects.vercel.app';

describe('isAllowedOrigin', () => {
  it('allows a valid preview origin', () => {
    expect(isAllowedOrigin(PREVIEW)).toBe(true);
  });

  it('allows another branch preview origin', () => {
    expect(isAllowedOrigin('https://monorepo-git-feat-x-mosoriobs-projects.vercel.app')).toBe(true);
  });

  it('allows the configured fixed origin', () => {
    expect(isAllowedOrigin(PROD, { fixedOrigin: PROD })).toBe(true);
  });

  it('allows localhost with a port', () => {
    expect(isAllowedOrigin('http://localhost:3000')).toBe(true);
  });

  it('rejects an unrelated https origin', () => {
    expect(isAllowedOrigin('https://evil.example.com')).toBe(false);
  });

  it('rejects a suffix-spoofing host', () => {
    expect(
      isAllowedOrigin('https://monorepo-git-x-mosoriobs-projects.vercel.app.evil.com'),
    ).toBe(false);
  });

  it('rejects a prefix-spoofing host', () => {
    expect(isAllowedOrigin('https://evil.monorepo-git-x-mosoriobs-projects.vercel.app')).toBe(false);
  });

  it('rejects http (non-localhost) preview', () => {
    expect(isAllowedOrigin('http://monorepo-git-x-mosoriobs-projects.vercel.app')).toBe(false);
  });

  it('rejects an origin that carries a path', () => {
    expect(isAllowedOrigin(`${PREVIEW}/oauth2/callback`)).toBe(false);
  });

  it('rejects empty and malformed input', () => {
    expect(isAllowedOrigin('')).toBe(false);
    expect(isAllowedOrigin('not-a-url')).toBe(false);
  });

  it('exposes an anchored default pattern', () => {
    expect(DEFAULT_PREVIEW_ORIGIN_PATTERN.startsWith('^')).toBe(true);
    expect(DEFAULT_PREVIEW_ORIGIN_PATTERN.endsWith('$')).toBe(true);
  });
});
