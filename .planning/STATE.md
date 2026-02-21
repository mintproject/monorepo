# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** Researchers can browse, register, configure, and compare models through a modern React interface backed entirely by the Hasura GraphQL endpoint.
**Current focus:** Milestone v2.0 — UI React Migration

## Current Position

Phase: Not started (defining requirements)
Plan: --
Status: Defining requirements
Last activity: 2026-02-21 -- Milestone v2.0 started

## Performance Metrics

**Velocity (from v1.0):**
- Total plans completed: 15
- Average duration: 5.5 minutes
- Total execution time: 1.27 hours

## Accumulated Context

### Decisions

- [v1.0]: Fresh modelcatalog_* tables with 4-level hierarchy (Software > Version > Config > Setup)
- [v1.0]: FastAPI as thin REST layer over Hasura
- [v1.0]: Keep old model tables during migration (FK migration deferred)
- [v2.0]: Standalone React app at ui-react/ (not hybrid with LitElement)
- [v2.0]: GraphQL only (no REST API dependency)
- [v2.0]: Modern defaults stack (React 19, React Router, TanStack Query, Material UI)

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 3 FK migration from v1.0 still pending (Fuseki runs in parallel)
- Hasura GraphQL schema for regions needs verification (current region queries may use different patterns)

## Session Continuity

Last session: 2026-02-21
Stopped at: Milestone v2.0 initialization
Resume file: --
