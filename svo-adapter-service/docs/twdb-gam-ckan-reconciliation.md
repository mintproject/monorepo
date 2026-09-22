# TWDB GAM CKAN reconciliation

`scripts/reconcile_twdb_gams.py` reconciles the complete TWDB groundwater-model
download table with the `twdb-gams` CKAN organization. It includes GAM,
alternative, and research models.

The script is dry-run by default. It snapshots the TWDB page, live CKAN
packages and schemas; checks every listed source URL; matches stable package and
resource identities; and writes `reconciliation-plan.json` without changing
CKAN.

```bash
python3 scripts/reconcile_twdb_gams.py --output /tmp/twdb-gam-audit
```

Review at least these generated files before publication:

- `reconciliation-plan.json`: package and resource actions and unresolved
  scientific metadata gaps.
- `ckan-packages-before.json`: rollback snapshot of existing records.
- `source-url-checks.json`: source availability, content type, and size.
- `model-page-evidence.json`: source text used for release and engine claims.

After explicit CKAN-write approval, use a Tapis token from `CKAN_API_TOKEN` or
pass a dotenv file containing `TAPIS_USERNAME` and `TAPIS_PASSWORD`:

```bash
python3 scripts/reconcile_twdb_gams.py \
  --output /tmp/twdb-gam-publish \
  --apply --yes \
  --credentials-file ../.env
```

The apply path performs a fresh audit, refuses publication if any TWDB URL is
unreachable, uses `package_patch`/`resource_patch` for exact matches, creates
missing records, and records every returned ID in `ckan-write-log.json`.
`ckan-readback-verification.json` confirms that every source package and URL is
present. Reruns resolve resources by canonical URL, so an interrupted run is
additive instead of duplicating completed resources.

## Scientific metadata policy

- A downloadable archive is not proof that outputs, a runnable model, units,
  datum, temporal coverage, or every possible variable are present.
- A complete model archive may carry a reviewed, resource-level
  `mint_standard_variables` list describing variables known to be contained in
  the bundle. Do not copy that list to reports, landing pages, grids, or
  geodatabases without direct evidence.
- Keep model ZIP/ZIPX/7Z resources distinct from shapefile ZIPs. Model bundles
  use `resource_type=model_archive` where the schema supports it and normalize
  to the adapter's `zip` format; only explicit shapefile bundles normalize to
  `shapefile-zip`.
- Preserve existing uploads and stable resource IDs. Do not recreate packages
  to repair metadata.
- Use `notspecified` when the source does not establish a standardized license;
  retain the TWDB use/limitations statement as provenance.
- Do not promote an approximate GMA or county envelope as an exact model-grid
  footprint. Record unverified coverage explicitly until the grid is inspected.
- Store reviewed spatial coverage once at dataset level, not on each resource.
- Keep alternative and research models discoverable, but label their category
  rather than presenting them as adopted GAMs.

The 2026-09-19 publication registered 32 source models and 178 authoritative
links. It preserved all prior package/resource IDs and left four separately
managed output/planning datasets unchanged.

The 2026-09-20 metadata correction moved nine reviewed SVO lists onto ten model
archives and promoted 11 identical resource polygons to dataset-level spatial
metadata, clearing 21 duplicate resource copies after read-back. The same
reconciler now carries a fixed temporal evidence manifest for all 32 model
datasets. It plans dataset-level `temporal_coverage_start` and
`temporal_coverage_end` values plus report provenance extras; a year-precision
period is represented as January 1 through December 31 of the cited years.
Use `scripts/reconcile_ckan_svos.py` for the idempotent audit/repair manifest.

The temporal range is labeled in the manifest as historical calibration,
transient simulation, a full configured historical/predictive model range, or
a steady-state calibration evidence window. It is not a statement that every
resource in the dataset contains observations for every day in the interval.

Run a read-only plan from `svo-adapter-service` with:

```bash
python3 scripts/reconcile_ckan_svos.py \
  --output /tmp/twdb-gam-temporal-dry-run \
  --credentials-file ../.env
```

Review `plan.json`, especially the 32 package actions and their temporal
evidence, before requesting an external CKAN write. The command remains dry-run
unless `--apply --yes` is explicitly supplied after approval.

Before resuming the full spatial migration, verify the live
`subside_dataset` schema exposes `spatial` under dataset fields rather than
resource fields. The local schema source in `ckan-docker` has that placement;
the reconciler will stop on readback if the deployed CKAN schema has not caught
up.
