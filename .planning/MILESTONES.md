# Milestones

## v2.0 DYNAMO Model Catalog GraphQL Migration (Shipped: 2026-03-15)

**Phases completed:** 4 phases, 25 plans, 8 tasks

**Key accomplishments:**
- Migrated 4,365+ model catalog entities from Apache Fuseki (RDF triplestore) to PostgreSQL via ETL pipeline covering 36 tables (6 entity + 14 junction + extended schema)
- Built new Node.js/TypeScript REST API (model-catalog-api-v2) at /v2.0.0/ backed by Hasura GraphQL, serving 46 resource types and 13 custom endpoints with v1.8.0 response format compatibility
- Migrated execution/thread FK references to new modelcatalog_* tables (234 executions, 87 thread_models classified, 0 orphans)
- Removed @mintproject/modelcatalog_client SDK from Ensemble Manager — replaced with direct Hasura GraphQL queries
- Disabled Fuseki (Jena/SPARQL) in Helm chart and removed model_catalog_api dependency from all config files
- Fixed has_accepted_values TEXT[] column and configuration_id WHERE clause bugs enabling E2E Ensemble Manager model run flows

---

