"""External authoritative data providers for forecast site inputs that NTGAM's
registered rasters don't carry.

Each provider is BEST-EFFORT: on any failure (service down, point outside coverage,
no sample found) it returns ``None`` and the field stays in the scenario's
``missing`` list — it is never silently faked. Successful pulls carry provenance
(source, url, resolution, confidence) so the UI shows exactly where a value came
from, the same way registry-sourced values do.

Implemented now:
  * usgs_elevation_ft  -> land_surface_ft_msl   (USGS 3DEP Elevation Point Query Service)

Documented-but-not-yet-automated (see SOURCE_GUIDANCE / build_scenario): aquifer top &
thickness (NTGAM .gdb model geometry or BRACS unit picks), clay thickness (BRACS /
SDR driller logs), groundwater temperature & TDS (TWDB GWDB / Water Quality Portal
nearest same-aquifer sample). These need a search-radius + aquifer-matching policy and,
for the gdb route, the model geodatabase registered — wired as follow-on providers.
"""
from __future__ import annotations

import concurrent.futures as cf
import csv
import io
import math
import statistics
from collections import defaultdict
from typing import Any

import httpx

EPQS_URL = "https://epqs.nationalmap.gov/v1/json"
WQP_STATION = "https://www.waterqualitydata.us/data/Station/search"
WQP_RESULT = "https://www.waterqualitydata.us/data/Result/search"

# Where each still-missing field can be pulled from (shown to the user in `missing`).
SOURCE_GUIDANCE: dict[str, str] = {
    "aquifer_top_ft_msl": "NTGAM model-layer geometry (.gdb) first; else BRACS unit top depth -> "
                          "land_surface_ft_msl − aquifer_top_depth_ft_bgs",
    "aquifer_thickness_ft": "NTGAM layer geometry (.gdb) first; else BRACS unit picks -> "
                            "aquifer_bottom_depth_ft_bgs − aquifer_top_depth_ft_bgs",
    "clay_thickness_ft": "NTGAM aquitard layers, BRACS hydrostratigraphic units, or parsed SDR "
                         "driller-log clay/shale/marl intervals (estimate)",
    "groundwater_temp_c": "TWDB GWDB water-quality / Water Quality Portal — nearest same-aquifer sample",
    "groundwater_tds_mg_l": "TWDB GWDB / BRACS / Water Quality Portal — nearest same-aquifer sample",
}


def usgs_elevation_ft(lat: float, lon: float, timeout: float = 20.0) -> dict[str, Any] | None:
    """land_surface_ft_msl from USGS 3DEP (EPQS), interpolated at the point.

    Returns {value, source, url, resolution, confidence} or None on failure /
    no-data (EPQS returns a large negative sentinel outside its coverage)."""
    params = {"x": lon, "y": lat, "units": "Feet", "wkid": 4326}
    try:
        r = httpx.get(EPQS_URL, params=params, timeout=timeout)
        r.raise_for_status()
        body = r.json()
    except (httpx.HTTPError, ValueError):
        return None
    raw = body.get("value")
    if raw is None:
        return None
    try:
        val = float(raw)
    except (TypeError, ValueError):
        return None
    if val <= -1e6:  # EPQS no-data sentinel
        return None
    return {
        "value": val,
        "source": "usgs_3dep",
        "url": f"{EPQS_URL}?x={lon}&y={lat}&units=Feet&wkid=4326",
        "resolution": body.get("resolution"),
        "confidence": "high",
    }


def _haversine_mi(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 3958.7613
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _wqp_csv(url: str, characteristic: str, bbox: str, timeout: float) -> list[dict]:
    params = {"bBox": bbox, "siteType": "Well", "characteristicName": characteristic,
              "mimeType": "csv"}
    if "Result" in url:
        params["dataProfile"] = "resultPhysChem"
    r = httpx.get(url, params=params, timeout=timeout)
    r.raise_for_status()
    return list(csv.DictReader(io.StringIO(r.text)))


def wqp_nearest(lat: float, lon: float, characteristic: str, units_ok: set[str],
                radius_mi: float = 30.0, half_deg: float = 0.4,
                timeout: float = 90.0) -> dict[str, Any] | None:
    """Nearest groundwater (siteType=Well) sample for a characteristic from the Water
    Quality Portal, live: query a small bbox around the point, aggregate per well
    (median), return the nearest within the radius. None if none found / on failure."""
    bbox = f"{lon - half_deg},{lat - half_deg},{lon + half_deg},{lat + half_deg}"
    try:
        with cf.ThreadPoolExecutor(max_workers=2) as ex:
            f_sta = ex.submit(_wqp_csv, WQP_STATION, characteristic, bbox, timeout)
            f_res = ex.submit(_wqp_csv, WQP_RESULT, characteristic, bbox, timeout)
            stations, results = f_sta.result(), f_res.result()
    except (httpx.HTTPError, ValueError):
        return None
    coords: dict[str, tuple[float, float]] = {}
    for row in stations:
        try:
            coords[row["MonitoringLocationIdentifier"]] = (
                float(row["LatitudeMeasure"]), float(row["LongitudeMeasure"]))
        except (KeyError, ValueError):
            continue
    by_station: dict[str, list[tuple[str, float]]] = defaultdict(list)
    for row in results:
        if (row.get("ResultMeasure/MeasureUnitCode") or "").strip().lower() not in units_ok:
            continue
        try:
            v = float(row.get("ResultMeasureValue"))
        except (TypeError, ValueError):
            continue
        by_station[row.get("MonitoringLocationIdentifier")].append(
            (row.get("ActivityStartDate") or "", v))
    best = None
    for sid, (slat, slon) in coords.items():
        obs = by_station.get(sid)
        if not obs:
            continue
        d = _haversine_mi(lat, lon, slat, slon)
        if best is None or d < best[0]:
            best = (d, sid, obs)
    if not best or best[0] > radius_mi:
        return None
    dist, sid, obs = best
    return {"value": round(statistics.median(v for _, v in obs), 3), "source": "wqp",
            "station": sid, "distance_mi": round(dist, 1), "n": len(obs),
            "latest_date": max(d for d, _ in obs), "confidence": "medium",
            "url": "waterqualitydata.us (siteType=Well)"}


def _wqp_temperature(lat: float, lon: float) -> dict[str, Any] | None:
    return wqp_nearest(lat, lon, "Temperature, water", {"deg c", "degc", "deg_c", "c", "°c"})


def _wqp_tds(lat: float, lon: float) -> dict[str, Any] | None:
    return wqp_nearest(lat, lon, "Total dissolved solids", {"mg/l"})


# field -> provider callable(lat, lon) -> {value, source, ...} | None  (all LIVE)
FIELD_PROVIDERS = {
    "land_surface_ft_msl": usgs_elevation_ft,
    "groundwater_temp_c": _wqp_temperature,
    "groundwater_tds_mg_l": _wqp_tds,
}
