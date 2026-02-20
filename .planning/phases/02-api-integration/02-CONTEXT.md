# Phase 2: API Integration - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the current Python/FastAPI REST API (backed by Fuseki/SPARQL) with a new Node.js/TypeScript API server (backed by Hasura/PostgreSQL). The new API serves identical responses at /v2.0.0/ while the old API remains at /v1.8.0/ for parallel validation. Ensemble Manager is NOT touched -- it stays as-is and continues using the existing SDK against the REST API.

**Note:** The existing roadmap plans (02-01 FastAPI HasuraBackend, 02-02 Ensemble Manager GraphQL) are superseded by this context. The approach changed from "rewire FastAPI" to "clean rewrite in Node.js" and Ensemble Manager updates are deferred.

</domain>

<decisions>
## Implementation Decisions

### Technology Stack
- Clean rewrite in Node.js/TypeScript (not incremental FastAPI replacement)
- Fastify framework for the REST server
- Apollo Client for GraphQL queries to Hasura
- Reuse the existing OpenAPI spec (v1.8.0) to drive Fastify route generation, bumped to v2.0.0
- New separate repo: mintproject/model-catalog-api
- Hasura migrations and metadata stay in this repo (mint)
- Match existing authentication approach
- Node.js preferred over Python for GraphQL ecosystem maturity and code reuse potential; researcher should compare tradeoffs before locking in

### Ensemble Manager
- Already a Node.js API -- do NOT touch it in this phase
- Must maintain REST compatibility so the existing `@mintproject/modelcatalog_client` SDK continues working unchanged
- Ensemble Manager updates deferred to a later phase if needed

### API Versioning
- URL path prefix versioning, continuing semver pattern: /v2.0.0/
- New API serves only /v2.0.0/ endpoints
- Old API (v1.8.0) stays running on the existing FastAPI/Fuseki stack for parallel testing
- Both accessible at same domain: api.models.mint.tacc.utexas.edu
- After cutover, /v1.8.0/ paths return 301 redirect to /v2.0.0/

### Response Format
- v2.0.0 responses are identical to v1.8.0 -- no format changes
- Keep array wrapping for all values (e.g., `"label": ["CYCLES"]`)
- Keep URI-based IDs (e.g., `"id": "https://w3id.org/okn/i/mint/CYCLES"`)
- Keep existing field names (`id`, `type`, `label`, `hasVersion`, etc.)
- Keep `username` query parameter for scoping
- No JSON-LD artifacts to remove -- current API already uses plain `id`/`type` fields

### GraphQL Exposure
- Hasura GraphQL endpoint exposed publicly (direct access, not proxied through Fastify)
- REST is primary/documented interface; GraphQL is available as a bonus
- Multiple external consumers exist -- REST compatibility is critical

### Data Operations
- Full CRUD (GET, POST, PUT, DELETE) from day one
- All reads and writes go through Hasura GraphQL (queries and mutations)
- Once v2 is deployed, writes go to PostgreSQL; Fuseki becomes stale and that's acceptable

### Migration Strategy
- Brief parallel period (days), then cut DNS/routing to v2
- Automated comparison tool: call both APIs for every endpoint and diff responses
- Fuseki kept running (unused) until Phase 3 cleanup

### Deployment / DevOps
- Helm subchart added to this repo's helm-charts/ directory
- CI/CD pipeline (GitHub Actions): lint, test, build Docker image, push to Docker Hub
- Container image: docker.io/mintproject/model-catalog-api
- Hasura URL configured via environment variable (HASURA_GRAPHQL_URL)
- Health endpoint (/health) checking Hasura connectivity
- Structured JSON logging with request IDs and timing

### Claude's Discretion
- Comparison tool placement (new repo test suite vs this repo)
- Error handling and timeout policies for Hasura communication
- Specific Fastify plugins for OpenAPI-driven routing
- Resource limits and scaling configuration in Helm chart

</decisions>

<specifics>
## Specific Ideas

- Reuse the existing OpenAPI spec from v1.8.0 to generate/validate Fastify routes -- the spec is the contract
- Run old and new APIs side by side at the same domain for validation before cutover
- "You can see https://api.models.mint.tacc.utexas.edu/v1.8.0/models?username=mint@isi.edu" -- this is the reference for expected response format
- Node.js motivation is code reuse potential between services (shared GraphQL client, types, utilities)

</specifics>

<deferred>
## Deferred Ideas

- Ensemble Manager GraphQL migration (currently uses REST SDK -- keep as-is for now)
- Fuseki removal from deployment stack -- Phase 3
- Response format improvements (unwrapping single-value arrays, cleaner naming) -- future version
- Prometheus metrics and full observability -- future enhancement

</deferred>

---

*Phase: 02-api-integration*
*Context gathered: 2026-02-20*
