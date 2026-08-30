# Model Catalog ETL

**A one-time migration tool. The migration is finished.**

MINT v1.x kept the model catalog in an RDF triplestore (Apache Jena Fuseki) and queried
it with SPARQL. v2.0 keeps it in PostgreSQL and serves it as GraphQL through Hasura. This
pipeline is what moved the data across. It reads the RDF TriG dump, turns the triples into
relational rows, and loads them into the `modelcatalog_*` tables.

The v2.0 platform reads PostgreSQL directly. No service and no deployment runs this
pipeline. It is kept because three jobs still need it:

- **Seed a new database.** A fresh cluster, or a local development stack, starts empty.
- **Reload after a schema change.** Run with `--clear` to truncate and load again.
- **Audit the migration.** Run with `--validate-only` to compare the RDF source against
  the tables.

Use it for those. Do not add it to a deployment.

## Getting the TriG source file

The file is not in this repository, and the Fuseki endpoint it came from
(`endpoint.models.mint.tacc.utexas.edu`) is retired. The surviving copy lives in
[`mintproject/model-catalog-endpoint`](https://github.com/mintproject/model-catalog-endpoint)
at `data/model-catalog.trig` (about 25 MB). That repository is not archived. Download the
file and pass its path with `--trig-path`.

Do not rely on the built-in default. It still names `model-catalog-endpoint/`, a submodule
the single-repo cutover removed.

## Prerequisites

- Python 3.9+
- PostgreSQL with the `modelcatalog_*` schema applied (see `graphql_engine/migrations/`)
- The TriG file, from above

## Setup

```bash
pip install -r etl/requirements.txt
```

## Connecting to the Database

If the database is running on Kubernetes, port-forward the PostgreSQL service first:

```bash
kubectl -n mint port-forward svc/mint-hasura-db 5432:5432
```

Then run the ETL in a separate terminal with `--db-host localhost`.

To retrieve the database password from the cluster secret:

```bash
kubectl -n mint get secret mint-secrets -o jsonpath='{.data.HASURA_GRAPHQL_DATABASE_URL}' | base64 -d
```

## Usage

Run the full pipeline (extract, transform, load, validate):

```bash
python3 etl/run.py --trig-path <path>/model-catalog.trig
```

Three wrappers in `scripts/` drive this against a real database. They handle the
port-forward, the credentials and, for production, a backup first. Prefer them over calling
`run.py` by hand:

| Script | Target |
|--------|--------|
| `scripts/test-migration-local.sh` | Local Docker stack |
| `scripts/test-migration-devel.sh` | The MicroK8s development cluster |
| `scripts/run-migration-prod.sh` | TACC production. Takes a backup, pins the dump by md5 |

### Options

| Flag | Description |
|------|-------------|
| `--trig-path PATH` | Path to the TriG file. Always pass it; the built-in default names a removed directory |
| `--clear` | Truncate all tables before loading (useful for reruns) |
| `--validate-only` | Skip ETL, only run validation against existing data |
| `--db-host HOST` | Database host (default: `localhost`) |
| `--db-port PORT` | Database port (default: `5432`) |
| `--db-name NAME` | Database name (default: `postgres`) |
| `--db-user USER` | Database user (default: `postgres`) |
| `--db-password PASS` | Database password (default: `postgres`) |

All database parameters can also be set via environment variables: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `TRIG_FILE`.

## Pipeline Stages

1. **Extract** (`extract.py`) -- Parses the TriG file with `rdflib.Dataset` and extracts 6 entity types via SPARQL queries: Software, SoftwareVersion, ModelConfiguration, ModelConfigurationSetup, DatasetSpecification, Parameter.

2. **Transform** (`transform.py`) -- Inverts parent-child RDF predicates (`sd:hasVersion`, `sd:hasConfiguration`, `sd:hasSetup`) into FK columns and builds junction table rows for I/O and parameter links.

3. **Load** (`load.py`) -- Batch inserts into PostgreSQL using `psycopg2.extras.execute_batch` in FK-dependency order. Idempotent via `ON CONFLICT DO NOTHING`.

4. **Validate** (`validate.py`) -- Compares entity counts between the TriG source (SPARQL) and PostgreSQL target (SQL), checks junction tables, runs sample spot-checks, and reports orphaned entities.

## Entity Counts (expected)

| Entity Type | Table | Count |
|-------------|-------|-------|
| Software (`sdm:Model`) | `modelcatalog_software` | ~42 |
| SoftwareVersion | `modelcatalog_software_version` | ~66 |
| ModelConfiguration | `modelcatalog_model_configuration` | ~91 |
| ModelConfigurationSetup | `modelcatalog_model_configuration_setup` | ~158 |
| DatasetSpecification | `modelcatalog_dataset_specification` | ~1,224 |
| Parameter | `modelcatalog_parameter` | ~1,784 |

## Notes

- The pipeline is **idempotent** -- rerunning produces the same result. Use `--clear` for a clean reload.
- Some entities have **nullable FK columns** (orphans with no identifiable parent in the RDF data). These are logged during transform but still loaded.
- Software entities are typed as `sdm:Model` in the TriG data, not `sd:Software`.
