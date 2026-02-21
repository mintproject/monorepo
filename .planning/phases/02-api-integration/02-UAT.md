---
status: diagnosed
phase: 02-api-integration
source: 02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md, 02-05-SUMMARY.md, 02-06-SUMMARY.md, 02-07-SUMMARY.md, 02-08-SUMMARY.md, 02-09-SUMMARY.md, 02-10-SUMMARY.md
started: 2026-02-21T20:00:00Z
updated: 2026-02-21T20:30:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. API Server Starts Successfully
expected: Run the server. It starts in under 1 second with no errors. Route registration completes and the server listens on the configured port.
result: pass

### 2. Health Endpoint Returns Status
expected: With the server running, GET /health returns a JSON response. If Hasura is reachable, status 200 with hasura=ok. If Hasura is unreachable, status 503 with hasura=unreachable.
result: pass

### 3. List Software Entities (v1.8.0 Format)
expected: GET /v2.0.0/softwares returns HTTP 200 with a JSON array. Each entry has array-wrapped scalar fields (e.g. label: ["CYCLES"]), a synthesized type field (e.g. type: ["Software"]), and camelCase field names. The id field is a URI string (not array-wrapped).
result: issue
reported: "version should be hasVersion. Relationship field names don't match v1.8.0 API format (e.g. versions instead of hasVersion)"
severity: major

### 4. Get Software By ID With Nested Relationships
expected: GET /v2.0.0/softwares/{id} returns HTTP 200 with a single entity object. The response includes nested relationships like authors and versions with nested fields.
result: issue
reported: "Not URL-encoded ID, only the plain ID. GET /v2.0.0/softwares/1bade4cb-d924-4253-bfa9-4c02b461396a returns 404 Not found when it should return the entity."
severity: major

### 5. Software Subtype Filtering
expected: GET /v2.0.0/models returns only software with type Model (~22 results). GET /v2.0.0/empiricalmodels returns only EmpiricalModel entries (~5). GET /v2.0.0/theory-guidedmodels returns only TheoryGuidedModel entries (~7). Each endpoint returns a different filtered subset.
result: pass

### 6. Custom Model Index Endpoint
expected: GET /v2.0.0/custom/model/index returns a list of models with aggregated metadata including version and configuration counts. Response is a JSON array with nested data.
result: skipped
reason: Unable to test. Also noted: numericalindexs endpoint may need review.

### 7. Custom ModelConfigurationSetup Detail
expected: GET /v2.0.0/custom/modelconfigurationsetups/{id} returns a deeply nested setup object with all relationships expanded: inputs, outputs, parameters, and parent configuration/version info.
result: issue
reported: "curl http://localhost:3000/v2.0.0/custom/modelconfigurationsetups/hand_v6 returns error: field 'has_documentation' not found in type: 'modelcatalog_model_configuration_setup'"
severity: major

### 8. Null-Table Resource Returns Empty Array
expected: GET /v2.0.0/catalogidentifiers returns HTTP 200 with an empty JSON array []. GET /v2.0.0/catalogidentifiers/{any-id} returns HTTP 404. These resource types have no backing table but return graceful empty responses.
result: pass

### 9. Write Endpoints Require Authentication
expected: POST /v2.0.0/softwares with a JSON body but no Authorization header returns HTTP 401 (Unauthorized). The security handler blocks unauthenticated write requests.
result: pass

### 10. Unit Tests Pass
expected: Run `cd /Users/mosorio/repos/model-catalog-api && npx vitest run`. All 32 tests pass (24 mapper unit tests + 8 integration tests). No failures or errors.
result: pass

### 11. Docker Image Builds
expected: Run `cd /Users/mosorio/repos/model-catalog-api && docker build -t model-catalog-api-test .`. The multi-stage build completes: TypeScript compiles in the builder stage, production image contains only dist/ and production dependencies.
result: pass

## Summary

total: 11
passed: 7
issues: 3
pending: 0
skipped: 1
skipped: 0

## Gaps

- truth: "Relationship field names match v1.8.0 API format (hasVersion, hasConfiguration, hasInput, etc.)"
  status: failed
  reason: "User reported: version should be hasVersion. Relationship field names don't match v1.8.0 API format (e.g. versions instead of hasVersion)"
  severity: major
  test: 3
  root_cause: "Relationship keys in resource-registry.ts use short names (versions, inputs, configurations) instead of v1.8.0 OWL property names (hasVersion, hasInput, hasConfiguration); response mapper uses these keys directly as output field names"
  artifacts:
    - path: "model-catalog-api/src/mappers/resource-registry.ts"
      issue: "All relationship keys use wrong names: versions->hasVersion, configurations->hasConfiguration, inputs->hasInput, outputs->hasOutput, parameters->hasParameter, setups->hasSetup, categories->hasModelCategory, grids->hasGrid, processes->hasProcess, regions->hasRegion, etc."
  missing:
    - "Rename all relationship keys in resource-registry.ts to match v1.8.0 OWL property names"
    - "Verify authors vs author naming (v1.8.0 uses 'author' for both single and array)"
  debug_session: ""

- truth: "GET /v2.0.0/softwares/{id} returns the entity when given a plain ID (not URL-encoded URI)"
  status: failed
  reason: "User reported: Not URL-encoded ID, only the plain ID. GET /v2.0.0/softwares/1bade4cb-d924-4253-bfa9-4c02b461396a returns 404 Not found when it should return the entity."
  severity: major
  test: 4
  root_cause: "getById() passes raw path parameter to Hasura _by_pk query without prepending ID_PREFIX; DB stores full URIs (https://w3id.org/okn/i/mint/...) but plain IDs like '1bade4cb-...' are sent as-is"
  artifacts:
    - path: "model-catalog-api/src/service.ts"
      issue: "getById() line 129 decodes URI but never prepends ID_PREFIX; same bug in update() and deleteResource()"
  missing:
    - "In getById(), update(), deleteResource(): detect if id starts with 'https://', if not prepend resourceConfig.idPrefix or ID_PREFIX"
  debug_session: ""

- truth: "GET /v2.0.0/custom/modelconfigurationsetups/{id} returns deeply nested setup with all relationships"
  status: failed
  reason: "User reported: error 'field has_documentation not found in type modelcatalog_model_configuration_setup' when requesting /custom/modelconfigurationsetups/hand_v6"
  severity: major
  test: 7
  root_cause: "SETUP_FIELDS in custom-handlers.ts requests columns that don't exist on modelcatalog_model_configuration_setup (has_documentation, date_created, date_modified) and uses wrong junction traversal shapes for inputs/outputs/parameters"
  artifacts:
    - path: "model-catalog-api/src/custom-handlers.ts"
      issue: "SETUP_FIELDS has non-existent columns (has_documentation, date_created, date_modified) and wrong nested shapes for junction relationships (inputs/outputs/parameters need junction traversal pattern like 'inputs { input { ... } }')"
    - path: "model-catalog-api/src/hasura/field-maps.ts"
      issue: "This file is CORRECT and should be used as the authoritative reference for SETUP_FIELDS rewrite"
  missing:
    - "Rewrite SETUP_FIELDS to match actual schema: remove has_documentation/date_created/date_modified, fix junction traversal shapes to match field-maps.ts"
  debug_session: ""
