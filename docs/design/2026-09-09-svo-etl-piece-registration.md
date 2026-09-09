# SVO ETL Piece Registration and CKAN Test Dataset

Status: In Review

## Objective

Add an authenticated “ETL pieces” tab to the SVO Adapter UI. The tab will let a user register a reusable ETL piece with Python source, descriptive metadata, and SVO input/output contracts. The adapter will persist the piece as a transform registry entry and use its runtime definition when generating a Tapis workflow: lightweight pieces become Tapis/OWE `function` tasks containing the registered Python source, while heavyweight pieces reference configured Tapis apps as `tapis_job` tasks. The feature will also provide a small, reproducible test dataset manifest and a dry-run/apply workflow for registering that dataset in CKAN.

Non-goals: executing arbitrary Python submitted from the browser; embedding Python execution in the adapter service; changing the planner’s compatibility algorithm; or silently publishing data to CKAN.

## User need

**Primary user:** **[ASSUMPTION — confirm]:** an adapter administrator or scientific data engineer who understands SVO contracts, Python ETL conventions, and configured Tapis deployments.

**Secondary users:** **[ASSUMPTION — confirm]:** researchers who need to inspect registered pieces and use them in planned workflows, but do not manage runtime credentials.

**Job-to-be-done:** Register a reusable, discoverable transformation capability once so the planner can chain it and Tapis can execute the approved runtime implementation.

**Current pain:** The service already exposes `POST /transform-specs`, but the live UI has no form for entering a Python-backed piece, its contracts, or its runtime binding. Test data and CKAN registration are also not presented as a coherent onboarding path.

**Definition of success:** An authenticated user can open the new tab, enter valid metadata, Python source, a Tapis function/app binding, and one or more SVO input/output contracts; submit it; see the resulting registry entry; and use the included test dataset manifest to validate CKAN registration in dry-run mode before an explicitly confirmed CKAN write.

## Current code/system summary

- `svo-adapter-service` is a FastAPI sidecar with a static HTML/JavaScript UI.
- `GET/POST /transform-specs` already registers a transform spec and nested contracts through Hasura.
- `TransformSpecIn` already includes metadata, Tapis function/app fields, container information, parameter schema, and contracts.
- The adapter boundary document places executable transform logic in the adapter registry, data bytes and discoverable reference data in CKAN, and runtime execution in Tapis.
- CKAN resources are currently synchronized into adapter data objects by `POST /admin/sync-from-ckan`; the service has CKAN integration code but no user-facing dataset registration form.
- The existing UI has DFC and forecast navigation, authentication state, and admin setup controls.

## Proposed design

Architectural boundary for this pivot:

- ETL process registration and discovery will move toward a first-class Model Catalog entity/API.
- The SVO Adapter remains the owner of semantic planning, compatibility inference, transform DAG construction, and all existing use-case APIs.
- No DFC, NTGAM forecast, objective, readiness, CKAN synchronization, planning, or workflow-facing use-case endpoint will be removed or moved in this change.
- Any future Ensemble Manager execution integration must be introduced behind an internal adapter interface first; existing SVO Adapter use-case routes remain stable.

1. Add an “ETL pieces” navigation tab to the static SVO Adapter UI.
2. Add a registration form with:
   - identity: stable ID, name, version, description, transform type, method;
   - Python source editor as plain text, with client-side required/non-empty validation and a visible warning that source executes only in the configured Tapis/OWE runtime, not in the adapter;
   - runtime binding: hosted function or Tapis app/job; app pieces use Tapis app ID/version, while function pieces use the registered Python source and entrypoint;
   - optional parameters schema and environment/file-input JSON fields;
   - repeatable input and output SVO contract rows covering URI, unit, format, dimensionality, spatial type, CRS, temporal resolution, schema requirements, and catalog state.
3. Submit the form to the existing `POST /transform-specs` endpoint, placing the Python runtime definition in the existing `metadata` JSON object. App runtime binding uses the existing typed fields; function runtime binding uses a normalized metadata convention. Do not add a second registry API.
4. Add a registry list/detail view in the tab that reloads from `GET /transform-specs`, showing contracts and runtime binding status. Python source should be masked/collapsed by default and never displayed as executable UI content.
5. Add server-side validation for the new metadata convention: source must be a string for user-authored function pieces; source language must be Python; function pieces must declare an entrypoint; and app pieces must declare a complete Tapis app binding. Preserve compatibility with existing records using built-in `transform_type` code or legacy app fields.
6. Update workflow generation so each planned step chooses its task type independently. A user-source function piece becomes a Tapis/OWE `function` task using the registered Python source and entrypoint; an app-backed piece remains a `tapis_job` task using its registered Tapis app/version. A generated pipeline may mix both types.
7. Add a checked-in test dataset fixture and CKAN manifest under `svo-adapter-service/examples/`. The fixture will be small CSV/JSON data with a declared `mint_standard_variables` value matching an existing SVO mapping. Add a dry-run endpoint or command path that validates the manifest and reports the intended CKAN package/resource payload; actual CKAN creation/update remains an explicit operation using existing CKAN credentials and approval.
8. Keep the CKAN registration mechanism separated from transform registration: the ETL piece is stored in the adapter registry; the test data is published to CKAN; then `sync-from-ckan` makes it available as an adapter data object.

## Files likely affected

- `svo-adapter-service/app/models.py` — source metadata validation/request normalization if needed.
- `svo-adapter-service/app/main.py` — registration validation and test-dataset manifest validation/CKAN helper endpoint if required by the existing integration.
- `svo-adapter-service/static/index.html` — navigation and ETL registration/list view.
- `svo-adapter-service/static/js/main.js` — tab state, form serialization, registry loading, validation, and submit behavior.
- `svo-adapter-service/static/css/main.css` — editor, contract-row, and registry-list styling.
- `svo-adapter-service/examples/etl_piece_registration.json` — representative registration payload.
- `svo-adapter-service/examples/test-etl-dataset/` — small fixture plus CKAN manifest.
- `svo-adapter-service/tests/` — API validation and payload-shaping tests; static UI tests if the project has a suitable pattern.
- `svo-adapter-service/docs/api.md` and `svo-adapter-service/README.md` — endpoint and onboarding documentation.

## API/schema changes

Preferred path: reuse the existing `TransformSpecIn` and adapter tables. Store the source convention in `metadata`, for example:

```json
{
  "source": {"language": "python", "code": "...", "entrypoint": "transform"},
  "authoring": {"kind": "ui", "source_format": "python"}
}
```

The exact source substructure is **[ASSUMPTION — confirm]:** proposed and should be finalized during review. No database migration is expected unless review finds that source needs first-class versioning, access control, or retention semantics. CKAN registration should use the existing CKAN API integration, not adapter tables.

## Data flow

```text
UI form → POST /transform-specs (JWT)
       → FastAPI validates metadata/runtime binding
       → Hasura inserts adapter.transform_spec + contracts
       → edge recomputation
       → UI reloads registry

fixture + manifest → dry-run validation → explicit CKAN package/resource write
                   → POST /admin/sync-from-ckan
                   → adapter.data_object visible to planner/UI
```

## Risks and tradeoffs

- User-provided Python is executable content. Embedding it in a Tapis function task keeps execution in the configured Tapis/OWE runtime, but requires source-size limits, authorization, reviewability, and dependency restrictions. The adapter must not execute it locally.
- Reusing `metadata` avoids a migration and preserves current API shape, but makes source querying/version governance less structured.
- A CKAN write is an external mutation. Dry-run output and explicit approval are required; idempotent package/resource identifiers should be used to make retries safe.
- Browser-side JSON editing is flexible for scientific schemas but increases validation burden; the server remains authoritative.

## Alternatives considered

- Add a new first-class `etl_piece` database table: rejected for the first slice because the existing transform registry already models the same planner-facing capability.
- Execute submitted Python in FastAPI: rejected because it creates a code-execution and dependency-isolation surface outside Tapis.
- Require every piece to be a pre-registered Tapis app: rejected because small transformations should remain lightweight function tasks and generated DAGs need mixed task types.
- Publish the test dataset automatically on form submission: rejected because transform registration and CKAN data publication are separate concerns and CKAN writes require approval.

## Test plan

- Unit-test source metadata and runtime-binding validation, including missing/partial Tapis bindings and legacy records.
- Test the POST payload maps source metadata and contracts to the existing transform registry shape.
- Test manifest validation and deterministic CKAN package/resource payload generation without network writes.
- Add a browser-level or DOM test covering tab visibility, required-field validation, repeatable contracts, successful registration, and error display.
- Run the existing SVO adapter pytest suite and the UI test/build commands.

## Documentation plan

Update the adapter README with the new tab workflow, source-storage/runtime boundary, and test dataset onboarding. Update `docs/api.md` for any new validation or dry-run endpoint. Include a complete example payload and explain that CKAN publishing is explicit and separate from registering an ETL piece.

## Rollout/rollback plan

The UI is additive and can be rolled back by reverting the static assets and validation changes. Existing transform records remain readable because source metadata is optional. If a CKAN test package is created, rollback is a separate, explicitly approved CKAN deletion or deprecation action; the first rollout should prefer a unique development package slug.

## Open questions

- **[ASSUMPTION — confirm]:** Is the intended primary user an adapter admin/data engineer, or should ordinary researchers also be allowed to register pieces?
- Should source code be returned by `GET /transform-specs`, or should the list return only a source-present/version hash indicator?
- Should the first CKAN flow stop at dry-run payload generation, or is an authenticated “Publish test dataset” button required in this slice?
- What Tapis binding is the canonical runtime for the included example piece: function ID, app ID/version, or either selectable option?
- What concrete test transformation and SVO variables should the fixture demonstrate?

## Decisions

- User confirmed the feature should register reusable ETL pieces with Python source, metadata, and SVO contracts; execution remains through configured Tapis functions/apps.
- No arbitrary Python execution will be implemented in the adapter or browser.
- User-authored Python will execute only as a Tapis/OWE function task generated from the registered piece; the adapter itself will never execute the source.
- A generated workflow may mix user-source `function` tasks and pre-registered-app `tapis_job` tasks.
- Tapis function tasks are reusable adapter-registry definitions, not independently registered Tapis entities. Each generated Tapis pipeline materializes the selected function-task definitions inline.
- Cross-user reuse is based on shared registry visibility and versioned definitions; each consuming user receives a newly generated pipeline containing the referenced function task.
- The existing transform registry is the initial persistence boundary; CKAN remains the data catalog boundary.
- Existing SVO Adapter use-case APIs remain in place during the catalog/execution boundary transition.

## User feedback / decisions

- 2026-09-09: User selected the reusable-registration approach over direct Python execution.
- Pending: user review of the design choices and open questions above.
- Implementation: the ETL Pieces tab, existing registry integration, inline Python function-task materialization, mixed-task workflow test, and onboarding documentation are implemented. CKAN publishing remains intentionally outside this change and was not performed.
