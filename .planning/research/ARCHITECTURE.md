# Architecture Patterns: RDF-to-PostgreSQL Migration

**Project:** DYNAMO Model Catalog Migration (Fuseki -> PostgreSQL/Hasura)
**Researched:** 2026-02-14
**Confidence:** MEDIUM

## Recommended Architecture

```
+---------------+        +------------------+        +-----------------+
|               |        |                  |        |                 |
|   Fuseki      |------->|  ETL Pipeline    |------->|   PostgreSQL    |
|  (Source)     | JSON/  |  (Python)        |  SQL   | modelcatalog_*  |
|  .trig dump   | TriG   |                  |        |                 |
+---------------+        +------------------+        +-----------------+
                                                              |
                                                              v
                                                     +----------------+
                                                     |    Hasura      |
                                                     |   GraphQL      |
                                                     +----------------+
                                                              |
                                                              v
                                                     +----------------+
                                                     |   FastAPI      |
                                                     |   (REST)       |
                                                     +----------------+
```

## Component Boundaries

### 1. Data Extraction (Source)
- **Input:** TriG dump file (`model-catalog-tacc.trig`) or JSON from existing REST API
- **Output:** Python dicts/objects representing RDF entities
- **Technology:** rdflib for TriG parsing, or requests/httpx for JSON API
- **Boundary:** Knows RDF structure, produces domain objects. No SQL knowledge.

### 2. Schema Definition (Hasura Migrations)
- **Input:** Schema design decisions
- **Output:** Hasura migration SQL files in `graphql_engine/migrations/`
- **Technology:** Hasura CLI migrations
- **Boundary:** Defines `modelcatalog_*` tables, relationships, metadata. No data logic.

### 3. Data Loading (ETL)
- **Input:** Domain objects from extraction
- **Output:** Rows in `modelcatalog_*` PostgreSQL tables
- **Technology:** Python + psycopg2 or SQLAlchemy
- **Boundary:** Maps domain objects to relational rows. Handles ID generation, FK resolution.

### 4. Validation Engine
- **Input:** Source data (RDF) and target data (PostgreSQL)
- **Output:** Validation report (counts, integrity, sample comparison)
- **Technology:** Python scripts
- **Boundary:** Read-only. Never modifies data.

### 5. FastAPI REST Layer (Updated)
- **Input:** HTTP requests from external consumers
- **Output:** JSON responses matching existing API contract
- **Technology:** FastAPI + httpx (querying Hasura) or SQLAlchemy (querying PostgreSQL directly)
- **Boundary:** Thin translation layer. No business logic beyond response formatting.

### 6. Ensemble Manager Integration (Updated)
- **Input:** Model catalog queries from execution workflows
- **Output:** Model metadata for execution
- **Technology:** GraphQL queries to Hasura (replacing REST client calls)
- **Boundary:** Consumes GraphQL API. No direct database access.

## Data Flow

### Migration Flow (One-Time)
1. Parse TriG dump or fetch JSON from existing API
2. Extract entities by type (Software, SoftwareVersion, ModelConfiguration, ModelConfigurationSetup)
3. Generate PostgreSQL IDs, maintain URI-to-ID mapping
4. Insert in hierarchy order: Software first, then Version, then Config, then Setup
5. Insert related entities: inputs, outputs, parameters, variables
6. Validate: count checks, sample deep comparison, FK integrity

### Query Flow (Post-Migration)
1. Client (UI or external) calls FastAPI REST endpoint
2. FastAPI queries Hasura GraphQL (or PostgreSQL directly)
3. Hasura resolves against `modelcatalog_*` tables
4. FastAPI formats response to match legacy API contract
5. Client receives same JSON structure as before

## Migration Execution Pattern: Staged with Parallel Tables

**Recommended for DYNAMO** because:
- Zero downtime (new tables created alongside existing)
- Rollback easy (just drop new tables)
- FK migration can happen in a later phase

**Steps:**
1. Create `modelcatalog_*` tables (does NOT touch existing `model` tables)
2. Load data into `modelcatalog_*` tables
3. Configure Hasura to track new tables
4. Update FastAPI to query new tables
5. (Later) Migrate FKs from `execution`/`thread_model` to new tables
6. (Later) Deprecate old `model`/`model_io`/`model_parameter` tables

## Build Order (Dependencies)

### Phase 1: Schema + Data (Foundation)
1. Design `modelcatalog_*` schema -- blocks everything else
2. Create Hasura migration -- needs schema design
3. Write ETL extraction scripts -- can parallel with #2
4. Write ETL loading scripts -- needs migration applied (#2)
5. Run migration + validate -- needs #3, #4

### Phase 2: API Integration
6. Update FastAPI to query Hasura/PostgreSQL -- needs data loaded (#5)
7. Ensure REST API backward compatibility -- needs #6
8. Update Ensemble Manager GraphQL queries -- needs Hasura tracking (#2)

### Phase 3: FK Migration + Cleanup
9. Classify existing `model` table rows -- needs new tables populated (#5)
10. Add FK columns pointing to `modelcatalog_*` tables -- needs #9
11. Migrate `execution`/`thread_model` FKs -- needs #10
12. Remove Fuseki dependency -- needs all above verified

## Anti-Patterns to Avoid

| Anti-Pattern | Why Bad | Instead |
|--------------|---------|---------|
| Direct RDF-to-SQL auto-mapping | Over-normalized, poor query performance | Design relational schema for query patterns |
| Generic triple table (s,p,o) | Defeats purpose of relational migration | Fully normalize into domain tables |
| Two-way sync Fuseki<->PostgreSQL | Complex, race conditions | One-way migration, then cutover |
| Row-by-row inserts | Slow, locks tables | Batch inserts (1000+ rows per transaction) |
| Ignoring NULL semantics | RDF missing property != empty string | Use nullable columns for optional properties |
| Migrating without validation | Silent data loss | Always validate counts, samples, constraints |

## Integration Points with Existing MINT

| Component | Current State | Post-Migration State |
|-----------|--------------|---------------------|
| UI (LitElement) | Queries FastAPI + `@mintproject/modelcatalog_client` | No change (out of scope) |
| FastAPI | Queries Fuseki via SDK | Queries Hasura/PostgreSQL |
| Ensemble Manager | Uses `@mintproject/modelcatalog_client` | Uses GraphQL queries to Hasura |
| Hasura | Tracks model/model_io tables | Tracks modelcatalog_* tables |
| PostgreSQL | model/model_io/model_parameter tables | + modelcatalog_* tables |
| Fuseki | Source of truth for model catalog | Decommissioned |

## Sources

Based on DYNAMO project context, existing MINT codebase analysis, and established RDF-to-relational migration patterns.
