# svo-adapter-service

FastAPI sidecar that plans SVO-to-SVO ETL pipelines to make data objects
model-ready for MINT. See [`../docs/svo-adapter-service.md`](../docs/svo-adapter-service.md)
for the full architecture.

## How this reuses MINT's existing PostgreSQL + Hasura architecture

- **Same database, new schema.** Tables live in a dedicated `adapter` schema in
  the same PostgreSQL instance as `modelcatalog_*`. No model-catalog table is
  altered. The migration is in `graphql_engine/migrations/` like every other
  MINT migration.
- **Same Hasura.** The 9 `adapter.*` tables are tracked in
  `graphql_engine/metadata/tables.yaml`. They get GraphQL CRUD for free, exactly
  like the model catalog.
- **Same access pattern.** This service reads/writes metadata **through Hasura
  GraphQL**, not via a private Postgres connection. Reads use the admin secret;
  user writes forward the caller's JWT — the `model-catalog-api` convention.
- **Same separation of concerns.** Hasura does CRUD. This service does only what
  Hasura can't: multi-dimensional compatibility, transform-path search, Tapis
  workflow generation, provenance.
- **Same "URI everywhere".** PKs are TEXT (URI-capable); cross-links to the model
  catalog are stored as URIs.

## MINT catalog sync

The adapter can pull ModelConfigurations directly from the MINT catalog (same
Hasura/Postgres) and register them as `adapter.transform_spec` rows.

```bash
# Preview what would be created/updated/deleted (no writes):
curl -X POST http://localhost:8090/admin/sync-from-mint?dry_run=true

# Run the sync (also triggers a background edge-recompute):
curl -X POST http://localhost:8090/admin/sync-from-mint

# Check state:
curl http://localhost:8090/admin/sync-status
```

**How it works:**

- Each MINT `ModelConfiguration` with at least one typed I/O presentation becomes
  one `transform_spec` row. Configs with no presentations (standalone models) are
  skipped.
- One contract is created per `(DatasetSpecification, VariablePresentation)` pair.
  Standard variable URIs and units are carried through to the BFS planner.
- `env_from_args` is built from MINT parameter labels following the convention
  table in `mint_sync.py`. Non-standard labels are warned and skipped.
- If a `ModelConfiguration` has `tapis_app_id` set, the generated Tapis pipeline
  uses a `tapis_job` task (batch HPC job). Without it, a hosted OWE `function`
  task runs using `task_code.get_code(transform_type)`.
- MINT is the sole source of truth: adapter rows whose `mint_model_config_id` no
  longer appears in MINT are deleted on the next sync. Hand-created rows (null
  `mint_model_config_id`) are never touched.
- `POST /admin/sync-from-mint` fires `recompute-edges` in the background whenever
  it creates, updates, or deletes rows, so multi-hop BFS planning is consistent
  immediately after sync.

**Startup sync:** set `SVO_ADAPTER_MINT_SYNC_ON_STARTUP=true` to run the sync
automatically when the service starts.

**Required env vars** (in addition to `SVO_ADAPTER_HASURA_GRAPHQL_URL`):

```
SVO_ADAPTER_HASURA_ADMIN_SECRET=<hasura-admin-secret>
```

The anonymous Hasura role does not have column-level access to the
`tapis_app_id`/`tapis_app_version` fields on `modelcatalog_configuration`, so the
admin secret is required for sync queries.

**Unresolved Tapis apps:** `GET /admin/sync-status` reports `unresolved_count` —
specs that were synced but have no `tapis_app_id`. These use OWE function tasks
until an admin registers the app in Tapis and sets `tapis_app_id` on the MINT
`ModelConfiguration`, then re-runs the sync.

## Layout

```
app/
  config.py      # settings (Hasura URL/secret, Tapis, geo_actor) via SVO_ADAPTER_*
  hasura.py      # async GraphQL client + all GraphQL queries/mutations
  mint_sync.py   # MINT catalog → adapter.transform_spec sync
  task_code.py   # OWE function task code builders (point_extract, unit_convert, …)
  models.py      # Pydantic models + the DataObjectContract
  planner.py     # six-dimension compatibility + BFS transform-path search
  tapis.py       # plan_json → Tapis Workflows pipeline + register/run
  store.py       # in-memory Hasura stub for demo mode
  main.py        # FastAPI endpoints
examples/        # sample request/response payloads
```

## Run (dev)

```bash
cd svo-adapter-service
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
export SVO_ADAPTER_HASURA_GRAPHQL_URL=http://localhost:8080/v1/graphql
export SVO_ADAPTER_HASURA_ADMIN_SECRET=...   # same Hasura as the model catalog
uvicorn app.main:app --reload --port 8090
```

Apply the schema first (from `graphql_engine/`): `hasura migrate apply && hasura metadata apply`.

## Demo UI (zero infra)

A bundled standalone single-page UI (`static/index.html`) walks the whole flow —
register the ETL pieces, check readiness, plan, generate, and run a Tapis
Workflows pipeline. **Demo mode** backs every Hasura call with an in-memory store
so it runs with no Hasura/Postgres/Tapis:

```bash
cd svo-adapter-service
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
SVO_ADAPTER_DEMO_MODE=1 uvicorn app.main:app --reload --port 8090
# open http://localhost:8090/  -> click "Load SUBSIDE WERC pieces" -> step through 1-6
```

Click **Load SUBSIDE WERC pieces** to seed the SUBSIDE pipeline as `transform_spec`s
(`POST /admin/seed-subside-werc`), then walk steps 1–6. "Submit run" defaults to
**dry-run** (registers + returns the pipeline definition without triggering Tapis —
no `workflows` grant needed). Headless equivalent: `python tests/test_demo_api.py`.

Same UI, real backend: drop `SVO_ADAPTER_DEMO_MODE` and point at a live Hasura
(the readiness/plan target can still be supplied inline via `target_contract`, so
a populated model catalog is optional).
