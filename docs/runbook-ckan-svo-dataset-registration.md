# Runbook: Registering CKAN Datasets So MINT Discovers Them via SVO

## How discovery actually works

MINT does not query CKAN live at request time. The `svo-adapter-service` pulls CKAN
resources into its own `adapter.data_object` table via a one-way sync
(`svo-adapter-service/app/ckan_sync.py`, endpoint `POST /admin/sync-from-ckan`):

1. `_fetch_all_resources` paginates `GET {CKAN_URL}/api/3/action/package_search`
   (optionally filtered by `organization:{org}` via `fq`), collecting every
   resource across every result package.
2. `_resource_to_data_object` inspects each **resource** (not the parent package)
   and skips it unless it has both a `url` and a non-empty `mint_standard_variables`
   value.
3. `mint_standard_variables` is parsed as a comma-separated list of short variable
   names (works whether CKAN returns it as a string or a list).
4. Each short name is looked up in `STDVAR_TO_SVO` (`ckan_sync.py`) to resolve the
   full registered MINT/SVO URI. Unmapped names are **skipped** and reported as a
   warning. If every declared name is unmapped, the resource is not imported.
5. The resource's `format` is normalized (upper-cased) and mapped through
   `CKAN_FORMAT_TO_ADAPTER` to the adapter's format token (e.g. `TIF` → `geotiff`).
   Unrecognized formats are dropped silently (the data object is created without a
   `format` field).
6. The result is reconciled as one `adapter_data_object` row per resource, keyed by
   `id = "ckan-{resource_id}"`. Each sync transaction replaces that object's variable
   children with the current CKAN list. Removing all usable annotations removes the
   stale CKAN-owned object, so repeated syncs are idempotent.
7. `source_catalog` is set to `ckan:{package_name}` so `/datasets/find` can group
   sibling resources back into one dataset entry.

Nothing in this path is triggered by a CKAN webhook. Sync happens either on
service startup (if `SVO_ADAPTER_CKAN_SYNC_ON_STARTUP=true`) or on demand via
`POST /admin/sync-from-ckan`. **A dataset published to CKAN is invisible to MINT
until this sync runs.**

## Multiple SVOs on one resource

A single CKAN resource can declare more than one standard variable: put a
comma-separated list in `mint_standard_variables`
(e.g. `groundwater__hydraulic_head,land_surface__subsidence_rate`). `_parse_stdvars`
splits on commas (works whether CKAN hands back a string or a list), each name is
resolved independently through `STDVAR_TO_SVO`, and every resolved name becomes its
own entry in the resource's `variables` list — all attached to the same
`data_object` row. A name with no mapping is dropped with a warning; the rest of
the list still syncs.

The synchronizer replaces existing variable children and inserts the current set
in one Hasura mutation. This avoids duplicate child rows without requiring a
database uniqueness migration.

### Version-specific MODFLOW archives

Complete simulation archives use a version-specific archive label in addition
to any scientific variables verified inside the bundle:

| MODFLOW version | Archive label |
|---|---|
| 6 | `groundwater_model_modflow6_simulation_archive` |
| 2000 | `groundwater_model_modflow2000_simulation_archive` |
| 2005 | `groundwater_model_modflow2005_simulation_archive` |
| 96 | `groundwater_model_modflow96_simulation_archive` |

An archive compatible with more than one version may carry more than one of
these labels. Do not replace contained-variable annotations when adding the
archive label. The adapter maps `SIMULATION-ARCHIVE`, `ZIP`, `ZIPX`, and `7Z`
to its model-archive `zip` format; shapefile evidence is still required for
`shapefile-zip`.

## Naming conventions (Scientific Variables Ontology)

`STDVAR_TO_SVO` short names aren't arbitrary strings — they follow the CSDMS
Standard Names grammar that the [Scientific Variables Ontology](https://scientificvariablesontology.org/)
(SVO) formalized and extended. `ckan_sync.py` uses explicit mappings because some
canonical MINT records have uppercase or UUID identifiers. Therefore **the short
name must be grammar-valid, registered in the target MINT catalog, and explicitly
mapped**; dictionary membership alone is not proof that the remote record exists.

**Structure: `object__quantity`**
([CSN Basic Rules](https://csdms.colorado.edu/wiki/CSN_Basic_Rules)) — every name
has exactly one **double underscore (`__`)**, separating the *object* part (the
phenomenon/thing observed) from the *quantity* part (the property or process
measured on it). Examples already in `STDVAR_TO_SVO`:

| Name | Object | Quantity |
|---|---|---|
| `groundwater__hydraulic_head` | `groundwater` | `hydraulic_head` |
| `land_surface__subsidence_rate` | `land_surface` | `subsidence_rate` |
| `groundwater_well__pumping_volume_flow_rate` | `groundwater_well` | `pumping_volume_flow_rate` |
| `land_subsurface_water__recharge_volume_flux` | `land_subsurface_water` | `recharge_volume_flux` |

**Delimiter rules within each part:**

- **Single underscore (`_`)** joins separate words within the object or quantity
  part (`groundwater_well`, `pumping_volume_flow_rate`).
- **Hyphen (`-`)** binds words that form one multi-word concept treated as a
  single unit (e.g. `water_carbon-dioxide__solubility`).
- **Tilde (`~`)** in the object part separates a noun from trailing adjectives,
  written noun-first (`bear~black~alaskan` rather than `black_alaskan_bear`) —
  rare in the mappings currently in this repo, but valid if you need it.
- Lowercase letters and digits only; no spaces.

**Adjective/word ordering:**

- In the **object** part, adjectives go *after* the noun, separated by `~`,
  most-general to most-specific.
- In the **quantity** part, adjectives go *before* the base quantity, most-general
  to most-specific leftward (`conductivity` → `hydraulic_conductivity` →
  `saturated_hydraulic_conductivity`).

**Quantity-part composition (from SVO's Property/Process Name Rules and the
flux/flow-rate schema — see `knowledge-base/wiki/property-names.md`,
`process-names.md`, `fluxes-and-flow-rates.md`):**

- Property names are usually nominalized adjectives (`wide` → `width`); process
  names are nominalized verbs (`recharge`, `pumping`, `drainage`).
- A **process quantity** pairs a process name with a property name
  (`pumping_volume_flow_rate` = process `pumping` + flow quantity
  `volume_flow_rate`).
- Conserved-quantity families follow a fixed suffix pattern on one of the 7 root
  quantities (charge, energy, mass, moles, momentum, number, volume): `_flux`,
  `_flow_rate`, `_concentration`, `_fraction`, `_ratio`, `_diffusivity`.
- A mathematical **operation** prefixes the quantity part and always ends in the
  reserved word `_of` (`divergence_of_...`, `time_derivative_of_...`); these can
  chain.

**Where to look before inventing a name:**

1. Search the live MINT standard-variables catalog first — this is the same
   endpoint the CKAN autocomplete widget (`mint_variable_string_autocomplete`
   preset) queries. Use the `/v2.0.0/standardvariables` endpoint for the target
   deployment and confirm the returned record ID, not just its label.
2. Browse/search the ontology itself at
   [scientificvariablesontology.org](https://scientificvariablesontology.org/) —
   the "Get Ontology" and search pages let you check whether a concept already
   exists; the "Design Patterns" section
   ([documentation.html](https://scientificvariablesontology.org/documentation.html))
   walks through constructing new variables (Phenomenon + Property, then adding
   Process, Context, and Role for compound concepts) if nothing matches.
3. Cross-check the [CSN Object Templates](https://csdms.colorado.edu/wiki/CSN_Object_Templates)
   and [CSN Quantity Templates](https://csdms.colorado.edu/wiki/CSN_Quantity_Templates)
   pages for existing object/quantity vocabulary before coining new words.
4. Only after confirming the name is correct and either already registered or
   worth registering, add it to `STDVAR_TO_SVO` in `ckan_sync.py` — that dict is
   MINT's local cache of the mapping, not the source of truth for what's a valid
   SVO name.

## Best practices for registering a dataset

1. **Set `mint_standard_variables` on the resource, not the package.** Confirm the
   CKAN dataset schema you're using defines this field under `resource_fields`
   (`mint_dataset.yaml`, `ckan_dataset.yaml`, and the corrected
   `subside_dataset.yaml`) — not under top-level `dataset_fields`.

2. **Use exact short names already known to the adapter.** Check
   `STDVAR_TO_SVO` in `svo-adapter-service/app/ckan_sync.py` for the canonical list.
   If your variable isn't listed, follow the lookup order in
   [Naming conventions](#naming-conventions-scientific-variables-ontology) below
   before coining a new one, then add it to `STDVAR_TO_SVO` (a small PR) before
   publishing — otherwise the resource syncs but drops that variable with a
   warning.

3. **Set `format` to a value `CKAN_FORMAT_TO_ADAPTER` recognizes** (BAS, CBB/CBC,
   CSV, DDN, DIS, ESRI REST, EVT, GEOTIFF/TIF/TIFF, HDS, JSON/GEOJSON, LPF,
   NETCDF/NC, PARQUET, RCH, SHP/SHAPEFILE, WEL, ZIP/ZIPX/7Z).
   Anything else still creates the data object but without a format hint, which
   can break downstream compatibility checks in the planner.

   Ordinary model archives remain `zip`; only resources explicitly identified as
   shapefiles by name, URL, or `resource_type=shapefile` become `shapefile-zip`.

4. **Always set `url`** on the resource — resources without one are skipped
   entirely, not just unmapped.

5. **For GIS/boundary layers** (management areas, GCDs, counties, DFC planning
   areas), also populate the optional metadata fields the sync recognizes:
   `boundary_type`, `geometry_type`, `arcgis_layer_id`, `arcgis_query_field`,
   `arcgis_name_field`, `feature_count`, `source_authority`, `source_updated`,
   `source_notes`, `source_page`, `source_package`. These get folded into
   `variable.metadata_json`. `spatial_type`/`crs` default to `polygon`/`EPSG:4326`
   for the known boundary SVOs but can be overridden per resource.

6. **Dry-run before writing.** Call `POST /admin/sync-from-ckan?dry_run=true`
   (optionally `&org=<slug>` to scope it) first and read the `warnings` array —
   it lists every unmapped `mint_standard_variables` value by resource ID. Fix
   those before re-running with `dry_run=false`.

7. **Naming/idempotency:** package and resource names don't need to be
   MINT-specific. The adapter derives a stable `data_object` ID from the CKAN
   resource ID and authoritatively replaces its variable children on each sync.

## Common pitfalls

- Setting `mint_standard_variables` at the dataset (package) level instead of the
  resource level — package annotations are not synchronized.
- Typos in the standard-variable short name — no hard failure, just a dropped
  variable buried in `warnings`.
- Forgetting the dry run — a bad `mint_standard_variables` value is easy to miss
  once the object already exists without that variable attached.
- Relying on CKAN's own search/webhooks to reflect changes in MINT immediately —
  it requires an explicit or startup-triggered `sync-from-ckan` call.

## Audit and correction result: `twdb-gams` (2026-09-20)

All 36 datasets in `twdb-gams` were reviewed. The approved correction was
applied through `scripts/reconcile_ckan_svos.py` with fixed package/resource IDs,
expected-before drift checks, snapshots, rollback values, and immediate read-back.

- The nine reviewed package-level SVO lists were removed from their packages and
  attached to ten complete model archives. Seymour has both a legacy ZIP and the
  current 7Z model bundle, so both carry the reviewed list.
- Eleven reviewed polygons are now package-level CKAN `spatial` extras. The 21
  duplicate resource-level polygons were cleared only after each package value
  was written and read back.
- Capitan Reef now has eight scientifically annotated resources: BAS, DDN, DIS,
  EVT, HDS, LPF, RCH, and WEL. Its reports and MODFLOW control-only files no
  longer misuse the SVO field.
- PARQUET, DDN, MODFLOW package formats, ZIPX, and 7Z are represented in the
  adapter mapping. Model archives normalize to `zip`; explicit shapefile bundles
  normalize to `shapefile-zip`.
- No package or resource was deleted or recreated. All 36 package IDs and every
  resource ID were preserved, and the protected NTGAM records were unchanged.
- Final verification reported 73/73 actions already applied, zero pending, and
  zero drift.

Archive resources without a reviewed variable list remain untagged. Do not infer
the complete scientific contents of an uninspected archive merely from its GAM
label; add annotations after source or archive evidence is available.

The CKAN metadata repair is live. The adapter reconciliation/format changes and
the corrected `subside_dataset` form schema are code changes that still require
their normal review and deployment before running the adapter database sync.

## References

- `svo-adapter-service/app/ckan_sync.py` — discovery/mapping logic (source of truth
  for supported variable names and formats).
- `svo-adapter-service/scripts/reconcile_ckan_svos.py` — drift-pinned TWDB SVO and
  spatial correction manifest (dry-run by default).
- `svo-adapter-service/app/main.py:815` — `POST /admin/sync-from-ckan` endpoint.
- `svo-adapter-service/examples/test-etl-dataset/ckan-manifest.json` — worked
  example manifest with a correctly-placed resource-level `mint_standard_variables`.
- `docs/design/2026-09-09-svo-etl-piece-registration.md` — design context for the
  CKAN/adapter/Tapis data boundary.
- `ckan-docker/src/ckanext-dso_scheming/ckanext/dso_scheming/mint_dataset.yaml` —
  correct resource-level schema definition.
- `ckan-docker/src/ckanext-dso_scheming/ckanext/dso_scheming/subside_dataset.yaml` —
  corrected dataset-level spatial and resource-level SVO field placement.
- `graphql_engine/migrations/1771300000000_svo_adapter_schema/up.sql` —
  `adapter.data_object_variable` schema (no unique constraint on
  `(data_object_id, standard_variable_uri)`).
- [scientificvariablesontology.org](https://scientificvariablesontology.org/) —
  SVO home, ontology browser, and design-pattern documentation.
- [CSDMS Standard Names — Basic Rules](https://csdms.colorado.edu/wiki/CSN_Basic_Rules),
  [Object Templates](https://csdms.colorado.edu/wiki/CSN_Object_Templates),
  [Quantity Templates](https://csdms.colorado.edu/wiki/CSN_Quantity_Templates) —
  the `object__quantity` naming grammar SVO extends.
- `knowledge-base/wiki/scientific-variables-ontology.md`,
  `property-names.md`, `process-names.md`, `fluxes-and-flow-rates.md`,
  `mathematical-operations.md` — this repo's domain notes on SVO's conceptual
  model (Phenomenon/Property/Process, flux/flow-rate family, operation chaining).
