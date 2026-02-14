# Feature Landscape

**Domain:** RDF-to-PostgreSQL/GraphQL Migration (Model Catalog)
**Researched:** 2026-02-14

## Table Stakes (Must-Have)

| # | Feature | Complexity | Why Table Stakes |
|---|---------|------------|-----------------|
| 1 | 4-level hierarchy schema | High | Core data model: Software > SoftwareVersion > ModelConfiguration > ModelConfigurationSetup |
| 2 | Complete data migration | High | All RDF entities must transfer without data loss |
| 3 | FK backward compatibility | High | execution/thread tables have FKs to current model tables |
| 4 | FastAPI REST preservation | Medium | External consumers depend on REST API permanently |
| 5 | URI/ID mapping | Medium | RDF URIs must map to PostgreSQL IDs; maintain lookup for reference |
| 6 | GraphQL schema via Hasura | Low | Hasura auto-generates from PostgreSQL tables |
| 7 | I/O, parameter, variable tables | High | Model inputs, outputs, parameters, variables must migrate |
| 8 | Query performance parity | Medium | Must match or exceed current Fuseki/SPARQL performance |
| 9 | Data validation | Medium | Verify migrated data integrity and completeness |
| 10 | Migration rollback capability | Medium | Keep Fuseki running in parallel during initial deployment |

## Differentiators (Value-Add)

| # | Feature | Complexity | Value |
|---|---------|------------|-------|
| 11 | GraphQL nested queries | Low | Fetch model + versions + configs in one query (Hasura provides) |
| 12 | Real-time subscriptions | Low | GraphQL subscriptions for catalog changes (Hasura provides) |
| 13 | Full-text search | Medium | PostgreSQL FTS on descriptions/documentation |
| 14 | Fine-grained permissions | Medium | Row-level security via Hasura |
| 15 | Audit trail | Medium | Track changes with timestamps and user attribution |

## Anti-Features (Deliberately Not Building)

| Anti-Feature | Why Avoid |
|--------------|-----------|
| Full SPARQL endpoint | Defeats migration purpose |
| Triple store emulation | Use proper relational schema |
| Real-time Fuseki sync | One-way migration only |
| Custom ORM/query builder | Use SQLAlchemy + Hasura |
| GraphQL mutations initially | Keep REST for writes initially; add later |
| Inference/reasoning engine | PostgreSQL isn't designed for this |
| UI migration to GraphQL | Explicitly out of scope |

## Feature Dependencies

```
Schema design (#1) --> Data migration (#2)
Schema design (#1) --> Hasura GraphQL (#6)
Schema design (#1) --> I/O tables (#7)
Data migration (#2) --> Data validation (#9)
URI/ID mapping (#5) --> Data migration (#2)
Hasura GraphQL (#6) --> FastAPI REST update (#4)
Data validation (#9) --> FK migration (#3)
```

## MVP Scope

**Phase 1 (Core):** #1, #2, #5, #6, #7, #9
**Phase 2 (Integration):** #4, #8, #10
**Phase 3 (FK Migration):** #3
**Phase 4 (Enhancement):** #11-15

## Sources

Based on DYNAMO project context, existing MINT schema analysis, and RDF-to-relational migration patterns.
