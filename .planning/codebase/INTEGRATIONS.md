# External Integrations

**Analysis Date:** 2026-02-14

## APIs & External Services

**Model Catalog API:**
- Service: Mint Project Model Catalog
- What it's used for: Metadata about scientific models (inputs, outputs, parameters), model configurations
- SDK/Client: `@mintproject/modelcatalog_client` 8.0.3-alpha.8
- Endpoint config: `model_catalog_api` in config (default: http://api.models.mint.local/v1.8.0)
- Integration files: `src/classes/mint/model-catalog-functions.ts`, `src/classes/mint/model-catalog-graphql-adapter.ts`

**Data Catalog (CKAN):**
- Service: Data Catalog via TACC CKAN instance
- What it's used for: Dataset discovery, metadata registration, data availability
- SDK/Client: Custom TypeScript implementation with HTTP requests
- Endpoint config: `data_catalog_api` in config (default: http://ckan.tacc.cloud:5000)
- Auth: API key via `data_catalog_key` JWT token
- Integration files: `src/classes/mint/data-catalog/TACC_CKAN_Datacatalog.ts`, `src/classes/mint/data-catalog-functions.ts`

**Tapis HPC System:**
- Service: Tapis v3 OAuth2 & Job Submission API
- What it's used for: Submit and monitor scientific model jobs on HPC resources
- SDK/Client: `@tapis/tapis-typescript` 0.0.55, tapipy (Python)
- Auth: OAuth2 with authorization_url (default: https://portals.tapis.io/v3/oauth2/authorize)
- Endpoint: `tapis.basePath` in config (default: https://portals.tapis.io)
- Config params: parallelism setting (default: 2 jobs concurrent)
- Integration files: `src/classes/tapis/`, `src/classes/tapis/jobs/index.ts`, `src/classes/tapis/adapters/`

**Model Catalog FastAPI Backend:**
- Service: MINT Model Catalog REST API
- What it's used for: GraphQL endpoint for querying/managing models, model runs, parameters
- Deployment: `src/` directory contains FastAPI application with Graphene GraphQL
- Technologies: FastAPI 0.85.1 + Uvicorn + GraphQL (Graphene 3.1.1)
- Authentication: JWT with RS256 algorithm
- Location: `/Users/mosorio/repos/mint/model-catalog-fastapi/`

## Data Storage

**Databases:**
- Hasura GraphQL Engine
  - Connection: GraphQL endpoint configured in UI/Ensemble Manager via `graphql.endpoint`
  - Protocol: WebSocket (subscriptions) + HTTP (queries/mutations)
  - Auth: JWT token in `Authorization` header
  - SSL configurable: `graphql.enable_ssl` in config
  - Integration: All graphql queries in `src/classes/graphql/` are executed against Hasura

- Redis
  - Purpose: Job queue backend (Bull.js), caching, session storage
  - Connection: `REDIS_URL` environment variable (default: redis://localhost:6379)
  - Usage: Bull queue for execution management (`EXECUTION_QUEUE_NAME`, `DOWNLOAD_TAPIS_OUTPUT_QUEUE_NAME`)
  - Client: Python redis library in Model Catalog, bull npm package in Ensemble Manager

**File Storage:**
- Local filesystem (development)
  - directories: `codedir`, `datadir`, `tempdir`, `logdir` configured in localex settings
  - URLs: `dataurl`, `logurl` point to local file:// paths

- AWS S3 (production)
  - Client: `@aws-sdk/client-s3` 3.525.0
  - Config: `data_server_extra` contains `region`, `bucket`, `access_key`, `secret_access_key`
  - Default region: `ap-south-1`
  - Default bucket: `mintdata`

**Caching:**
- Redis (via aioredis in FastAPI for Python)
  - fastapi-cache2 0.1.9 - Caching layer for FastAPI

## Authentication & Identity

**Auth Provider:**
- Keycloak (production) / Custom OAuth2
  - Implementation: JWT-based authentication with RS256 public key verification
  - Config files: `src/config/config.json` contains public key, auth_server, auth_realm, auth_client_id
  - Default auth server: https://auth.mint.isi.edu/
  - Default realm: production
  - UI Client ID: mint-ui
  - Ensemble Manager Client ID: me3
  - OAuth2 Adapter: `src/util/oauth2-adapter.ts` in UI handles token exchange and header attachment

- Tapis OAuth2 Integration
  - Supports multiple OAuth2 providers via Tapis
  - Authorization endpoint configured in `auth.authorization_url`
  - Default: https://portals.tapis.io/v3/oauth2/authorize

## Monitoring & Observability

**Error Tracking:**
- None detected - No Sentry/Rollbar integration found

**Logs:**
- Local file logging
  - Ensemble Manager: Logs written to local filesystem paths configured in localex
  - Model Catalog FastAPI: Console logging to stdout
  - Job execution logs stored in `logdir` and accessible via `logsService`
  - Tapis job logs: Retrieved via Tapis API and returned through `/v1/logs` endpoint
- Log retrieval API: `src/api/api-v1/paths/logs/` provides HTTP endpoints to fetch execution logs

## CI/CD & Deployment

**Hosting:**
- Kubernetes (primary production)
  - Namespace: `mint` (configurable)
  - Resource limits: 800m CPU, 2048Mi memory per pod (configurable)
  - Client integration: `@kubernetes/client-node` 0.21.0 for job submission
  - Manifests location: `/Users/mosorio/repos/mint/k8s/`

- Docker
  - Ensemble Manager Dockerfile: `Dockerfile` at project root
  - DinD (Docker-in-Docker) support for local execution via `docker:20.10.21-dind` service
  - Image name: `kcapd/ensemble-manager`
  - docker-compose.yml for local development stack with Redis, DinD, Ensemble Manager

**CI Pipeline:**
- Not detected - No GitHub Actions, GitLab CI, or Jenkins configurations found

**Build Commands:**
- UI: `npm run build`, `npm run create-build`, `npm run create-build-wildfire`
- Ensemble Manager: `npm run build` (webpack), `npm start` (run server)
- Model Catalog: Standard FastAPI deployment via Uvicorn

## Environment Configuration

**Required env vars:**
- `REDIS_URL` - Redis connection string (default: redis://localhost:6379)
- `DOCKER_HOST` - Docker daemon endpoint for local execution (default: tcp://localhost:2375)
- `PORT` - Server port (default: 3000)
- `VERSION` - API version string (default: v1)
- `ENSEMBLE_MANAGER_CONFIG_FILE` - Path to JSON config file (default: src/config/config.json)

**Configuration file structure** (`src/config/config.json`):
```json
{
  "data_catalog_api": "...",
  "data_catalog_type": "CKAN",
  "data_catalog_key": "JWT token",
  "model_catalog_api": "...",
  "ensemble_manager_api": "...",
  "graphql": { "endpoint": "...", "enable_ssl": true/false, "use_secret": true/false, "secret": "..." },
  "execution_engine": "tapis|localex",
  "tapis": { "parallelism": 2, "basePath": "..." },
  "localex": { "codedir": "...", "datadir": "...", "tempdir": "...", "logdir": "...", "dataurl": "...", "logurl": "...", "parallelism": 2 },
  "kubernetes": { "use": true, "namespace": "mint", "cpu_limit": "800m", "memory_limit": "2048Mi" },
  "auth_server": "...",
  "auth_realm": "production",
  "auth_client_id": "...",
  "auth": { "client_id": "...", "authorization_url": "...", "public_key": "...", "algorithms": ["RS256"] }
}
```

**Secrets location:**
- `.env` files are gitignored
- Kubernetes Secrets for production
- Docker environment variables in docker-compose.yml

## Webhooks & Callbacks

**Incoming:**
- Execution status callbacks from Tapis
  - Tapis Job Subscription Service: `src/classes/tapis/adapters/TapisJobSubscriptionService.ts`
  - Polls Tapis for job status updates asynchronously
  - Updates execution records in Hasura GraphQL

**Outgoing:**
- None detected - No outbound webhooks to external services

## Data Flow & Integration Points

**Main Integration Flow:**
1. **UI Layer** (`/Users/mosorio/repos/mint/ui/`) → GraphQL queries/subscriptions via Apollo Client
2. **GraphQL Engine** (Hasura) ← Data persistence and subscriptions
3. **Ensemble Manager** (`/Users/mosorio/repos/mint/mint-ensemble-manager/`) → Provides REST API endpoints
4. **Model Catalog** ← Fetches scientific model metadata
5. **Data Catalog (CKAN)** ← Discovers and registers datasets
6. **Tapis** ← Submits jobs, monitors execution status
7. **Kubernetes/Docker** ← Local execution backend
8. **File Storage** (S3/Local) ← Model outputs and data

**Execution Workflow:**
1. User creates subtask (model configuration) via UI
2. Ensemble Manager receives execution request
3. Service selects execution engine (Tapis or Local)
4. Job submitted with model metadata from Model Catalog
5. Execution status monitored via Tapis Job Subscription Service
6. Logs retrieved via logsService from Tapis or local filesystem
7. Results stored in Data Catalog (CKAN)
8. UI receives real-time updates via GraphQL subscriptions

---

*Integration audit: 2026-02-14*
