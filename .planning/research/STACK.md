# Technology Stack Research

**Project:** RDF-to-PostgreSQL/GraphQL Migration (DYNAMO)
**Researched:** 2026-02-14
**Confidence:** MEDIUM (based on training data, project context verified)

## Recommended Stack

### Database Layer
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| PostgreSQL | 16.x | Primary data store | Already in MINT stack, excellent JSONB support for semi-structured metadata, ACID guarantees |

**Rationale:** PostgreSQL is already the MINT database. The 4-level hierarchy maps naturally to relational tables with foreign keys.

### GraphQL Layer
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Hasura GraphQL Engine | v2.36+ | Auto-generated GraphQL API | Already in MINT, instant GraphQL from PostgreSQL schema, subscriptions, permissions |
| Hasura CLI | Latest | Schema migrations | Version-controlled metadata and database migrations |

**Rationale:** Hasura is already deployed. Reusing it avoids new technology introduction.

### REST API Layer
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| FastAPI | 0.110+ | REST API for external consumers | Already in use, must maintain backward compatibility |
| Pydantic | v2.6+ | Data validation and serialization | Type-safe validation, FastAPI integration |
| SQLAlchemy | 2.0+ | Database access for FastAPI | Mature ORM, async support, works well with FastAPI |
| httpx | 0.27+ | HTTP client for Hasura queries | Async HTTP client for FastAPI to query Hasura GraphQL |

**Rationale:** FastAPI acts as compatibility shim. Queries Hasura/PostgreSQL internally, returns same JSON as old Fuseki-backed API.

### Migration Tools
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Python | 3.11+ | Migration scripts | Existing MINT stack language |
| rdflib | 7.0+ | RDF/TriG parsing | Standard Python library for RDF; parse the .trig data dump |
| json | stdlib | JSON processing | Data is available as JSON from existing REST API |

**Rationale:** Python-based migration reuses existing MINT patterns. rdflib handles the TriG data dump natively.

### Testing & Validation
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| pytest | 8.0+ | Test framework | Standard Python testing |
| pytest-asyncio | 0.23+ | Async test support | Required for testing FastAPI async endpoints |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Database | PostgreSQL | MongoDB | MINT already uses PostgreSQL; hierarchy is relational |
| GraphQL | Hasura | Strawberry/Ariadne | Custom servers need more code; Hasura is already deployed |
| ORM | SQLAlchemy 2.0 | Django ORM | FastAPI already in stack; Django adds unnecessary weight |
| Migration | Python scripts | Ontop/D2RQ | Those are for virtual RDF-to-SQL mapping, not permanent migration |
| Migration | Python scripts | RML (R2RML) | R2RML is for RDB-to-RDF (opposite direction) |

## Schema Strategy: Relational with modelcatalog_ Prefix

```sql
-- 4-level hierarchy
modelcatalog_software (id, label, description, ...)
modelcatalog_software_version (id, software_id FK, version_id, ...)
modelcatalog_model_configuration (id, software_version_id FK, ...)
modelcatalog_model_configuration_setup (id, model_configuration_id FK, ...)

-- I/O, parameters, variables as related tables
modelcatalog_input (id, model_configuration_id FK, ...)
modelcatalog_output (id, model_configuration_id FK, ...)
modelcatalog_parameter (id, model_configuration_id FK, ...)
```

## Anti-Patterns to Avoid

- **Don't** use RDF-to-SQL automatic mapping tools (Ontop, D2RQ) -- these are for virtual views, not migration
- **Don't** store triples in a generic (subject, predicate, object) table -- defeats purpose of relational
- **Don't** duplicate data in both PostgreSQL and Fuseki long-term
- **Don't** store all metadata as JSONB -- loses queryability for core fields

## Sources

Based on training data and MINT project context (existing PostgreSQL, Hasura, FastAPI stack).
