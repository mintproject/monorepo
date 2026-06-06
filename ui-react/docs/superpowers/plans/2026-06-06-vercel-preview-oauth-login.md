# Tapis OAuth Login from Vercel Previews — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any Vercel preview deployment complete Tapis OAuth2 login using one fixed registered callback, by carrying the originating origin in `state` and forwarding back to it through a regex-validated allowlist.

**Architecture:** All deployments send Tapis the same fixed `redirect_uri` (the production origin), so Tapis's exact-match check passes. The `state` parameter encodes `{nonce, origin}`. The fixed-origin callback page decodes `state`, validates `origin` against an anchored regex allowlist, and redirects the browser back to that origin's callback with the token/code intact. The preview-origin callback then validates the nonce (CSRF) and stores the token.

**Tech Stack:** TypeScript, React, Vite, Vitest + jsdom + @testing-library. Spec: `ui-react/docs/superpowers/specs/2026-06-06-vercel-preview-oauth-login-design.md`.

**Repo / branch:** monorepo `mint`, branch `feat/vercel-preview-oauth`, worktree `.claude/worktrees/feat-vercel-preview-oauth`. All `ui-react/...` paths below are relative to that worktree. Run all commands from the `ui-react/` directory.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `ui-react/src/lib/auth/oauth-state.ts` | encode/decode the `state` param (`{nonce, origin}`) | Create |
| `ui-react/src/lib/auth/origin-allowlist.ts` | anchored regex allowlist for forward targets | Create |
| `ui-react/src/lib/auth/oauth2-adapter.ts` | callback URL, state encoding, fragment-state read, forwarder, CSRF | Modify |
| `ui-react/vite-env.d.ts` | add optional `AUTH_CALLBACK_ORIGIN`, `AUTH_PREVIEW_ORIGIN_ALLOWLIST` to `MintConfig` | Modify |
| `ui-react/src/pages/OAuth2CallbackPage.tsx` | call forwarder before normal callback handling | Modify |
| `ui-react/src/__tests__/oauth-state.test.ts` | tests for codec | Create |
| `ui-react/src/__tests__/origin-allowlist.test.ts` | tests for allowlist (security-critical) | Create |
| `ui-react/src/__tests__/oauth2-adapter.test.ts` | extend with new adapter behavior | Modify |
| (ops) Tapis client + Vercel env | one fixed-callback client, Vercel env vars | Manual |

---

## Task 0: Baseline

**Files:** none

- [ ] **Step 1: Install dependencies**

Run (from `ui-react/`): `npm install`
Expected: completes without errors.

- [ ] **Step 2: Run the existing test suite to confirm a clean baseline**

Run: `npm test`
Expected: all tests PASS (note the count). If any fail before changes, stop and report.

---

## Task 1: State codec (`oauth-state.ts`)

**Files:**
- Create: `ui-react/src/lib/auth/oauth-state.ts`
- Test: `ui-react/src/__tests__/oauth-state.test.ts`

- [ ] **Step 1: Write the failing test**

Create `ui-react/src/__tests__/oauth-state.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- oauth-state`
Expected: FAIL — `Cannot find module '@/lib/auth/oauth-state'`.

- [ ] **Step 3: Write minimal implementation**

Create `ui-react/src/lib/auth/oauth-state.ts`:

```ts
/**
 * Codec for the OAuth2 `state` parameter.
 *
 * We pack two values into `state`:
 *   - nonce:  CSRF token, also mirrored in sessionStorage on the initiating origin.
 *   - origin: window.location.origin of the deployment that started login, so the
 *             fixed-origin callback can forward the result back to it.
 *
 * Encoded as URL-safe base64 of a JSON object.
 */

export interface OAuthState {
  nonce: string;
  origin: string;
}

const MAX_STATE_LENGTH = 2048;

function toBase64Url(input: string): string {
  // btoa operates on Latin1; nonce and origin are ASCII, so this is safe.
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(input: string): string {
  return atob(input.replace(/-/g, '+').replace(/_/g, '/'));
}

export function encodeState(payload: OAuthState): string {
  return toBase64Url(JSON.stringify(payload));
}

export function decodeState(raw: string | null | undefined): OAuthState | null {
  if (!raw || raw.length > MAX_STATE_LENGTH) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(raw)) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as OAuthState).nonce === 'string' &&
      typeof (parsed as OAuthState).origin === 'string'
    ) {
      const { nonce, origin } = parsed as OAuthState;
      return { nonce, origin };
    }
    return null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- oauth-state`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add ui-react/src/lib/auth/oauth-state.ts ui-react/src/__tests__/oauth-state.test.ts
git commit -m "feat(auth): add OAuth state codec carrying nonce and origin"
```

---

## Task 2: Origin allowlist (`origin-allowlist.ts`) — security-critical

**Files:**
- Create: `ui-react/src/lib/auth/origin-allowlist.ts`
- Test: `ui-react/src/__tests__/origin-allowlist.test.ts`

- [ ] **Step 1: Write the failing test**

Create `ui-react/src/__tests__/origin-allowlist.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- origin-allowlist`
Expected: FAIL — `Cannot find module '@/lib/auth/origin-allowlist'`.

- [ ] **Step 3: Write minimal implementation**

Create `ui-react/src/lib/auth/origin-allowlist.ts`:

```ts
/**
 * Anti–open-redirect allowlist for OAuth2 callback forwarding.
 *
 * The fixed-origin callback page forwards the login result back to the
 * deployment that started the flow (carried in `state.origin`). That origin
 * MUST be validated here before we hand it the access token.
 */

/** Default: Vercel preview deployments of the `monorepo` project. */
export const DEFAULT_PREVIEW_ORIGIN_PATTERN =
  '^https://monorepo-git-[a-z0-9-]+-mosoriobs-projects\\.vercel\\.app$';

const LOCALHOST_PATTERN = /^http:\/\/localhost(:\d+)?$/;
const MAX_ORIGIN_LENGTH = 269; // hostname cap (253) + scheme/port slack

export interface AllowlistOptions {
  /** The single registered fixed origin (always allowed). */
  fixedOrigin?: string;
  /** Regex source string overriding DEFAULT_PREVIEW_ORIGIN_PATTERN. */
  patternSource?: string;
}

export function isAllowedOrigin(origin: string, opts: AllowlistOptions = {}): boolean {
  if (typeof origin !== 'string' || origin.length === 0 || origin.length > MAX_ORIGIN_LENGTH) {
    return false;
  }

  // Must be a well-formed absolute origin — no path, query, fragment, or userinfo.
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.origin !== origin) return false;

  if (LOCALHOST_PATTERN.test(origin)) return true;
  if (opts.fixedOrigin && origin === opts.fixedOrigin) return true;

  const source = opts.patternSource ?? DEFAULT_PREVIEW_ORIGIN_PATTERN;
  let re: RegExp;
  try {
    re = new RegExp(source);
  } catch {
    return false;
  }
  return re.test(origin);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- origin-allowlist`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add ui-react/src/lib/auth/origin-allowlist.ts ui-react/src/__tests__/origin-allowlist.test.ts
git commit -m "feat(auth): add anchored origin allowlist for callback forwarding"
```

---

## Task 3: Config type + fixed callback origin + state encoding

**Files:**
- Modify: `ui-react/vite-env.d.ts`
- Modify: `ui-react/src/lib/auth/oauth2-adapter.ts` (`getConfig`, `getCallbackUrl`, `buildAuthorizationUrl`)
- Test: `ui-react/src/__tests__/oauth2-adapter.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `ui-react/src/__tests__/oauth2-adapter.test.ts` (inside the file, after existing imports add `decodeState`, and add a new `describe` block):

At the top, extend the import from the adapter test's existing adapter import list to also import the codec:

```ts
import { decodeState } from '@/lib/auth/oauth-state';
```

Add this block at the end of the file:

```ts
describe('preview-aware authorization URL', () => {
  it('uses window.location.origin for redirect_uri when AUTH_CALLBACK_ORIGIN is unset', () => {
    setMintConfig({ AUTH_PROVIDER: 'tapis' });
    const url = new URL(buildAuthorizationUrl());
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost/oauth2/callback');
  });

  it('uses AUTH_CALLBACK_ORIGIN for redirect_uri when set', () => {
    setMintConfig({
      AUTH_PROVIDER: 'tapis',
      AUTH_CALLBACK_ORIGIN: 'https://monorepo-mosoriobs-projects.vercel.app',
    });
    const url = new URL(buildAuthorizationUrl());
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://monorepo-mosoriobs-projects.vercel.app/oauth2/callback',
    );
  });

  it('encodes {nonce, origin} in state and mirrors the nonce in sessionStorage', () => {
    setMintConfig({ AUTH_PROVIDER: 'tapis' });
    const url = new URL(buildAuthorizationUrl());
    const decoded = decodeState(url.searchParams.get('state'));
    expect(decoded).not.toBeNull();
    expect(decoded!.origin).toBe('http://localhost');
    expect(decoded!.nonce).toBe(sessionStorage.getItem('oauth2_state'));
  });
});
```

> Note: the test stubs `window.location.origin` as `http://localhost` in the existing `beforeEach`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- oauth2-adapter`
Expected: FAIL — `redirect_uri` still `http://localhost/oauth2/callback` ignoring `AUTH_CALLBACK_ORIGIN`, and `state` is a bare nonce so `decodeState` returns null. (Also a TS error on `AUTH_CALLBACK_ORIGIN` not existing on `MintConfig` until Step 3.)

- [ ] **Step 3a: Extend the config type**

In `ui-react/vite-env.d.ts`, replace the `MintConfig` interface with:

```ts
interface MintConfig {
  HASURA_ENDPOINT: string;
  AUTH_SERVER: string;
  AUTH_CLIENT_ID: string;
  AUTH_REALM: string;
  AUTH_PROVIDER: 'keycloak' | 'tapis';
  GOOGLE_MAPS_KEY?: string;
  WELCOME_MESSAGE?: string;
  /** Fixed origin to register as the single Tapis callback_url (Vercel prod). */
  AUTH_CALLBACK_ORIGIN?: string;
  /** Regex source overriding the default preview-origin allowlist. */
  AUTH_PREVIEW_ORIGIN_ALLOWLIST?: string;
}
```

- [ ] **Step 3b: Update the adapter**

In `ui-react/src/lib/auth/oauth2-adapter.ts`:

Add to the imports at the top (after the `token-store` import):

```ts
import { encodeState } from './oauth-state';
```

Replace `getConfig()` (lines ~17-26) with:

```ts
function getConfig() {
  return (
    window.__MINT_CONFIG__ ?? {
      AUTH_SERVER: import.meta.env.VITE_AUTH_SERVER ?? 'https://portals.tapis.io',
      AUTH_CLIENT_ID: import.meta.env.VITE_AUTH_CLIENT_ID ?? 'mint-local',
      AUTH_REALM: import.meta.env.VITE_AUTH_REALM ?? '',
      AUTH_PROVIDER: (import.meta.env.VITE_AUTH_PROVIDER ?? 'tapis') as 'keycloak' | 'tapis',
      AUTH_CALLBACK_ORIGIN: import.meta.env.VITE_AUTH_CALLBACK_ORIGIN as string | undefined,
      AUTH_PREVIEW_ORIGIN_ALLOWLIST: import.meta.env.VITE_AUTH_PREVIEW_ORIGIN_ALLOWLIST as
        | string
        | undefined,
    }
  );
}
```

Replace `getCallbackUrl()` (lines ~28-30) with:

```ts
function getCallbackUrl(): string {
  const { AUTH_CALLBACK_ORIGIN } = getConfig();
  const base = AUTH_CALLBACK_ORIGIN ?? window.location.origin;
  return `${base}/oauth2/callback`;
}
```

Replace the body of `buildAuthorizationUrl()` (lines ~92-107) with:

```ts
export function buildAuthorizationUrl(grantType?: GrantType): string {
  const { AUTH_CLIENT_ID } = getConfig();
  const type = grantType ?? resolveGrantType();
  const nonce = generateState();
  sessionStorage.setItem('oauth2_state', nonce);
  const state = encodeState({ nonce, origin: window.location.origin });

  const params = new URLSearchParams({
    client_id: AUTH_CLIENT_ID,
    response_type: type,
    redirect_uri: getCallbackUrl(),
    scope: 'openid profile email',
    state,
  });

  return `${getAuthorizationEndpoint()}?${params.toString()}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- oauth2-adapter`
Expected: PASS, including the three new tests. Existing adapter tests still pass.

- [ ] **Step 5: Commit**

```bash
git add ui-react/vite-env.d.ts ui-react/src/lib/auth/oauth2-adapter.ts ui-react/src/__tests__/oauth2-adapter.test.ts
git commit -m "feat(auth): send fixed callback origin and encode origin in state"
```

---

## Task 4: Read state from fragment + nonce-based CSRF check

**Files:**
- Modify: `ui-react/src/lib/auth/oauth2-adapter.ts` (add `getReturnedRawState`, update `handleCallback`)
- Test: `ui-react/src/__tests__/oauth2-adapter.test.ts`

- [ ] **Step 1: Write the failing test**

Add this block at the end of `ui-react/src/__tests__/oauth2-adapter.test.ts`:

```ts
import { encodeState } from '@/lib/auth/oauth-state';

describe('handleCallback CSRF via encoded state', () => {
  it('reads implicit token + state from the fragment and stores the token', async () => {
    setMintConfig({ AUTH_PROVIDER: 'tapis' });
    sessionStorage.setItem('oauth2_state', 'nonce-1');
    const state = encodeState({ nonce: 'nonce-1', origin: 'http://localhost' });
    window.location.hash = `#access_token=tok-abc&expires_in=3600&state=${state}`;

    const result = await handleCallback();
    expect(result.type).toBe('token');
    expect(getAccessToken()).toBe('tok-abc');
  });

  it('rejects a forged nonce in the fragment state', async () => {
    setMintConfig({ AUTH_PROVIDER: 'tapis' });
    sessionStorage.setItem('oauth2_state', 'nonce-1');
    const state = encodeState({ nonce: 'WRONG', origin: 'http://localhost' });
    window.location.hash = `#access_token=tok-abc&state=${state}`;

    const result = await handleCallback();
    expect(result.type).toBe('error');
    expect(result.error).toMatch(/CSRF/i);
  });
});
```

> `getAccessToken` is already imported in this test file. If your editor flags a duplicate `encodeState` import, keep a single import at the top instead of repeating it here.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- oauth2-adapter`
Expected: FAIL — `handleCallback` reads `state` from query only, so the fragment nonce is never compared (forged-nonce test does not error) and/or token-from-fragment path differs.

- [ ] **Step 3: Write minimal implementation**

In `ui-react/src/lib/auth/oauth2-adapter.ts`:

Add to the import from `./oauth-state` so it reads:

```ts
import { encodeState, decodeState } from './oauth-state';
```

Add this helper just above `handleCallback` (before the `export async function handleCallback`):

```ts
/** Reads the raw `state` value from the URL fragment (implicit) or query (code). */
function getReturnedRawState(): string | null {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const fromHash = hashParams.get('state');
  if (fromHash) return fromHash;
  return new URLSearchParams(window.location.search).get('state');
}
```

Replace the CSRF block inside `handleCallback()` (the lines from `// Validate state to prevent CSRF` through `sessionStorage.removeItem('oauth2_state');`) with:

```ts
  // Validate the state nonce to prevent CSRF.
  const decoded = decodeState(getReturnedRawState());
  const storedNonce = sessionStorage.getItem('oauth2_state');
  if (decoded && storedNonce && decoded.nonce !== storedNonce) {
    return { type: 'error', error: 'State mismatch — possible CSRF attack' };
  }
  sessionStorage.removeItem('oauth2_state');
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- oauth2-adapter`
Expected: PASS, including the two new tests.

- [ ] **Step 5: Commit**

```bash
git add ui-react/src/lib/auth/oauth2-adapter.ts ui-react/src/__tests__/oauth2-adapter.test.ts
git commit -m "fix(auth): validate CSRF nonce from fragment-encoded state"
```

---

## Task 5: Forwarder (`maybeForwardToOrigin`)

**Files:**
- Modify: `ui-react/src/lib/auth/oauth2-adapter.ts` (add `ForwardResult` + `maybeForwardToOrigin`)
- Test: `ui-react/src/__tests__/oauth2-adapter.test.ts`

- [ ] **Step 1: Write the failing test**

Add this block at the end of `ui-react/src/__tests__/oauth2-adapter.test.ts`:

```ts
import { maybeForwardToOrigin } from '@/lib/auth/oauth2-adapter';

describe('maybeForwardToOrigin', () => {
  const PREVIEW = 'https://monorepo-git-feat-modeling-datasets-mosoriobs-projects.vercel.app';

  it('does not forward when state.origin equals the current origin', () => {
    setMintConfig({ AUTH_PROVIDER: 'tapis' });
    const state = encodeState({ nonce: 'n', origin: 'http://localhost' });
    window.location.hash = `#access_token=tok&state=${state}`;
    const result = maybeForwardToOrigin();
    expect(result.forwarded).toBe(false);
  });

  it('forwards to an allowed preview origin, preserving the fragment', () => {
    setMintConfig({ AUTH_PROVIDER: 'tapis' });
    const state = encodeState({ nonce: 'n', origin: PREVIEW });
    window.location.hash = `#access_token=tok&state=${state}`;
    const result = maybeForwardToOrigin();
    expect(result.forwarded).toBe(true);
    expect(result.error).toBeUndefined();
    expect(window.location.href).toBe(`${PREVIEW}/oauth2/callback#access_token=tok&state=${state}`);
  });

  it('refuses to forward to a disallowed origin', () => {
    setMintConfig({ AUTH_PROVIDER: 'tapis' });
    const evil = 'https://evil.example.com';
    const state = encodeState({ nonce: 'n', origin: evil });
    window.location.hash = `#access_token=tok&state=${state}`;
    const before = window.location.href;
    const result = maybeForwardToOrigin();
    expect(result.forwarded).toBe(true);
    expect(result.error).toMatch(/disallowed/i);
    expect(window.location.href).toBe(before); // no redirect issued
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- oauth2-adapter`
Expected: FAIL — `maybeForwardToOrigin` is not exported.

- [ ] **Step 3: Write minimal implementation**

In `ui-react/src/lib/auth/oauth2-adapter.ts`:

Add to the imports at the top:

```ts
import { isAllowedOrigin } from './origin-allowlist';
```

Add immediately after the `getReturnedRawState` helper (and before `handleCallback`):

```ts
export interface ForwardResult {
  forwarded: boolean;
  error?: string;
}

/**
 * When login lands on the fixed callback origin but was initiated from a
 * different (preview) origin, forward the result back there — gated by the
 * allowlist. Returns { forwarded:true } when a redirect was issued OR refused;
 * { forwarded:false } when this origin should handle the callback itself.
 */
export function maybeForwardToOrigin(): ForwardResult {
  const decoded = decodeState(getReturnedRawState());
  if (!decoded || decoded.origin === window.location.origin) {
    return { forwarded: false };
  }

  const { AUTH_CALLBACK_ORIGIN, AUTH_PREVIEW_ORIGIN_ALLOWLIST } = getConfig();
  const allowed = isAllowedOrigin(decoded.origin, {
    fixedOrigin: AUTH_CALLBACK_ORIGIN,
    patternSource: AUTH_PREVIEW_ORIGIN_ALLOWLIST,
  });
  if (!allowed) {
    return {
      forwarded: true,
      error: `Refusing to forward authentication to a disallowed origin: ${decoded.origin}`,
    };
  }

  window.location.href = `${decoded.origin}/oauth2/callback${window.location.search}${window.location.hash}`;
  return { forwarded: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- oauth2-adapter`
Expected: PASS, including the three new tests.

- [ ] **Step 5: Commit**

```bash
git add ui-react/src/lib/auth/oauth2-adapter.ts ui-react/src/__tests__/oauth2-adapter.test.ts
git commit -m "feat(auth): forward callback to originating preview origin via allowlist"
```

---

## Task 6: Wire the forwarder into the callback page

**Files:**
- Modify: `ui-react/src/pages/OAuth2CallbackPage.tsx`
- Test: `ui-react/src/__tests__/OAuth2CallbackPage.test.tsx` (extend)

- [ ] **Step 1: Write the failing test**

Add this block to `ui-react/src/__tests__/OAuth2CallbackPage.test.tsx`. It mocks the adapter so we can assert the page consults the forwarder first. Match the existing file's render/import style; if the file already mocks `@/lib/auth/oauth2-adapter`, extend that mock to include `maybeForwardToOrigin` instead of re-declaring it.

```tsx
// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OAuth2CallbackPage } from '@/pages/OAuth2CallbackPage';
import * as adapter from '@/lib/auth/oauth2-adapter';

describe('OAuth2CallbackPage forwarding', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('stops and does not call handleCallback when forwarding', async () => {
    vi.spyOn(adapter, 'maybeForwardToOrigin').mockReturnValue({ forwarded: true });
    const handle = vi.spyOn(adapter, 'handleCallback');

    render(
      <MemoryRouter>
        <OAuth2CallbackPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(adapter.maybeForwardToOrigin).toHaveBeenCalled());
    expect(handle).not.toHaveBeenCalled();
  });

  it('shows an error when forwarding is refused', async () => {
    vi.spyOn(adapter, 'maybeForwardToOrigin').mockReturnValue({
      forwarded: true,
      error: 'Refusing to forward authentication to a disallowed origin: https://evil.example.com',
    });

    render(
      <MemoryRouter>
        <OAuth2CallbackPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText(/disallowed origin/i)).toBeInTheDocument());
  });

  it('runs handleCallback when not forwarding', async () => {
    vi.spyOn(adapter, 'maybeForwardToOrigin').mockReturnValue({ forwarded: false });
    const handle = vi
      .spyOn(adapter, 'handleCallback')
      .mockResolvedValue({ type: 'token' });

    render(
      <MemoryRouter>
        <OAuth2CallbackPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(handle).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- OAuth2CallbackPage`
Expected: FAIL — page never calls `maybeForwardToOrigin`.

- [ ] **Step 3: Write minimal implementation**

In `ui-react/src/pages/OAuth2CallbackPage.tsx`:

Update the adapter import (line 4) to:

```tsx
import { handleCallback, maybeForwardToOrigin } from '../lib/auth/oauth2-adapter';
```

Replace the body of the `useEffect` (lines 21-41) with:

```tsx
  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const forward = maybeForwardToOrigin();
    if (forward.forwarded) {
      if (forward.error) {
        setStatus('error');
        setErrorMessage(forward.error);
      }
      // Otherwise the browser is redirecting to the originating origin; keep the spinner.
      return;
    }

    handleCallback()
      .then((result) => {
        if (result.type === 'error') {
          setStatus('error');
          setErrorMessage(result.error ?? 'Authentication failed');
          return;
        }
        setStatus('success');
        // Give React a moment to flush state before navigating
        setTimeout(() => navigate('/'), 100);
      })
      .catch((err: unknown) => {
        setStatus('error');
        const message = err instanceof Error ? err.message : 'Unknown error during authentication';
        setErrorMessage(message);
      });
  }, [navigate]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- OAuth2CallbackPage`
Expected: PASS. Then run the full suite: `npm test` — all green.

- [ ] **Step 5: Typecheck + lint + build**

Run: `npm run build`
Expected: `tsc -b` and `vite build` succeed (no type errors).
Run: `npm run lint`
Expected: no new lint errors in changed files.

- [ ] **Step 6: Commit**

```bash
git add ui-react/src/pages/OAuth2CallbackPage.tsx ui-react/src/__tests__/OAuth2CallbackPage.test.tsx
git commit -m "feat(auth): forward preview logins from the callback page"
```

---

## Task 7: Provision the fixed Tapis client + Vercel env (ops)

> External actions. `FIXED_ORIGIN = https://monorepo-mosoriobs-projects.vercel.app` (confirmed). The Tapis `callback_url` must match it character-for-character.
>
> **Status:** the Tapis client is already registered (Steps 1–3 done). The
> `VITE_*` env-var approach in the original Steps 4–5 was **superseded** —
> see the note below and the spec's "Config-delivery correction". Only the
> "Configure Vercel env" + redeploy steps remain.

**Files:** none (uses `tacc/ckan` `scripts/tapis-oauth/` and Vercel config)

- [x] **Step 1: Production origin confirmed** — `https://monorepo-mosoriobs-projects.vercel.app`.

- [x] **Step 2: Tapis client registered** — `mint-vercel`, `callback_url = https://monorepo-mosoriobs-projects.vercel.app/oauth2/callback` (created via `tacc/ckan` `scripts/tapis-oauth/create-client.sh`, owner `mosorio`, public client).

- [x] **Step 3: Registration verified** — `get-client.sh mint-vercel` returns the matching `callback_url`.

> **Why Steps 4–5 changed:** `public/env-config.js` ships to Vercel (Vite copies
> `public/` → `dist/`, loaded by `index.html`), so `window.__MINT_CONFIG__` is
> always present on Vercel and `getConfig()`'s `VITE_*` fallbacks never apply
> there. Delivery is therefore handled by `ui-react/scripts/generate-env-config.mjs`
> (runs after `vite build`; no-op unless `process.env.VERCEL`), which rewrites
> `dist/env-config.js` from the Vercel project env vars below.

- [ ] **Step 4: Configure Vercel env (Preview + Production scopes)**

In the `monorepo` Vercel project settings (Preview **and** Production), set:
- `AUTH_CLIENT_ID=mint-vercel`
- `AUTH_CALLBACK_ORIGIN=https://monorepo-mosoriobs-projects.vercel.app`
- (optional) `AUTH_PREVIEW_ORIGIN_ALLOWLIST` only if the default anchored pattern needs overriding.

(Unprefixed names; `VITE_`-prefixed equivalents also work as fallbacks. Other keys — HASURA, AUTH_SERVER, GOOGLE_MAPS_KEY — default to the committed values in `generate-env-config.mjs`; set them only to override.) Leave local dev (`.env.development`, `public/env-config.js`) untouched so it keeps using `mint-local`.

- [ ] **Step 5: Redeploy the preview branch** so the regenerated `env-config.js` takes effect.

---

## Task 8: Manual end-to-end verification

**Files:** none

- [ ] **Step 1:** Open `https://monorepo-git-feat-modeling-datasets-mosoriobs-projects.vercel.app/modeling/problem-statements` and start login.

- [ ] **Step 2:** Confirm the browser flow: preview → `portals.tapis.io` login → `FIXED_ORIGIN/oauth2/callback` → back to the preview `/oauth2/callback` → signed in (token stored on the preview origin).

- [ ] **Step 3:** Confirm a tampered/disallowed origin in `state` produces the "disallowed origin" error and **no** redirect (e.g. craft a `state` with `origin=https://evil.example.com` against `FIXED_ORIGIN/oauth2/callback`).

- [ ] **Step 4:** Confirm production login (on `FIXED_ORIGIN` itself) and local dev (`mint-local`) still work unchanged.

---

## Self-Review Notes

- **Spec coverage:** fixed callback origin (Task 3), state-carried origin (Task 3), regex allowlist (Task 2), fixed-origin forwarder (Task 5), preview completer + fragment CSRF (Task 4/6), one Tapis client (Task 7), tests incl. allowlist hostile cases (Task 2), manual e2e (Task 8). Implicit grant retained (no grant-type change).
- **Type consistency:** `OAuthState{nonce,origin}`, `AllowlistOptions{fixedOrigin,patternSource}`, `ForwardResult{forwarded,error}`, `isAllowedOrigin`, `maybeForwardToOrigin`, `encodeState`/`decodeState`, `getReturnedRawState` used consistently across tasks.
- **Residual risk (accepted, per spec):** implicit-grant token transits the fixed origin's fragment/history during the bounce; allowlist confines targets to owner-controlled hosts. Code-grant/PKCE hardening is out of scope.
