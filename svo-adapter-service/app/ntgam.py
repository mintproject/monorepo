"""NTGAM location -> SUBSIDE forecast scenario assembly (registry-driven).

Given a lat/lon in the Northern Trinity GAM, build the forecast's input scenario
with NOTHING hardcoded:

  * water levels  -> SAMPLED from the CKAN-registered NTGAM head rasters
                     (groundwater__hydraulic_head), chosen by model layer + the
                     ordered stress periods (earliest = predevelopment, latest =
                     current, a middle one = base).
  * scalar config -> the forecast ModelConfiguration's PARAMETER DEFAULTS, read
                     live from MINT (overridable by the caller).
  * site inputs   -> EXECUTED from the planner branch chain. Published rasters /
                     point collections are sampled directly; raw DIS/SDR archives
                     are materialized into the adapter cache first, then sampled.
  * anything still unresolved is left to the model default and reported in
                     ``missing`` rather than silently zeroed.

The scalar parameter slugs are identical to the ``SubsidenceInputs`` field names,
so the scenario dict feeds ``forecast.run_forecast`` directly.
"""
from __future__ import annotations

import concurrent.futures as cf
import csv
import hashlib
import io
import json
import math
import os
import re
import shutil
import subprocess
import tempfile
import threading
import zipfile
from collections import defaultdict
from pathlib import Path
from typing import Any

import httpx

from . import providers, stac
from .config import settings
from .sampling import SampleError, sample_raster

HEAD_SVO = "groundwater__hydraulic_head"
STORATIVITY_SVO = "aquifer__storativity"
LAND_SURFACE_SVO = "land_surface__elevation"
_TEMPORAL_TO_SP = {"predevelopment": 52, "base": 92, "current": 132}
_SP_TO_TEMPORAL = {v: k for k, v in _TEMPORAL_TO_SP.items()}
_YEAR_TO_SP = {1939: 52, 1979: 92, 2019: 132}
_HEAD_RASTER_FORMATS = {"GEOTIFF", "GTIFF", "COG", "TIF", "TIFF"}
_REPO = Path(__file__).resolve().parents[3]
_RAW_SOURCE_CACHE = Path(tempfile.gettempdir()) / "ntgam-source-cache"
_MATERIALIZATION_CACHE = Path(tempfile.gettempdir()) / "ntgam-materialization-cache"
_MATERIALIZATION_LOCK = threading.RLock()
_NTGAM_BBOX = (-99.7630, 29.9014, -93.4816, 34.4266)
_CLAY_TERMS = re.compile(r"clay|shale|marl|mudstone|claystone", re.I)
_RASTERIZE_CO = ["-co", "COMPRESS=DEFLATE", "-co", "PREDICTOR=2"]

# Ordered stress period -> SubsidenceInputs water-level field. The position in the
# *sorted* list of available stress periods decides the role (user decision:
# earliest = predevelopment, latest = current), so no calendar is assumed and the
# mapping adapts to whatever stress periods CKAN actually holds.
_WL_PREDEV = "predevelopment_water_level_ft_msl"
_WL_BASE = "base_water_level_ft_msl"
_WL_CURRENT = "current_water_level_ft_msl"

# The screening model's required numeric inputs (mirrors model.validate_inputs). The
# tab fills these from: sampled rasters (water levels), MINT param defaults, physical
# derivations, or — for site properties NTGAM doesn't carry — an explicit override.
REQUIRED_NUMERIC = [
    "land_surface_ft_msl", "aquifer_top_ft_msl", "aquifer_thickness_ft",
    "clay_thickness_ft", "groundwater_temp_c", "groundwater_tds_mg_l",
    "current_water_level_ft_msl", "unsat_thickness_ft",
    "preconsolidation_water_level_ft_msl", "base_water_level_ft_msl",
    "future_water_level_ft_msl", "aquifer_porosity_pct", "clay_porosity_pct",
    "aq_comp_min_psi_inv", "aq_comp_max_psi_inv", "clay_comp_min_psi_inv",
    "clay_comp_max_psi_inv",
]
# Site properties that NTGAM has no registered source for (user must supply).
SITE_INPUTS = ["land_surface_ft_msl", "aquifer_top_ft_msl", "aquifer_thickness_ft",
               "clay_thickness_ft", "groundwater_temp_c", "groundwater_tds_mg_l"]


def _is_num(v: Any) -> bool:
    try:
        return v is not None and float(v) == float(v)  # excludes NaN
    except (TypeError, ValueError):
        return False


# --- MINT: forecast parameter defaults -------------------------------------
_PARAM_QUERY = """
query Params($cfg: String!) {
  modelcatalog_configuration_parameter(where: {configuration_id: {_ilike: $cfg}}) {
    parameter { id label has_default_value has_data_type }
  }
}
"""


def _hasura(query: str, variables: dict[str, Any]) -> dict[str, Any]:
    r = httpx.post(
        settings.mint_hasura_url,
        headers={"x-hasura-admin-secret": settings.mint_admin_secret,
                 "Content-Type": "application/json"},
        json={"query": query, "variables": variables},
        timeout=settings.request_timeout_seconds,
    )
    r.raise_for_status()
    payload = r.json()
    if payload.get("errors"):
        raise RuntimeError(payload["errors"][0].get("message", "hasura error"))
    return payload["data"]


def _coerce(value: Any, dtype: str) -> Any:
    if value is None or value == "":
        return None
    try:
        if dtype == "int":
            return int(float(value))
        if dtype == "float":
            return float(value)
    except (TypeError, ValueError):
        return None
    return str(value)


def param_defaults() -> dict[str, dict[str, Any]]:
    """{slug: {label, default(typed), type, param_id}} for the forecast config."""
    data = _hasura(_PARAM_QUERY, {"cfg": f"%{settings.forecast_config_id}%"})
    out: dict[str, dict[str, Any]] = {}
    marker = "_param_"
    for row in data["modelcatalog_configuration_parameter"]:
        p = row["parameter"]
        pid = p["id"]
        slug = pid.split(marker, 1)[1] if marker in pid else pid.rsplit("/", 1)[-1]
        dtype = (p.get("has_data_type") or "string")
        if isinstance(dtype, list):
            dtype = dtype[0] if dtype else "string"
        out[slug] = {
            "label": p.get("label"),
            "type": dtype,
            "default": _coerce(p.get("has_default_value"), dtype),
            "raw_default": p.get("has_default_value"),
            "param_id": pid,
        }
    return out


# --- CKAN: NTGAM head rasters ----------------------------------------------
def _ckan(action: str, **params: Any) -> Any:
    headers = {"Authorization": settings.ckan_token} if settings.ckan_token else {}
    r = httpx.get(f"{settings.ckan_url}/api/3/action/{action}", params=params,
                  headers=headers, timeout=settings.request_timeout_seconds)
    r.raise_for_status()
    body = r.json()
    if not body.get("success"):
        raise RuntimeError(f"ckan {action} failed: {body.get('error')}")
    return body["result"]


def _head_stress_period(res: dict[str, Any]) -> int | None:
    raw_sp = res.get("stress_period")
    if raw_sp is not None:
        try:
            return int(raw_sp)
        except (TypeError, ValueError):
            pass
    temporal = str(res.get("temporal_resolution") or "").lower()
    if temporal in _TEMPORAL_TO_SP:
        return _TEMPORAL_TO_SP[temporal]
    raw_year = res.get("year")
    if raw_year is not None:
        try:
            return _YEAR_TO_SP.get(int(raw_year))
        except (TypeError, ValueError):
            pass
    match = re.search(r"(?:^|[_\W])sp(\d+)(?:\D|$)",
                      f"{res.get('name', '')} {res.get('url', '')}", re.IGNORECASE)
    return int(match.group(1)) if match else None


def _is_head_raster(res: dict[str, Any]) -> bool:
    if res.get("mint_standard_variables") != HEAD_SVO or not res.get("url"):
        return False
    if str(res.get("name", "")).startswith("Rasters__"):
        return True
    fmt = str(res.get("format") or "").upper()
    url = str(res.get("url") or "").lower()
    return fmt in _HEAD_RASTER_FORMATS or url.endswith((".tif", ".tiff"))


def list_heads() -> list[dict[str, Any]]:
    """Registered NTGAM head *rasters* with their (layer, stress_period, extent)."""
    pkg = _ckan("package_show", id=settings.ntgam_waterlevels_dataset)
    heads = []
    for res in pkg.get("resources", []):
        if not _is_head_raster(res):
            continue
        layer, sp = res.get("model_layer"), _head_stress_period(res)
        if layer is None or sp is None:
            continue
        try:
            heads.append({
                "id": res["id"], "name": res["name"], "url": res["url"],
                "model_layer": int(layer), "stress_period": int(sp),
                "temporal_resolution": res.get("temporal_resolution") or _SP_TO_TEMPORAL.get(int(sp)),
                "extent": res.get("extent") or "full", "unit": res.get("unit"),
            })
        except (TypeError, ValueError):
            continue
    return heads


def options() -> dict[str, Any]:
    """Everything the UI needs to drive the tab — all from the registry."""
    heads = list_heads()
    params = param_defaults()
    layers = sorted({h["model_layer"] for h in heads})
    sps = sorted({h["stress_period"] for h in heads})
    extents = sorted({h["extent"] for h in heads})
    return {
        "config_id": settings.forecast_config_id,
        "dataset": settings.ntgam_waterlevels_dataset,
        "model_layers": layers,
        "stress_periods": sps,
        "extents": extents,
        "head_raster_count": len(heads),
        "parameters": [
            {"slug": s, "label": v["label"], "type": v["type"], "default": v["default"]}
            for s, v in params.items()
        ],
        # spatial inputs declared by the forecast config + whether NTGAM has a source
        "spatial_inputs": [
            {"slug": "water_level", "svo": HEAD_SVO, "field": "(water levels)",
             "ntgam_source": "ckan_raster" if heads else None},
            {"slug": "storage_coefficient", "svo": STORATIVITY_SVO,
             "field": "aquifer_storage_coefficient",
             "ntgam_source": None, "note": "storativity grid is inside the .gdb only"},
            {"slug": "land_surface", "svo": LAND_SURFACE_SVO,
             "field": "land_surface_ft_msl",
             "ntgam_source": None, "note": "no DEM registered for NTGAM"},
        ],
    }


# Site-input fields that are now registered as their own CKAN raster(s) and sampled
# at the point exactly like the heads. `per_layer` picks the raster matching the
# selected model layer (for the aquifer-geometry sources). Grows as ingest adds more.
SITE_RASTER_SOURCES: dict[str, dict[str, Any]] = {
    "land_surface_ft_msl": {"dataset": "ntgam-land-surface", "svo": LAND_SURFACE_SVO,
                            "per_layer": False},
    "aquifer_top_ft_msl": {"dataset": "ntgam-aquifer-geometry",
                           "svo": "aquifer__top_elevation", "per_layer": True},
    "aquifer_thickness_ft": {"dataset": "ntgam-aquifer-geometry",
                             "svo": "aquifer__thickness", "per_layer": True},
}


def _ckan_rasters(dataset: str, svo: str) -> list[dict[str, Any]]:
    """Sampleable rasters in a CKAN dataset carrying a given SVO."""
    try:
        pkg = _ckan("package_show", id=dataset)
    except Exception:  # noqa: BLE001 - dataset may not exist yet (ingest not run)
        return []
    out = []
    for res in pkg.get("resources", []):
        if res.get("mint_standard_variables") != svo or not res.get("url"):
            continue
        out.append({"id": res["id"], "name": res["name"], "url": res["url"],
                    "model_layer": res.get("model_layer"), "unit": res.get("unit"),
                    "origin": res.get("source"), "extent": res.get("extent")})
    return out


def sample_site_raster(field: str, lat: float, lon: float,
                       model_layer: int) -> tuple[float, dict[str, Any]] | None:
    """Sample a registered CKAN site raster for `field` at the point; None if absent."""
    spec = SITE_RASTER_SOURCES.get(field)
    if not spec:
        return None
    rasters = _ckan_rasters(spec["dataset"], spec["svo"])
    if spec.get("per_layer"):
        rasters = [r for r in rasters if str(r.get("model_layer")) == str(model_layer)] or rasters
    for r in rasters:
        try:
            v = sample_raster(r["url"], lon, lat, settings.ckan_token)
        except SampleError:
            continue
        if v is not None:
            return v, r
    return None


# Site-input fields registered as a CKAN POINT dataset (GeoJSON), sampled by nearest
# observation within a search radius (groundwater quality from the Water Quality Portal).
SITE_POINT_SOURCES: dict[str, dict[str, Any]] = {
    "groundwater_temp_c": {"dataset": "ntgam-water-quality",
                           "svo": "groundwater__temperature", "radius_mi": 30},
    "groundwater_tds_mg_l": {"dataset": "ntgam-water-quality",
                             "svo": "groundwater__total_dissolved_solids", "radius_mi": 30},
    "clay_thickness_ft": {"dataset": "ntgam-lithology",
                          "svo": "aquitard__clay_thickness", "radius_mi": 25},
}


def _haversine_mi(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 3958.7613  # mean Earth radius, miles
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


# Parsed GeoJSON point features cached by resource URL (some datasets — e.g. SDR clay,
# ~265k wells — are large; download + parse once, then nearest lookups are in-memory).
_POINT_FEATURE_CACHE: dict[str, list[dict[str, Any]]] = {}


def _ckan_point_features(dataset: str, svo: str) -> list[dict[str, Any]]:
    """Download (once) the GeoJSON point resource carrying `svo` and return its features."""
    try:
        pkg = _ckan("package_show", id=dataset)
    except Exception:  # noqa: BLE001
        return []
    res = next((r for r in pkg.get("resources", [])
                if r.get("mint_standard_variables") == svo and r.get("url")), None)
    if not res:
        return []
    url = res["url"]
    if url in _POINT_FEATURE_CACHE:
        return _POINT_FEATURE_CACHE[url]
    headers = {"Authorization": settings.ckan_token} if settings.ckan_token else {}
    try:
        r = httpx.get(url, headers=headers, timeout=120.0, follow_redirects=True)
        r.raise_for_status()
        feats = (r.json() or {}).get("features", [])
    except (httpx.HTTPError, ValueError):
        return []
    _POINT_FEATURE_CACHE[url] = feats
    return feats


# --- aquifer auto-detect from the CKAN-mirrored context polygons (same CKAN process) ---
def _point_in_ring(x: float, y: float, ring: list) -> bool:
    inside, n, j = False, len(ring), len(ring) - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi:
            inside = not inside
        j = i
    return inside


def _point_in_polygon(x: float, y: float, geom: dict[str, Any]) -> bool:
    t, coords = geom.get("type"), geom.get("coordinates") or []
    polys = coords if t == "MultiPolygon" else ([coords] if t == "Polygon" else [])
    for poly in polys:
        if poly and _point_in_ring(x, y, poly[0]) and not any(_point_in_ring(x, y, h) for h in poly[1:]):
            return True
    return False


def detect_aquifer(lat: float, lon: float) -> dict[str, Any]:
    """Which aquifer the point is in + a suggested NTGAM layer, by point-in-polygon over
    the CKAN-mirrored aquifer polygons (ntgam-context). Falls back to live STAC if absent."""
    feats = _ckan_point_features("ntgam-context", "aquifer__extent")
    names = [str((f.get("properties") or {}).get("AQ_NAME"))
             for f in feats if (f.get("properties") or {}).get("AQ_NAME")
             and _point_in_polygon(lon, lat, f.get("geometry") or {})]
    if not feats:
        return stac.detect_aquifer(lat, lon)  # not mirrored yet -> live fallback
    suggested = None
    for nm in names:
        for key, lyr in stac.AQUIFER_TO_LAYER.items():
            if key in nm.lower():
                suggested = lyr
                break
        if suggested:
            break
    return {"aquifers": names, "suggested_layer": suggested, "source": "ckan:ntgam-context"}


def sample_site_point(field: str, lat: float, lon: float) -> tuple[float, dict[str, Any]] | None:
    """Nearest registered observation for `field` within its search radius; None if none."""
    spec = SITE_POINT_SOURCES.get(field)
    if not spec:
        return None
    best: tuple[float, dict[str, Any]] | None = None
    for f in _ckan_point_features(spec["dataset"], spec["svo"]):
        try:
            lon2, lat2 = f["geometry"]["coordinates"][:2]
            val = float(f["properties"]["value"])
        except (KeyError, TypeError, ValueError, IndexError):
            continue
        d = _haversine_mi(lat, lon, float(lat2), float(lon2))
        if best is None or d < best[0]:
            best = (d, {"value": val, **f.get("properties", {})})
    if best is None or best[0] > spec["radius_mi"]:
        return None
    dist, meta = best
    meta["distance_mi"] = round(dist, 1)
    return meta["value"], meta


def _wl_field_for_index(i: int, n: int) -> str | None:
    """Map the i-th (of n) ascending stress period to a water-level field."""
    if n == 1:
        return _WL_CURRENT
    if i == 0:
        return _WL_PREDEV
    if i == n - 1:
        return _WL_CURRENT
    # any middle stress period -> base (last middle wins; fine for the 3-SP case)
    return _WL_BASE


# ===========================================================================
# Plan-driven assembly: the PLANNER resolves which source + ETL satisfies each
# forecast input (see /forecast/plan); this executes those resolved branches.
# Nothing about which sources/ETLs to use is hardcoded here — it comes from the plan.
# ===========================================================================
# (run-spec input SVO + temporal) -> SubsidenceInputs field the value fills.
FORECAST_FIELD_MAP: dict[tuple[str, str | None], str] = {
    ("groundwater__hydraulic_head", "predevelopment"): "predevelopment_water_level_ft_msl",
    ("groundwater__hydraulic_head", "base"): "base_water_level_ft_msl",
    ("groundwater__hydraulic_head", "current"): "current_water_level_ft_msl",
    ("aquifer__top_elevation", None): "aquifer_top_ft_msl",
    ("aquifer__thickness", None): "aquifer_thickness_ft",
    ("land_surface__elevation", None): "land_surface_ft_msl",
    ("groundwater__temperature", None): "groundwater_temp_c",
    ("groundwater__total_dissolved_solids", None): "groundwater_tds_mg_l",
    ("aquitard__clay_thickness", None): "clay_thickness_ft",
}


def _cache_key(*parts: Any) -> str:
    h = hashlib.sha1()
    for part in parts:
        h.update(str(part).encode())
        h.update(b"\0")
    return h.hexdigest()[:16]


def _local_source_path(uri: str) -> Path | None:
    path = Path(uri[7:]) if uri.startswith("file://") else Path(uri)
    return path if "://" not in uri or uri.startswith("file://") else None


def _download_source(uri: str, suffix: str, timeout: float = 900.0) -> Path:
    local = _local_source_path(uri)
    if local and local.exists():
        return local
    _RAW_SOURCE_CACHE.mkdir(parents=True, exist_ok=True)
    dest = _RAW_SOURCE_CACHE / f"{_cache_key(uri)}{suffix}"
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    headers = {"Authorization": settings.ckan_token} if settings.ckan_token else {}
    tmp = dest.with_suffix(dest.suffix + ".part")
    try:
        with httpx.stream("GET", uri, headers=headers, timeout=timeout,
                          follow_redirects=True) as r:
            r.raise_for_status()
            with tmp.open("wb") as fh:
                for chunk in r.iter_bytes():
                    fh.write(chunk)
        tmp.replace(dest)
    except httpx.HTTPError as exc:
        raise RuntimeError(f"could not download source archive: {exc}") from exc
    return dest


def _find_local_ntgam_gdb() -> Path | None:
    explicit = os.environ.get("SVO_ADAPTER_NTGAM_GDB_DIR") or os.environ.get("NTGAM_GDB_DIR")
    candidates: list[Path] = []
    if explicit:
        candidates.append(Path(explicit))
    candidates.extend([
        _REPO / "ntgam" / "NTGAM_Geodatabase",
        _REPO / "NTGAM_Geodatabase",
    ])
    for candidate in candidates:
        if candidate.suffix.lower() == ".gdb" and candidate.exists():
            return candidate
        if candidate.exists():
            found = sorted(candidate.glob("*.gdb"))
            if found:
                return found[0]
    return None


def _extract_gdb_from_archive(uri: str) -> Path:
    outdir = _RAW_SOURCE_CACHE / f"gdb-{_cache_key(uri)}"
    found = sorted(outdir.rglob("*.gdb")) if outdir.exists() else []
    if found:
        return found[0]
    archive = _download_source(uri, ".zip")
    outdir.mkdir(parents=True, exist_ok=True)
    if archive.suffix.lower() != ".zip":
        raise RuntimeError(f"unsupported DIS geometry archive type: {archive.suffix}")
    with zipfile.ZipFile(archive) as z:
        z.extractall(outdir)
    found = sorted(outdir.rglob("*.gdb"))
    if not found:
        raise RuntimeError("DIS geometry archive did not contain a .gdb directory")
    return found[0]


def _resolve_dis_gdb(uri: str) -> Path:
    local = _find_local_ntgam_gdb()
    if local:
        return local
    return _extract_gdb_from_archive(uri)


def _run_tool(args: list[str], timeout: float = 900.0) -> None:
    exe = shutil.which(args[0])
    if not exe:
        raise RuntimeError(f"{args[0]} is not installed or not on PATH")
    proc = subprocess.run([exe, *args[1:]], capture_output=True, text=True, timeout=timeout)
    if proc.returncode != 0:
        detail = (proc.stderr or proc.stdout or "").strip()[-800:]
        raise RuntimeError(f"{args[0]} failed: {detail}")


def _materialize_dis_field(uri: str, field: str) -> Path:
    _MATERIALIZATION_CACHE.mkdir(parents=True, exist_ok=True)
    out = _MATERIALIZATION_CACHE / f"ntgam_dis_{field}_{_cache_key(uri, field)}.tif"
    with _MATERIALIZATION_LOCK:
        if out.exists() and out.stat().st_size > 0:
            return out
        tmp = out.with_suffix(".tmp.tif")
        tmp.unlink(missing_ok=True)
        _run_tool([
            "gdal_rasterize", "-l", "ntgam_dis", "-a", field, "-tr", "500", "500",
            "-ot", "Float32", "-a_nodata", "-1e30", *_RASTERIZE_CO, "-q",
            str(_resolve_dis_gdb(uri)), str(tmp),
        ])
        tmp.replace(out)
    return out


def _materialize_aquifer_grid(uri: str, transform_name: str, model_layer: int | None) -> Path:
    if model_layer is None:
        raise RuntimeError("model_layer is required for NTGAM aquifer materialization")
    layer = int(model_layer)
    if layer < 1 or layer > 8:
        raise RuntimeError(f"model_layer must be 1..8 for NTGAM aquifer materialization, got {layer}")
    if transform_name == "derive-ntgam-aquifer-top-grid":
        field = "top" if layer == 1 else f"botm_{layer - 1}"
        return _materialize_dis_field(uri, field)
    if transform_name != "derive-ntgam-aquifer-thickness-grid":
        raise RuntimeError(f"unsupported aquifer materialization transform '{transform_name}'")

    _MATERIALIZATION_CACHE.mkdir(parents=True, exist_ok=True)
    out = _MATERIALIZATION_CACHE / f"ntgam_thickness_lyr{layer}_{_cache_key(uri, layer)}.tif"
    with _MATERIALIZATION_LOCK:
        if out.exists() and out.stat().st_size > 0:
            return out
        top_field = "top" if layer == 1 else f"botm_{layer - 1}"
        top = _materialize_dis_field(uri, top_field)
        botm = _materialize_dis_field(uri, f"botm_{layer}")
        tmp = out.with_suffix(".tmp.tif")
        tmp.unlink(missing_ok=True)
        _run_tool([
            "gdal_calc.py", "-A", str(top), "-B", str(botm), f"--outfile={tmp}",
            "--calc=A-B", "--NoDataValue=-1e30", "--type=Float32",
            "--co=COMPRESS=DEFLATE", "--co=PREDICTOR=2", "--quiet", "--overwrite",
        ])
        tmp.replace(out)
    return out


def _zip_table_reader(z: zipfile.ZipFile, suffix: str):
    member = next((m for m in z.namelist() if m.endswith(suffix)), None)
    if not member:
        raise RuntimeError(f"SDR archive missing {suffix}")
    raw = z.open(member)
    rdr = csv.reader(io.TextIOWrapper(raw, encoding="latin-1", newline=""), delimiter="|")
    header = next(rdr)
    return rdr, {c: i for i, c in enumerate(header)}


def _materialize_sdr_clay_points(uri: str) -> Path:
    _MATERIALIZATION_CACHE.mkdir(parents=True, exist_ok=True)
    out = _MATERIALIZATION_CACHE / f"sdr_clay_thickness_{_cache_key(uri)}.geojson"
    with _MATERIALIZATION_LOCK:
        if out.exists() and out.stat().st_size > 0:
            return out
        zpath = _download_source(uri, ".zip")
        minlon, minlat, maxlon, maxlat = _NTGAM_BBOX
        wells: dict[str, tuple[float, float]] = {}
        clay: dict[str, float] = defaultdict(float)
        with zipfile.ZipFile(zpath) as z:
            rdr, idx = _zip_table_reader(z, "WellData.txt")
            ti, la, lo = idx["WellReportTrackingNumber"], idx["CoordDDLat"], idx["CoordDDLong"]
            for row in rdr:
                if len(row) <= max(ti, la, lo):
                    continue
                try:
                    lat, lon = float(row[la]), float(row[lo])
                except ValueError:
                    continue
                if lon > 0:
                    lon = -lon
                if minlat <= lat <= maxlat and minlon <= lon <= maxlon:
                    wells[row[ti]] = (lat, lon)

            rdr, idx = _zip_table_reader(z, "WellLithology.txt")
            ti, td, bd, de = (idx["WellReportTrackingNumber"], idx["TopDepth"],
                              idx["BottomDepth"], idx["LithologyDescription"])
            for row in rdr:
                if len(row) <= max(ti, td, bd, de) or row[ti] not in wells:
                    continue
                if not _CLAY_TERMS.search(row[de]):
                    continue
                try:
                    thick = float(row[bd]) - float(row[td])
                except ValueError:
                    continue
                if thick > 0:
                    clay[row[ti]] += thick

        feats = [{
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [wells[tn][1], wells[tn][0]]},
            "properties": {"value": round(thk, 1), "station": tn, "confidence": "estimated"},
        } for tn, thk in clay.items()]
        tmp = out.with_suffix(".tmp.geojson")
        tmp.write_text(json.dumps({"type": "FeatureCollection", "features": feats}))
        tmp.replace(out)
    return out


def _nearest_in_geojson(url: str, lat: float, lon: float):
    if url in _POINT_FEATURE_CACHE:
        features = _POINT_FEATURE_CACHE[url]
    else:
        local = _local_source_path(url)
        if local and local.exists():
            features = (json.loads(local.read_text()) or {}).get("features", [])
        else:
            headers = {"Authorization": settings.ckan_token} if settings.ckan_token else {}
            r = httpx.get(url, headers=headers, timeout=120.0, follow_redirects=True)
            r.raise_for_status()
            features = (r.json() or {}).get("features", [])
        _POINT_FEATURE_CACHE[url] = features
    best = None
    for f in features:
        try:
            lon2, lat2 = f["geometry"]["coordinates"][:2]
            v = float(f["properties"]["value"])
        except (KeyError, TypeError, ValueError, IndexError):
            continue
        d = _haversine_mi(lat, lon, float(lat2), float(lon2))
        if best is None or d < best[0]:
            best = (d, v, f.get("properties", {}))
    return best


def execute_branch(branch: dict[str, Any], lat: float, lon: float,
                   model_layer: int | None = None) -> tuple[float | None, dict[str, Any]]:
    """Execute one resolved plan branch's ETL on its source -> (value, provenance).
    Dispatch is by the registered ETL name + source URI; the impls are the local
    samplers/providers (the sampling runs where the data is)."""
    etl = branch.get("etl") or []
    leaf = etl[-1] if etl else None
    uri = branch.get("source") or ""
    raw_uri = uri
    svo = branch.get("standard_variable") or ""
    base = {"etl": etl, "resource_uri": raw_uri, "temporal": branch.get("temporal")}
    materialized_by = None
    try:
        for step in etl[:-1]:
            if step in {"derive-ntgam-aquifer-top-grid", "derive-ntgam-aquifer-thickness-grid"}:
                uri = str(_materialize_aquifer_grid(raw_uri, step, model_layer))
                materialized_by = step
            elif step == "derive-sdr-clay-thickness-points":
                uri = str(_materialize_sdr_clay_points(raw_uri))
                materialized_by = step
    except Exception as exc:  # noqa: BLE001 - report as missing/provenance instead of hard-failing scenario
        return None, {**base, "error": str(exc), "materialized_by": materialized_by}
    if materialized_by:
        base = {**base, "raw_resource_uri": raw_uri, "materialized_uri": uri,
                "materialized_by": materialized_by}
    if leaf == "sample-raster-at-point":
        try:
            v = sample_raster(uri, lon, lat, settings.ckan_token)
        except SampleError as exc:
            return None, {**base, "error": str(exc)}
        source = "adapter_materialized_raster" if materialized_by else "ckan_raster"
        return v, {**base, "source": source, "svo": svo, "value": v}
    if leaf == "nearest-point-sample":
        try:
            best = _nearest_in_geojson(uri, lat, lon)
        except (httpx.HTTPError, ValueError):
            best = None
        if not best:
            return None, {**base, "error": "no nearby observation"}
        d, v, props = best
        source = "adapter_materialized_point_collection" if materialized_by else "ckan_point"
        return v, {**base, "source": source, "svo": svo, "value": v,
                   "distance_mi": round(d, 1), "station": props.get("station"),
                   "confidence": props.get("confidence", "medium")}
    if leaf == "query-service-at-point":
        got = None
        if "epqs" in uri or "nationalmap" in uri:
            got = providers.usgs_elevation_ft(lat, lon)
        elif "waterqualitydata" in uri:
            got = providers._wqp_temperature(lat, lon) if svo.endswith("temperature") \
                else providers._wqp_tds(lat, lon)
        if not (got and _is_num(got.get("value"))):
            return None, {**base, "error": "service returned no value"}
        return got["value"], {**base, **got}
    return None, {**base, "error": f"no executor for ETL '{leaf}'"}


def build_scenario_from_plan(lat: float, lon: float, *, layer: int, layer_source: str,
                             aquifers: list[str], nearest_well: dict | None,
                             branches: list[dict[str, Any]],
                             overrides: dict[str, Any] | None = None) -> dict[str, Any]:
    """Assemble the forecast scenario by EXECUTING the planner-resolved branches, then
    the registered scalar params + physical derivations. No hardcoded source selection."""
    overrides = overrides or {}
    scenario: dict[str, Any] = {
        "scenario_id": f"ntgam_{lat:.4f}_{lon:.4f}_lyr{layer}",
        "aquifer": ", ".join(aquifers) or f"NTGAM layer {layer}",
        "well_name": f"NTGAM ({lat:.4f}, {lon:.4f})",
    }
    provenance: dict[str, Any] = {}
    missing: list[dict[str, str]] = []

    # 1) execute each resolved branch (in parallel) -> spatial input values
    def _run(b: dict[str, Any]):
        field = FORECAST_FIELD_MAP.get((b.get("standard_variable"), b.get("temporal")))
        if not field or not b.get("source"):
            return None
        v, prov = execute_branch(b, lat, lon, layer)
        return field, v, prov
    with cf.ThreadPoolExecutor(max_workers=8) as ex:
        for res in ex.map(_run, branches):
            if not res:
                continue
            field, v, prov = res
            if _is_num(v):
                scenario[field] = v
                provenance[field] = prov

    # 2) scalar config from the registered MINT parameter defaults
    params = param_defaults()
    for slug, meta in params.items():
        if meta["default"] is None:
            continue
        scenario[slug] = meta["default"]
        provenance[slug] = {"source": "mint_param_default", "param_id": meta["param_id"],
                            "value": meta["default"]}

    # 3) caller overrides win
    for key, value in overrides.items():
        if value is None or value == "":
            continue
        scenario[key] = value
        provenance[key] = {"source": "user_override", "value": value}

    # 4) physical derivations (no hardcoded constants)
    wls = [scenario[f] for f in (_WL_PREDEV, _WL_BASE, _WL_CURRENT) if _is_num(scenario.get(f))]
    if not _is_num(scenario.get("preconsolidation_water_level_ft_msl")) and wls:
        scenario["preconsolidation_water_level_ft_msl"] = min(wls)
        provenance["preconsolidation_water_level_ft_msl"] = {
            "source": "derived", "rule": "lowest sampled head (preconsolidation level)", "value": min(wls)}
    if not _is_num(scenario.get("future_water_level_ft_msl")) and _is_num(scenario.get(_WL_CURRENT)):
        scenario["future_water_level_ft_msl"] = scenario[_WL_CURRENT]
        provenance["future_water_level_ft_msl"] = {
            "source": "derived", "rule": "= current water level (decline applied via trend)",
            "value": scenario[_WL_CURRENT]}
    if (not _is_num(scenario.get("unsat_thickness_ft"))
            and _is_num(scenario.get("land_surface_ft_msl")) and _is_num(scenario.get(_WL_CURRENT))):
        u = max(0.0, scenario["land_surface_ft_msl"] - scenario[_WL_CURRENT])
        scenario["unsat_thickness_ft"] = u
        provenance["unsat_thickness_ft"] = {
            "source": "derived", "rule": "max(0, land surface − current head)", "value": u,
            "confidence": "low",
            "caveat": "NTGAM Trinity is largely confined; the model head is potentiometric, not a water table"}

    provenance["aquifer_storage_coefficient"] = {
        "source": "model_default",
        "note": "storativity grid is inside the .gdb only; using the screening model's built-in default"}

    # 5) blocking set: required numerics still unset
    param_slugs = set(params)
    for field in REQUIRED_NUMERIC:
        if _is_num(scenario.get(field)):
            continue
        reason = ("registered parameter has no default — provide a value" if field in param_slugs
                  else "no source resolved — provide a value")
        entry = {"field": field, "reason": reason}
        hint = providers.SOURCE_GUIDANCE.get(field)
        if hint:
            entry["source_hint"] = hint
        missing.append(entry)

    return {"scenario": scenario, "provenance": provenance, "missing": missing,
            "selection": {"model_layer": layer, "layer_source": layer_source, "lat": lat, "lon": lon},
            "context": {"aquifer": {"aquifers": aquifers}, "nearest_well": nearest_well}}


# --- run the forecast (shell out to the SUBSIDE venv) ----------------------
_RUNNER = (
    "import sys, json\n"
    "scenario = json.load(open(sys.argv[1]))\n"
    "from analysis.subsidence.forecast import run_forecast\n"
    "print(json.dumps(run_forecast(scenario)))\n"
)


def run_forecast(scenario: dict[str, Any]) -> dict[str, Any]:
    """Run the SUBSIDE screening model on a scenario via the SUBSIDE venv."""
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as fh:
        json.dump(scenario, fh)
        scenario_path = fh.name
    try:
        bindir = str(Path(settings.subside_python).parent)
        proc = subprocess.run(
            [settings.subside_python, "-c", _RUNNER, scenario_path],
            cwd=settings.subside_dir,
            env={"PYTHONPATH": settings.subside_dir,
                 "PATH": f"{bindir}:/usr/local/bin:/usr/bin:/bin"},
            capture_output=True, text=True, timeout=180,
        )
    finally:
        Path(scenario_path).unlink(missing_ok=True)
    if proc.returncode != 0:
        raise RuntimeError(f"forecast run failed: {proc.stderr.strip()[-500:]}")
    return json.loads(proc.stdout.strip().splitlines()[-1])
