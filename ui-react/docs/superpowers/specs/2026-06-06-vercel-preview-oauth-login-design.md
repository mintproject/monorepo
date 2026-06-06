# Design: Tapis OAuth2 login from Vercel preview deployments

Date: 2026-06-06
Status: Proposed (awaiting review)
Repo: `mint/ui-react` (implementation) + `tacc/ckan` scripts (Tapis client registration)

## Problem

The app logs in against TACC's Tapis OAuth2 service (`portals.tapis.io`) using a
public-client implicit flow. The callback is computed at runtime as
`` `${window.location.origin}/oauth2/callback` `` (`src/lib/auth/oauth2-adapter.ts`,
`getCallbackUrl()`), so each deployment sends its own origin as `redirect_uri`.

Vercel preview deployments have per-branch origins, e.g.
`https://monorepo-git-feat-modeling-datasets-mosoriobs-projects.vercel.app`.
Tapis rejects any `redirect_uri` that is not an exact match of the client's
registered `callback_url`, so login fails on every preview.

### Why we cannot "just add a regex to Tapis"

Verified against the Tapis authenticator source
(`tapis-project/authenticator`, `service/controllers.py:683`):

```python
if not client.callback_url == client_redirect_uri:
    raise errors.ResourceError(
        "redirect_uri query parameter does not match the registered callback_url for the client.")
```

`callback_url` is a single `db.String(200)` column (`service/models.py:289`),
compared with strict `==`. No regex, wildcard, prefix, or list support exists.

Empirically confirmed against the live `mint-local` client at the authorize endpoint:

| `redirect_uri`                                   | Tapis response          |
|--------------------------------------------------|-------------------------|
| `http://mint.local/oauth2/callback` (registered) | `302` → proceeds to login |
| Vercel preview URL                               | `400` → rejected         |
| Arbitrary URL                                    | `400` → rejected         |

**Conclusion:** the only place a regex can live is *our own* callback handler,
used as an anti–open-redirect allowlist. Tapis must always receive one fixed,
pre-registered `redirect_uri`.

## Goal

Any Vercel preview deployment (current and future branches) can complete Tapis
login with **one** Tapis client and **no per-branch registration**.

## Approach: fixed callback origin + state-carried origin + regex allowlist

Every deployment sends Tapis the **same fixed** `redirect_uri` (a stable,
always-deployed origin — the Vercel production URL). Tapis is satisfied (exact
match). The fixed-origin callback page then forwards the login result back to the
preview origin that initiated the flow, gated by a regex allowlist.

### Fixed origin

`https://monorepo-mosoriobs-projects.vercel.app` (Vercel production URL for
project `monorepo`, team `mosoriobs-projects`).

> ACTION REQUIRED before implementation: confirm the exact production origin in
> the Vercel dashboard (custom domain, if any, takes precedence). The Tapis
> `callback_url` must match it character-for-character.

### Components

1. **One Tapis client, one fixed callback.**
   Register (via `tacc/ckan` `scripts/tapis-oauth/create-client.sh`) a client,
   e.g. `mint-vercel`, with
   `callback_url = https://<FIXED_ORIGIN>/oauth2/callback`.
   All Vercel deployments (production *and* previews) set
   `VITE_AUTH_CLIENT_ID=mint-vercel`. Local dev keeps `mint-local` unchanged.

2. **`oauth2-adapter.ts` — authorization request.**
   - New config key `AUTH_CALLBACK_ORIGIN` (runtime `window.__MINT_CONFIG__`)
     / `VITE_AUTH_CALLBACK_ORIGIN` (build fallback).
   - `getCallbackUrl()` returns `` `${AUTH_CALLBACK_ORIGIN}/oauth2/callback` ``
     when the key is set; otherwise falls back to current behavior
     (`window.location.origin`) so local dev is unaffected.
   - `state` changes from a bare nonce to `base64url(JSON({ nonce, origin }))`,
     where `origin = window.location.origin` (the real initiating deployment).
     The `nonce` is still stored in `sessionStorage` (`oauth2_state`) for CSRF.

3. **Callback page at the fixed origin — forwarder.**
   On load, decode `state`. If `state.origin !== window.location.origin`:
   - Validate `state.origin` against the **regex allowlist** (below).
   - If valid: redirect the browser to
     `` `${state.origin}/oauth2/callback` `` re-attaching the credential
     (implicit: token in the URL *fragment*; code: `code` in the query) and the
     original `state`.
   - If invalid: render a hard error. **Never redirect to a non-allowlisted origin.**

4. **Callback page at the preview origin — completer.**
   Receives the forwarded credential, validates `state.nonce` against
   `sessionStorage` (CSRF — the nonce was set on this origin before the flow
   began and survives the cross-origin round trip because `sessionStorage` is
   per-origin and persists for the tab), then stores the token and finishes.
   This is the existing `handleCallback()` path, extended to read `state` from
   the fragment for implicit grant.

### Flow

```
preview → authorize(redirect_uri=FIXED, state={nonce, origin=preview})
Tapis (callback_url == FIXED ✓) → login → FIXED/oauth2/callback#access_token=…&state=…
FIXED page → regex-validate state.origin → redirect preview/oauth2/callback#access_token=…&state=…
preview page → validate nonce → store token → logged in
```

When the active deployment *is* the fixed origin (production), `state.origin`
equals `window.location.origin`, so no forward happens and the existing flow
runs unchanged.

## Regex allowlist (security-critical)

The allowlist is the **only** control preventing an attacker-supplied
`state.origin` from receiving the access token. Requirements:

- Anchored, full-origin match (`^…$`) — never a substring/`includes` check.
- `https`-only.
- Exact host shape for project-owned Vercel hosts:
  `^https://monorepo-git-[a-z0-9-]+-mosoriobs-projects\.vercel\.app$`
- Plus the fixed production origin itself, and `http://localhost:\d+` for dev.
- Configurable via `VITE_AUTH_PREVIEW_ORIGIN_ALLOWLIST` /
  `AUTH_PREVIEW_ORIGIN_ALLOWLIST` (regex source string), defaulting to the
  pattern above. Because all `*-mosoriobs-projects.vercel.app` hosts are
  deployable only by the project owner, the allowlist confines forwarding to
  owner-controlled origins.

### Residual risk (accepted)

Implicit grant returns the token in a URL fragment; the cross-origin bounce
means the token transits the fixed origin's fragment and browser history. This
matches the app's existing implicit-grant posture (token already appears in a
URL). Fragments are not sent in HTTP requests. Switching Tapis to authorization
code grant (forwarding a single-use `code` instead of a bearer token) is a
documented future hardening step, gated on confirming Tapis public-client code
grant / PKCE support.

## Grant type

Keep the current **implicit grant** (`response_type=token`) for Tapis. It
already works with the public client; switching to code grant for a secret-less
SPA introduces Tapis-support uncertainty (PKCE) and is out of scope here.

## Components changed / added

| Unit | Responsibility | Repo |
|---|---|---|
| `mint-vercel` Tapis client | one fixed `callback_url` for all Vercel deploys | `tacc/ckan` scripts |
| `getCallbackUrl()` / config | emit fixed callback origin when configured | `ui-react` |
| `buildAuthorizationUrl()` / `state` codec | encode `{nonce, origin}` in `state` | `ui-react` |
| origin allowlist module | anchored regex validation of `state.origin` | `ui-react` (new) |
| fixed-origin callback (forwarder) | validate + forward to preview origin | `ui-react` |
| preview callback (`handleCallback`) | read state from fragment; nonce check | `ui-react` |

## Testing

- **Unit — allowlist:** valid preview / production / localhost pass; `evil.com`,
  `http://…`, suffix tricks (`…vercel.app.evil.com`), prefix tricks, and empty
  origin all fail.
- **Unit — state codec:** round-trip encode/decode; malformed/oversized state
  rejected.
- **Unit — `getCallbackUrl()`:** returns fixed origin when configured, falls back
  to `window.location.origin` when not.
- **Manual e2e:** log in on the actual preview URL
  (`…feat-modeling-datasets…/modeling/problem-statements`) end to end.

## Out of scope

- Switching to authorization code grant / PKCE.
- Per-branch Tapis clients or custom per-branch domains (rejected alternatives).
- Any change to local dev (`mint-local`) flow.

## Open items to confirm before implementation

1. Exact production origin to register as `callback_url`.
2. Whether `handleImplicitCallback()` already reads `state` from the fragment;
   if not, add it (needed for the forwarder to recover `state.origin`).
