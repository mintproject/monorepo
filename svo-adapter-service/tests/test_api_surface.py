"""Focused checks for the documented SVO API surface and OpenAPI grouping."""

from __future__ import annotations

import os
import sys
from pathlib import Path

os.environ["SVO_ADAPTER_DEMO_MODE"] = "1"
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


client = TestClient(app)


def test_openapi_restored_paths_and_tags():
    spec = client.get("/openapi.json").json()
    paths = spec["paths"]
    tags = {tag["name"] for tag in spec["tags"]}

    assert {
        "Core: Registry",
        "Core: Planning",
        "Core: Workflows",
        "Core: Runs",
        "Core: Catalog/objectives",
        "Integrations",
        "DFC/GAM",
        "NTGAM forecast",
    } <= tags
    for path in (
        "/runtime-defaults",
        "/dfc-targets",
        "/objectives",
        "/objectives/{objective_id}",
        "/objectives/{objective_id}/evaluate-plan",
        "/plans/dfc-fanout",
        "/runs",
        "/runs/{run_id}/poll",
        "/runs/{run_id}/provenance",
    ):
        assert path in paths


def test_fixture_backed_catalog_routes():
    runtime = client.get("/runtime-defaults")
    assert runtime.status_code == 200
    assert "tapis_token" not in runtime.json()

    targets = client.get("/dfc-targets", params={"gma_id": "GMA 12", "limit": 3})
    assert targets.status_code == 200
    assert len(targets.json()["records"]) <= 3
    assert all(record["gma"] == 12 for record in targets.json()["records"])

    objectives = client.get("/objectives")
    assert objectives.status_code == 200
    assert objectives.json()["objectives"]
    objective_id = objectives.json()["objectives"][0]["id"]
    assert client.get(f"/objectives/{objective_id}").status_code == 200
    assert client.get("/objectives/not-a-real-objective").status_code == 404


def test_run_history_routes_work_in_demo_mode():
    assert client.get("/runs").json() == {"runs": [], "total": 0}
    assert client.get("/runs/missing").status_code == 404
