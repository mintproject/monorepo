# Architecture

**Analysis Date:** 2026-02-14

## Pattern Overview

**Overall:** Distributed microservices architecture with a monorepo containing multiple independent services and a frontend application.

**Key Characteristics:**
- Multi-service backend (Node.js and Python) communicating via GraphQL and REST APIs
- Redux-based state management in frontend with lazy reducer loading
- GraphQL as primary data layer (Hasura backend) for problem statements, tasks, and executions
- Service-oriented architecture with specialized backend services for different concerns
- Event-driven execution management with queue-based job processing

## Layers

**Frontend (LitElement + Redux):**
- Purpose: Single Page Application for scientific modeling workflows
- Location: `ui/src/`
- Contains: LitElement web components, Redux store with lazy-loaded reducers, GraphQL queries, component library
- Depends on: GraphQL API, Model Catalog API, Data Catalog API, OAuth2 providers
- Used by: End users interacting with MINT platform for problem statement and model configuration

**GraphQL/Data Layer (Hasura + PostgreSQL):**
- Purpose: Centralized data persistence and query orchestration
- Location: `graphql_engine/`
- Contains: Database migrations, GraphQL schemas, metadata configuration
- Depends on: PostgreSQL database, authentication providers
- Used by: All backend services and frontend for data operations

**Ensemble Manager API (Node.js/Express):**
- Purpose: Orchestrate scientific model ensemble executions and manage problem statements, tasks, and execution workflows
- Location: `mint-ensemble-manager/src/`
- Contains: REST API routes, execution services, GraphQL client integration, Tapis/local execution adapters
- Depends on: GraphQL API, Model Catalog API, Tapis HPC backend, Redis queues, Kubernetes
- Used by: Frontend for execution management; other services for inter-service communication

**Model Catalog API (FastAPI):**
- Purpose: Provide OpenAPI-based access to scientific model metadata and configuration
- Location: `model-catalog-fastapi/src/`
- Contains: OpenAPI-generated routes, domain models, query handlers
- Depends on: External model catalog data, Model Catalog client SDK
- Used by: Frontend and Ensemble Manager for model discovery and metadata retrieval

**Metadata & Configuration:**
- Purpose: Runtime configuration and catalog data management
- Location: `mint/` (helm charts, documentation, releases)
- Contains: Helm charts for Kubernetes deployment, documentation, schema definitions
- Depends on: Kubernetes cluster, service endpoints configuration
- Used by: Deployment and infrastructure teams

## Data Flow

**User Interaction Flow:**

1. User opens UI at `ui/src/index.ts` → loads `mint-app.ts`
2. Redux store initializes with `app/reducers.ts` (static) and lazy-loads feature reducers
3. User navigates → `actions.ts` dispatch thunk actions
4. Thunks call `graphql_adapter.ts` which uses Apollo Client
5. GraphQL queries (in `src/queries/`) execute against Hasura backend
6. Results update Redux state → components re-render via `stateChanged()` mixin

**Execution Flow:**

1. User configures ensemble in UI (screen: `screens/modeling/`)
2. UI dispatches `selectTask()` and related actions (stored in Redux)
3. Ensemble Manager API receives ensemble configuration via REST
4. Ensemble Manager queries Model Catalog API for model metadata
5. Ensemble Manager creates execution plan and submits to Tapis or local backend
6. Execution results flow back through GraphQL subscriptions to UI in real-time

**State Management:**

- Redux store in `app/store.ts` combines static (`app`, `modeling`, `analysis`, `modelCatalog`, `ui`) and lazy-loaded reducers (`models`, `datasets`, `regions`, `variables`, `emulators`, `messages`)
- Lazy reducers loaded via `lazyReducerEnhancer` when feature screens are accessed
- All async operations handled by Redux Thunk middleware
- State selectors in `util/state_functions.ts`

## Key Abstractions

**GraphQL Adapter:**
- Purpose: Abstract GraphQL client operations from components
- Examples: `util/graphql_adapter.ts`
- Pattern: Conversion functions (e.g., `regionToGQL()`, `regionFromGQL()`) transform between frontend types and GraphQL types

**Data Catalog Adapter:**
- Purpose: Unified interface to different data catalog implementations (CKAN, default)
- Examples: `util/datacatalog/data-catalog-adapter.ts`, `util/datacatalog/ckan-data-catalog.ts`
- Pattern: Adapter pattern with interface in base class, implementations for different catalog types

**Model Catalog API:**
- Purpose: Abstraction over Model Catalog SDK
- Examples: `model-catalog-api/model-catalog-api.ts`, `model-catalog-api/custom-apis/`
- Pattern: Static class wrapping SDK client, custom API classes extending generated ones

**OAuth2 Adapter:**
- Purpose: Handle authentication with multiple OAuth2 providers (Keycloak, Tapis)
- Examples: `util/oauth2-adapter.ts`
- Pattern: Static methods for token management, supports multiple grant types

**Execution Backends:**
- Purpose: Abstract different execution engines (Tapis HPC, local execution)
- Examples: `mint-ensemble-manager/src/classes/tapis/`, `mint-ensemble-manager/src/classes/localex/`
- Pattern: Common execution interface with backend-specific implementations

**Feature Screens:**
- Purpose: Self-contained feature modules with actions, reducers, components
- Examples: `screens/modeling/`, `screens/datasets/`, `screens/models/`
- Pattern: Each screen manages own Redux state with lazy loading; main component extends `PageViewElement`

## Entry Points

**Frontend Application:**
- Location: `ui/src/index.ts`
- Triggers: Browser navigation to UI URL
- Responsibilities: Polyfill detection, lazy imports mint-app component

**Main App Component:**
- Location: `ui/src/app/mint-app.ts`
- Triggers: Loaded by index.ts after polyfills
- Responsibilities: Router configuration, Redux store connection, render main layout with page routing, authentication

**Ensemble Manager Server:**
- Location: `mint-ensemble-manager/src/server.ts`
- Triggers: `npm start` or container startup
- Responsibilities: Express app initialization, API route registration, middleware setup

**GraphQL Engine:**
- Location: `graphql_engine/` (Hasura configuration)
- Triggers: Docker/Kubernetes container startup
- Responsibilities: Database schema migration, GraphQL endpoint exposure

## Error Handling

**Strategy:** Layered error handling with user-facing notifications and backend logging.

**Patterns:**

- **Frontend:** UI actions dispatch error actions → reducers store error state → components render error notifications via `notification.ts` component
- **GraphQL:** Query errors caught in Apollo Client → error details logged and dispatched to Redux
- **API:** Express middleware catches errors, returns standardized error responses with HTTP status codes
- **Execution:** Ensemble Manager catches job failures, stores in state, notifies user via GraphQL subscription updates

## Cross-Cutting Concerns

**Logging:**
- Frontend: `console.log/warn/error` (no centralized logging configured)
- Backend: Ensemble Manager uses Express logging, structured logging in services
- GraphQL: Query execution logged by Hasura

**Validation:**
- Frontend: Form validation in component `render()` methods; schema validation with `ajv` package
- Backend: OpenAPI validation in FastAPI; Ensemble Manager validates request payloads
- Data: GraphQL schema enforces field types; database constraints at PostgreSQL level

**Authentication:**
- OAuth2 adapter handles token acquisition and refresh
- Tokens passed in GraphQL headers (via `OAuth2Adapter.getAccessTokenHeader()`)
- Ensemble Manager validates JWT tokens in request middleware
- Keycloak integration for centralized auth (production)

---

*Architecture analysis: 2026-02-14*
