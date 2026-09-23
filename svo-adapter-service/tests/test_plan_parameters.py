import os

os.environ["SVO_ADAPTER_DEMO_MODE"] = "1"

import pytest

from app.main import _validate_plan_args
from app.planner import build_plan_json, parameter_definitions


def test_parameter_definitions_merge_schema_env_and_file_inputs():
    steps = [{
        "transform_spec_id": "ts-springflow",
        "name": "springflow",
        "parameters_schema_json": {
            "type": "object",
            "properties": {
                "start_date": {"type": "string", "description": "Beginning of the run"},
                "threshold": {"type": "number", "minimum": 0},
            },
            "required": ["start_date", "threshold"],
        },
        "env_from_args": {"START_DATE": "start_date", "THRESHOLD": "threshold"},
        "file_inputs": [{"from_arg": "aoi_geojson_uri", "name": "aoi", "target_path": "aoi.geojson"}],
    }]

    definitions = parameter_definitions(steps, {
        "allocation": {"type": "string", "required": True},
        "tapis_token": {"type": "string", "required": True},
    })
    by_name = {item["name"]: item for item in definitions}

    assert by_name["start_date"]["source_transform"] == "springflow"
    assert by_name["threshold"]["type"] == "number"
    assert by_name["aoi_geojson_uri"]["required"] is True
    assert by_name["allocation"]["required"] is True
    assert by_name["allocation"]["managed"] is True
    assert "tapis_token" not in by_name


def test_server_managed_parameters_are_not_user_inputs():
    steps = [{
        "transform_spec_id": "ts-gma-extract",
        "name": "modflow6-drain-gma-extract",
        "parameters_schema_json": {
            "type": "object",
            "properties": {
                "source_uri": {"type": "string"},
                "geo_actor_id": {"type": "string"},
                "tapis_token": {"type": "string"},
                "gma_id": {"type": "string"},
            },
            "required": ["source_uri", "geo_actor_id", "tapis_token", "gma_id"],
        },
    }]

    by_name = {
        item["name"]: item
        for item in parameter_definitions(steps)
    }

    assert "tapis_token" not in by_name
    assert by_name["source_uri"]["managed"] is True
    assert by_name["source_uri"]["managed_source"] == "execution_handoff"
    assert by_name["geo_actor_id"]["managed"] is True
    assert by_name["geo_actor_id"]["managed_source"] == "adapter_service"
    assert by_name["gma_id"]["required"] is True


def test_adapter_allocation_defaults_to_ensemble_manager_allocation():
    from app import tapis

    by_name = {
        item["name"]: item
        for item in parameter_definitions(
            [{"name": "workflow", "env_from_args": {"ALLOCATION": "allocation"}}],
            tapis.STANDARD_PARAMS,
        )
    }

    assert by_name["allocation"] == {
        "name": "allocation",
        "type": "string",
        "required": False,
        "default": "PT2050-DataX",
        "source_transform": "workflow",
        "transform_spec_id": None,
        "managed": True,
        "managed_source": "adapter_service",
    }


def test_build_plan_json_carries_parameter_definitions():
    plan = build_plan_json([{
        "id": "ts-springflow",
        "name": "springflow",
        "transform_type": "springflow",
        "parameters_schema_json": {
            "properties": {"basin": {"type": "string"}},
            "required": ["basin"],
        },
        "env_from_args": {"BASIN": "basin"},
    }])

    assert plan["parameters"] == [{
        "name": "basin",
        "type": "string",
        "required": True,
        "source_transform": "springflow",
        "transform_spec_id": "ts-springflow",
    }]


def test_submit_validation_rejects_missing_unknown_and_invalid_values():
    plan = {"parameters": [{
        "name": "threshold",
        "type": "number",
        "required": True,
        "minimum": 0,
    }]}

    with pytest.raises(Exception) as missing:
        _validate_plan_args(plan, {}, "token")
    assert missing.value.status_code == 422
    assert missing.value.detail["code"] == "INVALID_PARAMETERS"

    with pytest.raises(Exception) as unknown:
        _validate_plan_args(plan, {"other": 1, "threshold": 1}, "token")
    assert unknown.value.status_code == 422
    assert unknown.value.detail["code"] == "UNKNOWN_PARAMETERS"

    with pytest.raises(Exception) as invalid:
        _validate_plan_args(plan, {"threshold": -1}, "token")
    assert invalid.value.status_code == 422
    assert invalid.value.detail["parameters"]["threshold"] == "must be >= 0"
