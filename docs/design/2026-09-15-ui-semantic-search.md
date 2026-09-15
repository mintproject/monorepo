# Wire MINT UI to Standalone Semantic Search

Status: Implemented

## Objective

Make the React UI call the standalone semantic-search service in the develop deployment instead of a developer's localhost, while keeping local compose development working.

## User need

- **Primary user:** MINT UI users searching for standard variables in the deployed dev application.
- **Secondary users:** Developers running the monorepo locally.
- **Job-to-be-done:** Find semantically relevant standard variables from the autocomplete control.
- **Current pain:** The UI sends searches to `http://localhost:8091`, so a deployed browser cannot reach the semantic-search pod.
- **Definition of success:** The deployed UI sends `/search` requests to the deployed semantic-search URL and receives results without browser CORS errors; local compose continues to use port 8091.

## Current code/system summary

`ui-react/src/components/autocomplete/StandardVariableCombobox.tsx` hardcodes `http://localhost:8091/search`. The Tapis deploy script registers `mintdevsemanticsearch` and already derives its public URL, but does not pass that URL to the UI. `semantic-search-service/main.py` only permits `http://localhost:3000`. Compose publishes the service on port 8091.

## Proposed design

1. Add `SEMANTIC_SEARCH_API` to the UI runtime configuration and use it as the base URL for `/search`.
2. Default the UI configuration to `http://localhost:8091` for local compose development.
3. Inject `urls["semantic_search"]` into the Tapis UI pod environment.
4. Make semantic-service CORS origins configurable through a comma-separated `SVO_CORS_ORIGINS` value, defaulting to localhost, and set the Tapis value to `urls["ui"]`.
5. Set the same local CORS default in compose.

## Files likely affected

- `ui-react/src/components/autocomplete/StandardVariableCombobox.tsx`
- `ui-react/src/lib/config.ts`
- `ui-react/vite-env.d.ts`
- `ui-react/scripts/generate-env-config.mjs`
- `ui-react/scripts/generate-env-config.d.ts`
- `ui-react/public/env-config.js`
- `ui-react/.env.example`
- `deploy/tapis/register_mint_stack.py`
- `deploy/tapis/test_register_mint_stack.py`
- `semantic-search-service/main.py`
- `compose.yaml`
- focused UI/service tests and `docs/deploy/mint-dev-pods.md`

## API/schema changes

No API or database schema changes. The existing standalone `GET /search` endpoint remains unchanged. A new browser runtime configuration key and semantic-service CORS environment variable are added.

## Data flow

The browser reads `SEMANTIC_SEARCH_API` from `window.__MINT_CONFIG__`, calls `<base>/search?q=...&limit=50`, and receives ranked results from `mintdevsemanticsearch`. The service permits the exact deployed UI origin supplied through `SVO_CORS_ORIGINS`. Hasura's existing catalog webhook remains unchanged.

## Risks and tradeoffs

- Direct browser-to-pod traffic depends on the public Tapis HTTPS URL remaining stable; that URL is already the deployment's documented service endpoint.
- CORS must allow the exact UI origin, so each isolated stack must derive both values from the same `urls` map.
- Keeping a localhost default preserves local development but would be wrong if a deployment omits the injected variable; tests will cover the Tapis spec.

## Alternatives considered

- **Route search through model-catalog-api:** rejected because develop already deploys and health-checks a standalone semantic-search API, and the requested architecture is to use that API.
- **Use a wildcard CORS policy:** rejected because it broadens browser access unnecessarily.
- **Keep the hardcoded localhost URL:** rejected because it cannot work for deployed users.

## Test plan

- Test runtime config defaults and overrides for `SEMANTIC_SEARCH_API`.
- Test that the combobox requests the configured `/search` endpoint.
- Test that Tapis specs inject the semantic URL into the UI and the UI origin into semantic-service CORS.
- Test semantic-service CORS origin parsing/default behavior.
- Run focused UI tests, typecheck, deployment Python tests, service tests if available, and `git diff --check`.

## Documentation plan

Document the new UI runtime variable and standalone semantic-search endpoint in the UI example/config comments and the Tapis dev deployment guide.

## Rollout/rollback plan

The change rolls out with the UI and semantic-search image deployment. Rollback is a code revert; local defaults remain backwards-compatible. No database migration or data mutation is involved.

## Open questions

None for the develop deployment: its UI origin and semantic-search public URL are both derived by `pod_urls()`.

## Decisions

### 2026-09-15 — Keep standalone semantic search as the develop integration

- **Decision:** Wire `mintdevui` directly to `mintdevsemanticsearch` through runtime configuration.
- **Reason:** The develop deployment already registers the standalone service, and the user clarified that this is the intended API path.
- **Alternatives rejected:** The model-catalog-api consolidation branch is separate and must not be introduced into develop.
- **User feedback:** “it’s supposed to run through semantic search api we just pushed through”; “go to develop”; “ok do it.”
- **Impact on implementation:** No model-catalog-api changes; add only UI endpoint configuration and standalone-service CORS configuration.

## User feedback / decisions

The user approved implementation on the current develop branch after distinguishing it from the separate `codex/model-catalog-embeddings` branch.

Implementation completed on 2026-09-15. The UI now reads `SEMANTIC_SEARCH_API`,
the Tapis UI pod receives the standalone semantic-search URL, and the semantic
pod receives the exact UI origin through `SVO_CORS_ORIGINS`. No API/schema
changes were needed.
