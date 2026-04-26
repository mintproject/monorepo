---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: milestone
status: executing
stopped_at: Phase 11 context gathered
last_updated: "2026-04-26T20:26:15.034Z"
last_activity: "2026-04-26 - Completed quick task 260426-fk5: Fix Apollo field 'model' not found in type 'thread_model' in mint-ensemble-manager"
progress:
  total_phases: 10
  completed_phases: 6
  total_plans: 34
  completed_plans: 34
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-15)

**Core value:** All model catalog data accessible through a single GraphQL endpoint, eliminating the Fuseki dependency while maintaining REST API compatibility.
**Current focus:** Phase 10 — check-the-required-changes-on-mint-ensemble-manager-after-migration

## Current Position

Phase: 10
Plan: Not started
Milestone v2.0: COMPLETE (shipped 2026-03-15)
Status: Ready to execute
Last activity: 2026-04-26 - Completed quick task 260426-fk5: Fix Apollo field 'model' not found in type 'thread_model' in mint-ensemble-manager

Progress: [████████████] 100% — v2.0 shipped

## Performance Metrics

**Velocity:**

- Total plans completed: 25
- Average duration: 5.5 minutes
- Total execution time: 1.27 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-schema-and-data-migration | 7 | 39.8 min | 5.7 min |
| 02-api-integration | 13 | 55.5 min | 4.3 min |
| 03-fk-migration-and-cleanup | 4 | — | — |
| 04-critical-bug-fixes | 1 | — | — |

**Recent Trend:**

- Last 5 plans: 3 min, 5.2 min, 6.7 min, 2 min, 4 min
- Trend: Stable

*Updated after each plan completion*
| Phase 03-fix-nested-resource-creation-link-or-create-associated-resources-when-creating-parent-resource P01 | 4 | 2 tasks | 3 files |
| Phase 03-fix-nested-resource-creation-link-or-create-associated-resources-when-creating-parent-resource P02 | 1 | 2 tasks | 1 files |
| Phase 05-variable-migration-analysis-trig-fuseki-to-hasura P01 | 2 | 2 tasks | 4 files |
| Phase 05-variable-migration-analysis-trig-fuseki-to-hasura P03 | 3 | 1 tasks | 2 files |
| Phase 09-merge-modelconfiguration-setup-tables-and-migrate-thread-model-relationships P02 | 5 | 2 tasks | 2 files |
| Phase 09-merge-modelconfiguration-setup-tables-and-migrate-thread-model-relationships P03 | 8 | 2 tasks | 3 files |
| Phase 09-merge-modelconfiguration-setup-tables-and-migrate-thread-model-relationships P01 | 8 | 2 tasks | 7 files |
| Phase 09-merge-modelconfiguration-setup-tables-and-migrate-thread-model-relationships P04 | 25 | 3 tasks | 16 files |
| Phase 10 P01 | 4 | 2 tasks | 5 files |
| Phase 10-check-the-required-changes-on-mint-ensemble-manager-after-migration P00 | 3 | 2 tasks | 5 files |

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
- [Phase 02-api-integration]: OpenAPI spec pre-processed to strip response/request schemas before openapi-glue registration
- [Phase 02-api-integration]: AJV strict:false required for OpenAPI 3.x keywords
- [Phase 02-api-integration]: Bearer token not validated by SecurityHandler; Hasura validates JWT via row-level permissions
- [Phase 02-06]: JS-side post-filtering for intervention/region/variable cross-joins
- [Phase 02-08]: username param accepted but ignored (no-op) -- no user_id column in modelcatalog_* tables
- [Phase 02-api-integration]: junctionRelName added to RelationshipConfig for junction traversal
- [Phase 02-07]: model_catalog_api_v2 disabled by default in values.yaml
- [Phase 02-api-integration]: null-table resource types return 200 [] for list and 404 for get-by-id
- [Phase 02-10]: ETL extracts most specific rdf:type for software entities; falls back to sdm:Model
- [Phase 02-11]: Plain UUID IDs accepted by prepending resourceConfig.idPrefix; full URIs pass through unchanged
- [Phase 03-02]: ingress guarded by AND of model_catalog_endpoint.enabled + ingress.enabled
- [Phase 03-01]: Delete-before-FK-add pattern for execution_parameter_binding and thread_model_parameter
- [Phase 03-03]: convertApiUrlToW3Id moved to model-catalog-graphql-adapter.ts as canonical utility
- [Phase 03-04]: 1 unmatched model_io row acceptable (135/136 matched) -- data quality issue in RDF source
- [Phase 04-critical-bug-fixes]: Anonymous role in tables.yaml uses explicit inline column list
- [Phase 04-critical-bug-fixes]: has_accepted_values TEXT[] not string - adapter fallback is [] not empty string
- [quick-260328-f39]: modelcatalog_software_category junction with YAML anchor &id040
- [quick-260328-hu8]: deploy-hasura.sh script automates migration apply + metadata apply inside pod
- [quick-260328-igb]: intervalUnit extracted as string (URI last segment) not object in ETL transform
- [quick-today]: modelcatalog_modelconfiguration_category (&id041) and modelcatalog_modelconfigurationsetup_category (&id042) junction tables; TEXT FKs for configuration category junctions
- [Phase 03-01]: parentFkColumn added as explicit field on RelationshipConfig (not runtime map) for self-documenting junction FK resolution
- [Phase 03-01]: buildJunctionInserts is a separate export alongside toHasuraInput, wired into service layer by Plan 02
- [Phase 03-fix-nested-resource-creation-link-or-create-associated-resources-when-creating-parent-resource]: Used multi-root Hasura mutation for update path: delete junctions + update scalars + insert junctions in one transaction
- [Phase 03-fix-nested-resource-creation-link-or-create-associated-resources-when-creating-parent-resource]: Used flat FK columns for update-path junction inserts; nested insert syntax only for create() path
- [Phase 05-variable-migration-analysis-trig-fuseki-to-hasura]: Added VP FK column indexes in migration for has_standard_variable and uses_unit query performance
- [Phase 05-variable-migration-analysis-trig-fuseki-to-hasura]: VP object_relationships declared without FK constraints - will activate after Plan 03 adds FK constraints
- [Phase 05-variable-migration-analysis-trig-fuseki-to-hasura]: D-03 resolved: no modelcatalog_variable table created; 0 plain sd:Variable instances in TriG data confirmed
- [Phase 05-variable-migration-analysis-trig-fuseki-to-hasura]: FK constraints use DEFERRABLE INITIALLY DEFERRED and ON DELETE SET NULL to support batch ETL loading
- [Phase 09]: All three resource entries (modelconfigurations, modelconfigurationsetups, configurationsetups) point to modelcatalog_configuration; hasSetup uses child_configurations and modelConfiguration uses parent_configuration for self-referential relationships
- [Phase 09-03]: extract_configurations() merges both entity types into unified list with self-FK populated at extract time from hasSetup links
- [Phase 09-03]: setup_* junction tables removed from ETL; data flows through unified configuration_* tables with configuration_id FK
- [Phase 09]: Three-migration split: table creation (10000), junction consolidation (11000), FK backfill and public.model drop (12000)
- [Phase 09]: self-FK model_configuration_id as discriminator: NULL=Configuration, non-NULL=Setup rows in unified modelcatalog_configuration table
- [Phase 09]: modelIOFromCatalogGQL helper added alongside existing modelIOFromGQL to handle new catalog junction shape
- [Phase 09]: CatalogDatasetSpec and CatalogModelConfiguration interfaces moved inline to service files after removal from adapter
- [Phase 10]: model-executions query rewritten to start from execution table using modelcatalog_configuration relationship (dropped model table removed)
- [Phase 10]: Delete-before-FK-add pattern used for execution_data_binding and execution_result because model_io_id is part of PK (cannot be nulled)
- [Phase 10]: execution_result table included in FK repoint migration alongside execution_data_binding (both reference model_io)

### Roadmap Evolution

- Phase 1 added: Test all POST endpoints and create status/error summary
- Phase 2 added: Fix JWT signature verification error on POST endpoints
- Phase 3 added: Fix nested resource creation - link or create associated resources when creating parent resource
- Phase 5 added: Variable Migration Analysis: TriG/Fuseki to Hasura
- Phase 6 added: Ensemble manager Tapis integration tests
- Phase 7 added: Test coverage for model catalog migration - verify GraphQL adapter, service layer, and architecture changes
- Phase 8 added: Remove Model Catalog API adapter functions (modelConfigurationToGraphQL, modelConfigurationSetupToGraphQL) - post-migration cleanup
- Phase 9 added: Merge ModelConfiguration/Setup tables and migrate thread_model relationships
- Phase 10 added: Check the required changes on mint-ensemble-manager after migration
- Phase 11 added: Simplify ensemble manager and UI execution model — kill thread_model_execution junction

### Pending Todos

- [config] Centralize execution config in ensemble-manager, UI fetches via API — `.planning/todos/pending/2026-04-26-centralize-execution-config-in-ensemble-manager-ui-fetches-v.md`
- [deployment] Secure dynamo-values.yaml secrets — avoid committing plaintext credentials — `.planning/todos/pending/2026-04-26-secure-dynamo-values-yaml-secrets.md`

### Blockers/Concerns

None — v2.0 milestone complete.

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 260326-uar | Fix /models endpoint to return Model subclass types | 2026-03-27 | 34587d2 | Verified | [260326-uar-fix-model-not-returned-by-v2-api-id-mism](./quick/260326-uar-fix-model-not-returned-by-v2-api-id-mism/) |
| 260326-uun | Fix JWT signature verification error - configure Hasura webhook auth for Tapis JWT tokens | 2026-03-27 | 4f10173 | Verified | [260326-uun-fix-jwt-signature-verification-error-con](./quick/260326-uun-fix-jwt-signature-verification-error-con/) |
| 260326-v3p | Fix POST models mutation - map camelCase API fields to snake_case Hasura columns | 2026-03-27 | baf99e5 | Verified | [260326-v3p-fix-post-models-mutation-map-camelcase-a](./quick/260326-v3p-fix-post-models-mutation-map-camelcase-a/) |
| 260326-vn8 | Default model type to sdm#Model when POST body omits type field | 2026-03-27 | 43088a6 | Verified | [260326-vn8-default-model-type-to-sdm-model-when-pos](./quick/260326-vn8-default-model-type-to-sdm-model-when-pos/) |
| 260326-w98 | Scope default type assignment to modelcatalog_software only | 2026-03-27 | 0402865 | Verified | [260326-w98-modelconfiguration-doesn-t-type-model-so](./quick/260326-w98-modelconfiguration-doesn-t-type-model-so/) |
| 260328-f39 | Add software-category junction, ETL extraction, Hasura table, and API category support | 2026-03-28 | f7d6a8f | Verified | [260328-f39-add-software-category-junction-etl-extra](./quick/260328-f39-add-software-category-junction-etl-extra/) |
| 260328-hu8 | Create script to automate MINT hasura/model-catalog deployment | 2026-03-28 | ace51d4 | Verified | [260328-hu8-create-script-to-automate-mint-hasura-mo](./quick/260328-hu8-create-script-to-automate-mint-hasura-mo/) |
| 260328-igb | Fix timeintervals API parsing error - intervalUnit expects String but receives Object | 2026-03-28 | 747a1c6 | Verified | [260328-igb-fix-timeintervals-api-parsing-error-inte](./quick/260328-igb-fix-timeintervals-api-parsing-error-inte/) |
| 260328-mc-cat | Add hasModelCategory junction for modelconfiguration and modelconfigurationsetup | 2026-03-28 | b5b6174 | Verified | — |
| 260328-n8j | Add live HTTP integration tests for junction-based relationship CRUD | 2026-03-28 | da78c6f | Complete | [260328-n8j-add-integration-test-to-the-changes-perf](./quick/260328-n8j-add-integration-test-to-the-changes-perf/) |
| 260328-oa7 | Add junction integration tests for modelconfigurations, modelconfigurationsetups, parameters | 2026-03-28 | 33ccb2b | Complete | [260328-oa7-add-more-integration-tests-for-junction-](./quick/260328-oa7-add-more-integration-tests-for-junction-/) |
| 260328-p5m | Fix parameters junction integration test - POST returns 400 due to missing label column | 2026-03-28 | 4ab6cbe | Needs Review | [260328-p5m-fix-parameters-junction-integration-test](./quick/260328-p5m-fix-parameters-junction-integration-test/) |
| 260328-q36 | Add junction integration tests for softwareversions/hasInputVariable and modelconfigurationsetups/calibratedVariable | 2026-03-28 | a7ccc32 | Complete | [260328-q36-add-junction-integration-tests-for-stand](./quick/260328-q36-add-junction-integration-tests-for-stand/) |
| 260328-r01 | Variable migration analysis: TriG/Fuseki to Hasura | 2026-03-28 | a21ed7b | Complete | [260328-r01-analyze-variables-hasura-vs-trig-fuseki](./quick/260328-r01-analyze-variables-hasura-vs-trig-fuseki/) |
| 260405-nrv | Fix GraphQL query referencing old model table and threadFromGQL adapter | 2026-04-05 | f5c8875 | Verified | [260405-nrv-fix-graphql-query-referencing-old-model-](./quick/260405-nrv-fix-graphql-query-referencing-old-model-/) |
| 260411-hb5 | Add filtering info and toggles (time, region, variables) to dataset selection view | 2026-04-11 | b89305a | Verified | [260411-hb5-add-filtering-info-and-toggles-time-regi](./quick/260411-hb5-add-filtering-info-and-toggles-time-regi/) |
| 260411-nis | Fix UI GraphQL fragments selecting dropped execution.model_id column | 2026-04-11 | 43e4b00 | Needs Review | [260411-nis-ui-has-outdated-query-looking-model-id-o](./quick/260411-nis-ui-has-outdated-query-looking-model-id-o/) |
| 260426-fk5 | Fix Apollo field 'model' not found in type 'thread_model' in mint-ensemble-manager | 2026-04-26 | 7661979 | Complete | [260426-fk5-fix-apollo-field-model-not-found-in-type](./quick/260426-fk5-fix-apollo-field-model-not-found-in-type/) |

## Session Continuity

Last session: 2026-04-26T20:26:15.030Z
Stopped at: Phase 11 context gathered
Resume file: .planning/phases/11-simplify-ensemble-manager-and-ui-execution-model-kill-thread/11-CONTEXT.md
