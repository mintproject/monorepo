# Research Summary

**Project:** DYNAMO Model Catalog GraphQL Migration
**Date:** 2026-02-14

## Key Findings

### Stack
- **No new infrastructure needed** -- PostgreSQL, Hasura, FastAPI are all already in the MINT stack
- **Migration tooling:** Python + rdflib for parsing TriG dump, standard SQLAlchemy/psycopg2 for loading
- **Schema strategy:** Dedicated `modelcatalog_*` prefixed tables alongside existing tables
- **Anti-pattern to avoid:** Don't use RDF-to-SQL automatic mapping tools (Ontop, D2RQ) -- they're for virtual views

### Features
- **10 table-stakes features** centered on: schema design, data migration, FK preservation, API compatibility
- **5 differentiators** that come nearly free from Hasura: nested queries, subscriptions, permissions, search
- **7 anti-features** to explicitly avoid: SPARQL endpoints, triple store emulation, UI migration
- **MVP scope:** Schema + data migration + API update, then FK migration as separate phase

### Architecture
- **ETL pipeline:** TriG/JSON extraction -> Python transformation -> PostgreSQL loading -> Hasura exposure
- **Staged migration pattern:** New tables alongside old, gradual FK migration, eventual old table deprecation
- **Build order:** Schema first -> Data loading -> Hasura config -> FastAPI update -> FK migration -> Fuseki removal
- **Key boundary:** FastAPI becomes thin REST wrapper over Hasura GraphQL

### Pitfalls (Top 3)
1. **Mixed data in `model` table** -- Must classify each row as config vs setup BEFORE FK migration
2. **Breaking execution/thread FK chains** -- Use dual-column approach (add new FK, backfill, drop old)
3. **FastAPI response format drift** -- Capture golden files of current responses for contract testing

## Implications for Roadmap

### Phase Structure (Recommended)
1. **Schema + Data Migration** -- Design modelcatalog_* tables, create Hasura migrations, ETL data from TriG/JSON, validate
2. **API Integration** -- Update FastAPI to query Hasura/PostgreSQL, ensure backward compatibility, update Ensemble Manager
3. **FK Migration + Cleanup** -- Classify model rows, migrate execution/thread FKs, remove Fuseki dependency

### Critical Dependencies
- Schema design blocks EVERYTHING -- get this right first
- Data must be loaded and validated before any API changes
- FK migration is highest risk -- do it last, with rollback plan
- FastAPI contract tests must be written BEFORE changing the backend

### Risk Mitigation
- Keep Fuseki running during entire migration for rollback
- Use feature flags to switch between old and new backends
- Validate at every phase boundary (counts, samples, FK integrity)
- Test with production data copy, not just dev data

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack choices | HIGH | All technologies already in MINT |
| Schema approach | HIGH | 4-level hierarchy well understood from RDF ontology |
| Migration strategy | MEDIUM | Staged approach is standard but specifics need validation against actual data |
| FK migration | MEDIUM | Highest risk area; mixed model table needs careful classification |
| Performance | LOW | Need benchmarks of current system to set targets |

## Open Questions for Planning

1. How many entities per level in the hierarchy? (affects batch sizing)
2. What's the actual distribution of configs vs setups in current `model` table?
3. Which existing REST endpoints are used by external consumers? (prioritize compatibility testing)
4. Is the TriG dump or JSON API the better data source? (need to compare completeness)
5. What Hasura version is currently deployed?
