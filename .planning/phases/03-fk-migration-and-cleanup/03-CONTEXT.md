# Phase 3: FK Migration and Cleanup - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate execution and thread tables to reference new `modelcatalog_*` tables, update the Ensemble Manager to query Hasura directly instead of copying from the Model Catalog API, remove `@mintproject/modelcatalog_client` SDK dependency, and remove Fuseki from the Helm chart and application code. The old v1.8.0 API and Docker Compose/CI Fuseki references stay for now.

</domain>

<decisions>
## Implementation Decisions

### Row classification strategy
- Best-effort auto-classify model rows by matching `model.id` (full URI) against `modelcatalog_model_configuration` and `modelcatalog_model_configuration_setup` tables — the ETL already loaded them
- Two-step process: (1) classify and generate review report, (2) apply FK updates after user reviews
- Review report shows each old model row -> matched modelcatalog row -> classification type
- Orphaned rows (no match in modelcatalog_* tables) keep null FK — stay in place, revisit manually later

### FK migration approach
- Five tables have direct `model_id` FK to `model` table: `execution`, `model_input`, `model_output`, `model_parameter`, `thread_model`
- Secondary chain: `execution_data_binding`, `execution_parameter_binding`, `execution_result`, `thread_model_io`, `thread_model_parameter` reference `model_io` and `model_parameter`
- `execution` and `thread_model`: add two nullable FK columns (`modelcatalog_configuration_id` and `modelcatalog_setup_id`) — one populated per row depending on classification
- Old `model_id` column: keep but make nullable, drop FK constraint to `model(id)`. New rows won't populate it
- `model_io` table: keep table, add FK to `modelcatalog_dataset_specification`. Execution pipeline stays the same
- `model_parameter` table: replace entirely with `modelcatalog_parameter`. Remove the copy step from Ensemble Manager. `execution_parameter_binding` and `thread_model_parameter` point to `modelcatalog_parameter` directly
- `model_input` / `model_output`: keep (they reference `model_io` which stays)
- No new rows written to `model` table — Ensemble Manager creates new work referencing `modelcatalog_*` IDs directly

### Migration rollback safety
- Take pg_dump backup before running migration
- Run during maintenance window (brief downtime)
- DB migration deploys first, Ensemble Manager code deploys second — old code still works because `model_id` column stays
- Explicit validation gate after DB migration: count matched vs unmatched rows, spot-check samples. Only deploy new code after validation passes

### Fuseki removal scope
- Remove from: Helm chart (deployment, service, configmap) and application code (connection strings, client code, config)
- Keep in: Docker Compose (dev) and CI/CD pipelines — lower priority, clean up later
- Keep old v1.8.0 FastAPI API running as fallback — remove in a later phase after v2.0.0 validated in production
- Ensemble Manager: remove `model_catalog_api` config entirely — no longer needs the REST API since it queries `modelcatalog_*` tables directly via Hasura GraphQL

### SDK dependency removal
- Remove `@mintproject/modelcatalog_client` (^8.0.0) from package.json
- 8 files import from the SDK: model-catalog-functions.ts, model-catalog-graphql-adapter.ts, useModelInputService.ts, useModelParameterService.ts, useModelParameterService.test.ts, subTasksService.ts, threadsService.ts, graphql_functions.ts
- Replace SDK types with GraphQL codegen types — regenerate from Hasura schema to pick up `modelcatalog_*` table types
- model-catalog-functions.ts: remove entirely (fetch-and-copy pattern no longer needed)
- model-catalog-graphql-adapter.ts: rewrite to use codegen types for catalog-to-execution data conversion

### Claude's Discretion
- Exact Hasura migration SQL syntax and ordering
- GraphQL query structure for new modelcatalog_* lookups in Ensemble Manager
- Validation query design for the post-migration gate
- How to handle model_io_variable references during migration

</decisions>

<specifics>
## Specific Ideas

- model.id values are full URIs (https://w3id.org/okn/i/mint/...) — same format as modelcatalog_* IDs, so matching is direct string comparison
- Production database dump available at mint-prod-dump.sql for schema reference and testing
- Production Hasura pod: mint-hasura-7fd6978848-z7qjk in namespace `mint`
- Production DB pod: mint-hasura-db-0 in namespace `mint`
- The Ensemble Manager already has a GraphQL client and codegen setup — no new infrastructure needed for direct Hasura queries

</specifics>

<deferred>
## Deferred Ideas

- Remove Fuseki from Docker Compose and CI/CD — future cleanup
- Remove old v1.8.0 FastAPI deployment — after v2.0.0 validated in production
- Drop model_id column entirely from execution/thread_model — after all consumers adapted
- Drop model table entirely — after model_id column removed
- Full Ensemble Manager rewrite to eliminate model_io copy pattern — model_io stays with FK for now, full replacement in a future phase

</deferred>

---

*Phase: 03-fk-migration-and-cleanup*
*Context gathered: 2026-02-21*
