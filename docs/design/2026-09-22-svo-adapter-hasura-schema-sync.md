# Synchronize SVO adapter and MINT Hasura schemas

Status: Implemented

## Objective

Bring the persistent MINT dev Hasura schema and metadata into compatibility
with the current MINT→SVO adapter synchronization and transform-edge code.

## User need

The dev UI can display manually synchronized ETL records, but the supported
admin synchronization endpoint fails because Hasura lacks the Tapis app fields
that the adapter queries. Edge recomputation also fails because the adapter
writes compatibility details that the edge table does not store. The dev
deployment must be able to apply the schema forward and then synchronize
without a manual database workaround.

## Current code/system summary

- `svo-adapter-service/app/mint_sync.py` queries
  `modelcatalog_configuration.tapis_app_id` and `tapis_app_version`.
- `svo-adapter-service/app/edges.py` inserts `compatibility_json` into
  `adapter.transform_edge`.
- The existing model-catalog migration does not define the two Tapis app
  columns, and the original adapter migration does not define
  `compatibility_json`.
- Hasura table metadata omits the new columns from the relevant permissions.
- The dev persistent database is behind the application image because the
  migration stage had not yet applied the current schema.

## Proposed design

Add one forward migration after the current migration head that:

1. Adds nullable `tapis_app_id` and `tapis_app_version` text columns to
   `public.modelcatalog_configuration`.
2. Adds nullable `compatibility_json` JSONB to `adapter.transform_edge`.
3. Updates Hasura permissions metadata for the new fields.
4. Exposes the Tapis app fields in the model-catalog API's configuration
   selections so registered app IDs can be inspected through the catalog API;
   writes remain an admin-owned catalog operation.

The migration is idempotent where PostgreSQL permits it and has a reversible
down migration. After the image containing the migration is deployed, the
existing gated `--migrate-hasura` stage applies migrations and metadata,
then the adapter sync and edge-recompute endpoints are verified.

## Files likely affected

- `graphql_engine/migrations/1771300000017_svo_adapter_sync_schema/up.sql`
- `graphql_engine/migrations/1771300000017_svo_adapter_sync_schema/down.sql`
- `graphql_engine/metadata/tables.yaml`
- `model-catalog-api/src/hasura/field-maps.ts`
- `model-catalog-api/src/custom-handlers.ts`
- `graphql_engine/tests/test_svo_adapter_schema.py`
- `graphql_engine/tests/test_svo_adapter_sync_schema.py`
- `docs/design/2026-09-22-svo-adapter-hasura-schema-sync.md`

## API/schema changes

- `public.modelcatalog_configuration.tapis_app_id TEXT NULL`
- `public.modelcatalog_configuration.tapis_app_version TEXT NULL`
- `adapter.transform_edge.compatibility_json JSONB NULL`

No existing endpoint is removed or renamed. The adapter's existing GraphQL
queries and mutations become valid against the migrated schema.

## Data flow

```text
GraphQL image with migration
  -> hasura migrate apply
  -> metadata apply/reload
  -> adapter reads MINT configs + ETLs
  -> transform specs upsert
  -> compatibility edges computed and persisted
  -> problem-statement inference reads the synchronized registry
```

## Risks and tradeoffs

- Existing configuration rows receive NULL Tapis app fields until an admin
  registers and records the corresponding app IDs; this is intentional and
  preserves current function-task fallback behavior.
- Edge recomputation deletes and rebuilds a derived cache. It must run only
  after the schema is present and the transform registry is readable.
- The migration changes persistent dev state and must run before adapter/UI
  verification. It does not automatically mutate CKAN or execute MINT models.
- The working tree contains unrelated user changes; only the files listed here
  should be modified for this fix.

## Alternatives considered

- Change the adapter to omit Tapis app fields when Hasura rejects them: rejected
  because it hides deployment drift and prevents registered Tapis apps from
  reaching workflow generation.
- Remove `compatibility_json` from edge writes: rejected because it discards
  useful readiness diagnostics and does not fix the schema mismatch generally.
- Edit the already-applied base migration: rejected because deployed Hasura
  migration ledgers would not re-run it.
- Keep the manual ETL registration workaround: rejected because it is not
  repeatable and leaves model-configuration sync broken.

## Test plan

- Assert the new migration adds and removes all three columns.
- Assert metadata permissions expose the new fields and edge JSON column.
- Run focused GraphQL migration/metadata tests.
- Run focused SVO adapter sync and edge computation tests.
- Apply migrations to the local Hasura database and verify the sync dry-run,
  live sync, edge recomputation, and dev UI outcome picker.

## Documentation plan

Update the SVO adapter and model-catalog API documentation only where the
current field exposure or migration prerequisite is described. Keep secrets,
tokens, and admin credentials out of logs and documentation.

## Rollout/rollback plan

Deploy the GraphQL image containing the migration, run the existing gated
Hasura migration stage, reload metadata, then restart the SVO adapter and run
its sync. Rollback is an application/image rollback plus a reviewed down
migration only if the new columns are not yet used; do not run down migrations
automatically in deployment.

## Open questions

- Which registered Tapis app IDs should be populated in the MINT configuration
  rows remains an operational catalog-registration decision, not a schema
  migration concern.
- Whether edge recomputation should remain synchronous for the admin endpoint
  or be made a queued job is outside this compatibility fix.

## Decisions

### 2026-09-22 — Make Hasura match the current adapter contract

- **Decision:** Add a forward migration and matching metadata rather than
  weakening the adapter code.
- **Reason:** The adapter contract and desired registry behavior are already
  implemented; the persistent dev schema is stale.
- **Alternatives rejected:** Compatibility fallbacks and manual ETL writes,
  because they would preserve deployment drift.
- **Impact on implementation:** The migration is the source of truth for both
  MINT configuration app fields and edge compatibility details.

## User feedback / decisions

- 2026-09-22: User explicitly approved implementing the Hasura compatibility
  fix with “do it”.

## Implementation result

- Added migration `1771300000017_svo_adapter_sync_schema` for the two nullable
  MINT Tapis app fields and the derived edge compatibility JSON.
- Updated Hasura permissions and model-catalog API selections.
- Normalized MINT ETL contract objects before adapter upsert so the catalog-only
  `position` field is preserved as metadata rather than sent to Hasura.
- Applied the equivalent forward SQL and metadata reload to the persistent dev
  Hasura database. The schema smoke query succeeded, MINT sync dry-run returned
  229 candidate rows, and edge recomputation inserted 410 edges.
- The new migration will be recorded normally the next time the GraphQL image
  containing it is deployed; the one-time dev SQL repair was idempotent.
- Full live sync awaits deployment of the updated SVO adapter image so the
  remote pod includes the ETL contract normalization fix.
