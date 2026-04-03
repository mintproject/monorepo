# Phase 3: Fix nested resource creation - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

When creating (POST) or updating (PUT) a resource via the REST API, nested/associated resources in the request body (e.g., `hasModelCategory`, `hasAuthor`, `hasInputVariable`) must be properly linked via junction tables. Currently, `toHasuraInput()` in `request.ts` explicitly drops all relationship fields, so nested resources are silently ignored.

This phase makes the API handle all junction-based relationships during create and update operations, using Hasura's native nested insert capability.

</domain>

<decisions>
## Implementation Decisions

### Linking Strategy
- **D-01:** Link-or-create behavior. If a nested resource ID exists in the database, link it via junction table. If it doesn't exist, create it first, then link.
- **D-02:** New nested resources use provided fields + defaults — same logic as top-level creation: generate UUID if no ID provided, set type URI from resource config, map camelCase to snake_case.

### Mutation Approach
- **D-03:** Use Hasura native nested inserts — single atomic mutation per request. No sequential mutations.
- **D-04:** Use `on_conflict` (upsert) on nested resource inserts so existing resources are matched by ID (no-op update) and new ones are created. Single mutation stays atomic.

### Error Handling
- **D-05:** Fail entire request if any nested insert fails. Return 400/422 with error details. Atomic behavior — nothing is created if any part fails.

### Relationship Scope
- **D-06:** Apply to ALL junction-based relationships generically (20+ junction tables), not a subset. Use existing `resource-registry.ts` relationship metadata (junctionTable, junctionRelName, targetResource) to drive the implementation.
- **D-07:** Applies to both POST (create) and PUT (update) operations. For PUT: replace all junction rows (delete old, insert new) to reflect the updated relationship set.

### Claude's Discretion
- Implementation details of how `toHasuraInput()` is refactored to include relationship data in the mutation input
- How junction FK column names are resolved from relationship metadata
- Whether to build nested insert objects inline or via a helper function

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### API Service Layer
- `model-catalog-api/src/service.ts` — Generic `create()` and `update()` handlers that build and execute GraphQL mutations
- `model-catalog-api/src/mappers/request.ts` — `toHasuraInput()` function that transforms API request bodies; currently drops relationship fields
- `model-catalog-api/src/mappers/request.test.ts` — Tests confirming relationship fields are dropped (must be updated)

### Relationship Configuration
- `model-catalog-api/src/mappers/resource-registry.ts` — `RelationshipConfig` with junctionTable, junctionRelName, targetResource metadata for all relationships

### GraphQL / Hasura
- `model-catalog-api/src/hasura/client.ts` — Write client using user JWT for mutations
- `model-catalog-api/src/hasura/field-maps.ts` — Field selections for queries (junction traversal patterns)
- `graphql_engine/metadata/tables.yaml` — Hasura table metadata with relationship definitions and insert permissions

### OpenAPI Spec
- `model-catalog-api/openapi.yaml` — API specification (243 operations)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `resource-registry.ts`: Full relationship metadata already maps API field names to junction tables, target resources, and Hasura relationship names
- `toHasuraInput()`: Existing camelCase-to-snake_case mapping and array unwrapping logic can be reused for nested resource field transformation
- `getResourceConfig()`: Resolves any API resource type to its Hasura table, field map, and relationships

### Established Patterns
- All junction tables follow `{entity_a_id, entity_b_id}` FK-pair pattern
- Junction tables have insert+delete permissions only (no update) per Phase 02-01 decision
- Writes forward user's Bearer token to Hasura for JWT validation
- Hasura `_insert_input` types support nested inserts with `on_conflict` natively

### Integration Points
- `service.ts` `create()` method (line ~175): Where the mutation is built — needs to include nested relationship data
- `service.ts` `update()` method: Same change needed for PUT operations, plus junction row replacement logic
- `toHasuraInput()`: Must stop dropping relationship fields and instead transform them into Hasura nested insert format

</code_context>

<specifics>
## Specific Ideas

- The v1.8.0 Fuseki API created triples freely — this implementation restores that behavior for the v2.0.0 API
- Example failing case: POST `/v2.0.0/models` with `hasModelCategory: [{id: "https://w3id.org/okn/i/mint/Economy", label: ["Economy"]}]` — category exists but junction row is not created
- Junction table `modelcatalog_software_category` has columns `software_id` and `category_id` — nested insert needs to map to these column names

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-fix-nested-resource-creation-link-or-create-associated-resources-when-creating-parent-resource*
*Context gathered: 2026-03-28*
