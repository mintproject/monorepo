# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-14)

**Core value:** All model catalog data accessible through a single GraphQL endpoint, eliminating the Fuseki dependency while maintaining REST API compatibility.
**Current focus:** Phase 2 - API Integration

## Current Position

Phase: 2 of 3 (API Integration)
Plan: 4 of 7 in current phase
Status: In Progress
Last activity: 2026-02-21 -- Completed plan 02-03 (Response/Request Mappers and Resource Registry)

Progress: [████░░░░░░] 38% (Phase 1 complete + 3/7 in Phase 2)

## Performance Metrics

**Velocity:**
- Total plans completed: 10
- Average duration: 3.3 minutes
- Total execution time: 0.82 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-schema-and-data-migration | 7 | 39.8 min | 5.7 min |
| 02-api-integration | 3 | 12.0 min | 4.0 min |

**Recent Trend:**
- Last 5 plans: 4 min, 4.2 min, 2.3 min, 5.8 min, 3 min, 5.2 min
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

### Pending Todos

None yet.

### Blockers/Concerns

- FK migration (Phase 3) is highest risk -- mixed data in `model` table needs careful classification before migration
- Research confidence on migration strategy is MEDIUM -- specifics need validation against actual data
- Performance benchmarks of current system not yet captured (needed for Phase 2 contract testing)

## Session Continuity

Last session: 2026-02-21
Stopped at: Completed 02-03-PLAN.md (Response/Request Mappers and Resource Registry)
Resume file: .planning/phases/02-api-integration/02-04-PLAN.md (next plan)
