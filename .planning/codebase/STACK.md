# Technology Stack

**Analysis Date:** 2026-02-14

## Languages

**Primary:**
- TypeScript 4.0+ - Used across Node.js backend (mint-ensemble-manager), frontend (UI), and build tooling
- JavaScript (ES5/ES6) - Primary runtime language in browser and Node.js
- Python 3.x - Model Catalog FastAPI backend service

**Secondary:**
- SQL - Data persistence via GraphQL engine (Hasura)
- YAML - Configuration files for Kubernetes and GraphQL engine metadata

## Runtime

**Environment:**
- Node.js 8.3+ (required for UI) - Browser and server runtime
- Python 3.x - Backend services (Model Catalog, GraphQL migration scripts)

**Package Manager:**
- npm - Primary package manager for all TypeScript/JavaScript projects
- pip - Python package management for FastAPI backend

## Frameworks

**Frontend:**
- LitElement 2.2.1 - Web Components framework for UI (`/Users/mosorio/repos/mint/ui`)
- React 16.13.1 - Secondary UI library (used alongside LitElement)
- Redux 4.0.0 - State management with Redux Thunk for async actions
- Apollo Client 3.7.1 - GraphQL client for queries and subscriptions

**Backend:**
- Express.js 4.17.1 - REST API framework for Ensemble Manager (`/Users/mosorio/repos/mint/mint-ensemble-manager/`)
- FastAPI 0.85.1 - Model Catalog API (`/Users/mosorio/repos/mint/model-catalog-fastapi/`)

**Testing:**
- Jest 24.1.0 (UI) / 29.7.0 (Ensemble Manager) - Unit and integration testing
- ts-jest 24.1.0 / 29.1.4 - TypeScript support for Jest
- jest-puppeteer 3.9.0 - E2E testing via headless browser
- Puppeteer 1.12.2 - Headless Chrome for E2E tests

**Build/Dev:**
- Webpack 4.39.1 (UI) / 5.75.0 (Ensemble Manager) - Module bundler and development server
- TypeScript 4.0-4.9 - Compilation and type checking
- Babel 7.x - JavaScript transpilation
- Gulp 4.0.0 - Task runner for UI builds
- Webpack Dev Server 3.1.14 - Development server with hot reload

**GraphQL:**
- graphql-ws 5.11.2 - WebSocket subscriptions for real-time updates
- graphql-tag 2.11.0-2.12.6 - GraphQL query parsing
- graphql-codegen - Code generation from GraphQL schema (Ensemble Manager)

## Key Dependencies

**Critical:**
- @apollo/client 3.7.1 - GraphQL query client for UI and Ensemble Manager
- @mintproject/modelcatalog_client 8.0.3-alpha.8 - Generated client for Model Catalog API
- @tapis/tapis-typescript 0.0.55 - Tapis HPC job submission SDK
- bull 4.10.2 - Redis-backed job queue for background processing
- axios 1.6.2 - HTTP client for API requests
- graphql 15.3.0 - GraphQL library for query parsing and validation

**Infrastructure:**
- redis 4.4.0rc2 (Python) - Caching and session storage in Model Catalog
- dockerode 3.2.1 - Docker API client for local execution
- @kubernetes/client-node 0.21.0 - Kubernetes API client for job orchestration
- @aws-sdk/client-s3 3.525.0 - AWS S3 client for cloud storage

**Development:**
- @babel/core 7.11.4 / 7.24.7 - Babel compiler core
- @babel/preset-typescript 7.10.4 / 7.24.7 - TypeScript preset
- tslint 5.12.1 - TypeScript linting (UI)
- eslint 8.0.0 - JavaScript linting (Ensemble Manager)
- prettier 3.2.5 - Code formatting
- nodemon 2.0.20 - File watcher for development

## Configuration

**Environment:**
- Window-based config system in UI: window.REACT_APP_* variables set at runtime
- File-based config: `src/config/config.json` in Ensemble Manager
- ENV vars for Docker/Kubernetes deployment: `REDIS_URL`, `DOCKER_HOST`, `TAPIS_BASE_PATH`, `PORT`

**Build:**
- `webpack/base.config.ts` - Base Webpack configuration
- `webpack/dev.config.ts` - Development mode configuration with hot reload
- `webpack/prod.config.ts` - Production build optimization
- `babel.config.js` - Babel transpilation settings
- `tsconfig.json` - TypeScript compiler options (strict mode, target ES5)
- Jest configuration inline in package.json or separate jest.config.js files

## Platform Requirements

**Development:**
- macOS/Linux/Windows with Node.js 8.3+
- Docker and Docker Compose for local services (Redis, DinD)
- Python 3.x for Model Catalog FastAPI
- Git for version control

**Production:**
- Kubernetes cluster or Docker Swarm
- Redis server for Bull queues and caching
- Hasura GraphQL Engine instance
- Tapis HPC portal (https://portals.tapis.io) for job execution
- Model Catalog API service (external)
- Data Catalog (CKAN) service (external)

---

*Stack analysis: 2026-02-14*
