# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-14)

**Core value:** All model catalog data accessible through a single GraphQL endpoint, eliminating the Fuseki dependency while maintaining REST API compatibility.
**Current focus:** All phases complete - ready for production deployment

## Current Position

Phase: 3 of 3 (FK Migration and Cleanup - COMPLETE)
Plan: 4 of 4 in current phase (03-04 complete)
Status: ALL PHASES COMPLETE
Last activity: 2026-02-22 -- 03-04 complete: validation script created, testing environment deployment verified, all Phase 3 artifacts approved

Progress: [████████████] 100% (All 3 phases complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 20
- Average duration: 5.5 minutes
- Total execution time: 1.27 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-schema-and-data-migration | 7 | 39.8 min | 5.7 min |
| 02-api-integration | 13 | 55.5 min | 4.3 min |

**Recent Trend:**
- Last 5 plans: 3 min, 5.2 min, 6.7 min, 2 min, 4 min, 10 min
- Trend: Stable

*Updated after each plan completion*

**Recent completions:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| 01-01 | 182s | 2 | 3 |
| 01-02 | [unknown] | [unknown] | [unknown] |
| 01-03 | 132s | 2 | 2 |
| 01-04 | 240s | 2 | 1 |
| 01-05 | 251s | 2 | 2 |
| 01-06 | 138s | 2 | 1 |
| 01-07 | 350s | 2 | 2 |
| 02-01 | 152s | 2 | 1 |
| 02-02 | 314s | 2 | 8 |
| 02-03 | 234s | 2 | 4 |
| 02-04 | 978s | 2 | 3 |
| 02-06 | 400s | 2 | 2 |
| Phase 02 P05 | 657 | 2 tasks | 5 files |
| 02-07 | 94s | 2 | 5 |
| 02-08 | 230s | 2 | 3 |
| Phase 02 P09 | 69 | 2 tasks | 2 files |
| 02-10 | 598s | 3 tasks | 4 files |
| Phase 02-api-integration P12 | 226 | 1 tasks | 3 files |
| 02-11 | 266s | 3 tasks | 4 files |
| 02-13 | 88s | 2 tasks | 2 files |
| 03-02 | 480s | 2 tasks | 6 files |
| 03-01 (cont) | 576s | 2 tasks | 5 files |
| 03-03 | 784s | 2 tasks | 12 files |
| 03-04 | checkpoint | 2 tasks | 1 file |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Compressed 5 categories into 3 phases (SCHM+DATA, API, FKMG+CLNP) per "quick" depth
- [Roadmap]: ETL pipeline split into separate plan from schema design to allow parallel work on extraction while Hasura migration is built
- [01-01]: Made FK columns nullable to handle orphaned entities in RDF data
- [01-01]: Single parameter table with parameter_type column instead of separate Adjustment table
- [01-01]: Created 15 indexes covering all FK columns for query performance
- [Phase 01-03]: Redundant author_id FK + junction table for single/multi-valued author optimization
- [Phase 01-03]: Polymorphic junction table for CausalDiagram parts with part_type discriminator
- [Phase 01-04]: Follow existing pattern of anonymous + user permissions with unrestricted read for consistency
- [Phase 01-04]: Bidirectional relationships on junction tables enable nested GraphQL queries in both directions
- [Phase 01-04]: Plural descriptive relationship names make GraphQL queries more intuitive
- [Phase 01-07]: Two-pass loading for self-referential FK tables to avoid constraint violations
- [Phase 01-07]: WARN vs FAIL validation strategy for new junction tables (TriG subset may not contain all relationship types)
- [Phase 02-01]: Junction tables (FK-pair-only) get insert+delete only; entity tables get insert+update+delete
- [Phase 02-01]: All mutation permissions use unrestricted filter {} consistent with existing non-modelcatalog conventions
- [Phase 02-02]: Apollo Client v4 is non-generic class; getWriteClient returns ApolloClient (not ApolloClient<unknown>)
- [Phase 02-02]: type=module in package.json required for import.meta with Node16 module resolution
- [Phase 02-02]: openapi.yaml has 243 operations total (not 105 paths -- research counted paths not operations)
- [Phase 02-02]: fastify-openapi-glue registration deferred to plan 04 (needs service handlers)
- [Phase 02-03]: Object relationships also array-wrapped in v1.8.0 responses (author -> [{id, type, ...}])
- [Phase 02-03]: 23 of 46 API types have no dedicated Hasura table (marked hasuraTable: null); need view strategy
- [Phase 02-03]: 6 software subtypes share modelcatalog_software table; service handlers add type discriminator filter
- [Phase 02-03]: configurationsetups is alias for modelconfigurationsetups (same table, different type URI)
- [Phase 02-api-integration]: JavaScript Proxy requires both has() and get() traps; openapi-glue uses 'in' operator to check handler existence
- [Phase 02-api-integration]: OpenAPI spec pre-processed to strip response/request schemas before openapi-glue registration: prevents AJV compile errors and reduces startup from 31s to under 1s
- [Phase 02-api-integration]: AJV strict:false required for OpenAPI 3.x keywords (example, xml, externalDocs) in schemas
- [Phase 02-api-integration]: Bearer token not validated by SecurityHandler; Hasura validates JWT via row-level permissions when token is forwarded
- [Phase 02-06]: JS-side post-filtering for intervention/region/variable cross-joins (simpler than Hasura nested where for multi-level traversals)
- [Phase 02-06]: standard_variable handler uses variable presentation label as proxy (standardvariables table does not exist in schema)
- [Phase 02-06]: datatransformations handler returns empty array stub (datatransformations hasuraTable is null in registry)
- [Phase 02-06]: configurationsetups and modelconfigurationsetups custom handlers are aliases querying same Hasura table
- [Phase 02-06]: user_login_post returns 501 -- Keycloak handles auth externally, API never sees credentials
- [Phase 02-08]: username param is now accepted but ignored (no-op) in service.ts and all 7 custom handlers -- no user_id column in modelcatalog_* tables
- [Phase 02-api-integration]: junctionRelName added to RelationshipConfig: mapper now traverses junction rows to extract target entities
- [Phase 02-api-integration]: vi.hoisted() required in vitest when mock factory references module-level variables
- [Phase 02-07]: openapi.yaml copied into production Docker image (required at runtime by fastify-openapi-glue)
- [Phase 02-07]: model_catalog_api_v2 disabled by default in values.yaml to avoid breaking existing deployments
- [Phase 02-07]: HASURA_ADMIN_SECRET sourced from existing mint-secrets resource with optional: true for consistency
- [Phase 02-07]: Ingress routes /v2.0.0 path prefix so v1.8.0 and v2.0.0 coexist on same domain
- [Phase 02-api-integration]: null-table resource types return 200 [] for list and 404 for get-by-id (matches v1.8.0 behavior for empty named graphs)
- [Phase 02-api-integration]: write operations on null-table types continue returning 501 (no backing store, writes cannot proceed)
- [Phase 02-10]: ETL extracts most specific rdf:type for software entities; falls back to sdm:Model if no specialized subtype found in TriG
- [Phase 02-10]: theory_guidedmodels (underscore) alias required in resource-registry: OpenAPI converts URL hyphens to underscores in operationIds
- [Phase 02-api-integration]: SETUP_FIELDS: removed non-existent columns (has_documentation, date_created, date_modified); all junction relationships use traversal pattern inputs { input { ... } }
- [Phase 02-api-integration]: custom_datasetspecifications_get uses 'input'/'output' relationship names on junction rows (not 'dataset_specification')
- [Phase 02-11]: Registry keys are the API output field names (OWL v1.8.0 property names); hasuraRelName stays as internal Hasura relationship name
- [Phase 02-11]: Plain UUID IDs accepted in getById/update/delete by prepending resourceConfig.idPrefix; full URIs (https://) pass through unchanged
- [Phase 02-11]: deleteResource returns deleted: fullId (not deleted: id) so caller sees the resolved full URI
- [Phase 02-13]: Handler 4 (custom_configuration_id_inputs_get) uses mcConfig.idPrefix from modelconfigurations because path param filters modelcatalog_model_configuration table
- [Phase 02-13]: Handler 5 (configurationid query param) uses mcConfig.idPrefix from modelconfigurations because filter field is model_configuration_id
- [Phase 03-02]: ingress-model-catalog-endpoint.yaml guarded by AND of model_catalog_endpoint.enabled + ingress.enabled (both conditions required)
- [Phase 03-02]: model-catalog-endpoint-backup.yaml guarded by AND of model_catalog_endpoint.enabled + backups.enabled (both conditions required)
- [Phase 03-02]: PVC template left intact with helm.sh/resource-policy: keep for Fuseki data preservation on disable
- [Phase 03-01]: Delete-before-FK-add pattern for execution_parameter_binding and thread_model_parameter (model_parameter_id is part of PK so cannot be nulled; DELETE orphans before ADD CONSTRAINT)
- [Phase 03-01]: Non-deferrable FK constraints in migration 2 after confirming 0 orphaned rows via user review -- deferrable adds complexity with no benefit when orphan count is 0
- [Phase 03-01]: Removed execution_parameter_bindings and thread_model_parameters array_relationships from model_parameter in tables.yaml (FK now on modelcatalog_parameter)
- [Phase 03-03]: Hasura relationship names on modelcatalog_model_configuration/setup are 'parameters', 'inputs', 'outputs' (not setup_parameters/setup_inputs) -- junction tables have 'parameter', 'input', 'output' object rels
- [Phase 03-03]: convertApiUrlToW3Id moved to model-catalog-graphql-adapter.ts as canonical model catalog utility
- [Phase 03-03]: All inputs from Hasura modelcatalog_dataset_specification treated as non-fixed (no has_fixed_resource column exists)
- [Phase 03-03]: useModelParameterService uses has_fixed_value (scalar string) not hasFixedValue (string array SDK style)
- [Phase 03-04]: 1 unmatched model_io row is acceptable (135/136 matched) -- data quality issue in RDF source, not a migration defect
- [Phase 03-04]: Deployment order validated in testing: DB backup -> schema migrations -> ETL -> FK migrations -> Hasura metadata -> validate SQL -> new code -> helm upgrade

### Pending Todos

None yet.

### Blockers/Concerns

None - all phases complete. Production deployment can proceed following the validated deployment order from 03-04.

## Session Continuity

Last session: 2026-02-22
Stopped at: Completed 03-04-PLAN.md (validation SQL script, testing environment verified, all Phase 3 artifacts approved)
Resume file: N/A - all phases complete, ready for production deployment
