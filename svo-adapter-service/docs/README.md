# SVO Adapter documentation

The SVO Adapter has one reusable service API plus several application profiles. Keep
the reusable contract separate from profile-specific behavior when adding endpoints,
examples, or operational instructions.

## Start here

- [API reference](api.md) — endpoint catalog, grouped by scope
- [CKAN vs. Adapter boundary](ckan-vs-adapter-boundary.md) — where data, transform
  logic, runtime state, and objectives belong
- [Design records](design/) — dated implementation decisions and use-case designs

## Scope labels

The API reference uses these labels:

- **Core** — intended for any SVO Adapter deployment. In Swagger UI this is split
  into Registry, Planning, Workflows, Runs, and Catalog/objectives groups.
- **Integration** — shared plumbing for a deployment that connects the adapter to
  MINT, CKAN, Hasura, or Tapis. These endpoints are not tied to one scientific
  application, but may be optional in a deployment.
- **Use case: DFC/GAM** — Texas GMA/GAM adopted DFC target discovery, fan-out, and
  QA/QC behavior.
- **Use case: NTGAM forecast** — the NTGAM location/scenario/forecast workflow.
- **Operations** — synchronization and administrative operations for a configured
  live deployment.

An endpoint should be documented in the narrowest applicable section. If a new
use-case endpoint needs generic planner behavior, link to the Core operation instead
of duplicating its request/response contract.
