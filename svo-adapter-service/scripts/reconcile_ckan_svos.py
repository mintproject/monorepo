#!/usr/bin/env python3
"""Correct the audited TWDB GAM SVO annotations in CKAN.

The command is read-only by default. It writes a drift-checked plan and
rollback manifest, and performs CKAN mutations only with ``--apply --yes``.
"""
from __future__ import annotations

import argparse
from datetime import date, datetime, timezone
import json
import os
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

CKAN = "https://ckan.tacc.utexas.edu"
ORG = "twdb-gams"
TAPIS_TOKEN_URL = "https://portals.tapis.io/v3/oauth2/tokens"
CAPITAN_PACKAGE_ID = "beba358a-69e3-404b-8e97-f2056418c0e9"
CAPITAN_PACKAGE_NAME = "https-txwaterdatahub-org-dataset-capitan-reef-complex-aquifer-gam-files"
MANIFEST_PATH = Path(__file__).with_name("twdb_gam_metadata_manifest.json")
TEMPORAL_MANIFEST_PATH = Path(__file__).with_name("twdb_gam_temporal_manifest.json")

# These package-level values cannot be consumed by the adapter and falsely
# imply that every opaque archive contains every listed variable.
PACKAGE_CORRECTIONS = {
    "4921c88c-f4fe-4177-91c2-0be294f48175": (
        "seymour-and-blaine-gam",
        ["groundwater__hydraulic_head", "aquifer__hydraulic_conductivity", "land_surface_water__evapotranspiration_volume_flux", "land_subsurface_water__recharge_volume_flux", "groundwater_well__pumping_volume_flow_rate"],
    ),
    "aae21134-8c61-4683-abb1-1107c433b175": (
        "nacatoch-aquifer-gam",
        ["groundwater__hydraulic_head", "land_surface_water__evapotranspiration_volume_flux", "aquifer__hydraulic_conductivity", "land_subsurface_water__recharge_volume_flux", "groundwater_well__pumping_volume_flow_rate"],
    ),
    "191f8bb3-1bf5-4326-89df-5aebae0b18b4": (
        "lipan-aquifer-gam",
        ["land_subsurface_water__recharge_volume_flux", "groundwater_well__pumping_volume_flow_rate"],
    ),
    "1db72fb2-762f-4669-b6e8-b78b3040d979": (
        "high-plains-aquifer-system-gam",
        ["groundwater__hydraulic_head", "land_surface_water__evapotranspiration_volume_flux", "land_subsurface_water__recharge_volume_flux", "groundwater_well__pumping_volume_flow_rate"],
    ),
    "82a7d48a-a9d7-44a0-8061-dbfea7fb0d01": (
        "gulf-coast-northern-gam",
        ["groundwater__hydraulic_head", "aquifer__hydraulic_conductivity", "land_subsurface_water__recharge_volume_flux", "aquifer__storativity", "groundwater_well__pumping_volume_flow_rate"],
    ),
    "6d11c310-e1c9-40d0-88f6-613d6d893e1a": (
        "gulf-coast-central-southern-gam",
        ["groundwater__hydraulic_head", "land_surface_water__evapotranspiration_volume_flux", "aquifer__hydraulic_conductivity", "land_subsurface_water__recharge_volume_flux", "groundwater_well__pumping_volume_flow_rate"],
    ),
    "f1c47627-b313-4b02-922d-80bec8b0d849": (
        "edwards-trinity-plateau-pecos-valley-gam",
        ["land_subsurface_water__recharge_volume_flux", "aquifer__storativity", "groundwater_well__pumping_volume_flow_rate"],
    ),
    "11dfa0b6-3d39-455b-824f-0ed6a4cdfd1f": (
        "edwards-bfz-northern-segment-gam",
        ["groundwater__hydraulic_head", "aquifer__hydraulic_conductivity", "land_subsurface_water__recharge_volume_flux", "groundwater_well__pumping_volume_flow_rate"],
    ),
    "3c0c4d61-90f1-489a-baa5-3c6357a01a84": (
        "edwards-bfz-barton-springs-segment-gam",
        ["land_subsurface_water__recharge_volume_flux", "aquifer__storativity", "groundwater_well__pumping_volume_flow_rate"],
    ),
}

# resource_id: (package_id, resource name). The variable lists are the reviewed
# values formerly stored on each parent package and are intentionally moved only
# to the complete model archive, not to reports, grids, or geodatabases.
MODEL_ARCHIVE_CORRECTIONS = {
    "5097bb8b-0624-48e6-a3d8-6e1b70bec545": ("3d5b4b97-cc54-49ef-9d34-6a94a872d36b", "Edwards (BFZ) Aquifer (San Antonio Segment) GAM — Model"),
    "3a9a635f-6330-46a3-84bc-579cd557ae5c": ("3c0c4d61-90f1-489a-baa5-3c6357a01a84", "Edwards (BFZ) Aquifer (Barton Springs Segment) GAM — Model and source data"),
    "12a42603-f17b-4d35-9c5e-a7a7e2ee7307": ("11dfa0b6-3d39-455b-824f-0ed6a4cdfd1f", "Edwards (BFZ) Aquifer (Northern Segment) GAM — Model"),
    "d63a3c99-7633-47ed-b897-75df156e5719": ("f1c47627-b313-4b02-922d-80bec8b0d849", "Edwards-Trinity (Plateau) and Pecos Valley aquifers GAM — Model"),
    "e318e313-12e1-4e92-a811-bf0fb085214e": ("6d11c310-e1c9-40d0-88f6-613d6d893e1a", "Gulf Coast Aquifer System (central and southern portions) GAM — Model"),
    "d58dd792-ff36-4e50-9936-83dcffaa8295": ("82a7d48a-a9d7-44a0-8061-dbfea7fb0d01", "Gulf Coast Aquifer System (northern portion) GAM (version 4.1) — Model"),
    "69f17ab8-462f-4344-8229-a5edb71c5186": ("1db72fb2-762f-4669-b6e8-b78b3040d979", "High Plains Aquifer System GAM — Model"),
    "59abce6e-6aba-4a85-b4b1-ae82a310ef7d": ("191f8bb3-1bf5-4326-89df-5aebae0b18b4", "Lipan Aquifer GAM — Model"),
    "b0b28282-05ee-4413-9bb1-d9ed5b850214": ("aae21134-8c61-4683-abb1-1107c433b175", "Nacatoch Aquifer GAM — Model"),
    "322a568f-b2d0-45be-a8cc-c9033a54f073": ("4921c88c-f4fe-4177-91c2-0be294f48175", "Seymour and Blaine GAM — Model Files archive"),
    "3d3a9061-cb24-4c6d-808c-310bf5f0ed88": ("4921c88c-f4fe-4177-91c2-0be294f48175", "Seymour and Blaine Aquifers GAM (v2.01) — Model"),
}
LEGACY_MODEL_ARCHIVE_IDS = {"322a568f-b2d0-45be-a8cc-c9033a54f073"}

# The San Antonio archive was inspected on 2026-09-20 before these bindings
# were approved.  CD-2_model/00_readme.txt identifies GWSIM-IV, the calibration
# and verification inputs, pumpage, recharge, and Comal/San Marcos springs.
# exec.f, getpmp.for, physdt.for, and output.for identify simulated heads,
# storage coefficient, permeability, spring flow, and river flow.  TWDB's
# model page independently describes this GWSIM as using an alternative
# hydraulic-conductivity distribution.
MODEL_ARCHIVE_VARIABLES = {
    "5097bb8b-0624-48e6-a3d8-6e1b70bec545": [
        "groundwater__hydraulic_head",
        "aquifer__hydraulic_conductivity",
        "aquifer__storativity",
        "land_subsurface_water__recharge_volume_flux",
        "groundwater_well__pumping_volume_flow_rate",
        "spring__volume_flow_rate",
        "river_water__volume_flow_rate",
    ],
}

# package_id: (package name, reviewed bbox, resource IDs to clear).
# The exact geometry is pinned so the migration cannot promote unreviewed drift.
SPATIAL_CORRECTIONS = {
    "3c0c4d61-90f1-489a-baa5-3c6357a01a84": ("edwards-bfz-barton-springs-segment-gam", (-100.797158325, 29.084134882, -97.315817496, 30.627955279), ("879f817f-bdaf-4c9f-8ce3-3d74a40b56df", "3a9a635f-6330-46a3-84bc-579cd557ae5c")),
    "11dfa0b6-3d39-455b-824f-0ed6a4cdfd1f": ("edwards-bfz-northern-segment-gam", (-100.151968314, 30.023275165, -94.042906845, 33.990395922), ("46801662-0c97-4d63-a360-e4a1ef695587", "12a42603-f17b-4d35-9c5e-a7a7e2ee7307")),
    "f1c47627-b313-4b02-922d-80bec8b0d849": ("edwards-trinity-plateau-pecos-valley-gam", (-105.998239664, 28.972594781, -97.369517546, 32.970185584), ("498502f9-e268-4f3e-a171-a9f4b4ed9ca0", "d63a3c99-7633-47ed-b897-75df156e5719")),
    "6d11c310-e1c9-40d0-88f6-613d6d893e1a": ("gulf-coast-central-southern-gam", (-100.212348138, 25.837224319, -95.503867001, 30.164485232), ("febe7790-f563-4b32-bb37-3b477d9c85f4", "e318e313-12e1-4e92-a811-bf0fb085214e")),
    "82a7d48a-a9d7-44a0-8061-dbfea7fb0d01": ("gulf-coast-northern-gam", (-96.794417387, 28.824544999, -93.507806581, 31.189625553), ("1df70ba5-0b2e-4bb8-86d6-c18aeca6a586", "d58dd792-ff36-4e50-9936-83dcffaa8295")),
    "1db72fb2-762f-4669-b6e8-b78b3040d979": ("high-plains-aquifer-system-gam", (-104.102389175, 29.084134882, -97.383017714, 36.500386094), ("18b0459b-54b8-45ee-8b6f-65a83b3ec1dc", "69f17ab8-462f-4344-8229-a5edb71c5186")),
    "191f8bb3-1bf5-4326-89df-5aebae0b18b4": ("lipan-aquifer-gam", (-103.584719045, 29.084134882, -98.349947784, 32.970185584), ("4612151e-4793-48fd-b0cb-72e470b81b78", "59abce6e-6aba-4a85-b4b1-ae82a310ef7d")),
    "aae21134-8c61-4683-abb1-1107c433b175": ("nacatoch-aquifer-gam", (-100.151968314, 30.023275165, -94.042906845, 33.990395922), ("cffc5316-5a1c-46a5-ba68-5c81928f8358", "b0b28282-05ee-4413-9bb1-d9ed5b850214")),
    "4921c88c-f4fe-4177-91c2-0be294f48175": ("seymour-and-blaine-gam", (-101.565038787, 32.233405585, -97.383017714, 35.183016003), ("352470de-2ded-4d53-a7d5-805b59c99f1f", "322a568f-b2d0-45be-a8cc-c9033a54f073")),
    "3d5b4b97-cc54-49ef-9d34-6a94a872d36b": ("edwards-bfz-san-antonio-segment-gam", (-100.797158325, 29.084134882, -97.315817496, 30.627955279), ("1a5aeaca-bb57-474b-b21c-8ac4ab485744", "5097bb8b-0624-48e6-a3d8-6e1b70bec545")),
    "f9b6b956-6b30-4017-aae9-f25b3a137ae6": ("gulf-coast-southern-superseded-gam", (-100.212348138, 25.837224319, -97.04518735, 28.786534911), ("37b53f09-5a74-42cc-92a0-5917a1605b05",)),
}

OLD_ARCHIVE_POLICY = (
    "Opaque model archives are not assigned mint_standard_variables. Variable bindings belong on "
    "separately extracted and scientifically interpreted resources."
)
NEW_ARCHIVE_POLICY = (
    "Complete model archives may carry reviewed mint_standard_variables for variables contained "
    "in the bundle. Reports, landing pages, grids, and geodatabases require their own direct evidence."
)
PACKAGE_EXTRA_CORRECTIONS = {
    package_id: "reviewed model-archive variable bindings retained"
    for package_id in PACKAGE_CORRECTIONS
}
PACKAGE_EXTRA_CORRECTIONS["3d5b4b97-cc54-49ef-9d34-6a94a872d36b"] = (
    "reviewed model-archive variable bindings retained"
)


def _load_manifest() -> dict[str, Any]:
    manifest = json.loads(MANIFEST_PATH.read_text())
    archives = manifest.get("archives")
    if not isinstance(archives, list) or len(archives) != 32:
        raise ValueError("TWDB GAM manifest must contain exactly 32 archives")
    codes = [item.get("model_code") for item in archives]
    if len(set(codes)) != len(codes) or any(not code for code in codes):
        raise ValueError("TWDB GAM manifest model codes must be unique and non-empty")
    for item in archives:
        required = {
            "package_id", "primary_resource_id", "package_name", "resource_name",
            "archive_url", "source_page", "variables", "svo_evidence_location",
            "spatial_bounds", "spatial_evidence_url", "spatial_evidence_location",
        }
        missing = required - set(item)
        if missing:
            raise ValueError(f"Manifest row {item.get('model_code')} is missing {sorted(missing)}")
        if not item["variables"]:
            raise ValueError(f"Manifest row {item['model_code']} has no concrete SVOs")
        if len(item["spatial_bounds"]) != 4:
            raise ValueError(f"Manifest row {item['model_code']} has invalid spatial bounds")
        west, south, east, north = item["spatial_bounds"]
        if not (-180 <= west < east <= 180 and -90 <= south < north <= 90):
            raise ValueError(f"Manifest row {item['model_code']} has invalid WGS84 bounds")
    return manifest


def _load_temporal_manifest(base_manifest: dict[str, Any]) -> dict[str, Any]:
    manifest = json.loads(TEMPORAL_MANIFEST_PATH.read_text())
    archives = manifest.get("archives")
    if not isinstance(archives, list) or len(archives) != 32:
        raise ValueError("TWDB GAM temporal manifest must contain exactly 32 archives")
    expected_packages = {item["package_id"] for item in base_manifest["archives"]}
    package_ids = [item.get("package_id") for item in archives]
    if set(package_ids) != expected_packages or len(package_ids) != len(set(package_ids)):
        raise ValueError("TWDB GAM temporal manifest package IDs must exactly match the metadata manifest")
    required = {
        "package_id", "model_code", "temporal_coverage_start", "temporal_coverage_end",
        "temporal_coverage_kind", "temporal_evidence_url", "temporal_evidence_location",
        "temporal_evidence_rationale", "temporal_precision",
    }
    for item in archives:
        missing = required - set(item)
        if missing:
            raise ValueError(f"Temporal manifest row {item.get('model_code')} is missing {sorted(missing)}")
        try:
            start = date.fromisoformat(item["temporal_coverage_start"])
            end = date.fromisoformat(item["temporal_coverage_end"])
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Temporal manifest row {item['model_code']} has invalid dates") from exc
        if start > end:
            raise ValueError(f"Temporal manifest row {item['model_code']} starts after it ends")
        if item["temporal_precision"] != "year":
            raise ValueError(f"Temporal manifest row {item['model_code']} must use year precision")
        if not all(item[key] for key in ("temporal_coverage_kind", "temporal_evidence_url", "temporal_evidence_location", "temporal_evidence_rationale")):
            raise ValueError(f"Temporal manifest row {item['model_code']} is missing evidence")
    return manifest


TWDB_GAM_MANIFEST = _load_manifest()
TWDB_GAM_BY_PACKAGE = {item["package_id"]: item for item in TWDB_GAM_MANIFEST["archives"]}
TWDB_GAM_BY_RESOURCE = {item["primary_resource_id"]: item for item in TWDB_GAM_MANIFEST["archives"]}
TWDB_GAM_TEMPORAL_MANIFEST = _load_temporal_manifest(TWDB_GAM_MANIFEST)
TWDB_GAM_TEMPORAL_BY_PACKAGE = {
    item["package_id"]: item for item in TWDB_GAM_TEMPORAL_MANIFEST["archives"]
}

# resource_id: (name, old format, old SVO value, new format, new SVO value)
RESOURCE_CORRECTIONS = {
    "6d8f3d63-d5a6-46be-b8d5-a0e2e92d379a": ("Capitan.bas", "BAS", "groundwater__initial_head", "BAS", "groundwater__initial_head"),
    "db23b2ec-28c0-4b93-93cb-a720cc84e526": ("Capitan.ddn", "", "", "DDN", "groundwater__drawdown"),
    "a38bbe2d-edee-4df7-9ac5-6f7258ef5635": ("Capitan.dis", "application/vnd.Mobius.DIS", "model_grid_layer~topmost_top__elevation", "DIS", "model_grid_layer~topmost_top__elevation, model_grid_layer_bottom__elevation"),
    "e8155602-575a-4527-8cd1-60242ff21718": ("Capitan.evt", "", "", "EVT", "land_surface_water__evapotranspiration_flux"),
    "41f84d7c-cf20-4cf6-ba7d-301b5bcf5c88": ("Capitan.hds", "", "", "HDS", "groundwater__hydraulic_head"),
    "9bac9061-0065-40b9-9c93-751a57ec11ac": ("Capitan.lpf", "application/lpf+zip", "Layer_Property_Flow_Package", "LPF", "groundwater__horizontal_hydraulic_conductivity, groundwater__vertical_hydraulic_conductivity"),
    "21a9ad07-cfb2-484a-97dc-92696864de40": ("Capitan.rch", "rch", "groundwater__recharge_volume_flux", "RCH", "groundwater__recharge_volume_flux"),
    "fab17fb0-6983-46a5-b14d-d60d977831a7": ("Capitan.wel", "wel", "groundwater_well__recharge_volume_flux", "WEL", "groundwater_well__volume_flow_rate"),
    "abe98c21-c711-423d-aba5-dd8c8de4cab1": ("Capitan.drn", "drn", "drain_package_file", "drn", ""),
    "e71d4889-fb3e-4d72-bbec-6a23c9f79aee": ("Capitan.hfb", "", "hfb6", "", ""),
    "32bbccd5-05af-4095-9c53-8fce1992839d": ("Capitan.oc", "", "output_control_file", "", ""),
    "0e013454-7c63-40a0-9682-32f14a3d6567": ("AA06 Aquifer Assessment Capitan Reef Aquifer", "PDF", "corpus_nlp", "PDF", ""),
    "f0644e1d-c155-48df-b638-f54ff034d8b5": ("AA09 Aquifer Assessment Capitan Reef Aquifer", "PDF", "corpus_nlp", "PDF", ""),
    "1c01efab-3d9e-4840-b5ea-07dd3c7868a2": ("GR18 GAM run - Management Plan", "PDF", "corpus_nlp", "PDF", ""),
    "f0b267b0-f8d0-41cd-8d03-c9197036daa2": ("GR19-008 GAM run-Management Plan", "PDF", "corpus_nlp", "PDF", ""),
    "0788ca0a-63a7-4920-a2a4-2f77dc47c833": ("GR19-021 GAM run - Management Plan", "PDF", "corpus_nlp", "PDF", ""),
    "298ddfbd-a01d-4fd2-8115-d7f7345f4345": ("GR23-001 GAM run-Management Plan", "PDF", "corpus_nlp", "PDF", ""),
    "2b654388-3305-4aef-995b-11aced95342f": ("GT13-028 GAM task - Total Estimated Recoverable Storage", "PDF", "corpus_nlp", "PDF", ""),
    "ddb09e03-22b1-4fca-a97f-622bb458ded3": ("GT13-030 GAM task - Total Estimated Recoverable Storage", "PDF", "corpus_nlp", "PDF", ""),
    "fc125ba1-4854-4ca7-bd70-801f8a43f714": ("Hydrologic atlas", "PDF", "corpus_nlp", "PDF", ""),
    "24c5d9e2-05ea-4e30-a9b4-5d904b04c0c6": ("TWDB numbered report", "PDF", "corpus_nlp", "PDF", ""),
    "89dc30e2-b8fa-461b-bde6-97bf8387b8d7": ("R317 TWDB numbered report", "PDF", "corpus_nlp", "PDF", ""),
}


def fetch(url: str, *, method: str = "GET", body: bytes | None = None, headers: dict[str, str] | None = None) -> bytes:
    request = Request(url, data=body, method=method, headers={"User-Agent": "MINT-CKAN-SVO-reconciler/1.0", **(headers or {})})
    with urlopen(request, timeout=45) as response:
        return response.read(32 * 1024 * 1024)


def action(name: str, **params: Any) -> Any:
    envelope = json.loads(fetch(f"{CKAN}/api/3/action/{name}?{urlencode(params)}"))
    if not envelope.get("success"):
        raise ValueError(f"CKAN {name}: {envelope.get('error')}")
    return envelope["result"]


def post_action(name: str, payload: dict[str, Any], token: str) -> Any:
    envelope = json.loads(fetch(
        f"{CKAN}/api/3/action/{name}", method="POST",
        body=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "X-Tapis-Token": token},
    ))
    if not envelope.get("success"):
        raise ValueError(f"CKAN {name}: {envelope.get('error')}")
    return envelope["result"]


def read_dotenv(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        values[key.strip()] = value
    return values


def get_token(credentials_file: Path | None) -> str:
    if os.environ.get("CKAN_API_TOKEN"):
        return os.environ["CKAN_API_TOKEN"]
    values = read_dotenv(credentials_file) if credentials_file else os.environ
    username, password = values.get("TAPIS_USERNAME"), values.get("TAPIS_PASSWORD")
    if not username or not password:
        raise ValueError("Set CKAN_API_TOKEN or provide TAPIS_USERNAME/TAPIS_PASSWORD")
    envelope = json.loads(fetch(
        TAPIS_TOKEN_URL, method="POST",
        body=json.dumps({"username": username, "password": password, "grant_type": "password"}).encode(),
        headers={"Content-Type": "application/json"},
    ))
    try:
        return envelope["result"]["access_token"]["access_token"]
    except (KeyError, TypeError) as exc:
        raise ValueError("Tapis token response did not contain an access token") from exc


def fetch_packages() -> list[dict[str, Any]]:
    result = action("package_search", fq=f"organization:{ORG}", rows=1000, start=0)
    if len(result["results"]) != result["count"]:
        raise ValueError("Incomplete CKAN package snapshot")
    return result["results"]


def _normalized_field(key: str, value: Any) -> Any:
    if key != "extras":
        if key == "mint_standard_variables" and value in (None, ""):
            return []
        if key in {"resource_type", "spatial", "temporal_coverage_start", "temporal_coverage_end"} and value is None:
            return ""
        return value
    if value in (None, ""):
        return []
    return sorted(
        ((item.get("key", ""), item.get("value", "")) for item in value),
        key=lambda item: (item[0], item[1]),
    )


def _state(current: dict[str, Any], before: dict[str, Any], after: dict[str, Any]) -> str:
    def value(key: str) -> Any:
        return _normalized_field(key, current.get(key, ""))

    if all(value(key) == _normalized_field(key, expected) for key, expected in after.items()):
        return "already_applied"
    if all(value(key) == _normalized_field(key, expected) for key, expected in before.items()):
        return "needs_apply"
    return "drift"


def _canonical_spatial(value: Any) -> str:
    parsed = json.loads(value) if isinstance(value, str) else value
    if not isinstance(parsed, dict):
        raise ValueError(f"Spatial value is not a GeoJSON object: {value!r}")
    return json.dumps(parsed, sort_keys=True, separators=(",", ":"))


def _bbox_polygon(bounds: tuple[float, float, float, float]) -> dict[str, Any]:
    west, south, east, north = bounds
    return {
        "type": "Polygon",
        "coordinates": [[
            [west, south], [east, south], [east, north], [west, north], [west, south],
        ]],
    }


def _updated_package_extras(
    extras: list[dict[str, Any]],
    package_id: str,
) -> list[dict[str, Any]]:
    semantic_status = PACKAGE_EXTRA_CORRECTIONS.get(package_id)
    if not semantic_status:
        return extras
    replacements = {
        "mint_standard_variables_policy": NEW_ARCHIVE_POLICY,
        "semantic_annotation_status": semantic_status,
        "spatial_coverage_status": "reviewed resource geometry promoted to dataset; not reverified",
    }
    result = []
    replaced = set()
    for item in extras:
        key = item.get("key")
        if key in replacements:
            result.append({"key": key, "value": replacements[key]})
            replaced.add(key)
        else:
            result.append(item)
    missing = set(replacements) - replaced
    if missing:
        raise ValueError(f"Missing expected package status extras for {package_id}: {sorted(missing)}")
    return result


def build_plan(packages: list[dict[str, Any]]) -> dict[str, Any]:
    by_id = {package["id"]: package for package in packages}
    resources = {
        resource["id"]: (package["id"], resource)
        for package in packages
        for resource in package.get("resources", [])
    }
    actions: list[dict[str, Any]] = []
    old_svo_values = {""}
    old_svo_values.update(", ".join(value) for value in MODEL_ARCHIVE_VARIABLES.values())
    old_svo_values.update(", ".join(value[1]) for value in PACKAGE_CORRECTIONS.values())
    allowed_policy = {"", OLD_ARCHIVE_POLICY, NEW_ARCHIVE_POLICY}
    allowed_policy.add("Opaque model archives are not assigned mint_standard_variables. Variable bindings belong on separately extracted and scientifically interpreted resources.")
    allowed_status = {
        "", "archive-level variable bindings intentionally omitted",
        "reviewed model-archive variable bindings retained",
        "evidence-backed model archive bindings in manifest",
    }
    allowed_spatial_status = {
        "", "approximate resource geometry retained; not promoted to dataset geometry",
        "reviewed resource geometry promoted to dataset; not reverified",
        "existing dataset geometry retained; not reverified",
        "exact model footprint not verified",
        "dataset-level TWDB extent envelope; resource spatial cleared",
    }

    for entry in TWDB_GAM_MANIFEST["archives"]:
        package_id = entry["package_id"]
        temporal = TWDB_GAM_TEMPORAL_BY_PACKAGE[package_id]
        package = by_id.get(package_id)
        if not package or package.get("name") != entry["package_name"]:
            raise ValueError(f"Missing or renamed target package {entry['package_name']} ({package_id})")
        package_extras = list(package.get("extras") or [])
        by_key: dict[str, dict[str, Any]] = {}
        for extra in package_extras:
            key = extra.get("key")
            if key in by_key:
                raise ValueError(f"Duplicate package extra {key} for {entry['package_name']}")
            by_key[key] = extra
        if by_key.get("mint_standard_variables_policy", {}).get("value", "") not in allowed_policy:
            raise ValueError(f"Drifted SVO policy extra for {entry['package_name']}")
        if by_key.get("semantic_annotation_status", {}).get("value", "") not in allowed_status:
            raise ValueError(f"Drifted semantic status extra for {entry['package_name']}")
        if by_key.get("spatial_coverage_status", {}).get("value", "") not in allowed_spatial_status:
            raise ValueError(f"Drifted spatial status extra for {entry['package_name']}")
        if "spatial" in by_key and by_key["spatial"].get("value"):
            _canonical_spatial(by_key["spatial"]["value"])
        spatial = _canonical_spatial(_bbox_polygon(tuple(entry["spatial_bounds"])))
        spatial_in_extra = package.get("type") == "subside_dataset"
        replacements = {
            "mint_standard_variables_policy": NEW_ARCHIVE_POLICY,
            "semantic_annotation_status": "evidence-backed model archive bindings in manifest",
            "spatial_coverage_status": "dataset-level TWDB extent envelope; resource spatial cleared",
            "simulation_period_status": "verified from official model report",
            "temporal_coverage_status": "evidence-backed model simulation or calibration period",
            "temporal_coverage_evidence_url": temporal["temporal_evidence_url"],
            "temporal_coverage_evidence_location": temporal["temporal_evidence_location"],
            "temporal_coverage_rationale": temporal["temporal_evidence_rationale"],
            "temporal_coverage_precision": temporal["temporal_precision"],
        }
        if spatial_in_extra:
            replacements["spatial"] = spatial
        after_extras = [
            {"key": item["key"], "value": replacements.get(item["key"], item.get("value", ""))}
            for item in package_extras
            if item["key"] != "spatial"
        ]
        present = {item["key"] for item in after_extras}
        after_extras.extend(
            {"key": key, "value": value}
            for key, value in replacements.items() if key not in present
        )
        package_before = {
            "mint_standard_variables": package.get("mint_standard_variables") or [],
            "temporal_coverage_start": package.get("temporal_coverage_start") or "",
            "temporal_coverage_end": package.get("temporal_coverage_end") or "",
            "extras": package_extras,
        }
        package_after = {
            "mint_standard_variables": [],
            "temporal_coverage_start": temporal["temporal_coverage_start"],
            "temporal_coverage_end": temporal["temporal_coverage_end"],
            "extras": after_extras,
        }
        if not spatial_in_extra:
            package_before["spatial"] = package.get("spatial") or ""
            package_after["spatial"] = spatial
        package_action = {
            "action": "package_patch", "id": package_id, "name": entry["package_name"],
            "before": package_before, "after": package_after,
            "rollback": package_before,
            "state": _state(package, package_before, package_after),
            "evidence": {
                "source_page": entry["source_page"],
                "spatial": entry["spatial_evidence_url"],
                "coverage_kind": "extent_envelope",
                "temporal": temporal,
            },
        }
        actions.append(package_action)

        parent_and_resource = resources.get(entry["primary_resource_id"])
        if not parent_and_resource or parent_and_resource[0] != package_id:
            raise ValueError(f"Missing model archive {entry['resource_name']} ({entry['primary_resource_id']})")
        resource = parent_and_resource[1]
        if resource.get("name") != entry["resource_name"]:
            raise ValueError(f"Renamed model archive {entry['resource_name']} ({entry['primary_resource_id']})")
        current_svo = resource.get("mint_standard_variables", "") or ""
        if isinstance(current_svo, list):
            current_svo = ", ".join(current_svo)
        if current_svo not in old_svo_values and current_svo != ", ".join(entry["variables"]):
            raise ValueError(f"Drifted SVO value on model archive {entry['primary_resource_id']}")
        current_type = resource.get("resource_type")
        if current_type not in (None, "", "model_archive"):
            raise ValueError(f"Drifted resource type on model archive {entry['primary_resource_id']}")
        before = {
            "mint_standard_variables": current_svo,
            "resource_type": current_type,
            "spatial": resource.get("spatial", "") or "",
        }
        after = {
            "mint_standard_variables": ", ".join(entry["variables"]),
            "resource_type": "model_archive",
            "spatial": "",
        }
        actions.append({
            "action": "resource_patch", "id": entry["primary_resource_id"],
            "package_id": package_id, "name": entry["resource_name"],
            "before": before, "after": after, "state": _state(resource, before, after),
            "evidence": {
                "source_page": entry["source_page"],
                "archive_url": entry["archive_url"],
                "location": entry["svo_evidence_location"],
                "variables": entry["variables"],
            },
        })

        for other in package.get("resources", []):
            if other["id"] == entry["primary_resource_id"] or not other.get("spatial"):
                continue
            other_before = {"spatial": other["spatial"]}
            actions.append({
                "action": "resource_patch", "id": other["id"], "package_id": package_id,
                "name": other.get("name", ""), "before": other_before, "after": {"spatial": ""},
                "state": _state(other, other_before, {"spatial": ""}),
            })

    capitan = by_id.get(CAPITAN_PACKAGE_ID)
    if capitan and capitan.get("name") == CAPITAN_PACKAGE_NAME:
        capitan_resources = {resource["id"]: resource for resource in capitan.get("resources", [])}
        for resource_id, correction in RESOURCE_CORRECTIONS.items():
            name, old_format, old_svo, new_format, new_svo = correction
            resource = capitan_resources.get(resource_id)
            if not resource or resource.get("name") != name:
                raise ValueError(f"Missing or renamed target resource {name} ({resource_id})")
            before = {"format": old_format, "mint_standard_variables": old_svo}
            after = {"format": new_format, "mint_standard_variables": new_svo}
            actions.append({
                "action": "resource_patch", "id": resource_id,
                "package_id": CAPITAN_PACKAGE_ID, "name": name,
                "before": before, "after": after, "state": _state(resource, before, after),
            })

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "ckan": CKAN, "organization": ORG,
        "summary": {
            "package_actions": sum(item["action"] == "package_patch" for item in actions),
            "resource_actions": sum(item["action"] == "resource_patch" for item in actions),
            "archive_resources": len(TWDB_GAM_MANIFEST["archives"]),
            "spatial_packages": len(TWDB_GAM_MANIFEST["archives"]),
            "spatial_resources": sum(
                1 for item in actions
                if item["action"] == "resource_patch" and item.get("after") == {"spatial": ""}
            ),
            "metadata_packages": len(TWDB_GAM_MANIFEST["archives"]),
            "temporal_packages": len(TWDB_GAM_TEMPORAL_MANIFEST["archives"]),
            "needs_apply": sum(item["state"] == "needs_apply" for item in actions),
            "already_applied": sum(item["state"] == "already_applied" for item in actions),
            "drift": sum(item["state"] == "drift" for item in actions),
        },
        "actions": actions,
        "protected_packages": ["ntgam-v301-outputs", "ntgam-trinity-woodbine-v301"],
        "manifests": [str(MANIFEST_PATH), str(TEMPORAL_MANIFEST_PATH)],
        "policy": "Spatial and temporal coverage are dataset-level. Evidence-backed SVO lists belong on the primary model archives, not reports, landing pages, grids, or geodatabases.",
    }


def dump(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def apply_plan(plan: dict[str, Any], output: Path, token: str) -> None:
    if plan["summary"]["drift"]:
        raise ValueError("Refusing to write because one or more target records drifted")
    log = {"started_at": datetime.now(timezone.utc).isoformat(), "actions": [], "status": "running"}
    log_path = output / "write-log.json"
    dump(log_path, log)
    try:
        for item in plan["actions"]:
            if item["state"] == "already_applied":
                continue
            payload = {"id": item["id"], **item["after"]}
            result = post_action(item["action"], payload, token)
            actual = {key: result.get(key, "") for key in item["after"]}
            if any(
                _normalized_field(key, actual[key]) != _normalized_field(key, expected)
                for key, expected in item["after"].items()
            ):
                raise ValueError(f"CKAN readback mismatch for {item['id']}: {actual!r}")
            log["actions"].append({"action": item["action"], "id": item["id"], "status": "success"})
            dump(log_path, log)
    except Exception as exc:
        log.update({
            "failed_at": datetime.now(timezone.utc).isoformat(),
            "status": "failed",
            "error": str(exc),
        })
        dump(log_path, log)
        raise
    log.update({"completed_at": datetime.now(timezone.utc).isoformat(), "status": "complete"})
    dump(log_path, log)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("/tmp/ckan-svo-corrections-2026-09-19"))
    parser.add_argument("--credentials-file", type=Path)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--yes", action="store_true")
    args = parser.parse_args()
    if args.apply and not args.yes:
        parser.error("--apply requires --yes")

    args.output.mkdir(parents=True, exist_ok=True)
    packages = fetch_packages()
    plan = build_plan(packages)
    dump(args.output / "ckan-before.json", packages)
    dump(args.output / "plan.json", plan)
    dump(args.output / "rollback.json", [
        {"action": item["action"], "id": item["id"], "values": item.get("rollback", item["before"])}
        for item in plan["actions"] if item["state"] == "needs_apply"
    ])
    print(json.dumps(plan["summary"], indent=2))
    print(f"Plan and rollback manifest: {args.output}")
    if not args.apply:
        print("Dry run only; no CKAN mutations performed.")
        return

    apply_plan(plan, args.output, get_token(args.credentials_file))
    after = fetch_packages()
    verification = build_plan(after)
    dump(args.output / "ckan-after.json", after)
    dump(args.output / "verification.json", verification)
    if verification["summary"]["needs_apply"] or verification["summary"]["drift"]:
        raise ValueError("Post-write verification failed")
    print(json.dumps(verification["summary"], indent=2))


if __name__ == "__main__":
    main()
