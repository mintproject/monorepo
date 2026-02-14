# Pitfalls: RDF-to-PostgreSQL Migration

**Project:** DYNAMO Model Catalog Migration
**Researched:** 2026-02-14

## Critical Pitfalls

### P1: Mixed Data in Current `model` Table
**Risk:** HIGH | **Phase:** Schema Design + FK Migration

**Problem:** Current `model` table contains both ModelConfigurations and ModelConfigurationSetups mixed together. If you don't properly classify each row before migrating FKs, `execution.model_id` will point to the wrong `modelcatalog_*` table.

**Warning Signs:**
- Queries returning unexpected model types
- FK constraint violations during migration
- Execution records pointing to configurations instead of setups (or vice versa)

**Prevention:**
- Audit ALL existing `model` rows before migration -- classify each as config vs setup
- Create explicit mapping table: `model.id -> modelcatalog_model_configuration.id` or `model.id -> modelcatalog_model_configuration_setup.id`
- Validate mapping with domain expert before executing FK migration
- Never assume 1:1 mapping between old and new tables

### P2: Breaking execution/thread FK Chains
**Risk:** CRITICAL | **Phase:** FK Migration

**Problem:** `execution`, `execution_data_binding`, `execution_parameter_binding`, `thread_model`, `thread_model_io`, `thread_model_parameter` all have FKs into current model tables. Migrating these FKs incorrectly breaks the execution history.

**Warning Signs:**
- FK constraint violations when altering tables
- Orphaned execution records
- Historical thread data becoming inaccessible

**Prevention:**
- Map ALL FK dependencies before starting (already identified in codebase analysis)
- Migrate FKs in a separate phase AFTER new tables are populated and validated
- Use dual-column approach: add new FK column alongside old, backfill, then drop old
- Never drop old model tables until all FKs are migrated and verified
- Test with production data copy, not just dev data

### P3: RDF Multi-Valued Properties Lost in Relational Mapping
**Risk:** MEDIUM | **Phase:** Schema Design

**Problem:** RDF allows any property to have multiple values (e.g., a model with multiple authors, multiple keywords). Mapping to a single column silently drops values.

**Warning Signs:**
- Count mismatches between RDF and PostgreSQL
- Properties that appear to have fewer values after migration
- Users reporting missing metadata

**Prevention:**
- Audit RDF data for multi-valued properties before schema design
- Use junction tables for multi-valued relationships (not arrays, for queryability)
- Validate counts per entity type AND per property

### P4: URI-to-ID Mapping Collisions
**Risk:** MEDIUM | **Phase:** Data Loading

**Problem:** RDF URIs are globally unique but long. Converting to integer/UUID IDs risks collisions if URI extraction logic is wrong, or if two different URIs map to the same generated ID.

**Warning Signs:**
- Duplicate key violations during insertion
- Fewer records in PostgreSQL than in RDF
- Wrong data associated with entities

**Prevention:**
- Use auto-incrementing integers or UUIDs for PostgreSQL IDs (not derived from URIs)
- Maintain explicit `uri_id_mapping` lookup table
- Store original URI as a column in each `modelcatalog_*` table for reference
- Validate uniqueness constraints before and after migration

### P5: FastAPI Response Format Drift
**Risk:** HIGH | **Phase:** API Integration

**Problem:** When FastAPI switches from Fuseki-backed to PostgreSQL-backed queries, subtle differences in response format (null vs missing field, date format, nested object structure) break clients.

**Warning Signs:**
- API tests failing with assertion errors on response shape
- External consumers reporting errors after deployment
- Fields that were previously objects now returned as IDs (or vice versa)

**Prevention:**
- Capture current API responses as golden files BEFORE starting migration
- Write contract tests comparing old vs new responses field-by-field
- Test with actual external consumer code if possible
- Use Pydantic models to enforce response schema consistency

### P6: Hierarchy Depth Assumptions
**Risk:** MEDIUM | **Phase:** Schema Design

**Problem:** Assuming all models follow the full 4-level hierarchy (Software > Version > Config > Setup). Some models might skip levels or have incomplete hierarchies in the RDF data.

**Warning Signs:**
- NULL foreign keys in hierarchy columns
- Orphaned entities without parent
- Import scripts failing on unexpected hierarchy patterns

**Prevention:**
- Query RDF data to discover actual hierarchy patterns before designing schema
- Allow nullable FKs for intermediate hierarchy levels
- Handle partial hierarchies explicitly in schema design
- Document which hierarchy patterns exist in the data

### P7: Hasura Metadata Out of Sync
**Risk:** MEDIUM | **Phase:** Schema + Integration

**Problem:** Creating tables via SQL migration but forgetting to track them in Hasura metadata, or configuring relationships incorrectly.

**Warning Signs:**
- Tables exist in PostgreSQL but not visible in Hasura console
- GraphQL queries returning empty results despite data existing
- Missing relationships in GraphQL schema

**Prevention:**
- Use Hasura CLI for all schema changes (not raw SQL)
- Include metadata export in migration scripts
- Test GraphQL queries immediately after table creation
- Version control Hasura metadata alongside SQL migrations

### P8: Data Loading Order Violates FK Constraints
**Risk:** MEDIUM | **Phase:** Data Loading

**Problem:** Inserting child records before parent records (e.g., ModelConfigurationSetup before ModelConfiguration) causes FK violations.

**Warning Signs:**
- FK constraint violation errors during ETL
- Partial data loads with missing children
- Need to disable constraints (fragile workaround)

**Prevention:**
- Load in strict hierarchy order: Software -> Version -> Configuration -> Setup
- Load I/O and parameters after their parent configuration
- Use transactions per entity tree (parent + all children)
- If needed, defer FK constraints within transaction

### P9: Ignoring model_input_fixed_binding and model_io_variable
**Risk:** MEDIUM | **Phase:** Schema Design + Data Migration

**Problem:** Focusing only on the main hierarchy tables and forgetting junction/binding tables that link I/O to variables and fixed resources.

**Warning Signs:**
- Execution workflows failing because I/O bindings are missing
- Variables not associated with model inputs/outputs
- Fixed resource bindings lost

**Prevention:**
- Map ALL tables from existing schema, including junction tables
- Include `model_input_fixed_binding` and `model_io_variable` equivalents in new schema
- Validate these relationships in migration verification

### P10: Performance Regression from N+1 Queries
**Risk:** MEDIUM | **Phase:** API Integration

**Problem:** FastAPI endpoint that previously made one SPARQL query now makes N+1 queries (one for model, one per input, one per output, etc.).

**Warning Signs:**
- API response times significantly slower than before
- High database connection count
- Endpoint performance degrades with model complexity

**Prevention:**
- Use Hasura's relationship-aware queries (single GraphQL query resolves nested data)
- If using SQLAlchemy, use `joinedload` or `selectinload` for relationships
- Add database indexes on foreign key columns
- Benchmark against current API performance before deployment

## Phase Mapping Summary

| Pitfall | Phase 1 (Schema/Data) | Phase 2 (API) | Phase 3 (FK Migration) |
|---------|----------------------|---------------|----------------------|
| P1: Mixed model data | Classify rows | | Use classification |
| P2: Breaking FK chains | | | Primary concern |
| P3: Multi-valued properties | Schema audit | | |
| P4: URI-to-ID collisions | ID strategy | | |
| P5: Response format drift | | Contract tests | |
| P6: Hierarchy depth | Schema design | | |
| P7: Hasura metadata | Track tables | | |
| P8: Loading order | ETL scripts | | |
| P9: Junction tables | Include in schema | | |
| P10: N+1 queries | | Performance test | |

## Sources

Based on DYNAMO project context, existing MINT schema analysis (`up.sql`), and established RDF-to-relational migration patterns.
