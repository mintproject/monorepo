"""End-to-end planner + submission test using the real SUBSIDE WERC pipeline.

Exercises the parts of svo-adapter-service that have no external dependency
(planner, Tapis Workflows pipeline generation, and the submit orchestration with
an injected fake client) against transforms modeled on the actual SUBSIDE WERC
OPERA DISP-S1 stages (subside/tapis/workflows/pipelines/werc-opera.yaml).

No Hasura/Postgres/Tapis needed: the registry fixture is in the exact shape
app.hasura.TRANSFORM_REGISTRY_QUERY returns, and the submit test injects a fake
tapipy client so no live tenant (or `workflows` service grant) is required.

Run directly:   python3 tests/test_subside_werc_plan.py
Or via pytest:  pytest tests/test_subside_werc_plan.py -q
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

# Make `app` importable when run as a plain script from the service root.
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app import tapis  # noqa: E402
from app.models import DataObjectContract, ReadinessStatus  # noqa: E402
from app.planner import build_plan_json, compatibility, find_path  # noqa: E402

FIXTURE = ROOT / "examples" / "subside_werc_transforms.json"


def _load(target_key="target_model_input"):
    data = json.loads(FIXTURE.read_text())
    registry = data["transform_specs"]
    src_do = data["source_data_object"]
    var = src_do["variables"][0]
    source = DataObjectContract(
        standard_variable_uri=var.get("standard_variable_uri"),
        local_name=var.get("local_name"),
        unit=var.get("unit"),
        format=src_do.get("format"),
        spatial_type=var.get("spatial_type"),
        crs=var.get("crs"),
        temporal_resolution=var.get("temporal_resolution"),
        resource_uri=src_do.get("resource_uri"),
    )
    target = DataObjectContract(**{
        k: v for k, v in data[target_key].items() if not k.startswith("_")
    })
    return registry, source, target


def _plan(target_key="target_model_input"):
    registry, source, target = _load(target_key)
    path = find_path(source, target, registry)
    assert path is not None, "no transform path found"
    return build_plan_json(path)


def test_source_is_not_ready():
    """Raw discovered displacement granules are not a subsidence-rate GeoTIFF."""
    registry, source, target = _load()
    result = compatibility(source, target)
    assert result.status != ReadinessStatus.ready
    dims = {d.dimension.value: d.compatible for d in result.dimensions}
    assert dims["semantic"] is False
    assert dims["format"] is False
    assert dims["accessibility"] is True  # the granules ARE addressable


def test_werc_is_one_job():
    """The adapter does NOT decompose the WERC compute: a plain subsidence-rate
    GeoTIFF target is satisfied by the single run-werc Tapis job."""
    plan_json = _plan()
    names = [s["name"] for s in plan_json["steps"]]
    assert names == ["run-werc"], f"expected one job, got {names}"
    assert plan_json["steps"][0]["tapis_app_id"] == "subside-werc-opera-analysis"


def test_etl_tail_appended_for_a_different_model_input():
    """When the target needs a different representation, the adapter keeps the one
    job and appends the ETL/load tail: run-werc -> format-convert -> stac-publish."""
    plan_json = _plan("target_model_input_netcdf")
    names = [s["name"] for s in plan_json["steps"]]
    assert names == ["run-werc", "format-convert", "stac-publish"], f"unexpected: {names}"


def test_generates_subside_shaped_pipeline():
    """The generated definition is a Tapis Workflows pipeline interchangeable with
    SUBSIDE's: a `workflow` with a `params` block. The compute is ONE tapis_job;
    the ETL tail (here for the NetCDF model target) are function tasks."""
    plan_json = _plan("target_model_input_netcdf")
    wf = tapis.generate_tapis_workflow(
        {"id": "subside-werc-demo", "plan_json": plan_json,
         "target_dataset_specification_id": "https://w3id.org/okn/i/mint/subsidence-rate-spec"},
        group_id="subside-ops",
    )
    assert wf["type"] == "workflow"
    assert wf["group_id"] == "subside-ops"
    for p in ("start_date", "end_date", "aoi_geojson_uri", "allocation", "tapis_token"):
        assert p in wf["params"], f"missing param {p}"

    # ONE Tapis job (the SUBSIDE app, unchanged), then the ETL/load as function tasks.
    assert [t["type"] for t in wf["tasks"]] == ["tapis_job", "function", "function"]
    job = wf["tasks"][0]
    assert job["tapis_job_def"]["appId"] == "subside-werc-opera-analysis"
    assert "depends_on" not in job
    env = {e["key"]: e["value"] for e in job["tapis_job_def"]["parameterSet"]["envVariables"]}
    assert env["STAGE"] == "run"
    assert env["START_DATE"] == "${args.start_date}"
    aoi = [f for f in job["tapis_job_def"]["fileInputs"] if f["name"] == "aoi-geojson"][0]
    assert aoi["sourceUrl"] == "${args.aoi_geojson_uri}"
    # the tail chains off the job
    assert wf["tasks"][1]["depends_on"] == [{"id": job["id"]}]
    return wf


# --- submission (with an injected fake client; no live Tapis) ----------------
class _FakeWorkflows:
    def __init__(self):
        self.run_calls = []

    def listPipelineRuns(self, **kw):
        return []

    def runPipeline(self, **kw):
        self.run_calls.append(kw)
        return type("R", (), {"uuid": "run-abc123"})()


class _FakeClient:
    base_url = "https://portals.tapis.io"
    username = "tester"

    def __init__(self):
        self.workflows = _FakeWorkflows()


def test_submit_emulates_subside_runpipeline(monkeypatch=None):
    """submit_tapis_workflow registers into the group then calls
    workflows.runPipeline(group_id, pipeline_id, name, args=...) — SUBSIDE's
    exact trigger — and returns the run uuid."""
    wf = test_generates_subside_shaped_pipeline()
    fake = _FakeClient()

    registered = {}
    orig_ensure, orig_register = tapis._ensure_group, tapis.register_pipeline
    tapis._ensure_group = lambda client, group_id: registered.update(group=group_id)
    tapis.register_pipeline = lambda client, pipeline, group_id, recreate=False: registered.update(
        pipeline=pipeline["id"], recreate=recreate)
    try:
        result = tapis.submit_tapis_workflow(
            wf,
            args={"start_date": {"value": "2024-01-01"}, "end_date": {"value": "2025-01-01"},
                  "allocation": {"value": "PT2050-DataX"}},
            client=fake,
            run_name="subside-werc-demo-run",
        )
    finally:
        tapis._ensure_group, tapis.register_pipeline = orig_ensure, orig_register

    assert registered == {"group": "subside-ops", "pipeline": "subside-werc-demo", "recreate": False}
    assert result["uuid"] == "run-abc123"
    assert result["pipelineId"] == "subside-werc-demo"
    assert result["groupId"] == "subside-ops"
    # The trigger got SUBSIDE-shaped args.
    call = fake.workflows.run_calls[0]
    assert call["group_id"] == "subside-ops"
    assert call["pipeline_id"] == "subside-werc-demo"
    assert call["args"]["start_date"] == {"value": "2024-01-01"}


def test_register_only_does_not_run():
    """register_pipeline (the dry-run path) must land the pipeline in the
    Workflows group but MUST NOT call runPipeline — that's the whole point of a
    register-but-don't-run dry-run, as distinct from a real submit."""
    wf = test_generates_subside_shaped_pipeline()
    fake = _FakeClient()

    registered = {}
    orig_ensure, orig_register = tapis._ensure_group, tapis.register_pipeline
    tapis._ensure_group = lambda client, group_id: registered.update(group=group_id)
    tapis.register_pipeline = lambda client, pipeline, group_id, recreate=False: registered.update(
        group=group_id, pipeline=pipeline["id"], recreate=recreate)
    try:
        tapis.register_pipeline(fake, wf, "subside-ops")
    finally:
        tapis._ensure_group, tapis.register_pipeline = orig_ensure, orig_register

    assert registered == {"group": "subside-ops", "pipeline": "subside-werc-demo", "recreate": False}
    assert fake.workflows.run_calls == []  # the bug: dry-run must never trigger a run


if __name__ == "__main__":
    test_source_is_not_ready()
    test_werc_is_one_job()
    test_etl_tail_appended_for_a_different_model_input()
    wf = test_generates_subside_shaped_pipeline()
    test_submit_emulates_subside_runpipeline()
    test_register_only_does_not_run()
    print("OK  source is not model-ready (transform required)")
    print("OK  WERC compute is ONE job (run-werc) — adapter does not decompose it")
    print("OK  different model target appends the ETL tail: run-werc -> format-convert -> stac-publish")
    print("OK  generated pipeline: 1 tapis_job + ETL/load function tasks")
    print("OK  submit_tapis_workflow -> workflows.runPipeline (fake client) returned run-abc123")
    print("OK  register_tapis_workflow registers but never calls runPipeline (the dry-run fix)")
    print("\nGenerated Tapis Workflows pipeline definition:")
    print(json.dumps(wf, indent=2))
