# Phase 1: Schema and Data Migration - Research

**Researched:** 2026-02-14
**Domain:** PostgreSQL schema design, RDF/TriG data extraction, Hasura GraphQL, ETL pipelines
**Confidence:** HIGH

## Summary

Phase 1 migrates model catalog data from Apache Fuseki (RDF triplestore) to PostgreSQL/Hasura GraphQL. The source data is stored in TriG format (384,517 lines) with a 4-level hierarchy: Software > SoftwareVersion > ModelConfiguration > ModelConfigurationSetup, plus related I/O specifications and parameters. Entity counts from the TriG dump: 240 SoftwareVersion, 308 ModelConfiguration, 756 ModelConfigurationSetup, 5,374 DatasetSpecification (I/O), and 8,263 Parameter entities.

This research covers three key technical domains: (1) PostgreSQL schema design for hierarchical data with foreign keys, (2) RDF/TriG parsing and ETL pipeline construction in Python, and (3) Hasura CLI migration and metadata management for GraphQL API generation.

**Primary recommendation:** Use RDFLib (Python) to parse TriG files into a Dataset, extract entities with SPARQL queries, load into PostgreSQL using psycopg2's `execute_batch()` for performance, create Hasura migrations with the CLI, and validate with automated count reconciliation.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| rdflib | 7.x | TriG/RDF parsing | Official Python library with built-in TriG parser, Dataset support for quads |
| psycopg2 | 2.9.x | PostgreSQL adapter | Industry standard Python-PostgreSQL driver, supports batch operations |
| Hasura CLI | 2.x | Migration management | Official tool for generating SQL migrations and metadata configuration |
| pandas | Latest | Data validation | De facto standard for data manipulation and count reconciliation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| SQLAlchemy | 2.x | ORM abstraction | Optional - if schema design benefits from declarative models |
| Great Expectations | Latest | Data validation | If comprehensive data quality checks beyond count matching are needed |
| Apache Airflow | 2.x | Workflow orchestration | If ETL needs to be scheduled/automated post-migration |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| psycopg2 | psycopg3 | Psycopg3 is newer but psycopg2 has broader ecosystem support (2026) |
| Hasura CLI v2 | Hasura CLI v3 | v3 has different config structure; existing project uses v2 |
| rdflib | Custom parser | RDFLib handles namespaces, quads, and TriG format natively |

**Installation:**
```bash
pip install rdflib psycopg2-binary pandas
# Hasura CLI - install via official script or binary
curl -L https://github.com/hasura/graphql-engine/raw/stable/cli/get.sh | bash
```

## Architecture Patterns

### Recommended Project Structure
```
etl/
├── extract.py           # TriG parsing with rdflib
├── transform.py         # RDF to relational mapping
├── load.py              # PostgreSQL batch insert
├── validate.py          # Count reconciliation
└── config.py            # DB connection, namespaces

graphql_engine/
├── migrations/
│   └── [timestamp]_modelcatalog_schema/
│       ├── up.sql       # CREATE TABLE statements
│       └── down.sql     # DROP TABLE statements
└── metadata/
    └── tables.yaml      # Hasura relationship config
```

### Pattern 1: Hierarchical Foreign Keys with Adjacency List
**What:** Each child table has a foreign key to its parent (SoftwareVersion.software_id → Software.id)
**When to use:** For the 4-level hierarchy in model catalog (Software > SoftwareVersion > ModelConfiguration > ModelConfigurationSetup)
**Example:**
```sql
-- Source: PostgreSQL official docs + Hasura schema patterns
CREATE TABLE modelcatalog_software (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    description TEXT,
    keywords TEXT
);

CREATE TABLE modelcatalog_software_version (
    id TEXT PRIMARY KEY,
    software_id TEXT NOT NULL REFERENCES modelcatalog_software(id),
    version_id TEXT,
    label TEXT NOT NULL,
    description TEXT,
    author_id TEXT
);

CREATE TABLE modelcatalog_model_configuration (
    id TEXT PRIMARY KEY,
    software_version_id TEXT NOT NULL REFERENCES modelcatalog_software_version(id),
    label TEXT NOT NULL,
    description TEXT,
    usage_notes TEXT
);

CREATE TABLE modelcatalog_model_configuration_setup (
    id TEXT PRIMARY KEY,
    model_configuration_id TEXT NOT NULL REFERENCES modelcatalog_model_configuration(id),
    label TEXT NOT NULL,
    description TEXT,
    has_component_location TEXT
);

-- Index foreign keys for performance
CREATE INDEX idx_sv_software ON modelcatalog_software_version(software_id);
CREATE INDEX idx_mc_version ON modelcatalog_model_configuration(software_version_id);
CREATE INDEX idx_mcs_config ON modelcatalog_model_configuration_setup(model_configuration_id);
```

### Pattern 2: Junction Tables for Many-to-Many Relationships
**What:** Separate tables for multi-valued properties (inputs, outputs, parameters)
**When to use:** For `hasInput`, `hasOutput`, `hasParameter` relationships where one configuration can have multiple I/O specs
**Example:**
```sql
-- Source: Existing MINT schema patterns (model_input, model_output tables)
CREATE TABLE modelcatalog_input (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    description TEXT,
    format TEXT,
    has_dimensionality INTEGER,
    position INTEGER
);

CREATE TABLE modelcatalog_configuration_input (
    configuration_id TEXT REFERENCES modelcatalog_model_configuration(id),
    input_id TEXT REFERENCES modelcatalog_input(id),
    position INTEGER,
    PRIMARY KEY (configuration_id, input_id)
);

CREATE TABLE modelcatalog_output (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    description TEXT,
    format TEXT,
    has_dimensionality INTEGER,
    position INTEGER
);

CREATE TABLE modelcatalog_configuration_output (
    configuration_id TEXT REFERENCES modelcatalog_model_configuration(id),
    output_id TEXT REFERENCES modelcatalog_output(id),
    position INTEGER,
    PRIMARY KEY (configuration_id, output_id)
);
```

### Pattern 3: RDFLib Dataset Querying for Entity Extraction
**What:** Use rdflib.Dataset (not Graph) to parse TriG files and extract entities via SPARQL
**When to use:** TriG files contain named graphs (quads), Dataset handles this natively
**Example:**
```python
# Source: rdflib documentation
from rdflib import Dataset, Namespace

# Define namespaces matching TriG file
SD = Namespace("https://w3id.org/okn/o/sd#")
SDM = Namespace("https://w3id.org/okn/o/sdm#")
RDFS = Namespace("http://www.w3.org/2000/01/rdf-schema#")

# Load TriG file into Dataset
ds = Dataset()
ds.parse("model-catalog.trig", format="trig")

# Extract SoftwareVersion entities
query = """
PREFIX sd: <https://w3id.org/okn/o/sd#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?uri ?label ?desc ?versionId
WHERE {
    ?uri a sd:SoftwareVersion ;
         rdfs:label ?label .
    OPTIONAL { ?uri sd:description ?desc }
    OPTIONAL { ?uri sd:hasVersionId ?versionId }
}
"""

results = ds.query(query)
for row in results:
    print(row.uri, row.label, row.desc, row.versionId)
```

### Pattern 4: Batch Insert with psycopg2
**What:** Use `execute_batch()` to insert rows in batches, reducing roundtrips
**When to use:** Loading thousands of entities (756 ModelConfigurationSetup, 5,374 I/O specs)
**Example:**
```python
# Source: psycopg2 performance benchmarks
from psycopg2.extras import execute_batch
import psycopg2

conn = psycopg2.connect("dbname=postgres user=postgres")
cur = conn.cursor()

# Prepare data as list of tuples
rows = [
    ('https://w3id.org/okn/i/mint/topoflow_3.5', 'Topoflow v3.5', 'Topoflow 3.5', '3.5'),
    # ... more rows
]

# Batch insert (page_size defaults to 100, adjust for larger batches)
execute_batch(
    cur,
    "INSERT INTO modelcatalog_software_version (id, label, description, version_id) VALUES (%s, %s, %s, %s)",
    rows,
    page_size=100
)

conn.commit()
cur.close()
conn.close()
```

### Pattern 5: Hasura Metadata Relationship Configuration
**What:** Define GraphQL relationships in metadata/tables.yaml using foreign key constraints
**When to use:** After schema migration, to enable nested GraphQL queries
**Example:**
```yaml
# Source: Hasura metadata docs
- table:
    name: modelcatalog_software_version
    schema: public
  object_relationships:
    - name: software
      using:
        foreign_key_constraint_on: software_id
  array_relationships:
    - name: configurations
      using:
        foreign_key_constraint_on:
          column: software_version_id
          table:
            name: modelcatalog_model_configuration
            schema: public
```

### Anti-Patterns to Avoid
- **Manually tracking Hasura tables one-by-one:** Use `hasura metadata apply` to track all tables from YAML config at once
- **Loading entire TriG file into memory:** Use streaming or query results directly from rdflib Dataset
- **Single-row inserts in a loop:** Always use `execute_batch()` for bulk operations
- **Skipping index creation on foreign keys:** PostgreSQL doesn't auto-index FKs; manual indexes essential for query performance

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| RDF/TriG parsing | Custom turtle parser | rdflib with `format="trig"` | Handles namespaces, blank nodes, quads, Unicode escaping |
| SPARQL queries | String parsing RDF | rdflib's `ds.query()` | Built-in query engine with OPTIONAL, FILTER support |
| Database migrations | Raw SQL execution | Hasura CLI migrations | Version control, rollback, metadata sync, team collaboration |
| Batch inserts | Loop with `execute()` | `execute_batch()` or `execute_values()` | 20% faster, reduces server roundtrips |
| Count validation | Manual SQL queries | pandas with `value_counts()` | Handles aggregation, comparison, reporting in one library |
| Relationship inference | Manual FK detection | Hasura Console "Track All" | Auto-detects FK relationships and generates metadata |

**Key insight:** RDF triplestores abstract complex graph queries; mapping to relational requires explicit junction tables for multi-valued properties. Hasura auto-generates GraphQL from schema but relationships must be declared in metadata.

## Common Pitfalls

### Pitfall 1: Missing Dataset vs Graph Distinction
**What goes wrong:** Using `rdflib.Graph()` instead of `Dataset()` for TriG files causes parsing errors or loses named graph context
**Why it happens:** TriG is a multi-graph format (quads: subject-predicate-object-graph), Graph only handles triples
**How to avoid:** Always use `Dataset()` for TriG files: `ds = Dataset(); ds.parse("file.trig", format="trig")`
**Warning signs:** Parse errors mentioning "unexpected token" or missing triples when querying

### Pitfall 2: Namespace URI Typos in Schema Mapping
**What goes wrong:** Extracting wrong entities or missing data due to incorrect namespace URIs in SPARQL queries
**Why it happens:** RDF namespaces are case-sensitive and version-specific (e.g., `sd#` vs `sdm#`)
**How to avoid:** Extract namespaces directly from TriG file header; verify with `ds.namespaces()` method
**Warning signs:** SPARQL queries return 0 results despite entities existing in TriG file

### Pitfall 3: Forgetting to Index Foreign Keys
**What goes wrong:** Slow GraphQL queries on nested relationships (e.g., fetching all configurations for a software version)
**Why it happens:** PostgreSQL auto-indexes primary/unique keys but NOT foreign keys
**How to avoid:** Create `CREATE INDEX idx_name ON table(foreign_key_column)` for every FK in schema
**Warning signs:** GraphQL queries with relationships take >1s for small datasets (<1000 rows)

### Pitfall 4: Hasura Metadata Out of Sync with Schema
**What goes wrong:** Tables appear in database but not in GraphQL schema, or relationships are missing
**Why it happens:** Hasura metadata (tables.yaml) must be explicitly updated after schema changes
**How to avoid:** After running migrations: `hasura metadata reload` or use Console to "Track All" tables
**Warning signs:** GraphQL introspection doesn't show newly created tables

### Pitfall 5: Multi-valued Properties as Comma-Separated Strings
**What goes wrong:** Storing `hasInput` as "input1,input2,input3" string breaks relational integrity and GraphQL querying
**Why it happens:** Direct RDF-to-column mapping without considering cardinality
**How to avoid:** Always use junction tables for one-to-many or many-to-many relationships
**Warning signs:** Schema has TEXT columns with comma-separated IDs instead of foreign key tables

### Pitfall 6: Batch Insert Memory Exhaustion
**What goes wrong:** Loading 5,374 I/O specs or 8,263 parameters into memory causes OOM errors
**Why it happens:** Building entire row list before `execute_batch()` on large datasets
**How to avoid:** Use generator pattern or process in chunks: `for chunk in chunked(results, 1000): execute_batch(...)`
**Warning signs:** Python process memory usage spikes >2GB during ETL

### Pitfall 7: Missing Count Validation for Each Entity Type
**What goes wrong:** Silent data loss during migration (e.g., only 700 of 756 ModelConfigurationSetup loaded)
**Why it happens:** Assuming successful script execution means complete data transfer
**How to avoid:** Automated validation: count entities in TriG (SPARQL COUNT), count rows in PostgreSQL, assert equality
**Warning signs:** GraphQL queries return fewer results than expected from original Fuseki endpoint

## Code Examples

Verified patterns from official sources:

### Example 1: Complete TriG Extraction Pipeline
```python
# Source: rdflib docs + MINT schema patterns
from rdflib import Dataset, Namespace, URIRef
from collections import defaultdict

SD = Namespace("https://w3id.org/okn/o/sd#")
SDM = Namespace("https://w3id.org/okn/o/sdm#")
RDFS = Namespace("http://www.w3.org/2000/01/rdf-schema#")

ds = Dataset()
ds.parse("model-catalog.trig", format="trig")

# Extract ModelConfiguration entities with all properties
query = """
PREFIX sd: <https://w3id.org/okn/o/sd#>
PREFIX sdm: <https://w3id.org/okn/o/sdm#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?uri ?label ?desc ?versionId ?usageNotes
WHERE {
    ?uri a sdm:ModelConfiguration ;
         rdfs:label ?label .
    OPTIONAL { ?uri sd:description ?desc }
    OPTIONAL { ?uri sd:hasVersionId ?versionId }
    OPTIONAL { ?uri sd:hasUsageNotes ?usageNotes }
}
"""

configs = []
for row in ds.query(query):
    configs.append({
        'id': str(row.uri),
        'label': str(row.label),
        'description': str(row.desc) if row.desc else None,
        'version_id': str(row.versionId) if row.versionId else None,
        'usage_notes': str(row.usageNotes) if row.usageNotes else None
    })

print(f"Extracted {len(configs)} ModelConfiguration entities")
```

### Example 2: Multi-valued Property Extraction (Inputs/Outputs)
```python
# Source: rdflib SPARQL patterns
# Extract hasInput relationships
query_inputs = """
PREFIX sd: <https://w3id.org/okn/o/sd#>
PREFIX sdm: <https://w3id.org/okn/o/sdm#>

SELECT ?config ?input
WHERE {
    ?config a sdm:ModelConfiguration ;
            sd:hasInput ?input .
}
"""

config_inputs = defaultdict(list)
for row in ds.query(query_inputs):
    config_inputs[str(row.config)].append(str(row.input))

# Prepare junction table rows
junction_rows = []
for config_id, input_ids in config_inputs.items():
    for position, input_id in enumerate(input_ids, start=1):
        junction_rows.append((config_id, input_id, position))
```

### Example 3: Hasura Migration File Structure
```sql
-- File: graphql_engine/migrations/[timestamp]_modelcatalog_schema/up.sql
-- Source: Hasura migration best practices

BEGIN;

-- Core hierarchy tables
CREATE TABLE modelcatalog_software (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    description TEXT,
    keywords TEXT,
    license TEXT,
    website TEXT
);

CREATE TABLE modelcatalog_software_version (
    id TEXT PRIMARY KEY,
    software_id TEXT REFERENCES modelcatalog_software(id) ON DELETE CASCADE,
    version_id TEXT,
    label TEXT NOT NULL,
    description TEXT,
    author_id TEXT,
    keywords TEXT,
    has_source_code TEXT
);

CREATE TABLE modelcatalog_model_configuration (
    id TEXT PRIMARY KEY,
    software_version_id TEXT NOT NULL REFERENCES modelcatalog_software_version(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    description TEXT,
    usage_notes TEXT,
    keywords TEXT,
    has_component_location TEXT,
    has_implementation_script_location TEXT
);

CREATE TABLE modelcatalog_model_configuration_setup (
    id TEXT PRIMARY KEY,
    model_configuration_id TEXT NOT NULL REFERENCES modelcatalog_model_configuration(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    description TEXT,
    has_component_location TEXT,
    has_implementation_script_location TEXT
);

-- I/O and parameter tables
CREATE TABLE modelcatalog_dataset_specification (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    description TEXT,
    has_format TEXT,
    has_dimensionality INTEGER,
    position INTEGER
);

CREATE TABLE modelcatalog_parameter (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    description TEXT,
    has_data_type TEXT,
    has_default_value TEXT,
    has_minimum_accepted_value TEXT,
    has_maximum_accepted_value TEXT,
    position INTEGER
);

-- Junction tables
CREATE TABLE modelcatalog_configuration_input (
    configuration_id TEXT REFERENCES modelcatalog_model_configuration(id) ON DELETE CASCADE,
    input_id TEXT REFERENCES modelcatalog_dataset_specification(id) ON DELETE CASCADE,
    position INTEGER,
    PRIMARY KEY (configuration_id, input_id)
);

CREATE TABLE modelcatalog_configuration_output (
    configuration_id TEXT REFERENCES modelcatalog_model_configuration(id) ON DELETE CASCADE,
    output_id TEXT REFERENCES modelcatalog_dataset_specification(id) ON DELETE CASCADE,
    position INTEGER,
    PRIMARY KEY (configuration_id, output_id)
);

CREATE TABLE modelcatalog_configuration_parameter (
    configuration_id TEXT REFERENCES modelcatalog_model_configuration(id) ON DELETE CASCADE,
    parameter_id TEXT REFERENCES modelcatalog_parameter(id) ON DELETE CASCADE,
    position INTEGER,
    PRIMARY KEY (configuration_id, parameter_id)
);

-- Index all foreign keys for query performance
CREATE INDEX idx_sv_software ON modelcatalog_software_version(software_id);
CREATE INDEX idx_mc_version ON modelcatalog_model_configuration(software_version_id);
CREATE INDEX idx_mcs_config ON modelcatalog_model_configuration_setup(model_configuration_id);
CREATE INDEX idx_ci_config ON modelcatalog_configuration_input(configuration_id);
CREATE INDEX idx_ci_input ON modelcatalog_configuration_input(input_id);
CREATE INDEX idx_co_config ON modelcatalog_configuration_output(configuration_id);
CREATE INDEX idx_co_output ON modelcatalog_configuration_output(output_id);
CREATE INDEX idx_cp_config ON modelcatalog_configuration_parameter(configuration_id);
CREATE INDEX idx_cp_param ON modelcatalog_configuration_parameter(parameter_id);

COMMIT;
```

### Example 4: Count Validation Script
```python
# Source: ETL validation best practices
import psycopg2
from rdflib import Dataset

# Source counts from TriG
ds = Dataset()
ds.parse("model-catalog.trig", format="trig")

source_counts = {}
for entity_type in ['SoftwareVersion', 'ModelConfiguration', 'ModelConfigurationSetup']:
    query = f"""
    PREFIX sdm: <https://w3id.org/okn/o/sdm#>
    SELECT (COUNT(?uri) as ?count)
    WHERE {{ ?uri a sdm:{entity_type} }}
    """
    result = list(ds.query(query))
    source_counts[entity_type] = int(result[0][0])

# Target counts from PostgreSQL
conn = psycopg2.connect("dbname=postgres user=postgres")
cur = conn.cursor()

target_counts = {}
table_map = {
    'SoftwareVersion': 'modelcatalog_software_version',
    'ModelConfiguration': 'modelcatalog_model_configuration',
    'ModelConfigurationSetup': 'modelcatalog_model_configuration_setup'
}

for entity_type, table_name in table_map.items():
    cur.execute(f"SELECT COUNT(*) FROM {table_name}")
    target_counts[entity_type] = cur.fetchone()[0]

cur.close()
conn.close()

# Validate
print("Entity Count Validation:")
for entity_type in source_counts:
    source = source_counts[entity_type]
    target = target_counts[entity_type]
    match = "✓" if source == target else "✗ MISMATCH"
    print(f"  {entity_type}: {source} (TriG) -> {target} (PostgreSQL) {match}")

    if source != target:
        raise ValueError(f"Count mismatch for {entity_type}: expected {source}, got {target}")
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hasura CLI v1 migrations | Hasura CLI v2 with config.yaml | 2020 | Metadata separated from migrations, version control improved |
| `executemany()` for batch inserts | `execute_batch()` or `execute_values()` | psycopg2 2.7+ | 20%+ performance improvement on large datasets |
| Manual table tracking in Hasura | Auto-track via Console or CLI | Hasura v2.0+ | Relationship inference from FK constraints |
| rdflib-postgresql store | Direct ETL to PostgreSQL | 2024-2025 | Simplified architecture, avoids RDF-relational hybrid complexity |

**Deprecated/outdated:**
- **Hasura CLI config v1**: Pre-2020 format, migrations in `migrations/` without separate metadata directory
- **rdflib.Graph() for TriG**: Use Dataset() instead - Graph doesn't support named graphs/quads
- **`COPY` command for small datasets**: Overhead not worth it for <100K rows; `execute_batch()` simpler

## Open Questions

1. **Should Software entities be created as a top-level table?**
   - What we know: TriG file has `sd:hasVersion` relationships from Software to SoftwareVersion
   - What's unclear: Grep search returned 0 results for `sd#Software>` type declarations - only SoftwareVersion exists
   - Recommendation: Start with 3-level hierarchy (SoftwareVersion > ModelConfiguration > ModelConfigurationSetup) unless Software entities are discovered in TriG file; can add later if needed

2. **How to handle RDF blank nodes for nested structures?**
   - What we know: Some TriG entities may use blank nodes for complex properties
   - What's unclear: Extent of blank node usage in model catalog TriG dump
   - Recommendation: Initial SPARQL queries should use `OPTIONAL` clauses; if blank nodes are found, extract to separate helper tables

3. **Should parameter types (Adjustment vs standard Parameter) be distinguished at schema level?**
   - What we know: TriG has `<https://w3id.org/wings/export/MINT#Adjustment>` as a separate class
   - What's unclear: Whether this distinction is needed for GraphQL queries in Phase 2
   - Recommendation: Single `modelcatalog_parameter` table with optional `parameter_type` TEXT column; can normalize later if needed

4. **Optimal batch size for execute_batch()?**
   - What we know: Default `page_size=100` works well for most cases
   - What's unclear: Optimal size for 5,374 I/O specs and 8,263 parameters on target production database
   - Recommendation: Start with default 100, benchmark with 500 and 1000; adjust based on memory/network latency

## Sources

### Primary (HIGH confidence)
- [Hasura Migrations Best Practices](https://hasura.io/docs/2.0/migrations-metadata-seeds/migration-best-practices/)
- [RDFLib Documentation](https://rdflib.readthedocs.io/) - TriG parsing and SPARQL queries
- [PostgreSQL Foreign Keys Tutorial](https://www.postgresql.org/docs/current/tutorial-fk.html)
- [psycopg2 Performance Benchmark](https://naysan.ca/2020/05/09/pandas-to-postgresql-using-psycopg2-bulk-insert-performance-benchmark/)
- Existing MINT schema (graphql_engine/migrations/1662641297914_init/up.sql) - model/model_io/model_parameter table patterns

### Secondary (MEDIUM confidence)
- [Hierarchical Models in PostgreSQL](https://www.ackee.agency/blog/hierarchical-models-in-postgresql) - Adjacency list pattern
- [Hasura Metadata API Reference: Relationships](https://hasura.io/docs/2.0/api-reference/metadata-api/relationship/)
- [ETL Data Validation Guide](https://www.integrate.io/blog/data-validation-etl/)

### Tertiary (LOW confidence - requires verification)
- GitHub discussions on RDF to PostgreSQL migration strategies (various projects, not model-catalog specific)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified in official docs and have stable 2.x versions
- Architecture: HIGH - Patterns extracted from existing MINT schema and official PostgreSQL/Hasura docs
- Pitfalls: MEDIUM-HIGH - Common issues documented in community resources, validated against MINT codebase structure

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (30 days - stable technologies, PostgreSQL/Hasura have slow release cycles)
