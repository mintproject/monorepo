# Tapis PostgreSQL Named Route for MINT Dev

Status: Implemented

## Objective

Restore PostgreSQL connectivity for the MINT dev Hasura and semantic-search
pods by using Tapis's PostgreSQL-aware networking route.

## User need

The semantic-search pod starts, but its embedding refresh and `/search` endpoint
fail with `psycopg.OperationalError` and `tlsv1 alert no application protocol`.
The dev stack needs a database route that supports PostgreSQL TLS negotiation.

## Current code/system summary

The deployment script exposes `mintdevpostgres` with a generic `default/tcp`
route and builds database URLs against the bare pod hostname on port 443. The
live PostgreSQL pod has the same route. Tapis documents a named `postgres`
route, whose external hostname includes the route name.

## Proposed design

Expose PostgreSQL as `networking.postgres` with protocol `postgres` and port
5432. Generate the shared Hasura and semantic-search database URL with the
`mintdevpostgres-postgres.pods.<domain>:443` hostname, retaining
`sslmode=require`. Keep the existing `mintdevpostgresdata` volume and PGDATA
unchanged.

## Files likely affected

- `deploy/tapis/register_mint_stack.py`
- `deploy/tapis/test_register_mint_stack.py`
- `docs/deploy/mint-dev-pods.md`

## API/schema changes

No application API or database schema changes. This changes only the Tapis pod
networking definition and the generated connection hostname.

## Data flow

Hasura and semantic search receive the same generated database URL. Their
connections reach the named Tapis PostgreSQL route on external port 443, which
proxies to PostgreSQL port 5432 inside `mintdevpostgres`. The persistent volume
remains mounted at `/var/lib/postgresql/data` with PGDATA below that mount.

## Risks and tradeoffs

- The named route may take time to become available after a pod update.
- Existing consumers must be updated to the suffixed hostname together with the
  PostgreSQL route.
- `sslmode=require` is retained; certificate hostname verification is not added
  because the Tapis route certificate policy is outside this repository.
- No volume deletion or database recreation is part of this change.

## Alternatives considered

- Keep `default/tcp`: rejected because the live log demonstrates an ALPN
  failure before PostgreSQL authentication.
- Remove TLS or use port 5432 externally: rejected because Tapis exposes the
  external pod route through port 443.
- Recreate the database volume: rejected because the failure is routing, not
  storage, and recreation risks data loss.

## Test plan

- Assert the generated PostgreSQL networking route is named `postgres` and
  uses protocol `postgres` on port 5432.
- Assert Hasura and semantic search share the suffixed route hostname.
- Assert explicit database URL overrides remain unchanged and shared.
- Run the focused deployment test suite and `git diff --check`.
- After rollout, inspect the live pod route and verify semantic-search health
  and `/search` response from the deployed service.

## Documentation plan

Update the MINT dev deployment runbook with the named route, external hostname,
and the reason the bare generic TCP hostname must not be used.

## Rollout/rollback plan

Update the PostgreSQL pod networking while retaining its existing volume, then
update/restart Hasura and semantic search with the generated hostname. Verify
SQL-backed health and `/search`. If the named route cannot become available,
restore the previous networking and connection URL without deleting the pod's
volume.

## Open questions

Whether the Tapis update operation immediately propagates the named route or
requires a pod restart must be confirmed during the live rollout.

## Decisions

- Use Tapis's named `postgres` protocol route.
- Keep port 5432 inside the pod and port 443 in client URLs.
- Preserve the existing persistent volume and database credentials.
- Keep the explicit database URL override behavior for operator-managed
  deployments.

## User feedback / decisions

- The user supplied the failing semantic-search log and asked to fix it.
- The user previously confirmed the dev deployment should use the standalone
  semantic-search service; this fix addresses its database connectivity rather
  than replacing that service.
- The live `mintdevpostgres`, `mintdevgraphql`, and `mintdevsemanticsearch`
  definitions were updated through Tapis using the named route and shared
  hostname. The existing `mintdevpostgresdata` volume remained attached.
- Post-rollout verification returned HTTP 200 from semantic search `/health`
  and `/search?q=temperature&limit=5`.
