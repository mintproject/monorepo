"""On-demand queries to the SUBSIDE STAC-cataloged context services.

The STAC `subside-context` collection registers the authoritative context layers
(TWDB WellReports FeatureServer, TWDB major/minor-aquifer FeatureServers, …). Rather
than copy any of it, the forecast reads the catalog to discover each service's URL and
queries it LIVE by location:

  * detect_aquifer(lat, lon) -> which TWDB aquifer the point is in (point-in-polygon),
    and a suggested NTGAM model layer (overridable by the caller).
  * nearest_well(lat, lon)   -> nearest TWDB well report (borehole depth, tracking #).

Nothing is persisted; the STAC catalog is the registry.
"""
from __future__ import annotations

from typing import Any

import httpx

from .config import settings

# NTGAM model layers (formation order) — for mapping a detected aquifer to a default
# layer. The user can always override the layer.
NTGAM_LAYERS = {1: "Outcrop", 2: "Woodbine", 3: "Washita/Fredericksburg", 4: "Paluxy",
                5: "Glen Rose", 6: "Hensell", 7: "Pearsall", 8: "Hosston"}
# Coarse TWDB-aquifer-name -> representative NTGAM layer (override expected).
AQUIFER_TO_LAYER = {"woodbine": 2, "trinity": 4}

_TIMEOUT = 25.0
_services_cache: dict[str, str] | None = None


def context_services() -> dict[str, str]:
    """{stac_item_id: service_href} for the subside-context layers (cached)."""
    global _services_cache
    if _services_cache is not None:
        return _services_cache
    out: dict[str, str] = {}
    try:
        r = httpx.get(f"{settings.stac_api_url}/collections/subside-context/items",
                      params={"limit": 50}, timeout=_TIMEOUT)
        r.raise_for_status()
        for feat in r.json().get("features", []):
            for asset in feat.get("assets", {}).values():
                href = asset.get("href")
                if href:
                    out[feat["id"]] = href
                    break
    except (httpx.HTTPError, ValueError, KeyError):
        out = {}
    _services_cache = out
    return out


def _feature_server_base(href: str) -> str:
    """Strip any query string and a trailing /query to get the FeatureServer layer URL."""
    base = href.split("?", 1)[0].rstrip("/")
    if base.endswith("/query"):
        base = base[: -len("/query")]
    return base


def _arcgis_point_query(layer_url: str, lat: float, lon: float, out_fields: str = "*",
                        return_geometry: bool = False, **extra: Any) -> list[dict[str, Any]]:
    params = {
        "geometry": f'{{"x":{lon},"y":{lat},"spatialReference":{{"wkid":4326}}}}',
        "geometryType": "esriGeometryPoint", "inSR": 4326,
        "spatialRel": "esriSpatialRelIntersects", "outFields": out_fields,
        "returnGeometry": "true" if return_geometry else "false", "f": "json", **extra,
    }
    try:
        r = httpx.get(f"{layer_url}/query", params=params, timeout=_TIMEOUT)
        r.raise_for_status()
        return r.json().get("features", []) or []
    except (httpx.HTTPError, ValueError):
        return []


def detect_aquifer(lat: float, lon: float) -> dict[str, Any]:
    """Point-in-polygon against the STAC-cataloged aquifer FeatureServers."""
    svcs = context_services()
    names: list[str] = []
    for item in ("major-aquifers", "minor-aquifers"):
        href = svcs.get(item)
        if not href:
            continue
        for f in _arcgis_point_query(_feature_server_base(href), lat, lon):
            a = f.get("attributes", {})
            nm = a.get("AQ_NAME") or a.get("AQ_NAME_UL") or a.get("AQUIFER_NAME")
            if nm:
                names.append(str(nm))
    suggested = None
    for nm in names:
        for key, lyr in AQUIFER_TO_LAYER.items():
            if key in nm.lower():
                suggested = lyr
                break
        if suggested:
            break
    return {"aquifers": names, "suggested_layer": suggested,
            "source": "stac:subside-context (TWDB aquifer FeatureServer)"}


def nearest_well(lat: float, lon: float, radius_m: int = 8000) -> dict[str, Any] | None:
    """Nearest TWDB well report (borehole depth, tracking #) to the point."""
    href = context_services().get("well-reports")
    if not href:
        return None
    feats = _arcgis_point_query(
        _feature_server_base(href), lat, lon, return_geometry=True,
        out_fields="WellReportTrackingNumber,County,BoreholeDepthFt,DateOfWellCompletion",
        distance=radius_m, units="esriSRUnit_Meter", outSR=4326, resultRecordCount=25)
    best = None
    for f in feats:
        g = f.get("geometry") or {}
        try:
            wlon, wlat = float(g["x"]), float(g["y"])
        except (KeyError, TypeError, ValueError):
            continue
        d = ((wlat - lat) ** 2 + (wlon - lon) ** 2) ** 0.5
        if best is None or d < best[0]:
            best = (d, f.get("attributes", {}))
    if not best:
        return None
    a = best[1]
    return {"tracking": a.get("WellReportTrackingNumber"), "county": a.get("County"),
            "borehole_depth_ft": a.get("BoreholeDepthFt"),
            "source": "stac:subside-context (TWDB WellReports)"}
