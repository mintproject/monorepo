# Model Catalog Embeddings Integration

Status: Implementing

## Objective

Move semantic embedding generation, catalog indexing, and semantic search into
the existing `model-catalog-api` service so the MINT Tapis deployment does not
need a separate semantic-search image or pod.

## User need

The deployed stack currently cannot create the standalone semantic-search pod
because Tapis rejects `ghcr.io/mintproject/semantic-search` as an unapproved
custom image. Semantic search is also a catalog capability, so its public API
and lifecycle should be owned by the Model Catalog API.

## Current code/system summary

`semantic-search-service/main.py` is a separate FastAPI service that loads
`sentence-transformers/all-MiniLM-L6-v2`, reads model-catalog tables directly,
updates `modelcatalog_standard_variable.semantic_text` and `embedding`, accepts
Hasura event webhooks, and serves `/search`.

`model-catalog-api` is a Node 20/Fastify service that already owns the catalog
REST API and reads/writes the same Hasura-backed catalog. Its image is already
permitted by Tapis. The embedding migration defines a 384-dimensional vector,
an HNSW cosine index, and the `search_standard_variables` SQL function.

## Proposed design

1. Add a Node embedding provider backed by Transformers.js/ONNX using the same
   MiniLM model and normalized 384-dimensional output as the current Python
   service. Keep the provider behind an internal boundary and serialize model
   work so CPU-heavy inference cannot run without limits on the Fastify request
   path.
2. Put semantic search routes and catalog-event handling in `model-catalog-api`.
   Preserve `/search` and `/events/catalog` contracts so the SVO UI and Hasura
   metadata need only change their host URL.
3. Keep embedding inference behind an `EmbeddingProvider` interface. Load one
   process-wide model instance lazily, with the model identifier, cache path,
   and refresh interval configurable through environment variables. Expose
   separate process, database, model, and index readiness states.
4. Keep catalog indexing asynchronous. Hasura events wake a serialized,
   coalesced incremental refresh loop, while a bounded periodic refresh handles
   writes that bypass Hasura. Search remains read-only and uses the existing
   pgvector/hybrid-score query path. Cap query length, result limits, and
   concurrent inference work.
5. Add the minimum direct PostgreSQL configuration required by the indexing
   implementation to the Model Catalog API pod. Existing Hasura credentials
   remain unchanged; the database URL is passed through the protected deploy
   workflow in the same way as the current semantic-search pod.
6. Authenticate Hasura event-trigger requests with a shared deployment secret;
   reject unauthenticated webhook calls and do not expose the database or admin
   secret in the webhook contract.
7. Remove the standalone semantic-search pod registration, image-matrix entry,
   compose service, and deployment health gate. Point the Hasura webhook and
   SVO client at the Model Catalog API endpoint.
8. Retain the migration-before-indexer startup ordering and fail deployment if
   Model Catalog health or schema/search verification fails.

## Files likely affected

- `model-catalog-api/package.json` and `package-lock.json` — add the Node
  inference/runtime dependency.
- `model-catalog-api/src/semantic-search.ts` — provider, indexing, and search logic.
- `model-catalog-api/src/app.ts` — register semantic routes and health state.
- `model-catalog-api/src/index.ts` — stop the embedding service during shutdown.
- `model-catalog-api/Dockerfile` — include deterministic model artifacts or a
  controlled runtime cache strategy.
- `model-catalog-api/README.md` — document configuration and endpoints.
- `model-catalog-api/src/__tests__/*` — provider, route, SQL, and lifecycle tests.
- `compose.yaml` — point Hasura and SVO at Model Catalog; remove standalone
  semantic-search service.
- `.github/workflows/build-mint-dev-images.yml` — remove the standalone image
  matrix entry.
- `.github/workflows/deploy-mint-dev-pods.yml` — remove standalone startup and
  health steps; verify Model Catalog search readiness.
- `deploy/tapis/register_mint_stack.py` and its tests — remove semantic pod
  registration and set the Model Catalog webhook/database environment.
- `graphql_engine/metadata/tables.yaml` — keep event triggers, resolve their
  webhook through the Model Catalog API URL, and add an authenticated header.
- `docs/deploy/mint-dev-pods.md` and the prior state-sync design — document the
  consolidated service and deployment ordering.

## API/schema changes

The existing embedding migration and `search_standard_variables` function
remain authoritative. A forward-only compatibility migration repairs the
already-intended `modelcatalog_etl_process_contract` table when a persistent
database reports the earlier ETL migration as applied without exposing the
table or its `contracts` relationship. It adds no new logical API surface and
does not load seeds or ETL data.

The Model Catalog API will serve:

- `GET /search?q=<text>&limit=<1-100>`
- `POST /events/catalog`
- `GET /health` with embedding readiness information

The response contract remains compatible with the current semantic-search
service. The Hasura webhook target changes from the standalone pod URL to the
Model Catalog API pod URL.

Required runtime configuration is `DATABASE_URL`,
`SVO_EMBEDDING_MODEL`, `SVO_EMBEDDING_REFRESH_SECONDS`,
`SVO_EMBEDDING_BATCH_SIZE`, and `SVO_SEMANTIC_SEARCH_WEBHOOK_SECRET`.
`GET /health` remains `200` when catalog/Hasura is healthy and reports semantic
states separately; `/search` returns `503` until the model and database index
are ready. The webhook returns `401` unless its shared header is present.

## Data flow

Catalog write → Hasura event trigger → Model Catalog `/events/catalog` →
asynchronous index refresh → normalized embedding written to PostgreSQL.

SVO search request → Model Catalog `/search` → shared embedding provider →
hybrid pgvector/full-text query → standard variables and linked models.

Deployment → PostgreSQL migration → Model Catalog starts and loads the model →
health/search readiness verification → Hasura metadata apply → dependent pods.
The protected `Deploy MINT Dev Pods` workflow can repeat this sequence from a
feature branch with `image_tag=codex-model-catalog-embeddings` and
`pod_prefix=mintemb`, isolating the pod and volume group.

## Risks and tradeoffs

- Node inference may differ numerically from Python unless the model revision,
  pooling, normalization, and vector conversion are matched exactly.
- The Model Catalog image becomes larger and uses more CPU/memory at startup.
- Runtime model downloads would make startup dependent on external network access;
  the preferred rollout is to pin and package the model artifact in the image,
  with a documented cache fallback only if image size is unacceptable. The first
  implementation may use a pinned cache download, but deployment must fail
  visibly if the model cannot load.
- Direct PostgreSQL access expands the Model Catalog pod's database permissions;
  use the least-privileged existing database credentials and never log the URL.
- A full reindex must not run synchronously on every catalog event or block HTTP
  requests; refreshes remain serialized and asynchronous.
- The event endpoint must be authenticated and bounded because Hasura retries
  delivery and the endpoint is otherwise an externally triggerable expensive
  operation.
- Rollback to an image without the embedding routes leaves Hasura metadata pointing
  at a missing endpoint. Rollback therefore includes restoring the previous
  webhook configuration or rolling back the whole stack together.

## Alternatives considered

- Keep semantic search as a separate Python service: lowest code risk, but it
  requires Tapis administrator allowlisting and another managed pod/image.
- Fold it into the SVO Adapter: runtime-compatible, but gives the SVO planning
  service ownership of catalog search and couples its availability to embedding
  inference.
- Put Python behind a child process or multi-process composite container: avoids
  a second Tapis pod but complicates process supervision, health reporting, and
  signal handling.
- Port only search to Model Catalog while retaining a separate embedding worker:
  cleanest scaling boundary, but still requires a second permitted runtime and
  does not solve the immediate Tapis allowlist constraint.

## Test plan

- Unit-test the provider's model configuration and output dimension, plus the
  service's deterministic mocked indexing/search behavior.
- Compare fixed text fixtures against Python-generated vectors and require the
  agreed cosine-distance tolerance before removing the Python service.
- Test search SQL parameterization, limits, empty-result behavior, and response
  shaping with mocked database rows.
- Test event-trigger acknowledgment and serialized refresh scheduling; refresh
  failures are captured in the health status for visible deployment diagnosis.
- Test `/health` behavior before and after embedding readiness.
- Test webhook authentication, query length/concurrency limits, and degraded
  catalog behavior while the model is unavailable.
- Run Model Catalog TypeScript build/tests, deployment-script tests, YAML parsing,
  Python compilation, and repository diff checks.
- Use dry-run deployment specs to verify the Model Catalog pod receives the
  webhook and database configuration and no semantic pod is selected.
- Build the production-shaped Node image and run an ONNX inference smoke test
  confirming the configured MiniLM conversion returns 384 dimensions.
- Require the protected deployment smoke test to query the nested ETL
  `contracts` relationship as well as problem statement events.

## Documentation plan

Update the Model Catalog README, local Compose instructions, Tapis deployment
runbook, and state-sync design to describe the consolidated API, environment
variables, model artifact strategy, readiness behavior, and rollback procedure.

## Rollout/rollback plan

Build and publish only the existing `model-catalog-api:develop` image, with the
embedding runtime included. Apply the existing migrations, including the
forward-only ETL contract compatibility repair, first. Deploy
Model Catalog and verify `/health` and `/search`, then apply Hasura metadata and
restart dependent services. Do not delete the existing PostgreSQL volume.

If readiness or compatibility verification fails, stop before metadata apply and
restore the prior webhook configuration. The standalone semantic-search pod
definition remains available in git history for a temporary rollback only; no
automatic downgrade of database migrations is performed.

## Open questions

- Whether the target Tapis pod has sufficient memory for the in-process ONNX
  model and catalog indexing workload.
- Whether the image build environment can package the pinned model artifact
  without exceeding registry/image limits. The current first rollout uses the
  Transformers.js cache download and fails visibly if it cannot load.
- Exact cosine-distance tolerance for Node/Python fixture compatibility.

## Decisions

### 2026-09-11 - Make Model Catalog the semantic-search owner

- **Decision:** Consolidate semantic search into `model-catalog-api`.
- **Reason:** Search is a catalog capability, and the Model Catalog image is
  already permitted by Tapis.
- **Alternatives rejected:** SVO Adapter ownership was runtime-compatible but
  crossed the service boundary; a separate service remains blocked by the Tapis
  image allowlist.
- **User feedback:** User approved trying this architecture.
- **Impact on implementation:** Replace the standalone service/pod with Node
  routes and an embedding provider in the Model Catalog image.

### 2026-09-11 - Isolate integration testing

- **Decision:** Add a prefixed manual workflow that delegates to the existing
  Tapis registration logic and stages PostgreSQL, Hasura, Model Catalog, event
  verification, and dependent pods in order.
- **Reason:** Feature-branch images need realistic Tapis validation without
  mutating the shared `mintdev*` resources.
- **Alternatives rejected:** Reusing the develop pod IDs risks disrupting the
  active stack; direct interactive pod execution is not available in this
  deployment model.
- **User feedback:** User requested a dedicated branch and staged pod testing.
- **Impact on implementation:** Add `register_mint_test_stack.py` and
  `.github/workflows/test-mint-catalog-stack.yml`; test volumes remain separate.

### 2026-09-11 — Record implementation shape and rollout boundary

- **Decision:** Keep the provider, indexer, and search query in the dedicated
  `semantic-search.ts` module, and use the feature-branch image tag only in the
  prefixed integration workflow; the normal protected deployment continues to
  select `develop`.
- **Reason:** This keeps generated CRUD handlers separate from embedding
  lifecycle code while allowing realistic branch-image testing without changing
  shared `mintdev*` pods.
- **Alternatives rejected:** Creating a second embedding module hierarchy was
  unnecessary for the current service size; testing the branch image against
  shared develop resources would violate the isolation requirement.
- **User feedback:** User required a dedicated branch and staged pod testing,
  and previously required the normal deployment to use the `develop` tag.
- **Impact on implementation:** The new workflow accepts an explicit branch
  image tag and prefix, while `deploy-mint-dev-pods.yml` remains pinned to
  `develop`. The first rollout downloads the configured model into the
  Transformers.js cache at runtime; a revision/artifact pin remains follow-up
  hardening rather than a prerequisite for this branch test.

### 2026-09-11 - Keep isolated Tapis registration unprivileged

- **Decision:** Isolated pod specs omit Tapis-level CORS fields and set the
  isolated UI origin only in Hasura's application configuration.
- **Reason:** Tapis treats all changes to the shared `default` networking CORS
  object as an `APPROVEDADMIN` operation, including wildcard origins.
- **Impact on implementation:** The prefixed stack can be created by the
  protected deploy workflow without requesting elevated Tapis permissions.

### 2026-09-11 - Allow schema-only migration on a fresh test volume

- **Decision:** The two existing data-repair migrations conditionally insert
  rows only when their referenced catalog entities are present.
- **Reason:** A fresh isolated volume has the schema but no ETL-loaded catalog;
  the live test explicitly avoids seeds and must still verify service wiring.
- **Impact on implementation:** Populated databases retain the prior repair
  behavior. ETL or a deliberate restore remains required for catalog data.

### 2026-09-11 — Upsert dependent pods in isolated deployments

- **Decision:** Prefixed workflow runs upsert and verify `ui`, `ensemble`, and
  `svo` instead of using restart-only mode; the shared `mintdev*` path remains
  restart-only.
- **Reason:** A newly isolated stack does not have those application pod
  definitions yet, so restart-only mode correctly refused the missing
  `mintembensemble` pod after the earlier gates had passed.
- **Alternatives rejected:** Precreating the pods manually would bypass the
  protected workflow and make the test sequence non-reproducible.
- **User feedback:** User approved proceeding with the fix and live test.
- **Impact on implementation:** The protected workflow now uses the existing
  registration wrapper and image-verification logic to create missing
  prefixed pods, then records them as ready in the job summary.

### 2026-09-11 — Repair applied migration drift for ETL contracts

- **Decision:** Add forward-only idempotent migration
  `1771200025000_modelcatalog_etl_process_contract_repair` and require the
  protected workflow smoke test to request `modelcatalog_etl_process.contracts`.
- **Reason:** The live isolated GraphQL endpoint exposed the parent ETL table
  but not its contract table or relationship even though the original
  migration was marked applied; the previous smoke test did not exercise the
  failing field.
- **Alternatives rejected:** Editing the original applied migration would not
  run on existing volumes; seeds or ETL would not create the missing schema;
  manually mutating Hasura would bypass the protected deploy workflow.
- **User feedback:** User approved proceeding with the repair after the live
  ETL page continued to fail.
- **Impact on implementation:** Add the repair migration, expand both
  workflow schema smoke tests, reapply metadata, and verify the live `/etl`
  GraphQL path after redeployment.

### 2026-09-11 — Verify anonymous UI relationship permissions

- **Decision:** Grant the anonymous role read access to the public ETL contract
  fields and the problem-statement event name, and run the schema smoke test
  without the Hasura admin secret.
- **Reason:** The live admin metadata check passed while the anonymous UI role
  still omitted `contracts` and `events`; Hasura role schemas can hide a
  relationship when its target table has no select permission.
- **Alternatives rejected:** Testing only with the admin secret reproduces the
  false-positive deployment; broad anonymous access to all contract/event
  columns would expose more data than the UI requires.
- **User feedback:** User approved continuing after the first deployment
  attempt failed to resolve the UI behavior.
- **Impact on implementation:** Add least-privilege anonymous metadata,
  require anonymous nested relationship coverage in both workflows, rebuild
  Hasura, include the UI's contract ordering fields in the smoke query, and
  verify the live UI query.

## Implementation result

Implemented on `codex/model-catalog-embeddings`. The standalone semantic-search
image/pod was removed from Compose, image builds, Tapis registration, and the
normal deployment sequence. The API now owns `/search`, `/events/catalog`, the
pgvector index refresh loop, authenticated Hasura event delivery, and semantic
health status. Live isolated Tapis resources use the `mintemb*` prefix. The
isolated workflow upserts dependent pods that do not exist yet, while the
normal `mintdev*` path remains restart-only for those services. The follow-up
ETL contract repair is additive and is verified by the nested-relationship
schema smoke test.

## User feedback / decisions

- User asked to try folding embeddings into the Model Catalog API after the
  standalone image was rejected by Tapis.
