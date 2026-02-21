# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-14)

**Core value:** All model catalog data accessible through a single GraphQL endpoint, eliminating the Fuseki dependency while maintaining REST API compatibility.
**Current focus:** Phase 3 - Fuseki Migration and Cleanup

## Current Position

Phase: 2 of 3 (API Integration - gap closure plans complete)
Plan: 9 of 9 in current phase (02-09 complete, Phase 2 done)
Status: Complete (Phase 2)
Last activity: 2026-02-21 -- Completed plan 02-09 (null-table resource types return empty read responses)

Progress: [███████████] 80% (Phase 1 complete + Phase 2 complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 14
- Average duration: 5.0 minutes
- Total execution time: 1.10 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-schema-and-data-migration | 7 | 39.8 min | 5.7 min |
| 02-api-integration | 9 | 42.2 min | 4.7 min |

**Recent Trend:**
- Last 5 plans: 5.8 min, 3 min, 5.2 min, 6.7 min, 2 min, 4 min
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

### Pending Todos

None yet.

### Blockers/Concerns

- FK migration (Phase 3) is highest risk -- mixed data in `model` table needs careful classification before migration
- Research confidence on migration strategy is MEDIUM -- specifics need validation against actual data
- Performance benchmarks of current system not yet captured (needed for Phase 2 contract testing)

## Session Continuity

Last session: 2026-02-21
Stopped at: Completed 02-09-PLAN.md (null-table resource types return empty read responses)
Resume file: .planning/phases/03-fuseki-migration/03-01-PLAN.md (Phase 3 next)
