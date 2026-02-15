# Codebase Concerns

**Analysis Date:** 2026-02-14

## Tech Debt

**Extensive Use of `any` Type:**
- Issue: Both codebase sections rely heavily on `any` types instead of proper TypeScript typing
- Files:
  - UI: 138+ occurrences across `/Users/mosorio/repos/mint/ui/src/**/*.ts`
  - Ensemble Manager: 104+ occurrences in `/Users/mosorio/repos/mint/mint-ensemble-manager/src/**/*.ts`
- Impact: Loss of type safety, harder refactoring, increased runtime errors, poor IDE support
- Fix approach: Gradually introduce proper types, start with critical services and API boundaries; use `@ts-expect-error` comments for temporary escapes with explicit tracking

**Unimplemented Features:**
- Issue: Multiple critical functions throw "not implemented" errors at runtime rather than before deployment
- Files:
  - `/Users/mosorio/repos/mint/ui/src/app/mint-app.ts:1013` - `signUp()` function throws "Function not implemented"
  - `/Users/mosorio/repos/mint/mint-ensemble-manager/src/api/api-v1/services/subTasksService.ts:64-68` - Wings and LocalEx execution services marked with TODO
- Impact: Features advertised in UI may silently fail; users hit dead ends; poor error messages
- Fix approach: Remove unimplemented code, implement or document as "future" with clear status; use feature flags for partial implementations

**Large Monolithic Components:**
- Issue: Several UI components exceed 1700+ lines with mixed concerns
- Files:
  - `ui/src/screens/models/model-explore/model-view.ts` - 3256 lines
  - `ui/src/screens/models/configure/resources/resource.ts` - 1709 lines
  - `ui/src/screens/modeling/actions.ts` - 1280 lines
  - `mint-ensemble-manager/src/classes/graphql/graphql.ts` - 14842 lines (auto-generated but problematic)
  - `mint-ensemble-manager/src/classes/graphql/types.ts` - 14841 lines (auto-generated but problematic)
- Impact: Difficult to test, maintain, understand code flow; increased coupling; hard to reuse logic
- Fix approach: Break into smaller, focused modules with single responsibility; extract shared utilities; consider component composition patterns for UI

**GraphQL Type Definitions Are Auto-Generated:**
- Issue: Very large type files (14k+ lines) are generated from GraphQL schema, making code navigation difficult
- Files:
  - `mint-ensemble-manager/src/classes/graphql/graphql.ts`
  - `mint-ensemble-manager/src/classes/graphql/types.ts`
- Impact: Can't manually refactor types; size makes imports slow; difficult to find relevant types in IDE
- Fix approach: Ensure codegen config excludes unused operations; consider splitting generated types into logical modules; add type mapping layer on top

**Incomplete Data Bindings and Transformations:**
- Issue: Multiple FIXME comments indicate incomplete or workaround solutions for data transformations
- Files:
  - `ui/src/screens/modeling/thread/mint-datasets.ts:1108` - "load from firestore" (FIXME)
  - `ui/src/screens/datasets/actions.ts:562-565` - Spatial coverage query workaround (504 timeout issue)
  - `mint-ensemble-manager/src/classes/graphql/graphql_functions.ts:270` - Collection creation incomplete for dimensionality > 1
  - `ui/src/util/graphql_adapter.ts:444` - Collection creation FIXME
- Impact: Data transformations may be incomplete; spatial queries timeout; model inputs not properly handled
- Fix approach: Complete spatial query optimization; implement proper collection handling; add comprehensive tests

**Authentication and Token Management Issues:**
- Issue: Multiple FIXME comments indicate incomplete auth implementations and workarounds
- Files:
  - `ui/src/app/mint-app.ts:768` - "user creation not working on keycloak" (FIXME)
  - `ui/src/util/oauth2-adapter.ts:203` - "maybe check refresh token on open" (TODO)
  - `ui/src/util/oauth2-adapter.ts:330` - "does not redirect, cleaning localStorage as quick fix" (FIXME)
  - `mint-ensemble-manager/src/config/keycloak-adapter.ts:75, 235, 250` - Multiple FIXME comments on user management
- Impact: User creation may fail silently; token refresh unreliable; workaround cleanup hides real issues; production data loss risk
- Fix approach: Implement proper token refresh lifecycle; add explicit user creation failure handling; remove localStorage cleanup workaround; add comprehensive auth tests

## Known Bugs

**Batch Data Fetching Causes Excessive Refreshes:**
- Symptoms: UI performance degrades when loading runs; multiple unnecessary re-renders
- Files: `ui/src/screens/modeling/thread/mint-runs.ts:740`
- Trigger: Loading modeling runs triggers batch fetch that refreshes too frequently
- Workaround: Debounce fetch calls or use caching
- Fix approach: Implement proper batch fetching with deduplication and request caching

**Hardcoded API Key in Example Code:**
- Symptoms: Example code exposes Google Maps API key
- Files: `ui/src/thirdparty/google-map/demo/polys.html:48`
- Trigger: Demo code left with real API key
- Workaround: Replace with placeholder before running
- Fix approach: Remove demo files from production build; use environment variables; add pre-commit hook to detect exposed keys

**Region Geojson Handling Inconsistency:**
- Symptoms: Different backends handle region GeoJSON differently; requires HACK patterns to normalize
- Files:
  - `mint-ensemble-manager/src/classes/tapis/helpers.ts:111` - "HACK: Replace region geojson"
  - `mint-ensemble-manager/src/classes/localex/local-execution-functions.ts:411` - Same HACK
  - `mint-ensemble-manager/src/classes/common/ExecutionCreation.ts:374` - Duplicated HACK
- Trigger: Different execution backends (Tapis, LocalEx) expect different GeoJSON formats
- Workaround: Replace region geojson values (HACK)
- Fix approach: Implement proper adapter pattern for region format conversion; consolidate into single transformation function

**Model Selection Uncertainty:**
- Symptoms: Model ID sometimes references wrong model unexpectedly
- Files: `ui/src/screens/modeling/thread/mint-runs.ts:131`
- Trigger: Unclear from comment
- Workaround: None documented
- Fix approach: Add comprehensive logging; implement model validation; ensure model IDs are properly scoped

**Category Headers Disappear When Hidden:**
- Symptoms: When filtering categories, header information is lost and can't be restored
- Files:
  - `ui/src/components/model-selector.ts:537` - FIXME
  - `ui/src/components/dataset-compatible-model.ts:557` - FIXME
- Trigger: Category filtering hides headers
- Workaround: Manual refresh required
- Fix approach: Implement proper category state management; maintain header metadata separately

## Security Considerations

**LocalStorage Token Storage Without Encryption:**
- Risk: Authentication tokens stored in browser localStorage are vulnerable to XSS attacks; JWT not validated client-side for freshness
- Files:
  - `ui/src/screens/modeling/thread/mint-runs.ts:556` - Token retrieved from localStorage
  - `ui/src/screens/modeling/thread/mint-results.ts:834` - Same pattern
- Current mitigation: Relies on browser same-origin policy
- Recommendations:
  - Move tokens to httpOnly cookies (requires backend changes)
  - Validate token expiration before use
  - Implement token refresh before expiration
  - Add Content Security Policy headers to prevent XSS

**Hardcoded Credentials in Configuration:**
- Risk: Passwords stored in config files and environment variables are readable by any code; credentials stored in `/src/` directories
- Files: `mint-ensemble-manager/src/config/keycloak-adapter.ts` - password parameters passed to signIn
- Current mitigation: Secrets file likely in .gitignore
- Recommendations:
  - Never store passwords in config files
  - Use environment variables only for secrets (already partially done)
  - Add .env validation to ensure secrets are present
  - Rotate credentials regularly

**GraphQL Queries Not Validated Against Schema:**
- Risk: No explicit schema validation of GraphQL queries; potential for injection-like attacks with untrusted data
- Files:
  - `mint-ensemble-manager/src/classes/graphql/graphql_functions.ts` - Custom GraphQL query building
  - `ui/src/util/graphql_adapter.ts` - GraphQL response parsing
- Current mitigation: Apollo Client provides some protection
- Recommendations:
  - Ensure all GraphQL operations are generated from schema (not hand-written)
  - Implement server-side rate limiting for GraphQL
  - Add query complexity analysis
  - Use GraphQL persisted queries if possible

**innerHTML Usage in Components:**
- Risk: Direct innerHTML assignment can introduce XSS vulnerabilities if data is untrusted
- Files:
  - `ui/src/components/image-gallery.ts:153-173` - innerHTML used for gallery entries
- Current mitigation: Relies on source data being safe
- Recommendations:
  - Use `textContent` for plain text
  - Use `lit-html` or similar for safe HTML rendering
  - Sanitize all user-provided HTML with DOMPurify
  - Add CSP headers

**Incomplete User Creation Permissions:**
- Risk: User creation endpoint doesn't properly verify permissions in Keycloak; allows unauthorized user creation attempts
- Files: `mint-ensemble-manager/src/config/keycloak-adapter.ts:235` - "editing profile requires user role" marked FIXME
- Current mitigation: Unknown
- Recommendations:
  - Implement role-based access control on user creation
  - Verify user has admin role before creating users
  - Add audit logging for user creation attempts
  - Rate limit user creation endpoint

## Performance Bottlenecks

**GraphQL Type System Too Large to Optimize:**
- Problem: 14k-line generated type files create performance issues during TypeScript compilation and IDE operations
- Files:
  - `mint-ensemble-manager/src/classes/graphql/graphql.ts:14842 lines`
  - `mint-ensemble-manager/src/classes/graphql/types.ts:14841 lines`
- Cause: GraphQL schema codegen produces types for entire API surface; not filtered to used operations
- Improvement path:
  - Configure codegen to only generate types for operations actually used in code
  - Split generated types into operation-specific files
  - Implement type trimming or lazy loading of type definitions
  - Consider GraphQL fragment codegen instead of full schema types

**Lazy Loading Not Fully Implemented:**
- Problem: Resource loading in model configuration happens synchronously, blocking UI
- Files: `ui/src/screens/models/configure/resources/resource.ts:1478` - "This does not work, loads everything always" (FIXME)
- Cause: Lazy loading flag set but implementation incomplete
- Improvement path:
  - Complete lazy loading implementation for large resource lists
  - Implement intersection observer for viewport-based loading
  - Add pagination for resource selection

**Batch Operations Trigger Excessive Re-Renders:**
- Problem: Setting multiple resources triggers separate update cycles instead of batching
- Files: `ui/src/screens/modeling/thread/mint-runs.ts:740` - Batch fetching causes refresh overload
- Cause: No batching or debouncing of updates
- Improvement path:
  - Implement request batching at Redux level
  - Debounce state updates
  - Use React Concurrent features or LitElement batch updates

**Spatial Query Timeouts in Dataset Loading:**
- Problem: Spatial coverage queries timeout (504 errors) when loading datasets
- Files: `ui/src/screens/datasets/actions.ts:562-565`
- Cause: Complex GeoJSON intersection queries on large datasets
- Improvement path:
  - Add query pagination for spatial results
  - Cache spatial queries
  - Pre-compute spatial indices on backend
  - Implement incremental loading with simplified geometry

**OAuth Token Refresh Overhead:**
- Problem: Token refresh not checked proactively; causes failures mid-request
- Files: `ui/src/util/oauth2-adapter.ts:203` - "maybe check refresh token on open" (TODO)
- Cause: Reactive rather than proactive token management
- Improvement path:
  - Check and refresh token before expiration on app startup
  - Implement automatic token refresh interceptor in HTTP client
  - Cache token expiration time locally to avoid unnecessary checks

## Fragile Areas

**Model Configuration Component (ModelConfiguration):**
- Files: `ui/src/screens/models/configure/resources/model-configuration.ts` (1111 lines)
- Why fragile: Very large component handling multiple concerns (UI, state, API); tightly coupled to GraphQL schema; extensive use of `any` types
- Safe modification: Use feature flags for large changes; write integration tests before refactoring; test each model configuration type separately
- Test coverage: Unclear; no visible tests for complex configuration scenarios

**Execution Service Selection (SubTasksService):**
- Files: `mint-ensemble-manager/src/api/api-v1/services/subTasksService.ts:49-72`
- Why fragile: Switch statement selects execution engine (Tapis, LocalEx, Wings); two backends throw "not implemented"; any new backend requires code change
- Safe modification: Implement factory pattern with service registry; add validation before switching; implement each backend fully before adding to switch
- Test coverage: No tests visible; critical path not covered

**GraphQL Adapter Functions (graphql_adapter.ts):**
- Files: `ui/src/util/graphql_adapter.ts` (987 lines) and `mint-ensemble-manager/src/classes/graphql/graphql_adapter.ts` (1031 lines)
- Why fragile: Long functions that parse GraphQL responses with many `any` types; no validation of response structure; duplicated logic between files
- Safe modification: Add type guards at function entry; use runtime validation; consolidate duplicate adapter functions
- Test coverage: Limited; no visible tests for malformed GraphQL responses

**Data Transformation Pipeline (mint-datasets.ts):**
- Files: `ui/src/screens/modeling/thread/mint-datasets.ts` (1337 lines)
- Why fragile: Complex data transformation with hardcoded mappings; multiple FIXME comments indicating incomplete logic; depends on external data catalog
- Safe modification: Add data validation tests; document data flow; implement schema validation at boundaries
- Test coverage: Unknown; likely gaps in error handling

**Thread Model Execution (mint-runs.ts):**
- Files: `ui/src/screens/modeling/thread/mint-runs.ts` (750 lines)
- Why fragile: Handles model execution, result fetching, and display; localStorage token handling; no visible error recovery
- Safe modification: Add comprehensive error handling; implement retry logic; test with network failures
- Test coverage: Unclear; dynamic token refresh not tested

## Scaling Limits

**GraphQL Query Size Limits Not Enforced:**
- Current capacity: No visible query depth/complexity limits
- Limit: Complex queries with deep nesting or large result sets may timeout
- Scaling path:
  - Implement GraphQL query complexity analysis
  - Set maximum query depth and field count
  - Implement pagination for all list queries
  - Cache frequently accessed queries

**Ensemble Size Limitations Hardcoded:**
- Current capacity: MAX_CONFIGURATIONS = 1000000 (hardcoded in graphql_functions.ts:260)
- Limit: Ensemble sizes approaching 1M configurations will hit memory limits or timeout
- Scaling path:
  - Make limit configurable based on available memory
  - Implement streaming/pagination for large ensembles
  - Add progress reporting for ensemble generation
  - Warn users when approaching limits

**LocalStorage Token Storage:**
- Current capacity: Tokens stored per browser tab; no cleanup of expired tokens
- Limit: Multiple tabs accumulate stale tokens; localStorage fills up over time
- Scaling path:
  - Move to sessionStorage or httpOnly cookies
  - Implement automatic cleanup of expired tokens
  - Limit number of stored tokens (keep only latest)

**Model Catalog Caching Not Implemented:**
- Current capacity: Model catalog models cached in-memory in ModelView component
- Limit: Large model catalogs (1000+ models) slow down UI interactions
- Scaling path:
  - Implement Redis caching layer for model catalog
  - Add pagination to model catalog queries
  - Implement client-side caching with TTL
  - Use GraphQL subscriptions for model updates instead of polling

## Dependencies at Risk

**OAuth2 Implementation with Multiple Providers:**
- Risk: Code supports Keycloak and Tapis OAuth2 with different configurations; adds complexity and potential for misconfiguration
- Impact: Auth failures if provider configuration incorrect; duplicate code for token handling
- Migration plan:
  - Standardize on single provider or abstract provider differences into strategy pattern
  - Consolidate OAuth2 token handling code
  - Add OAuth2 configuration validation at startup

**GraphQL Code Generation:**
- Risk: Relies on external codegen tools; generated code doesn't match current schema
- Impact: Type mismatches at runtime; stale types cause bugs; large generated files slow build
- Migration plan:
  - Ensure codegen runs in CI/CD automatically
  - Add schema validation to detect breaking changes
  - Implement type pruning to remove unused generated types
  - Consider switching to runtime type checking for critical types

**Model Catalog Client Library:**
- Risk: External `@mintproject/modelcatalog_client` package used throughout; version compatibility unknown
- Impact: Breaking changes in library propagate to entire codebase
- Migration plan:
  - Pin specific version with test coverage
  - Implement adapter layer to isolate library usage
  - Add deprecation detection tests
  - Plan migration path for major version upgrades

## Missing Critical Features

**User Management UI:**
- Problem: User creation not working on Keycloak (FIXME in mint-app.ts:768); no visible UI for user management
- Blocks: Cannot onboard new users; admin features incomplete
- Recommendations:
  - Implement proper user creation endpoint with validation
  - Add user management dashboard
  - Implement role-based access control UI
  - Add user deletion and deactivation

**Model Execution History:**
- Problem: No comprehensive execution history or status tracking visible
- Blocks: Users can't see what ran or why runs failed
- Recommendations:
  - Implement execution status dashboard
  - Add detailed run logs and error messages
  - Implement run cancellation
  - Add execution retry with different parameters

**Data Lineage and Provenance:**
- Problem: No clear tracking of data transformations and sources
- Blocks: Cannot audit data quality or trace results back to inputs
- Recommendations:
  - Implement data lineage tracking
  - Add data transformation audit trail
  - Link results to specific input datasets
  - Implement data quality scoring

## Test Coverage Gaps

**UI Component Testing:**
- Untested area: Large LitElement components with complex state management
- Files:
  - `ui/src/screens/models/model-explore/model-view.ts` (3256 lines) - No visible tests
  - `ui/src/screens/models/configure/resources/resource.ts` (1709 lines) - No visible tests
- Risk: Refactoring these files risks breaking features; UI bugs go undetected
- Priority: High
- Recommendation: Add component snapshot tests minimum; implement full interaction testing

**GraphQL Adapter Error Handling:**
- Untested area: Response parsing and error handling in adapters
- Files:
  - `ui/src/util/graphql_adapter.ts:42-500` - No visible error path tests
  - `mint-ensemble-manager/src/classes/graphql/graphql_adapter.ts` - No visible error tests
- Risk: Malformed GraphQL responses crash adapter or return invalid data
- Priority: High
- Recommendation: Add tests for missing fields, null values, type mismatches

**Authentication and Token Lifecycle:**
- Untested area: OAuth2 token refresh, expiration, and error handling
- Files: `ui/src/util/oauth2-adapter.ts` - No visible token lifecycle tests
- Risk: Token expiration not handled; session management is unreliable
- Priority: High
- Recommendation: Mock OAuth provider; test refresh flow; test expired token recovery

**Execution Backend Integration:**
- Untested area: Tapis, LocalEx, and Wings backend integration
- Files: `mint-ensemble-manager/src/classes/tapis/`, `src/classes/localex/`, `src/classes/wings/`
- Risk: Backend changes break execution; failure modes not understood
- Priority: Critical (only 12 test files in ensemble manager for ~300+ source files)
- Recommendation: Add integration tests for each execution backend; mock external services; test error paths

**Data Transformation Pipelines:**
- Untested area: Complex data transformations in dataset and model configuration
- Files:
  - `ui/src/screens/modeling/thread/mint-datasets.ts` - 1337 lines, no visible tests
  - `ui/src/screens/models/configure/resources/` - Complex resource transformations
- Risk: Data corruption in transformations goes undetected; regressions in data handling
- Priority: High
- Recommendation: Add unit tests for each transformation function; add property-based tests for edge cases

**Spatial Query Handling:**
- Untested area: GeoJSON/spatial coverage query and parsing
- Files: `ui/src/screens/datasets/actions.ts:562-565` - Workaround noted but no tests
- Risk: Spatial queries timeout or return invalid geometry; silent failures
- Priority: Medium
- Recommendation: Add tests with various GeoJSON geometries; test timeout handling; verify spatial accuracy

---

*Concerns audit: 2026-02-14*
