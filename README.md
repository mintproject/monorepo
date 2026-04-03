# MINT - Model INTegration

MINT is a scientific modeling platform that enables researchers to discover, configure, and execute computational models. It provides a unified catalog of models, datasets, and variables, allowing scientists to set up and run model ensembles for complex scenarios such as climate impact analysis, hydrology, and agriculture.

## Goals

- **Model Discovery:** Provide a searchable catalog of scientific models with rich metadata describing inputs, outputs, parameters, and supported regions/time periods.
- **Model Composition:** Enable researchers to connect models across disciplines (e.g., linking a climate model's output to an agriculture model's input) through shared standard variables.
- **Execution Orchestration:** Manage the configuration and execution of model runs, including ensemble runs with varying parameter sets.
- **Reproducibility:** Capture the full provenance of model setups -- software versions, configurations, input datasets, and parameters -- so experiments can be reproduced and shared.

## Architecture

The platform follows a layered architecture backed by PostgreSQL and exposed via GraphQL and REST APIs:

```
                +-----------+
                |    UI     |  (LitElement SPA)
                +-----+-----+
                      |
            +---------+---------+
            |                   |
    +-------v-------+   +------v--------+
    | Model Catalog |   |   Ensemble    |
    |   REST API    |   |   Manager     |
    |  (Fastify)    |   |  (Express)    |
    +-------+-------+   +---------------+
            |
    +-------v-------+
    | Hasura GraphQL|
    +-------+-------+
            |
    +-------v-------+
    |  PostgreSQL   |
    +---------------+
```

**Data flow:** Scientific model metadata is stored in PostgreSQL, exposed through Hasura GraphQL, and served to clients via a REST API that conforms to an OpenAPI specification. The ETL pipeline handles data migration from the legacy RDF triplestore into the relational database.

## Repository Structure

This monorepo uses git submodules for major components:

| Directory | Description | Stack |
|-----------|-------------|-------|
| `model-catalog-api/` | REST API v2.0.0 for the model catalog | TypeScript, Fastify |
| `mint-ensemble-manager/` | Model execution orchestration service | TypeScript, Express |
| `ui/` | Web frontend | TypeScript, LitElement |
| `graphql_engine/` | Hasura schema, migrations, and metadata | SQL, YAML |
| `etl/` | RDF-to-PostgreSQL migration pipeline | Python |
| `helm-charts/` | Kubernetes deployment charts | Helm |
| `model-catalog-ontology/` | OWL ontology defining the model catalog schema | OWL/RDF |
| `model-catalog-fetch-api-client/` | Generated API client library | TypeScript |
| `mint-instances/` | Preconfigured model instance data | - |
| `MINT_USERGUIDE/` | User documentation | MkDocs |
| `scripts/` | Deployment and maintenance utilities | Shell, SQL |

> **Note:** The `model-catalog-fastapi/` and `model-catalog-endpoint/` directories are legacy components from the old RDF/Fuseki-based architecture. They are no longer actively maintained and can be ignored. The platform now uses PostgreSQL with Hasura GraphQL as its data backend.

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.9+
- Docker (for running PostgreSQL and Hasura locally)

### Development

Each component can be developed independently. See the README in each submodule for detailed instructions.

```bash
# Clone with submodules
git clone --recurse-submodules https://github.com/mintproject/mint.git

# Model Catalog API
cd model-catalog-api
npm install && npm run dev

# UI
cd ui
yarn install && yarn start

# Ensemble Manager
cd mint-ensemble-manager
npm install && npm run start:watch
```

### Database Setup

```bash
# Apply Hasura migrations
cd graphql_engine
hasura migrate apply
hasura metadata apply

# Load data from RDF sources
python3 etl/run.py --trig-path model-catalog-endpoint/data/model-catalog.trig
```

## License

See individual submodule repositories for license information.
