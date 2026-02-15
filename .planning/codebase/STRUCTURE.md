# Codebase Structure

**Analysis Date:** 2026-02-14

## Directory Layout

```
/Users/mosorio/repos/mint/
├── ui/                              # Frontend: LitElement + Redux SPA
├── mint-ensemble-manager/           # Backend: Ensemble execution orchestration API
├── model-catalog-fastapi/           # Backend: Model metadata API (OpenAPI/FastAPI)
├── graphql_engine/                  # Data layer: Hasura GraphQL engine + PostgreSQL
├── mint/                            # Documentation, Helm charts, releases, tests
├── graphql_engine/                  # GraphQL schema and migrations
├── k8s/                             # Kubernetes deployment configurations
├── mint-instances/                  # Instance management tooling
├── model-catalog-endpoint/          # Legacy model catalog endpoint
├── model-catalog-fetch-api-client/  # Model catalog client library
├── mint-ensemble-manager/           # Ensemble manager (duplicate path noted in structure)
├── MINT_USERGUIDE/                  # User documentation
├── ontologies/                      # Domain ontologies
├── wifire-k8s/                      # Wildfire-specific K8s configurations
└── .planning/                       # Documentation and planning artifacts
```

## Directory Purposes

**`ui/`:**
- Purpose: LitElement web components application - main user interface for MINT platform
- Contains: TypeScript components, Redux store, GraphQL queries, assets (images, fonts, videos)
- Key files: `src/index.ts` (entry point), `src/app/mint-app.ts` (main app component), `webpack/` (build configuration)

**`mint-ensemble-manager/`:**
- Purpose: Node.js/Express API server for orchestrating model ensemble executions
- Contains: REST API routes, execution services, GraphQL client integration, Tapis/local execution adapters, Redis queue management
- Key files: `src/server.ts` (Express app entry point), `src/api/api-v1/` (API routes), `src/classes/` (domain classes)

**`model-catalog-fastapi/`:**
- Purpose: FastAPI server providing OpenAPI-based access to scientific model metadata
- Contains: OpenAPI-generated route handlers, domain models, CKAN adapter, database queries
- Key files: `src/openapi_server/` (auto-generated routes), `src/contexts/` (database connections)

**`graphql_engine/`:**
- Purpose: Hasura GraphQL server exposing PostgreSQL database
- Contains: GraphQL schema metadata, database migrations, seed data
- Key files: `metadata/` (GraphQL schema configuration), `migrations/` (database changes)

**`mint/`:**
- Purpose: Project root documentation, Helm deployment charts, release artifacts
- Contains: README, mkdocs configuration, Helm chart definitions, test suites
- Key files: `README.md` (main documentation), `charts/mint/` (Kubernetes Helm chart), `tests/` (test infrastructure)

**`docs/` (in mint/):**
- Purpose: ReadTheDocs documentation sources
- Contains: Markdown files for admin guides, user guides, architecture diagrams
- Key files: `mkdocs.yml` (documentation config), `admin-guide/`, `walkthrough/`

**`k8s/`:**
- Purpose: Kubernetes manifests and deployment configurations
- Contains: YAML manifests for deploying MINT services on Kubernetes clusters
- Key files: Service definitions, persistent volume configs, network policies

## Key File Locations

**Entry Points:**
- Frontend: `ui/src/index.ts` - Polyfill detection and lazy import of mint-app
- Frontend App: `ui/src/app/mint-app.ts` - Main LitElement component, router configuration
- Ensemble Manager: `mint-ensemble-manager/src/server.ts` - Express.js application setup
- Model Catalog: `model-catalog-fastapi/src/openapi_server/` - FastAPI auto-generated routes

**Configuration:**
- Frontend config: `ui/src/config/` - `graphql.ts`, `default-graph.ts` for API endpoint configuration
- Frontend runtime config: `ui/config.js` - Window variable-based configuration
- Ensemble Manager: `mint-ensemble-manager/src/config/config.json` - API endpoints, auth settings, execution backends
- GraphQL: `graphql_engine/config.yaml` - Hasura configuration

**Core Logic:**
- Frontend Redux: `ui/src/app/store.ts`, `ui/src/app/reducers.ts`, `ui/src/app/actions.ts`
- Feature Screens: `ui/src/screens/{modeling|datasets|models|regions|analysis|variables|messages|emulators}/` - Each has own actions.ts, reducers.ts
- GraphQL Client: `ui/src/util/graphql_adapter.ts` - Conversion functions and GraphQL utilities
- Ensemble Execution: `mint-ensemble-manager/src/classes/tapis/`, `mint-ensemble-manager/src/classes/localex/` - Backend adapters
- Model Catalog Integration: `ui/src/model-catalog-api/` - API client wrapper

**Testing:**
- Frontend: `ui/jest/` - Jest configuration; test files co-located as `*.test.ts` or in `__tests__/` directories
- Ensemble Manager: `mint-ensemble-manager/` - Jest config in `jest.config.js`; test files co-located as `*.test.ts`
- Integration: `mint/tests/` - Test infrastructure

## Naming Conventions

**Files:**
- **Components:** `kebab-case.ts` (e.g., `mint-app.ts`, `problem-statements-list.ts`, `dataset-selector.ts`)
- **Utilities:** `snake_case.ts` (e.g., `graphql_adapter.ts`, `ui_functions.ts`, `state_functions.ts`)
- **Redux:** `{name}.ts` for both actions and reducers (e.g., `actions.ts`, `reducers.ts` in each feature directory)
- **Screens:** Screen directories use lowercase with hyphen (e.g., `modeling-home/`, `datasets-home/`)
- **Config:** `kebab-case.ts` or `camelCase.ts` (e.g., `default-graph.ts`, `graphql.ts`)
- **Tests:** `*.test.ts` or `*.spec.ts` (e.g., `ckan-data-catalog.test.ts`)

**Directories:**
- **Feature Screens:** `ui/src/screens/{feature-name}/` - Each screen is a self-contained module
- **Utilities:** `ui/src/util/` - General utilities; `ui/src/util/datacatalog/` - Specialized subdomain
- **Components:** `ui/src/components/` - Reusable UI components
- **GraphQL Queries:** `ui/src/queries/{domain}/` - Organized by business domain
- **API Routes:** `mint-ensemble-manager/src/api/api-v1/paths/` - Routes organized by resource type
- **Services:** `mint-ensemble-manager/src/api/api-v1/services/` - Business logic services

## Where to Add New Code

**New Feature Screen (UI):**
- Create directory: `ui/src/screens/{feature-name}/`
- Add files: `{feature-name}-home.ts` (main component), `actions.ts`, `reducers.ts`, `ui-actions.ts`, `ui-reducers.ts` (if UI state needed)
- Register reducer: Import and call `store.addReducers()` in main component (see `ui/src/screens/modeling/modeling-home.ts` line 26-28)
- Create GraphQL queries: Add to `ui/src/queries/{feature-name}/` directory
- Pattern: Extend `PageViewElement` in main component, use `connect(store)(FeatureName)` mixin, implement `stateChanged(state: RootState)`

**New Utility Function:**
- Location: `ui/src/util/` (or `ui/src/util/{domain}/` if specialized)
- Naming: Use `snake_case.ts` for file; export functions and types
- If GraphQL-related: Add to `graphql_adapter.ts` or create new adapter file; use conversion pattern (ToGQL/FromGQL)
- If data-catalog related: Implement interface from `data-catalog-adapter.ts` base class

**New API Endpoint (Ensemble Manager):**
- Location: `mint-ensemble-manager/src/api/api-v1/paths/{resource}.ts`
- Pattern: Export function with JSDoc for OpenAPI documentation, use Express `Request`/`Response` types
- Service Layer: Create corresponding service in `mint-ensemble-manager/src/api/api-v1/services/{resource}Service.ts`
- GraphQL Client: Use injected GraphQL client from service dependencies
- Error Handling: Catch errors, return standardized response with appropriate HTTP status code

**New Component:**
- Location: `ui/src/components/`
- Naming: Use `kebab-case.ts` with `@customElement()` decorator
- Pattern: Extend `LitElement`, use `@property()` decorator for props, implement `render()`, define styles
- State: If component needs Redux, use `connect(store)(ComponentName)` mixin and implement `stateChanged()`

**New GraphQL Query:**
- Location: `ui/src/queries/{domain}/{operation-name}.graphql` or `ui/src/queries/{domain}/` as TypeScript file
- Pattern: Use `graphql-tag` for template strings; organize by domain (modeling, datasets, regions, etc.)
- Fragment Reuse: Import from `ui/src/queries/fragments/` for common field sets
- Type Generation: Use GraphQL Code Generator if adding queries to schema

## Special Directories

**`ui/assets/`:**
- Purpose: Static assets (images, videos, fonts)
- Generated: No
- Committed: Yes
- Subdirectories: `images/` (with `indicators/`, `manifest/`, `thumbnails/`), `fonts/`, `videos/`

**`ui/thirdparty/`:**
- Purpose: Third-party components and libraries
- Generated: No
- Committed: Yes
- Example: `google-map/` - Custom Google Maps integration component

**`ui/offline_data/`:**
- Purpose: Static data for offline functionality or demo mode
- Generated: No
- Committed: Yes

**`mint-ensemble-manager/dist/`:**
- Purpose: Compiled JavaScript output from TypeScript webpack build
- Generated: Yes (by `npm run build`)
- Committed: No

**`model-catalog-fastapi/src/openapi_server/`:**
- Purpose: Auto-generated FastAPI route handlers from OpenAPI schema
- Generated: Yes (by `generate-server.sh` from openapi.yaml)
- Committed: Yes (generated code is version controlled)

**`graphql_engine/migrations/`:**
- Purpose: Versioned database schema changes
- Generated: No (manually created)
- Committed: Yes
- Pattern: Each migration is a directory with timestamp prefix (e.g., `1662641297914_init/`)

**`graphql_engine/metadata/`:**
- Purpose: Hasura GraphQL schema metadata (which database tables expose in GraphQL, which fields are queryable)
- Generated: No (created and edited via Hasura UI or YAML)
- Committed: Yes

**`mint/releases/`:**
- Purpose: Versioned release artifacts and documentation for each MINT version
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-02-14*
