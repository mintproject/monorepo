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
    assert "tapis_token" not in by_name


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
