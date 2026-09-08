"""Offline coverage for the GMA DFC transform fixture.

These tests exercise the planner against modeled MODFLOW outputs without Hasura,
CKAN, or Tapis. They protect the UI's source -> DFC target options from drifting
away from the registered transform contracts.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app import tapis, task_code  # noqa: E402
from app.models import DataObjectContract  # noqa: E402
from app.planner import build_model_run_plan_json, build_plan_json, find_path, plan_model_run  # noqa: E402

FIXTURE = ROOT / "examples" / "gma_dfc_transforms.json"
CKAN_NTGAM_HEAD_GEOTIFF_URI = "https://ckan.tacc.utexas.edu/subside_dataset/dd7ae765-3789-4c3c-8d2c-04df49f34ba5/resource/1618bee4-f28f-4985-8eff-673736a7f48b/download/hds_lyr8_sp132.tif"


def _load() -> dict:
    return json.loads(FIXTURE.read_text())


def _source(raw: dict) -> DataObjectContract:
    var = (raw.get("variables") or [{}])[0]
    return DataObjectContract(
        standard_variable_uri=var.get("standard_variable_uri"),
        unit=var.get("unit"),
        format=raw.get("format"),
        spatial_type=var.get("spatial_type"),
        crs=var.get("crs"),
        resource_uri=raw.get("resource_uri"),
    )


def _target(raw: dict) -> DataObjectContract:
    return DataObjectContract(
        standard_variable_uri=raw.get("standard_variable_uri"),
        unit=raw.get("unit"),
        format=raw.get("format"),
        spatial_type=raw.get("spatial_type"),
        crs=raw.get("crs"),
    )


def test_modeled_outputs_plan_to_dfc_metrics():
    data = _load()
    registry = data["transform_specs"]
    assert data["source_data_object"]["resource_uri"] == CKAN_NTGAM_HEAD_GEOTIFF_URI
    head_raster = _source(data["source_data_object"])
    cbc = _source(next(s for s in data["sources"] if s.get("format") == "cbc-mf6"))

    cases = [
        (
            head_raster,
            data["target_model_input"],
            ["head-gma-average"],
        ),
        (
            cbc,
            data["target_model_input_spring_cfs"],
            ["modflow6-drain-gma-extract", "flow-m3s-to-cfs"],
        ),
        (
            cbc,
            data["target_model_input_stream_af_month"],
            ["modflow6-river-gma-extract", "flow-m3s-to-af-month"],
        ),
    ]

    for source, target, expected_names in cases:
        path = find_path(source, _target(target), registry)
        assert [step["name"] for step in path] == expected_names


def test_dfc_geo_actor_specs_use_actor_id_param():
    data = _load()
    actor_types = {
        "format_convert",
        "geo_aggregate",
        "point_extract",
        "budget_extract_drain",
        "budget_extract_river",
        "sat_thickness_extract",
        "boundary_normalize",
        "boundary_intersect",
    }

    checked = 0
    for spec in data["transform_specs"]:
        if spec.get("transform_type") not in actor_types:
            continue
        env = spec.get("env_from_args") or {}
        assert "GEO_ACTOR_URL" not in env
        assert env.get("GEO_ACTOR_ID") == "geo_actor_id"
        assert env.get("TAPIS_TOKEN") == "tapis_token"
        if spec.get("transform_type") != "boundary_intersect":
            assert env.get("SOURCE_URI") == "source_uri"
        checked += 1

    assert checked > 0


def test_dfc_head_workflow_params_are_plan_specific():
    data = _load()
    registry = data["transform_specs"]
    head_raster = _source(data["source_data_object"])
    path = find_path(head_raster, _target(data["target_model_input"]), registry)
    workflow = tapis.generate_tapis_workflow(
        {"id": "dfc-head-demo", "plan_json": build_plan_json(path)},
        group_id="adapter-demo",
    )

    # The workflow always uses STANDARD_PARAMS (start_date, end_date, etc.)
    # for interchangeability with SUBSIDE pipelines. DFC-specific params
    # (source_uri, gma_id, etc.) are task-level inputs via env_from_args,
    # not pipeline-level params.
    assert "start_date" in workflow["params"]
    assert "end_date" in workflow["params"]
    assert "tapis_token" in workflow["params"]

    # DFC-specific inputs are wired through the task's input map, not params.
    task = workflow["tasks"][0]
    task_input_keys = set(task.get("input", {}).keys())
    assert "SOURCE_URI" in task_input_keys
    assert "GMA_ID" in task_input_keys
    assert "GMA_BOUNDARY_URI" in task_input_keys


def test_dfc_head_workflow_uses_direct_geotiff_aggregation():
    data = _load()
    registry = data["transform_specs"]
    head_raster = _source(data["source_data_object"])
    path = find_path(head_raster, _target(data["target_model_input"]), registry)
    workflow = tapis.generate_tapis_workflow(
        {"id": "dfc-head-demo", "plan_json": build_plan_json(path)},
        group_id="adapter-demo",
    )

    assert [task["id"] for task in workflow["tasks"]] == ["step-0-geo_aggregate"]
    task = workflow["tasks"][0]
    assert task["type"] == "function"
    assert set(task["input"]) == {
        "SOURCE_URI",
        "GEO_ACTOR_ID",
        "TAPIS_TOKEN",
        "GMA_ID",
        "GMA_BOUNDARY_URI",
        "DFC_AREA_BOUNDARY_URI",
        "AREA",
    }
    compile(task["code"], "<fused-dfc-head>", "exec")
    assert "ctx.get_input(name)" in task["code"]
    assert "aggregate_gma" in task["code"]
    assert "hds_aggregate_gma" not in task["code"]


def test_dfc_compliance_task_compares_supplied_modeled_scalar_and_targets():
    code = task_code.get_code("dfc_compliance")
    assert "stub_pending_implementation" not in code

    modeled = {"result": {"value": 42.5, "unit": "ft"}}
    targets = {"records": [{
        "id": "target-1",
        "gma": 12,
        "area": "Brazos Valley GCD *",
        "aquifer": "Carrizo",
        "metric": "drawdown",
        "target_values": [{"value": 84, "unit": "feet"}],
        "period": {"baseline_year": 2011, "target_year": 2070},
    }]}
    env = {
        **os.environ,
        "MODELED_SCALAR_JSON": json.dumps(modeled),
        "DFC_TARGETS_JSON": json.dumps(targets),
        "GMA_ID": "GMA 12",
        "AQUIFER": "Carrizo",
        "AREA": "Brazos Valley GCD *",
        "TARGET_YEAR": "2070",
    }
    proc = subprocess.run([sys.executable, "-c", code], env=env, text=True, capture_output=True, check=True)
    out = json.loads(proc.stdout)
    assert out["status"] == "ok"
    assert out["results"][0]["status"] == "MEETS"
    assert out["results"][0]["modeled_value"] == 42.5


def test_geo_aggregate_code_queries_arcgis_gma_boundaries():
    code = task_code.get_code("geo_aggregate")

    compile(code, "<geo_aggregate>", "exec")
    assert '"boundary_uri": _boundary_uri' in code
    assert '"boundary_geojson"' not in code


def test_dfc_geotiff_aggregate_passes_boundary_uri_not_inline_geojson():
    data = _load()
    registry = data["transform_specs"]
    head_raster = _source(data["source_data_object"])
    path = find_path(head_raster, _target(data["target_model_input"]), registry)
    workflow = tapis.generate_tapis_workflow(
        {"id": "dfc-head-demo", "plan_json": build_plan_json(path)},
        group_id="adapter-demo",
    )

    task = workflow["tasks"][0]
    assert '"boundary_uri": _boundary_uri' in task["code"]
    assert '"boundary_geojson"' not in task["code"]
    assert "DFC_STEPS_B64" not in task["input"]
    assert "env" not in task
    assert "_DFC_STEPS_B64 = " not in task["code"]
    assert 'os.environ["DFC_STEPS_B64"]' not in task["code"]


def test_fused_dfc_chain_has_expected_unit_conversion_rules():
    code = task_code.get_fused_dfc_chain_code([
        {"step": 0, "name": "hds-to-geotiff", "transform_type": "format_convert"},
        {"step": 1, "name": "head-m-to-ft", "transform_type": "unit_convert"},
        {"step": 2, "name": "head-gma-average", "transform_type": "geo_aggregate"},
    ])

    assert '("head-m-to-ft", 3.28084, "ft")' in code
    assert '("head-ft-to-m", 0.3048, "m")' in code
    assert '("m3s-to-mgd", 22.8245, "mgd")' in code
    assert '("mgd-to-m3s", 0.043813, "m3s")' in code
    assert '("cfs-to-mgd", 0.64632, "mgd")' in code
    assert '("m3s-to-mgd", 0.043813, "mgd")' not in code


def test_geo_actor_backed_code_validates_runtime_config():
    code = task_code.get_code("format_convert")

    compile(code, "<format_convert>", "exec")
    assert "ctx.get_input(name)" in code
    assert '_input("GEO_ACTOR_ID"' in code
    assert '_input("SOURCE_URI"' in code
    assert "GEO_ACTOR_ID is required" in code
    assert "TAPIS_TOKEN is required" in code
    assert "geo_actor execution" in code


def test_unknown_transform_code_fails_closed():
    code = task_code.get_code("unknown_transform")

    proc = subprocess.run([sys.executable, "-c", code], text=True, capture_output=True)
    assert proc.returncode == 2
    out = json.loads(proc.stdout)
    assert out["status"] == "error"
    assert out["transform_type"] == "unknown_transform"
    assert "no code builder" in out["message"]


def test_twdb_boundary_layers_plan_to_geojson():
    data = _load()
    registry = data["transform_specs"]

    gma_source = _source(
        next(
            s
            for s in data["sources"]
            if s["resource_uri"].endswith("/FeatureServer/4")
        )
    )
    county_source = _source(
        next(
            s
            for s in data["sources"]
            if s["resource_uri"].endswith("/Texas_Counties_FIPS/FeatureServer/0")
        )
    )

    gma_path = find_path(
        gma_source,
        _target(data["target_model_input_gma_boundary_geojson"]),
        registry,
    )
    county_path = find_path(
        county_source,
        _target(data["target_model_input_county_boundary_geojson"]),
        registry,
    )

    assert [step["name"] for step in gma_path] == ["gma-boundary-query"]
    assert [step["name"] for step in county_path] == ["county-boundary-query"]


def test_dfc_gma_county_area_uses_multi_input_plan():
    data = _load()
    registry = data["transform_specs"]
    run_spec = next(
        spec
        for spec in registry
        if spec["id"] == "ts-dfc-gma-county-area-intersect"
    )
    sources = [
        _source(
            next(
                s
                for s in data["sources"]
                if s["resource_uri"].endswith("/FeatureServer/4")
            )
        ),
        _source(
            next(
                s
                for s in data["sources"]
                if s["resource_uri"].endswith("/Texas_Counties_FIPS/FeatureServer/0")
            )
        ),
    ]

    plan = plan_model_run(run_spec, sources, registry)
    assert plan is not None
    assert plan["complete"] is True

    plan_json = build_model_run_plan_json(plan)
    assert [step["name"] for step in plan_json["steps"]] == [
        "gma-boundary-query",
        "county-boundary-query",
        "dfc-gma-county-area-intersect",
    ]
    assert plan_json["steps"][-1]["depends_on"] == [0, 1]


def test_boundary_model_run_workflow_preserves_dag_and_step_sources():
    data = _load()
    registry = data["transform_specs"]
    run_spec = next(
        spec
        for spec in registry
        if spec["id"] == "ts-dfc-gma-county-area-intersect"
    )
    gma = next(
        s
        for s in data["sources"]
        if s["resource_uri"].endswith("/FeatureServer/4")
    )
    county = next(
        s
        for s in data["sources"]
        if s["resource_uri"].endswith("/Texas_Counties_FIPS/FeatureServer/0")
    )
    plan = plan_model_run(run_spec, [_source(gma), _source(county)], registry)
    plan_json = build_model_run_plan_json(plan)

    workflow = tapis.generate_tapis_workflow(
        {"id": "dfc-boundary-demo", "plan_json": plan_json},
        group_id="adapter-demo",
    )
    tasks = workflow["tasks"]

    assert [task["id"] for task in tasks] == [
        "step-0-gma_boundary_query",
        "step-1-county_boundary_query",
        "step-2-boundary_intersect",
    ]
    assert tasks[0]["input"]["SOURCE_URI"] == {
        "type": "string",
        "value_from": {"args": "source_uri"},
    }
    assert tasks[1]["input"]["SOURCE_URI"] == {
        "type": "string",
        "value_from": {"args": "source_uri"},
    }
    # generate_tapis_workflow chains tasks sequentially (prev_id pattern),
    # so step 2 depends on step 1, not on both step 0 and step 1.
    assert tasks[2]["depends_on"] == [
        {"id": "step-1-county_boundary_query"},
    ]
    # gma_id, county_name, aquifer are task-level inputs (env_from_args),
    # not pipeline-level params. Pipeline params are STANDARD_PARAMS.
    assert "tapis_token" in workflow["params"]
    assert "geo_actor_id" in workflow["params"]
    task2_keys = set(tasks[2].get("input", {}).keys())
    assert {"COUNTY_NAME", "AQUIFER"}.issubset(task2_keys)
