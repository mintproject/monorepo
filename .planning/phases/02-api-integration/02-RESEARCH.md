# Phase 2: API Integration - Research

**Researched:** 2026-02-20
**Domain:** Node.js/TypeScript REST API with Fastify, serving OpenAPI-contract responses from Hasura/PostgreSQL
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Clean rewrite in Node.js/TypeScript (not incremental FastAPI replacement)
- Fastify framework for the REST server
- Apollo Client for GraphQL queries to Hasura (see note in Architecture section -- graphql-request is actually the better server-side choice; Apollo Client was listed but researcher recommends reconsideration)
- Reuse the existing OpenAPI spec (v1.8.0) to drive Fastify route generation, bumped to v2.0.0
- New separate repo: mintproject/model-catalog-api
- Hasura migrations and metadata stay in this repo (mint)
- Match existing authentication approach (Bearer JWT)
- Full CRUD from day one; all reads and writes go through Hasura GraphQL
- URL path prefix versioning: /v2.0.0/
- v2.0.0 responses identical to v1.8.0 -- same JSON structure, array wrapping, URI-based IDs
- Hasura GraphQL endpoint exposed publicly (not proxied through Fastify)
- Helm subchart added to helm-charts/ directory in this repo
- CI/CD: GitHub Actions, Docker Hub, image docker.io/mintproject/model-catalog-api
- Hasura URL via env var HASURA_GRAPHQL_URL
- Health endpoint /health checking Hasura connectivity
- Structured JSON logging with request IDs and timing

### Claude's Discretion
- Comparison tool placement (new repo test suite vs this repo)
- Error handling and timeout policies for Hasura communication
- Specific Fastify plugins for OpenAPI-driven routing
- Resource limits and scaling configuration in Helm chart

### Deferred Ideas (OUT OF SCOPE)
- Ensemble Manager GraphQL migration (keep REST SDK as-is)
- Fuseki removal from deployment stack -- Phase 3
- Response format improvements (unwrapping arrays, cleaner naming) -- future version
- Prometheus metrics and full observability -- future enhancement
</user_constraints>

---

## Summary

Phase 2 is a clean-room rewrite of the model-catalog REST API in Node.js/TypeScript using Fastify, consuming the existing OpenAPI 3.0 spec as the contract. The new API calls Hasura/PostgreSQL via GraphQL for all data operations, exposing identical JSON responses at `/v2.0.0/` while the old FastAPI stack continues running at `/v1.8.0/` for parallel validation.

The existing FastAPI codebase reveals the scope: 105 paths across 46 resource types plus 13 custom/search endpoints, all backed by SPARQL queries today. Mapping these to Hasura GraphQL queries and mutations is the central engineering challenge. The Hasura schema (39 modelcatalog tables) was built in Phase 1 and has SELECT permissions defined, but INSERT/UPDATE/DELETE permissions are not yet configured -- this is a required prerequisite for write operations.

The GraphQL client choice matters: the locked decision says Apollo Client, but for a server-side Node.js API (no UI, no reactive state, no caching benefits), `graphql-request` is lighter and the right tool. The planner should surface this tradeoff. Authentication flows through Bearer JWT tokens that are validated by Fastify and forwarded as-is to Hasura, where row-level permissions enforce user scoping.

**Primary recommendation:** Use `fastify-openapi-glue` (v4.10.2) to generate routes from the existing OpenAPI spec, `graphql-request` (v7.x) as the Hasura client, and `@graphql-codegen` to generate typed Hasura query/mutation functions from the schema.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fastify | v5.7.x | HTTP server | Fastest Node.js framework; native TypeScript; built-in schema validation |
| fastify-openapi-glue | v4.10.2 | Route generation from OpenAPI spec | Design-first plugin that reads existing spec and wires handlers automatically |
| graphql-request | v7.x | Hasura GraphQL client | Minimal, no cache overhead, ideal for server-side request-response; Apollo adds no value without a frontend |
| @graphql-codegen/cli | latest | Generate typed TS from Hasura schema | Eliminates hand-written query types; introspects Hasura endpoint |
| typescript | v5.x | Language | Locked decision |
| @types/node | latest | Node.js types | Required by Fastify TS docs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @fastify/cors | v10.x | CORS headers | Required -- existing API allows browser clients |
| @fastify/jwt | v9.x (Fastify 5) | JWT bearer token verification | Validate incoming Bearer tokens before forwarding to Hasura |
| @fastify/swagger | v9.x | Serve OpenAPI spec at /docs | Expose v2.0.0 spec at /v2.0.0/docs |
| @fastify/swagger-ui | latest | Swagger UI | Human-readable docs at /v2.0.0/docs/ui |
| pino | built-in | Structured JSON logging | Fastify uses Pino internally; configure serializers for request IDs |
| tsx | v4.x | TypeScript runner for dev | Zero-config TS execution; no build step in dev |
| vitest | v2.x | Unit and integration testing | Fast, native ESM, TypeScript-first |

### GraphQL Codegen Plugins
| Plugin | Purpose |
|--------|---------|
| @graphql-codegen/typescript | Base TypeScript types from schema |
| @graphql-codegen/typescript-operations | Types for each query/mutation |
| @graphql-codegen/typescript-graphql-request | Generates typed SDK wrapping graphql-request |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| graphql-request | Apollo Client (locked decision) | Apollo Client is designed for React/browser; its InMemoryCache is useless server-side and adds ~50KB; graphql-request is 21KB, promise-based, zero setup for server use. Recommend overriding this locked decision. |
| fastify-openapi-glue | hand-write all 105 routes | 105 paths = ~400 route registrations by hand; glue plugin handles validation, operationId mapping, and security handler wiring automatically |
| @fastify/jwt | passport-jwt, jsonwebtoken manually | @fastify/jwt integrates with Fastify's request lifecycle; v9 supports Fastify 5 |
| vitest | jest | Vitest is ESM-native; no transpilation needed; jest requires babel/ts-jest for ESM |

**Installation (new repo):**
```bash
npm install fastify fastify-openapi-glue graphql-request graphql @fastify/cors @fastify/jwt @fastify/swagger @fastify/swagger-ui
npm install -D typescript @types/node tsx vitest @graphql-codegen/cli @graphql-codegen/typescript @graphql-codegen/typescript-operations @graphql-codegen/typescript-graphql-request
```

---

## Architecture Patterns

### Recommended Project Structure
```
mintproject/model-catalog-api/
├── src/
│   ├── index.ts              # Fastify instance construction, plugin registration
│   ├── app.ts                # App factory (testable without listen())
│   ├── service.ts            # Service class implementing all operationId handlers
│   ├── security.ts           # Security handler class (JWT verification hook)
│   ├── hasura/
│   │   ├── client.ts         # graphql-request GraphQLClient instance
│   │   ├── queries/          # .graphql files for GET operations (one per resource)
│   │   └── mutations/        # .graphql files for POST/PUT/DELETE operations
│   ├── mappers/
│   │   └── response.ts       # Hasura row shape -> v1.8.0 JSON shape transformer
│   └── generated/
│       └── sdk.ts            # graphql-codegen output (DO NOT EDIT)
├── openapi.yaml              # v2.0.0 spec (copied from fastapi repo, version bumped)
├── codegen.ts                # graphql-codegen config
├── tsconfig.json
├── package.json
├── Dockerfile
└── .github/workflows/
    └── ci.yml
```

### Pattern 1: OpenAPI-Glue Design-First Route Registration
**What:** fastify-openapi-glue reads `openapi.yaml` and creates all Fastify routes automatically. The `service` object provides one method per `operationId`.
**When to use:** Always -- this is the entire route registration strategy.
**Example:**
```typescript
// src/app.ts
// Source: https://github.com/seriousme/fastify-openapi-glue
import Fastify from 'fastify'
import openapiGlue from 'fastify-openapi-glue'
import { Service } from './service.js'
import { Security } from './security.js'

export async function buildApp() {
  const app = Fastify({ logger: true })

  await app.register(openapiGlue, {
    specification: new URL('../openapi.yaml', import.meta.url).pathname,
    serviceHandlers: new Service(),
    securityHandlers: new Security(),
    prefix: 'v2.0.0',
  })

  await app.register(import('@fastify/cors'), { origin: '*' })

  return app
}
```

### Pattern 2: Service Handler Mapping operationId to Hasura Query
**What:** Each OpenAPI `operationId` (e.g., `models_get`, `models_id_get`) maps to a method in the Service class. The method calls the typed Hasura SDK and transforms the response.
**When to use:** For every endpoint -- this is the core business logic layer.
**Example:**
```typescript
// src/service.ts
import { getSdk } from './generated/sdk.js'
import { GraphQLClient } from 'graphql-request'
import { toV1Shape } from './mappers/response.js'

const client = new GraphQLClient(process.env.HASURA_GRAPHQL_URL!, {
  headers: { 'X-Hasura-Admin-Secret': process.env.HASURA_ADMIN_SECRET! },
})
const sdk = getSdk(client)

export class Service {
  async models_get(req: FastifyRequest) {
    const { username, label, page = 1, per_page = 100 } = req.query as any
    const offset = (page - 1) * per_page
    const data = await sdk.GetModels({ username, label, limit: per_page, offset })
    return data.modelcatalog_software.map(toV1Shape)
  }

  async models_id_get(req: FastifyRequest) {
    const { id } = req.params as any
    const data = await sdk.GetModelById({ id: decodeURIComponent(id) })
    if (!data.modelcatalog_software_by_pk) throw { statusCode: 404 }
    return toV1Shape(data.modelcatalog_software_by_pk)
  }
}
```

### Pattern 3: Response Shape Transformation
**What:** Hasura returns flat column names (snake_case, no arrays). The v1.8.0 API contract requires camelCase field names with every scalar wrapped in a single-element array. A mapper function applies this transform.
**When to use:** On every response before returning from a service handler.
**Key insight from live API inspection:**
```json
// Hasura row (PostgreSQL column names):
{ "id": "https://w3id.org/okn/i/mint/CYCLES", "label": "CYCLES model", "date_created": "2019" }

// v1.8.0 expected response (array-wrapped, camelCase):
{ "id": "https://w3id.org/okn/i/mint/CYCLES", "type": ["Model"], "label": ["CYCLES model"], "dateCreated": ["2019"] }
```
The transformation rules are:
1. `id` stays as-is (URI string, no array wrapping)
2. `type` is synthesized from the resource class name (e.g., `["Model", "SoftwareDescription"]`)
3. All scalar fields are wrapped in `[value]` arrays
4. Null fields are omitted entirely (not `null` or `[]`)
5. Related objects become nested objects with their own `id` and `type`

### Pattern 4: JWT Passthrough Authentication
**What:** Fastify validates the JWT Bearer token on write routes (POST/PUT/DELETE) using `@fastify/jwt`. The validated token (or admin secret) is then forwarded to Hasura in the GraphQL request headers.
**When to use:** All write operations. Read operations for public data use admin secret with anonymous role.
**Example:**
```typescript
// src/security.ts
// Source: https://github.com/fastify/fastify-jwt
export class Security {
  async BearerAuth(req: FastifyRequest, reply: FastifyReply, params: any) {
    try {
      await req.jwtVerify()
    } catch (err) {
      reply.send(err)
    }
  }
}

// In service.ts for write operations: forward the raw token to Hasura
const userClient = new GraphQLClient(process.env.HASURA_GRAPHQL_URL!, {
  headers: { Authorization: req.headers.authorization! },
})
```

### Pattern 5: Hasura Admin Secret vs User Token
**What:** Two modes of calling Hasura, depending on operation type.
- **Reads (GET):** Use `X-Hasura-Admin-Secret` header, which bypasses row-level permissions and returns all public data. Anonymous role returns all rows. This matches v1.8.0 behavior (no auth required for reads).
- **Writes (POST/PUT/DELETE):** Forward the user's Bearer JWT token to Hasura. Hasura row-level permissions enforce `x-hasura-user-id` scoping so users can only mutate their own data.

**IMPORTANT DISCOVERY:** Hasura metadata currently only has `select_permissions` on modelcatalog tables. Insert/update/delete permissions do NOT exist yet. These must be added to Hasura metadata before write operations can work.

### Anti-Patterns to Avoid
- **Proxying GraphQL through REST:** Do not add a GraphQL pass-through route in Fastify. Hasura is exposed directly -- Fastify handles REST only.
- **Hand-rolling route registration:** Do not write `app.get('/v2.0.0/models', ...)` for each of 105 paths. Use fastify-openapi-glue.
- **Returning null arrays:** v1.8.0 omits null fields entirely. Do not return `"label": null` or `"label": []`. Strip nulls in the mapper.
- **Forgetting URI decoding on IDs:** The `id` parameter in path `/{id}` comes URL-encoded. Hasura stores the raw URI. Always `decodeURIComponent(id)` before querying.
- **Apollo Client on the server:** Apollo's InMemoryCache is process-level and shared across all requests. For a stateless REST API, this creates memory pressure and potential data cross-contamination between user requests.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Route registration from OpenAPI | Custom yaml parser + route loop | fastify-openapi-glue | Schema validation, security wiring, operationId mapping, multi-file spec support all included |
| JWT validation | Manual `jsonwebtoken.verify()` | @fastify/jwt | Integrates with Fastify lifecycle, handles error responses, works with openapi-glue security handler pattern |
| GraphQL typed queries | Hand-written TypeScript interfaces | @graphql-codegen | Hasura schema is typed; codegen introspects and generates exact types including all relationships |
| CORS headers | Manual response headers | @fastify/cors | Handles preflight, multiple origins, credentials correctly |
| Request ID tracking | UUID generation on each request | Fastify built-in | Fastify auto-generates `requestId` per request; Pino logs include it automatically |
| API diff comparison | Custom diff script | Simple `vitest` test suite calling both APIs | Vitest can run parametric tests across all 105 endpoints and diff responses with structured output |

**Key insight:** The 105-path OpenAPI spec is the complete contract. Any custom code that reimplements validation, routing, or documentation instead of reading from that spec creates drift risk.

---

## Common Pitfalls

### Pitfall 1: Missing Hasura Mutation Permissions
**What goes wrong:** POST/PUT/DELETE requests to Fastify succeed (JWT validates), but Hasura returns a permissions error because insert/update/delete permissions for the `user` role are not defined on modelcatalog tables.
**Why it happens:** Phase 1 (schema migration) defined only select permissions. Mutation permissions require additional Hasura metadata entries (metadata YAML) and a Hasura migration.
**How to avoid:** Add insert/update/delete permissions to Hasura metadata BEFORE implementing write handlers. These are YAML entries in `graphql_engine/metadata/tables.yaml` for each table, scoped by `user` role with `x-hasura-user-id` row filters.
**Warning signs:** Hasura returns `{ "errors": [{ "extensions": { "code": "permission-denied" } }] }`.

### Pitfall 2: Array Wrapping -- Response Format Drift
**What goes wrong:** v2.0.0 responses stop matching v1.8.0. The automated comparison tool catches diffs only if it's running; during development, it's easy to miss.
**Why it happens:** Hasura returns plain column values. Developers forget to wrap scalars in arrays in the mapper.
**How to avoid:** Write the response mapper first with unit tests driven by golden file fixtures from the live API. Run `curl https://api.models.mint.tacc.utexas.edu/v1.8.0/models?username=mint@isi.edu` and save as fixture.
**Warning signs:** Fields like `"label"` return a string instead of `["string"]`. The comparison tool shows structural diffs.

### Pitfall 3: URI-Encoded IDs in Path Parameters
**What goes wrong:** GET /v2.0.0/models/https%3A%2F%2Fw3id.org%2Fokn%2Fi%2Fmint%2FCYCLES returns 404 because Hasura is queried with the encoded form.
**Why it happens:** OpenAPI path parameters with URI-format IDs are percent-encoded by HTTP clients. Fastify passes them decoded in `req.params.id` by default, BUT if the ID itself contains `/`, some routing layers double-encode or leave it encoded.
**How to avoid:** Always call `decodeURIComponent(req.params.id)` before using the ID in a Hasura query. Write a test with a URI-formatted ID.
**Warning signs:** Consistent 404s for GET by ID even though the record exists.

### Pitfall 4: Custom Endpoints Not in Hasura Schema
**What goes wrong:** The 13 `/custom/` endpoints (e.g., `/custom/model/index`, `/custom/models/standard_variable`) perform cross-resource aggregation queries that the SPARQL QueryManager handles today. These have no direct equivalent in Hasura table structure.
**Why it happens:** These are complex SPARQL queries joining multiple entity types (e.g., find models by standard variable label). Hasura's auto-generated GraphQL supports nested object queries, but the custom endpoints need custom query logic.
**How to avoid:** Map each custom endpoint to a Hasura nested GraphQL query. They require joining through relationship chains (e.g., `modelcatalog_software -> versions -> configurations -> parameters -> variable_presentations`). These are the hardest endpoints to implement.
**Warning signs:** Custom endpoints return empty arrays or incorrect results compared to v1.8.0.

### Pitfall 5: `user` Query Parameter is Username, Not Auth User
**What goes wrong:** Confusing the `?username=mint@isi.edu` query parameter (used to scope reads to a named graph/user's data) with authentication. In v1.8.0, `username` scopes reads; authentication via Bearer token scopes writes.
**Why it happens:** The old SPARQL backend uses named graphs per user. The new PostgreSQL backend doesn't have named graphs -- all data is in shared tables.
**How to avoid:** Determine during planning whether `username` filtering needs to be preserved. If all data is in one public set, `username` may be a no-op. If per-user data isolation is needed, Hasura row-level permissions by `user_id` replace it. This needs a data model decision.
**Warning signs:** Reads with `?username=X` return the same data as reads without username, or return empty sets.

### Pitfall 6: fastify-openapi-glue Missing operationId
**What goes wrong:** Endpoints without `operationId` in the OpenAPI spec fail to wire up, or auto-generate an ID that doesn't match the service method name.
**Why it happens:** The existing v1.8.0 spec was auto-generated; some paths may lack explicit operationIds.
**How to avoid:** Audit the spec for missing operationIds before implementing. The `fastify-openapi-glue` CLI can scaffold a stub service class with one method per operationId, revealing any gaps immediately.
**Warning signs:** `TypeError: serviceHandlers[operationId] is not a function` at startup.

---

## Code Examples

### graphql-codegen Configuration
```typescript
// codegen.ts
// Source: https://the-guild.dev/graphql/codegen/docs/config-reference/codegen-config
import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  schema: {
    [process.env.HASURA_GRAPHQL_URL!]: {
      headers: {
        'X-Hasura-Admin-Secret': process.env.HASURA_ADMIN_SECRET!,
      },
    },
  },
  documents: 'src/hasura/**/*.graphql',
  generates: {
    'src/generated/sdk.ts': {
      plugins: [
        'typescript',
        'typescript-operations',
        'typescript-graphql-request',
      ],
    },
  },
}

export default config
```

### Hasura GraphQL Query for List Endpoint
```graphql
# src/hasura/queries/models.graphql
query GetModels($username: String, $label: String, $limit: Int = 100, $offset: Int = 0) {
  modelcatalog_software(
    limit: $limit
    offset: $offset
    where: {
      _and: [
        { label: { _ilike: $label } }  # if label param provided
      ]
    }
  ) {
    id
    label
    description
    keywords
    license
    website
    date_created
    date_published
    has_documentation
    has_download_url
    has_purpose
    author { id label }
    versions {
      id
      label
    }
  }
}
```

### Hasura Mutation Permission YAML (to be added to metadata)
```yaml
# Addition needed in graphql_engine/metadata/tables.yaml
# for modelcatalog_software and all other tables
insert_permissions:
  - role: user
    permission:
      check: {}        # no row-level check on insert
      columns:
        - id
        - label
        - description
        - keywords
        - license
        - website
        - date_created
        - date_published
        - has_documentation
        - has_download_url
        - has_purpose
update_permissions:
  - role: user
    permission:
      columns:
        - label
        - description
        - keywords
        - license
        - website
        - date_created
        - date_published
        - has_documentation
        - has_download_url
        - has_purpose
      filter: {}   # all rows -- username scoping needs further design decision
      check: {}
delete_permissions:
  - role: user
    permission:
      filter: {}
```

### Fastify app with health endpoint
```typescript
// src/app.ts
import Fastify from 'fastify'
import openapiGlue from 'fastify-openapi-glue'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { Service } from './service.js'
import { Security } from './security.js'
import { request } from 'graphql-request'

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      serializers: {
        req(req) {
          return { method: req.method, url: req.url, id: req.id }
        },
      },
    },
    genReqId: () => crypto.randomUUID(),
  })

  await app.register(cors, { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] })

  await app.register(jwt, {
    secret: { public: process.env.JWT_PUBLIC_KEY! },
  })

  await app.register(openapiGlue, {
    specification: new URL('../openapi.yaml', import.meta.url).pathname,
    serviceHandlers: new Service(),
    securityHandlers: new Security(),
    prefix: 'v2.0.0',
  })

  app.get('/health', async (req, reply) => {
    try {
      await request(process.env.HASURA_GRAPHQL_URL!, '{ __typename }', undefined, {
        'X-Hasura-Admin-Secret': process.env.HASURA_ADMIN_SECRET!,
      })
      return { status: 'ok', hasura: 'connected' }
    } catch {
      reply.status(503)
      return { status: 'error', hasura: 'unreachable' }
    }
  })

  return app
}
```

### GitHub Actions CI Workflow
```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - uses: docker/login-action@v3
        if: github.ref == 'refs/heads/main'
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        if: github.ref == 'refs/heads/main'
        with:
          push: true
          tags: docker.io/mintproject/model-catalog-api:latest,docker.io/mintproject/model-catalog-api:${{ github.sha }}
```

### Helm Subchart Values Pattern (from existing charts)
```yaml
# helm-charts/charts/mint/values.yaml -- addition
components:
  model_catalog_api_v2:
    enabled: false
    image:
      repository: mintproject/model-catalog-api
      tag: latest
      pullPolicy: IfNotPresent
    environment:
      hasura_url: ""
      hasura_admin_secret: ""
      jwt_public_key: ""
      log_level: "info"
    ingress:
      enabled: true
      annotations:
        nginx.ingress.kubernetes.io/enable-cors: "true"
      hosts:
        - host: api.models.mint.tacc.utexas.edu
          paths:
            - path: /v2.0.0
              pathType: Prefix
    resources:
      requests:
        cpu: 100m
        memory: 128Mi
      limits:
        cpu: 500m
        memory: 256Mi
```

---

## Scope Analysis: What Needs to be Built

**105 total paths in existing OpenAPI spec:**
- 92 standard CRUD paths across 46 resource types (list GET + {id} GET/POST/PUT/DELETE)
- 13 custom/search paths (`/custom/model/index`, `/custom/models/variable`, etc.)
- 1 auth path (`/user/login`)

**46 resource types identified:**
`catalogidentifiers, causaldiagrams, configurationsetups, constraints, coupledmodels, datasetspecifications, datatransformations, datatransformationsetups, empiricalmodels, emulators, equations, fundinginformations, geocoordinatess, geoshapes, grids, hybridmodels, images, interventions, modelcategorys, modelconfigurations, modelconfigurationsetups, models, numericalindexs, organizations, parameters, persons, pointbasedgrids, processs, regions, samplecollections, sampleexecutions, sampleresources, softwareconfigurations, softwareimages, softwares, softwareversions, sourcecodes, spatiallydistributedgrids, spatialresolutions, standardvariables, theory-guidedmodels, timeintervals, units, variablepresentations, variables, visualizations`

**39 Hasura tables registered** with select permissions only. Not all 46 API resource types map 1:1 to a Hasura table (e.g., `emulators`, `hybridmodels`, `coupledmodels`, `empiricalmodels`, `theory-guidedmodels` may be subtypes stored in `modelcatalog_software`). Subtype mapping is a planning-time decision.

**13 custom endpoints** are multi-join queries. Each needs a Hasura nested query or view. These are higher complexity than standard CRUD.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Express.js REST | Fastify v5 | Fastify v5: Nov 2024 | 20-30% faster; native TypeScript; no deprecation warnings |
| Apollo Client everywhere | graphql-request for server-side | 2023+ community shift | Removes 50KB+ bundle, no cache complexity |
| Hand-written routes | OpenAPI-glue design-first | 2022+ | Spec stays single source of truth |
| jest for TS | vitest | 2023+ | Native ESM; no babel; faster |
| Apollo Client 3 | Apollo Client 4 (if used) | Sep 2025 | 20-30% smaller bundles, stronger TS |

**Deprecated/outdated:**
- `fastify-swagger` (unscoped): replaced by `@fastify/swagger` (scoped)
- `fastify-cors` (unscoped): replaced by `@fastify/cors`
- `fastify-jwt` (unscoped): replaced by `@fastify/jwt`
- Apollo Client for Node.js servers: no built-in benefit; community recommends graphql-request for server-to-server

---

## Open Questions

1. **Apollo Client vs graphql-request**
   - What we know: User locked in Apollo Client; researcher finds graphql-request is the correct server-side choice
   - What's unclear: Whether user has a specific reason to prefer Apollo Client (shared code with another service?)
   - Recommendation: Planner should note the tradeoff and ask for confirmation before committing to Apollo Client

2. **username query parameter semantics in v2**
   - What we know: v1.8.0 uses `?username=mint@isi.edu` to scope SPARQL named graph. PostgreSQL has no named graphs.
   - What's unclear: Should v2.0.0 support `username` filtering (returning only data associated with that user), treat it as a no-op, or remove it?
   - Recommendation: Treat `username` as a filter on a `user_id` column if present, no-op if absent. This needs a Hasura schema check -- some tables may have `user_id` columns from Phase 1.

3. **Subtype mapping for Model hierarchy**
   - What we know: API has `emulators`, `hybridmodels`, `coupledmodels`, `empiricalmodels`, `theory-guidedmodels` as separate endpoints. Hasura has `modelcatalog_software` as the base table.
   - What's unclear: How are these subtypes stored? Is there a `type` discriminator column? Or are they separate tables?
   - Recommendation: Check Phase 1 schema; if no subtype table exists, these endpoints may need a view or a `type` column to filter against.

4. **Comparison tool placement**
   - What we know: A comparison tool is needed that calls both APIs for all endpoints and diffs responses.
   - What's unclear: Should it live in the new `model-catalog-api` repo test suite, or in this repo?
   - Recommendation: Place it in the new repo's test suite (`tests/comparison/`) as it's part of validating the new API works correctly. It can still be run from CI in either repo.

5. **Hasura mutation permissions design**
   - What we know: Currently NO mutation permissions exist. Writes via admin secret bypass all row-level rules.
   - What's unclear: Should write operations use admin secret (simpler, no user scoping enforcement at DB level) or user JWT forwarding (proper row-level security)?
   - Recommendation: Use admin secret for all Hasura calls initially (simpler, matches v1.8.0 which had user-scoping only at SPARQL named graph level). Add row-level permissions as a follow-up when multi-tenancy is needed.

---

## Sources

### Primary (HIGH confidence)
- fastify-openapi-glue GitHub (seriousme/fastify-openapi-glue) v4.10.2 -- route generation from OpenAPI spec, service handlers, operationResolver
- Fastify official docs v5.7.x (fastify.dev) -- TypeScript setup, logging, plugin registration
- @fastify/jwt GitHub (fastify/fastify-jwt) -- v9 Fastify 5 compatibility, verify-only mode
- Hasura official docs (hasura.io/docs/2.0) -- admin secret, JWT auth, row-level permissions
- Live API inspection: `curl https://api.models.mint.tacc.utexas.edu/v1.8.0/models?username=mint@isi.edu` -- response format verified
- Local codebase inspection: `model-catalog-fastapi/openapi.yaml` (105 paths, 46 resources, 53 schemas confirmed)
- Local codebase inspection: `graphql_engine/metadata/tables.yaml` (39 modelcatalog tables, select-only permissions confirmed)
- Local codebase inspection: `graphql_engine/migrations/` (complete schema structure)

### Secondary (MEDIUM confidence)
- graphql-request npm/LogRocket (verified v7.x, TypeScript support, 21KB size)
- @graphql-codegen/cli The Guild docs (verified typescript-graphql-request plugin generates typed SDK)
- @fastify/cors GitHub (verified wildcard origin, methods config)
- docker/build-push-action GitHub Actions (verified Docker Hub push workflow)

### Tertiary (LOW confidence)
- graphql-request vs Apollo Client comparison (multiple community sources agree; not an official benchmark)
- Helm chart resource limit recommendations (community best practices, 100m/500m CPU, 128Mi/256Mi memory)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries verified against official docs and npm
- Architecture: HIGH -- patterns verified against library docs and existing codebase inspection
- Scope analysis: HIGH -- counted from actual openapi.yaml and metadata/tables.yaml files
- Pitfalls: HIGH for Hasura permissions gap (confirmed by local inspection); MEDIUM for URI encoding and custom endpoints (common patterns, not project-specific verified)

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (stable ecosystem; fastify-openapi-glue and graphql-request are mature)
