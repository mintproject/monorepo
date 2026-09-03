"""Full ETL -> run the SUBSIDE forecast: every model input resolved from a source.

Exercises planner.plan_model_run against the MODFLOW->forecast bridge fixture.
Offline (no Hasura/Tapis). Run: python3 tests/test_forecast_plan.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.models import DataObjectContract  # noqa: E402
from app.planner import build_model_run_plan_json, find_path, plan_model_run  # noqa: E402

FIXTURE = ROOT / "examples" / "subside_forecast_transforms.json"


def _source(do: dict) -> DataObjectContract:
    var = do["variables"][0]
    return DataObjectContract(
        standard_variable_uri=var.get("standard_variable_uri"), local_name=var.get("local_name"),
        unit=var.get("unit"), format=do.get("format"), spatial_type=var.get("spatial_type"),
        crs=var.get("crs"), resource_uri=do.get("resource_uri"),
    )


def _load():
    data = json.loads(FIXTURE.read_text())
    registry = data["transform_specs"]
    run_spec = next(t for t in registry if t["id"] == data["forecast_run_spec_id"])
    sources = [_source(s) for s in data["sources"]]
    return registry, run_spec, sources


def test_all_inputs_resolve_and_forecast_runs():
    registry, run_spec, sources = _load()
    plan = plan_model_run(run_spec, sources, registry)

    # every forecast input is sourced
    assert plan["complete"] is True, [b for b in plan["branches"] if not b["source"]]
    by_var = {b["standard_variable_uri"].split("/")[-1]: [s["name"] for s in (b["path"] or [])]
              for b in plan["branches"]}
    assert by_var == {
        "groundwater__hydraulic_head": ["head-m-to-ft-msl"],   # MODFLOW head: m -> ft
        "aquifer__storativity": [],                            # ready as-is
        "land_surface__elevation": ["elevation-m-to-ft"],      # DEM: m -> ft
    }, by_var

    # the DAG: two conversions converge on the forecast run
    dag = build_model_run_plan_json(plan)
    names = [s["name"] for s in dag["steps"]]
    assert names[-1] == "subside-forecast"
    assert set(names[:-1]) == {"head-m-to-ft-msl", "elevation-m-to-ft"}
    run = dag["steps"][-1]
    assert sorted(run["depends_on"]) == sorted(s["step"] for s in dag["steps"][:-1])
    return plan, dag


def test_missing_source_reports_incomplete():
    """If a required input has no source, the plan is reported incomplete (not silently dropped)."""
    registry, run_spec, sources = _load()
    only_head = [s for s in sources if s.standard_variable_uri.endswith("groundwater__hydraulic_head")]
    plan = plan_model_run(run_spec, only_head, registry)
    assert plan["complete"] is False
    missing = [b["standard_variable_uri"].split("/")[-1] for b in plan["branches"] if not b["source"]]
    assert set(missing) == {"aquifer__storativity", "land_surface__elevation"}, missing


def test_raw_data_type_source_materializes_then_samples():
    ns = "https://w3id.org/okn/i/mint/"
    aquifer_top = ns + "aquifer__top_elevation"
    raw = DataObjectContract(
        data_type="ntgam_dis_geometry",
        format="zip",
        spatial_type="grid",
        resource_uri="https://ckan.tacc.utexas.edu/resource/ntgam_dis_geometry.zip",
    )
    target = DataObjectContract(
        standard_variable_uri=aquifer_top,
        unit="ft",
        spatial_type="point",
    )
    registry = [
        {
            "id": "ts-ntgam-derive-aquifer-top-grid",
            "name": "derive-ntgam-aquifer-top-grid",
            "contracts": [
                {
                    "role": "input",
                    "format": "zip",
                    "spatial_type": "grid",
                    "metadata_json": {"data_type": "ntgam_dis_geometry"},
                },
                {
                    "role": "output",
                    "standard_variable_uri": aquifer_top,
                    "unit": "ft",
                    "format": "geotiff",
                    "spatial_type": "grid",
                },
            ],
        },
        {
            "id": "sample-raster-at-point",
            "name": "sample-raster-at-point",
            "contracts": [
                {"role": "input", "spatial_type": "grid"},
                {"role": "output", "spatial_type": "point"},
            ],
        },
    ]

    path = find_path(raw, target, registry)
    assert [step["name"] for step in path] == [
        "derive-ntgam-aquifer-top-grid",
        "sample-raster-at-point",
    ]

    # A zip source with a different spatial_type (point_collection vs grid)
    # should NOT match the grid-input transform — planner filters on format + spatial_type.
    unrelated_zip = raw.model_copy(update={"spatial_type": "point_collection"})
    assert find_path(unrelated_zip, target, registry) is None


def test_raw_sdr_source_materializes_clay_then_samples():
    ns = "https://w3id.org/okn/i/mint/"
    clay = ns + "aquitard__clay_thickness"
    raw = DataObjectContract(
        data_type="twdb_sdr_lithology",
        format="zip",
        spatial_type="point_collection",
        resource_uri="https://www.twdb.texas.gov/groundwater/data/SDRDownload.zip",
    )
    target = DataObjectContract(
        standard_variable_uri=clay,
        unit="ft",
        spatial_type="point",
    )
    registry = [
        {
            "id": "ts-ntgam-derive-sdr-clay-thickness-points",
            "name": "derive-sdr-clay-thickness-points",
            "contracts": [
                {
                    "role": "input",
                    "format": "zip",
                    "spatial_type": "point_collection",
                    "metadata_json": {"data_type": "twdb_sdr_lithology"},
                },
                {
                    "role": "output",
                    "standard_variable_uri": clay,
                    "unit": "ft",
                    "format": "geojson",
                    "spatial_type": "point_collection",
                },
            ],
        },
        {
            "id": "nearest-point-sample",
            "name": "nearest-point-sample",
            "contracts": [
                {"role": "input", "spatial_type": "point_collection"},
                {"role": "output", "spatial_type": "point"},
            ],
        },
    ]

    path = find_path(raw, target, registry)
    assert [step["name"] for step in path] == [
        "derive-sdr-clay-thickness-points",
        "nearest-point-sample",
    ]

    # A zip source with a different spatial_type (grid vs point_collection)
    # should NOT match the point_collection-input transform.
    unrelated_zip = raw.model_copy(update={"spatial_type": "grid"})
    assert find_path(unrelated_zip, target, registry) is None


if __name__ == "__main__":
    plan, dag = test_all_inputs_resolve_and_forecast_runs()
    test_missing_source_reports_incomplete()
    print("OK  all 3 forecast inputs resolved from sources:")
    for b in plan["branches"]:
        chain = " -> ".join(s["name"] for s in (b["path"] or [])) or "(ready as-is)"
        print(f"      {b['standard_variable_uri'].split('/')[-1]:32s}  {chain}")
    print("OK  converging DAG runs the forecast:")
    for s in dag["steps"]:
        dep = f" (after steps {s['depends_on']})" if s["depends_on"] else ""
        print(f"      step {s['step']}: {s['name']}{dep}")
    print("OK  incomplete plan flagged when a source is missing")
    print("\nFull ETL -> forecast plan validated.")
