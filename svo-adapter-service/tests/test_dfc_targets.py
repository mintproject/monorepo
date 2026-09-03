"""Offline validation of DFC (Desired Future Condition) target data.

The /dfc-targets endpoint is not part of the current API surface. These tests
validate the DFC target data through the GMA DFC transforms fixture and the
planner, ensuring the transform specs cover the expected GMAs, aquifers, and
metrics.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.models import DataObjectContract  # noqa: E402
from app.planner import find_path  # noqa: E402

FIXTURE = ROOT / "examples" / "gma_dfc_transforms.json"


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


def test_dfc_transform_specs_cover_gma12_carrizo():
    """The GMA DFC fixture includes transform specs for GMA 12 / Carrizo
    drawdown: head-gma-average and related compliance chains."""
    data = _load()
    registry = data["transform_specs"]

    # The head raster -> GMA average path should exist for the modeled output.
    head_raster = _source(data["source_data_object"])
    target = _target(data["target_model_input"])
    path = find_path(head_raster, target, registry)
    assert path is not None, "no transform path from head raster to GMA target"
    assert any("gma" in s.get("name", "").lower() for s in path)


def test_dfc_compliance_specs_handle_multiple_metrics():
    """The fixture includes compliance specs for drawdown, spring flow,
    stream flow, and saturated thickness metrics."""
    data = _load()
    registry = data["transform_specs"]

    compliance_specs = [s for s in registry if "compliance" in s.get("id", "")]
    assert len(compliance_specs) >= 4, (
        f"expected at least 4 compliance specs (drawdown, spring, stream, satthk), "
        f"got {len(compliance_specs)}: {[s['id'] for s in compliance_specs]}"
    )
    spec_names = {s.get("name", "") for s in compliance_specs}
    assert any("gma" in n for n in spec_names)
    assert any("spring" in n for n in spec_names)


def test_dfc_spring_flow_path_uses_budget_extract():
    """The CBC -> spring CFS path goes through budget_extract_drain then
    unit conversion."""
    data = _load()
    registry = data["transform_specs"]
    cbc = _source(next(s for s in data["sources"] if s.get("format") == "cbc-mf6"))
    spring_target = _target(data["target_model_input_spring_cfs"])
    path = find_path(cbc, spring_target, registry)
    assert path is not None, "no transform path for CBC -> spring CFS"
    names = [s["name"] for s in path]
    assert any("extract" in n for n in names), f"expected budget extract in chain: {names}"
    assert any("flow" in n or "cfs" in n for n in names), f"expected flow conversion in chain: {names}"
