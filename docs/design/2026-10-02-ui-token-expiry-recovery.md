# UI token expiry recovery

Status: Approved

## Objective

Prevent the deployed UI from continuing to send an expired Tapis access token
after automatic refresh is unavailable.

## User need

MINT develop must use the signed-in UI token for Hasura, Ensemble Manager, and
Tapis jobs. When that token expires, the UI should clear the session and prompt
for authentication instead of producing `Authentication hook unauthorized this
request`.

## Current code/system summary

The live GraphQL and auth-webhook pods are configured for the `portals` tenant
and accept a fresh UI token. The UI token scheduler invokes the refresh
callback, but it only clears tokens when the callback rejects. Tapis implicit
authentication can return no refresh token, so the callback returns `false`
and the expired token remains in local storage and application state.

## Proposed design

Treat a refresh result of `false` as an authentication failure. Clear all
persisted tokens and notify `AuthProvider`, causing the UI to leave the signed-in
state and require a new UI login. Preserve the existing refresh path when a
refresh succeeds and the existing rejection handling when it throws.

## Files likely affected

- `ui-react/src/lib/auth/token-store.ts`
- `ui-react/src/__tests__/token-store.test.ts`
- This design record

## API/schema changes

None.

## Data flow

Expired UI token → scheduled refresh callback → `false` result → `clearTokens()`
→ auth state becomes signed out → user obtains a fresh Tapis token.

## Risks and tradeoffs

Users without a usable refresh token will be signed out at expiry rather than
receiving repeated 401 responses. This is preferable to sending stale bearer
credentials and does not introduce a service-level token.

## Alternatives considered

- Add `SVO_ADAPTER_TAPIS_TOKEN`: rejected because it is a static service
  credential and violates the UI-token authentication model.
- Change the live auth-webhook pod: rejected because its effective tenant,
  issuer, and JWKS settings already match local and accept fresh tokens.
- Keep retrying an expired token: rejected because the auth hook correctly
  rejects it and no job can be authenticated.

## Test plan

- Add a focused token-store test proving a `false` refresh result clears the
  expired access and refresh tokens and notifies the token listener.
- Run the token-store test suite, UI typecheck, and `git diff --check`.
- After deployment, verify the live auth hook still accepts a fresh token and
  the UI no longer sends expired tokens.

## Documentation plan

No user-facing documentation change is required; the behavior is automatic.

## Rollout/rollback plan

Deploy the UI image through the existing develop workflow. Roll back by
reverting the UI change if the token-store test or authenticated browsing
regresses.

## Open questions

None.

## Decisions

### 2026-10-02 - Clear the session on unsuccessful refresh

- The live pod inspection showed the auth infrastructure is correct; the
  failure is caused by stale browser credentials.
- A refresh callback returning `false` is terminal for the current session and
  must clear persisted credentials.

## User feedback / decisions

- The user confirmed local execution used real Tapis and requested inspection
  and repair of the deployed behavior.
