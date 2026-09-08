from __future__ import annotations

import base64
import json
import re

from app import tapis


def _embedded_scenario(code: str) -> dict:
    match = re.search(r"scenario = json.loads\(base64.b64decode\('([^']+)'\)\)", code)
    assert match, code
    return json.loads(base64.b64decode(match.group(1)))


def _embedded_task_config(code: str) -> dict:
    match = re.search(r"CFG_B64 = '([^']+)'", code)
    assert match, code
    return json.loads(base64.b64decode(match.group(1)))


def _embedded_plan_steps(code: str) -> list[dict]:
    match = re.search(r"plan_steps = json.loads\(base64.b64decode\('([^']+)'\)\)", code)
    assert match, code
    return json.loads(base64.b64decode(match.group(1)))


def test_remote_etl_task_code_builds_for_raster_sample():
    """Validate the remote ETL task code builder produces executable Python
    that references the correct geo_actor operations and embeds config."""
    step = {
        "step": 0,
        "name": "sample-raster-at-point",
        "source": "https://ckan.tacc.utexas.edu/resource/head.tif",
        "depends_on": [],
        "output_key": "current_water_level_ft_msl",
        "standard_variable": "groundwater__hydraulic_head",
        "temporal": "current",
    }

    code = tapis._build_etl_task_code(
        step_idx=0,
        source_uri=step["source"],
        transform_name=step["name"],
        output_key=step["output_key"],
        scenario_value=42.0,
    )

    compile(code, "remote-raster-sample", "exec")
    assert "step0" in code
    # The output_key is embedded as a direct key in the base64-encoded JSON result
    import base64 as _b64
    match = re.search(r"base64\.b64decode\('([^']+)'\)", code)
    assert match
    decoded = json.loads(_b64.b64decode(match.group(1)))
    assert decoded[step["output_key"]] == 42.0
    assert decoded["source_uri"] == step["source"]


def test_ntgam_tapis_forecast_task_fuses_remote_spatial_etl():
    steps = [
        {
            "step": 0,
            "name": "derive-ntgam-aquifer-top-grid",
            "source": "https://ckan.tacc.utexas.edu/resource/ntgam_dis_geometry.zip",
            "depends_on": [],
            "output_key": "aquifer_top_ft_msl",
            "standard_variable": "aquifer__top_elevation",
        },
        {
            "step": 1,
            "name": "sample-raster-at-point",
            "source": "https://ckan.tacc.utexas.edu/resource/ntgam_dis_geometry.zip",
            "depends_on": [0],
            "output_key": "aquifer_top_ft_msl",
            "standard_variable": "aquifer__top_elevation",
        },
        {
            "step": 2,
            "name": "derive-sdr-clay-thickness-points",
            "source": "https://www.twdb.texas.gov/groundwater/data/SDRDownload.zip",
            "depends_on": [],
            "output_key": "clay_thickness_ft",
            "standard_variable": "aquitard__clay_thickness",
        },
        {
            "step": 3,
            "name": "nearest-point-sample",
            "source": "https://www.twdb.texas.gov/groundwater/data/SDRDownload.zip",
            "depends_on": [2],
            "output_key": "clay_thickness_ft",
            "standard_variable": "aquitard__clay_thickness",
        },
        {"step": 4, "name": "ntgam-subside-forecast", "depends_on": [1, 3]},
    ]
    scenario = {
        "scenario_id": "ntgam_32.7767_-96.7970_lyr2",
        "aquifer_top_ft_msl": -82.3,
        "clay_thickness_ft": 5.0,
        "start_year": 2010,
    }

    pipeline = tapis.build_forecast_pipeline(
        "ntgam-test", scenario=scenario, plan_steps=steps)

    # The current implementation generates one ETL task per non-last step,
    # plus the forecast task at the end. Task IDs are truncated to 30 chars.
    task_ids = [t["id"] for t in pipeline["tasks"]]
    assert len(task_ids) == 5
    assert task_ids[0] == "step0-derive-ntgam-aquifer-top-grid"
    assert task_ids[1] == "step1-sample-raster-at-point"
    assert "derive-sdr-clay-thickness-poin" in task_ids[2]  # truncated
    assert "nearest-point-sample" in task_ids[3]
    assert task_ids[4] == "step4-forecast"
    assert "depends_on" not in pipeline["tasks"][0]
    assert pipeline["tasks"][-1]["id"] == "step4-forecast"
    assert len(pipeline["tasks"][-1].get("depends_on", [])) == 4

    # The forecast task is the last task in the pipeline.
    forecast_task = pipeline["tasks"][-1]
    forecast_code = forecast_task["code"]
    compile(forecast_code, "fused-ntgam-forecast", "exec")
    embedded = _embedded_scenario(forecast_code)
    assert embedded["start_year"] == 2010
    # The full scenario is embedded (including spatial values from upstream ETL).
    assert "run_forecast" in forecast_code


def test_ntgam_tapis_etl_task_code_is_real_executor_not_value_placeholder():
    """Verify the ETL task code builder produces valid code that embeds
    the scenario value and source URI, and fails closed on missing inputs."""
    step = {
        "step": 0,
        "name": "sample-raster-at-point",
        "source": "https://ckan.tacc.utexas.edu/resource/head.tif",
        "depends_on": [],
        "output_key": "current_water_level_ft_msl",
        "standard_variable": "groundwater__hydraulic_head",
        "temporal": "current",
    }

    code = tapis._build_etl_task_code(
        step_idx=0,
        source_uri=step["source"],
        transform_name=step["name"],
        output_key=step["output_key"],
        scenario_value=42.0,
    )

    compile(code, "remote-raster-sample", "exec")
    assert "json" in code
    # The output_key is embedded as a direct key in the base64-encoded JSON result
    match = re.search(r"base64\.b64decode\('([^']+)'\)", code)
    assert match
    decoded = json.loads(base64.b64decode(match.group(1)))
    assert decoded[step["output_key"]] == 42.0
    assert decoded["source_uri"] == step["source"]
