from __future__ import annotations

import os
import subprocess
import sys

os.environ["SVO_ADAPTER_DEMO_MODE"] = "1"

from fastapi.testclient import TestClient

from app.main import _plan_with_parameters, _validate_plan_args, app
from app.etl_contract import normalize_args, normalize_env_from_args
from app.mint_sync import _build_env_from_args
from app import task_code


client = TestClient(app)


def test_alias_normalization_is_canonical_and_canonical_wins():
    normalized = normalize_args({
        "gma_boundary_uri": {"value": "legacy-boundary"},
        "geometry_source_uri": {"value": "canonical-boundary"},
        "gma_id": {"value": "GMA 12"},
        "layer": {"value": 2},
        "time_step": {"value": 3},
        "boundary_query_field": {"value": "Name"},
        "boundary_query_value": {"value": "Travis"},
        "area_type": {"value": "county"},
        "county_name": {"value": "Travis"},
    })
    assert normalized["geometry_source_uri"]["value"] == "canonical-boundary"
    assert normalized["spatial_scope_id"]["value"] == "GMA 12"
    assert normalized["model_layer"]["value"] == 2
    assert normalized["timestep"]["value"] == 3
    assert normalized["geometry_filter_field"]["value"] == "Name"
    assert normalized["geometry_filter_value"]["value"] == "Travis"
    assert normalized["spatial_scope_type"]["value"] == "county"
    assert normalized["spatial_scope_name"]["value"] == "Travis"


def test_two_source_dfc_mapping_preserves_secondary_boundary_alias():
    mapping = normalize_env_from_args({
        "GMA_BOUNDARY_URI": "gma_boundary_uri",
        "DFC_AREA_BOUNDARY_URI": "dfc_area_boundary_uri",
    })
    assert mapping == {
        "GMA_BOUNDARY_URI": "geometry_source_uri",
        "DFC_AREA_BOUNDARY_URI": "dfc_area_boundary_uri",
    }


def test_legacy_plan_accepts_canonical_and_legacy_values_with_canonical_precedence():
    plan = {"parameters": [{"name": "gma_id", "type": "string", "required": True}]}
    args = _validate_plan_args(
        plan,
        {"gma_id": "legacy", "spatial_scope_id": "canonical"},
        "token",
    )
    assert args["spatial_scope_id"]["value"] == "canonical"


def test_distinct_dfc_area_boundary_does_not_collapse_into_primary_geometry_uri():
    plan = {"parameters": [{"name": "dfc_area_boundary_uri", "type": "string", "required": True}]}
    try:
        _validate_plan_args(plan, {"geometry_source_uri": "primary"}, "token")
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 422
    else:
        raise AssertionError("primary geometry URI must not satisfy DFC area boundary")


def test_mint_labels_use_common_canonical_mapping():
    warnings: list[str] = []
    result = _build_env_from_args([
        {"parameter": {"label": "GMA boundary URI"}},
        {"parameter": {"label": "gma_id"}},
        {"parameter": {"label": "layer"}},
        {"parameter": {"label": "county_name"}},
    ], "config-1", warnings)
    assert result["GEOMETRY_SOURCE_URI"] == "geometry_source_uri"
    assert result["SPATIAL_SCOPE_ID"] == "spatial_scope_id"
    assert result["MODEL_LAYER"] == "model_layer"
    assert result["SPATIAL_SCOPE_NAME"] == "spatial_scope_name"
    assert not warnings


def test_generated_runtime_reads_canonical_then_legacy_environment_names():
    compile(task_code._INPUT_HELPER, "<input-helper>", "exec")
    code = task_code._INPUT_HELPER + 'print(_input_alias("SPATIAL_SCOPE_ID", "GMA_ID"))\n'
    env = {**os.environ, "GMA_ID": "legacy", "SPATIAL_SCOPE_ID": "canonical"}
    result = subprocess.run([sys.executable, "-c", code], env=env, text=True, capture_output=True, check=True)
    assert result.stdout.strip() == "canonical"

    env.pop("SPATIAL_SCOPE_ID")
    result = subprocess.run([sys.executable, "-c", code], env=env, text=True, capture_output=True, check=True)
    assert result.stdout.strip() == "legacy"


def test_catalog_default_payload_has_no_secret_value():
    runtime = client.get("/runtime-defaults").json()
    assert "tapis_token" not in runtime
    assert "tapis_token" not in runtime.get("spatial_layers", [])


def test_spatial_plan_gets_backend_geometry_default():
    plan = _plan_with_parameters({
        "steps": [{
            "name": "modflow-2005-drain-gma-extract",
            "env_from_args": {"GMA_BOUNDARY_URI": "geometry_source_uri"},
        }],
    })
    geometry = next(item for item in plan["parameters"] if item["name"] == "geometry_source_uri")
    assert geometry["default"]
