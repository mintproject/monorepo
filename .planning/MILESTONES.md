# Milestones

## Completed

### v1.0 — Model Catalog GraphQL Migration

**Completed:** 2026-02-21
**Phases:** 1-2 (of 3 planned; Phase 3 FK Migration deferred)
**Duration:** ~1.3 hours execution time across 15 plans

**What shipped:**
- Phase 1: Schema and Data Migration — 12+ modelcatalog_* PostgreSQL tables, Hasura metadata, ETL pipeline from TriG dump
- Phase 2: API Integration — Node.js/TypeScript REST API at /v2.0.0/ backed by Hasura/PostgreSQL, identical responses to v1.8.0

**What's deferred:**
- Phase 3: FK Migration and Cleanup — Migrate execution/thread FKs to new tables, remove Fuseki dependency

**Key metrics:**
- 15 plans completed
- Average plan duration: 5.5 minutes
- 36 database tables created
- 46 REST resource types served via new API

---

## Current

### v2.0 — UI React Migration

See PROJECT.md for details.
