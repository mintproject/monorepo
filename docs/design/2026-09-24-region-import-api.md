# Region import API

Status: Implemented

## Objective

Move large GeoJSON region imports out of the Hasura authorization-hook request
path while preserving server-side authentication, enforcing curator/admin-only
access, and keeping imports synchronous and atomic.

## User need

An authenticated curator should be able to add one or more regions from a
GeoJSON file or remote spatial source without the request failing because
Hasura forwards the large GraphQL body to the Tapis authorization webhook.
Ordinary authenticated users should be able to browse and use regions but not
modify the shared region catalog.

## Current code/system summary

- `ui-react/src/pages/regions/RegionsEditor.tsx` parses GeoJSON in the browser
  and sends a nested `insert_region` GraphQL mutation containing all geometry
  JSON.
- The browser sends GraphQL requests to Hasura, which invokes the Tapis auth
  hook before executing the mutation. The external auth image has a small JSON
  body limit, producing `Invalid response from authorization hook` for larger
  imports.
- `model-catalog-api` already has a Fastify service, an authenticated request
  seam, and an admin-secret Hasura client. Its generic write path forwards the
  user's bearer token to Hasura rather than validating it itself.
- Hasura metadata currently permits the `user` role to insert rows into both
  `region` and `region_geometry`, so a new API-only policy would be bypassable
  through direct GraphQL unless those permissions change.
- Local Compose has an auth-hook proxy that strips large GraphQL request bodies,
  but the Tapis deployment can point Hasura directly at the webhook.

## Proposed design

### 1. Dedicated import API

Add a custom synchronous endpoint to `model-catalog-api`:

- `GET /v2.0.0/regions/import/access` (`custom_regions_import_access_get`)
  - Requires a bearer token.
  - Returns `{ "allowed": true }` for an authorized curator and
    `{ "allowed": false }` for an authenticated non-curator.
  - Returns `401` for a missing/invalid token.
- `POST /v2.0.0/regions/import` (`custom_regions_import_post`)
  - Requires a bearer token and curator/admin authorization.
  - Accepts a normalized JSON payload:

    ```json
    {
      "parent_region_id": "administrative",
      "category_id": "administrative",
      "regions": [
        {
          "id": "administrative__example",
          "name": "Example",
          "geometries": [
            {
              "type": "Polygon",
              "coordinates": [[[ -97, 30 ], [ -97, 31 ], [ -96, 31 ], [ -96, 30 ], [ -97, 30 ]]]
            }
          ]
        }
      ]
    }
    ```

  - Validates the parent/category identifiers, non-empty names, unique IDs,
    GeoJSON geometry shape, feature count, geometry count, and serialized body
    size before writing.
  - Performs one Hasura nested insert using the service's admin-secret client,
    so the import is atomic: either all regions and geometries are written or
    none are.
  - Returns `201` with inserted IDs/counts on success.
  - Returns structured `400` validation errors, `401` authentication errors,
    `403` authorization errors, `409` duplicate/conflict errors, and `413`
    limit errors. JWT/key-endpoint verification failures fail closed as `401` or `503`
    without attempting a database write.

The endpoint receives normalized geometry data rather than a remote URL. The
existing UI may continue loading GeoJSON files and remote spatial layers, but
the server remains responsible for validating the final import payload.

### 2. Trusted curator authorization

The endpoint must not infer curator status from the browser, a client header,
or the existing Hasura `user` role. Curator access is an operator-managed
database allowlist:

- Add a `region_curator` table keyed by `(tenant_id, username)`, with an
  `active` flag and audit timestamps.
- The table is managed by migrations or an operator-only database/admin
  workflow. It is not writable or readable by anonymous or ordinary Hasura
  users, and there is no browser UI for changing it in this phase.
- The API validates the bearer JWT signature, issuer, expiration, tenant, and
  username using the configured Tapis key endpoint and issuer. It then looks up the
  exact `(tapis/tenant_id, tapis/username)` pair in `region_curator`.
- Missing, inactive, malformed, expired, or unverifiable identities fail
  closed with `401` or `403`. No client-provided username can substitute for
  the verified JWT identity.
- Remote verification keys use a bounded cache. Curator rows may be read per
  request initially; any later cache must be short-lived and invalidation-safe.
  Never log tokens or sensitive identity payloads.

This avoids depending on a nonstandard Tapis role claim or an authorization
endpoint whose response contract is not present in this repository. The Tapis
key endpoint and issuer remain deployment configuration, with the same `portals`
defaults used by the existing auth webhook.

### 3. Hasura permission boundary

Remove `insert_permissions` for the ordinary `user` role from `region` and
`region_geometry`. Keep anonymous/user select permissions unchanged. The
import API becomes the only supported region-creation path and uses the
internal Hasura admin secret after it has completed the curator authorization.

The UI must treat its access check as a presentation optimization only. The
POST endpoint remains the security boundary and must return `403` even if a
non-curator calls it directly.

### 4. UI integration

Replace `useInsertRegionsMutation` in the region editor with a small REST
client that:

- reads the current bearer token from the existing token store;
- calls the access endpoint when the region editor loads or the user changes;
- hides the Add regions controls unless access is allowed;
- sends the normalized selected-region payload to the import endpoint;
- displays server validation, limit, conflict, authorization, and transient
  service errors without retrying a request that may have reached the API.

The existing file/remote-source parsing and name/id selection UX should remain
unchanged in this phase. The UI converts the selected features to the endpoint
payload and refreshes the region query after a `201` response.

## Files likely affected

- `monorepo/model-catalog-api/openapi.yaml`
- `monorepo/model-catalog-api/src/app.ts` or a new custom region-import route
  module
- `monorepo/model-catalog-api/src/hasura/client.ts`
- `monorepo/model-catalog-api/src/security.ts` and new Tapis identity/curator
  authorization module
- `monorepo/model-catalog-api/package.json` if JWT/Tapis verification needs a
  dependency
- `monorepo/model-catalog-api/README.md`
- `monorepo/ui-react/src/pages/regions/RegionsEditor.tsx`
- `monorepo/ui-react/src/lib/config.ts` and a region-import API helper
- focused UI/API tests
- `monorepo/graphql_engine/metadata/tables.yaml`
- a migration for `region_curator` and removal of direct user region inserts
- `monorepo/compose.yaml`, `monorepo/compose/README.md`, and deployment
  configuration for the new Tapis/limit settings
- the authoritative DSO Architecture service documentation, if accessible,
  because this adds a public API endpoint and new environment variables

## API/schema changes

- Add the two region-import REST operations described above using custom
  operation IDs so they cannot be captured by the generic `/regions` CRUD
  dispatcher.
- Add configuration for Tapis curator authorization and import limits.
- Add the operator-managed `region_curator` table and track it in Hasura with
  no ordinary-user permissions.
- Remove ordinary-user direct insert permissions for `region` and
  `region_geometry`.
- No changes to existing region columns are expected.
- The existing generic `POST /v2.0.0/regions` write operation must be retired,
  explicitly curator-gated, or documented as unsupported for shared-region
  creation before the ordinary Hasura insert permission is removed.
- Hasura remains the read/query API; geometry imports no longer traverse its
  external auth hook as a large request.

## Data flow

```text
UI GeoJSON/file/remote-source selection
  -> normalized region import payload
  -> model-catalog-api
       -> bearer token -> Tapis JWT verification + region_curator lookup
       -> validated payload
       -> Hasura admin mutation
       -> PostgreSQL region + region_geometry transaction
  -> 201 response
  -> UI refetches regions through Hasura reads
```

## Risks and tradeoffs

- The API holds a Hasura admin secret and therefore must never expose a generic
  GraphQL passthrough or accept arbitrary table/mutation names.
- Removing Hasura user inserts is a behavior change for any clients that write
  regions directly; the rollout must identify and migrate those callers.
- JWT verification depends on the configured Tapis key-endpoint/issuer
  contract. Key refresh failures fail closed and can temporarily prevent
  curator writes.
- Synchronous imports need conservative limits. Very large boundary datasets
  remain a future asynchronous-job concern.
- Keeping source parsing in the browser preserves the current UX but means the
  endpoint initially accepts normalized geometry rather than raw GeoJSON files.

## Alternatives considered

- **Browser-only authentication followed by direct upload:** rejected because
  browser state and client headers are not trusted authorization boundaries.
- **Continue sending large mutations through Hasura with a proxy:** useful as a
  short-term mitigation, but it leaves the upload coupled to the auth hook and
  still requires proxy/body-size tuning in every deployment.
- **Leave Hasura user insert permissions enabled:** rejected because callers
  could bypass curator authorization through direct GraphQL.
- **Tapis group/role JWT claim:** rejected as the default because Tapis role
  claims are tenant-specific and are not guaranteed in standard access tokens.
- **Remote Tapis permission lookup on every import:** rejected for the first
  phase because the repository does not contain a stable response contract and
  a database allowlist is simpler to operate and test.
- **Static API environment username allowlist:** rejected in favor of a
  database table so operator changes do not require rebuilding the API image.
- **Asynchronous import jobs:** deferred because the agreed first phase is
  synchronous with explicit limits.

## Test plan

- API unit tests for token extraction, JWT issuer/tenant/username validation,
  JWKS failure fail-closed behavior, curator-table lookup, and structured HTTP
  errors.
- API validation tests for empty names, duplicate IDs, malformed geometries,
  feature/geometry/body limits, parent/category values, and conflict handling.
- API Hasura-client tests proving one nested admin mutation is issued and no
  mutation is issued when authentication, authorization, or validation fails.
- Integration coverage for atomic rollback when one row conflicts.
- UI tests for access-gated controls, successful import/refetch, server errors,
  and absence of the old GraphQL insert mutation.
- Metadata validation proving ordinary `user` cannot insert `region` or
  `region_geometry`, cannot read or mutate `region_curator`, and retains read
  access to regions.
- Build, lint, focused tests, and `git diff --check`.

## Documentation plan

- Document the endpoint contract, configuration, limits, curator permission
  requirement, and local development setup in the model-catalog API README.
- Update Compose/deployment configuration documentation with the Tapis JWKS,
  issuer, tenant, curator-table seeding, and import-limit settings.
- Update the authoritative DSO Architecture service page for the new endpoint
  and environment variables.
- Explain that UI access checks are advisory and the API/Hasura boundary is
  authoritative.

## Rollout/rollback plan

1. Deploy the API authorization client and endpoint behind the existing UI.
2. Validate access checks and dry-run/fixture imports with a curator token.
3. Switch the UI to the endpoint while keeping the old mutation available only
   during the compatibility window.
4. Confirm no supported caller still depends on direct user region inserts and
   retire or curator-gate the generic REST region POST.
5. Remove user insert permissions from `region` and `region_geometry`.
6. Remove the old UI retry and direct GraphQL insert path.

Rollback before step 5 is an API/UI image rollback. After step 5, rollback must
restore the metadata permissions only with explicit approval and only after
confirming that the API authorization boundary is disabled; never leave an
admin-secret import endpoint exposed without its curator check.

## Open questions

- Confirm the initial curator usernames/tenant IDs to seed in `region_curator`
  and the operator process for adding/removing them.
- Confirm the exact Tapis JWKS URI and issuer for each deployment; local
  Compose defaults can reuse the existing `portals` values.
- Confirm the initial limits. Proposed starting point: 500 regions, 10
  geometries per region, 10 MiB request body, and 2 MiB serialized geometry per
  region.
- Confirm whether existing direct REST `POST /v2.0.0/regions` callers must be
  migrated to the new endpoint or should be explicitly disabled for writes.
- Confirm access to the DSO Architecture documentation repository for the
  required service-page update.

## Decisions

- 2026-09-24: Shared-region imports are curator/admin-only.
- 2026-09-24: First implementation is synchronous with explicit limits.
- 2026-09-24: Curator authorization uses an operator-managed database table
  keyed by verified Tapis tenant and username; no custom JWT role claim is
  assumed.
- 2026-09-24: The long-term boundary is a dedicated authenticated API route,
  not a browser-only check and not a large GraphQL mutation through Hasura's
  auth hook.
- 2026-09-24: The implementation uses Node's built-in RSA/JWKS primitives
  instead of adding a JWT dependency, with a five-minute JWKS cache and a
  five-second fetch timeout.
- 2026-09-24: The generic REST `POST /v2.0.0/regions` operation was removed
  from the published OpenAPI surface in the same change as the Hasura insert
  permission removal; no compatibility window remains for shared-region
  creation.
- 2026-09-24: The UI access check is advisory and hides the import controls for
  non-curators, while the API repeats token and curator authorization on every
  import request.
- 2026-09-24: The verifier accepts both standard JWKS documents and the Tapis
  tenant endpoint's `result.public_key` PEM response; the local Tapis endpoint
  uses the latter format.

## Implementation result

- Added `region_curator` migration and Hasura metadata with no ordinary-user
  permissions.
- Added the authenticated import/access endpoints to `model-catalog-api`,
  including request limits, GeoJSON validation, curator lookup, and one nested
  admin-secret mutation.
- Replaced the UI's direct nested GraphQL insert and retry with the REST import
  client; failed imports are surfaced without retrying a possibly committed
  request.
- Added Compose/deployment configuration and operator setup documentation for
  the curator table and import limits.
- API tests, the focused UI API-client tests, and both TypeScript builds pass.
  The full UI Vitest suite was attempted but the parallel test runner exceeded
  the local Node heap; the focused changed-path suite passed.

## User feedback / decisions

- The user requested the long-term design after diagnosing the auth-hook/body
  size failure.
- The user selected curator/admin-only access.
- The user selected synchronous imports with explicit limits.
- The user selected an operator-managed users table rather than groups for
  curator authorization because groups represent workflow membership.
