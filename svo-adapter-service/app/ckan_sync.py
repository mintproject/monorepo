"""CKAN → adapter.data_object sync.

Queries CKAN's package_search API, finds resources that have a
`mint_standard_variables` field, and upserts them as adapter data objects.
This mirrors how the existing MINT UI discovers datasets — CKAN resources
tagged with mint_standard_variables are the canonical source of truth.

The mapping tables here (STDVAR_TO_SVO, CKAN_FORMAT_TO_ADAPTER) are the
bridge between CKAN's short variable-name convention and the svo-adapter's
full SVO URI + format-string contract system.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import httpx

from .config import settings

log = logging.getLogger(__name__)

SVO_NS = "https://w3id.org/okn/i/mint/"

# Map mint_standard_variables short names (as stored on CKAN resources) to
# full SVO URIs used by the svo-adapter planner.
# Keys are lowercase-stripped to match CKAN's case-insensitive convention.
STDVAR_TO_SVO: dict[str, str] = {
    # Groundwater
    "groundwater__saturated_thickness":       f"{SVO_NS}groundwater__saturated_thickness",
    "groundwater__hydraulic_head":            f"{SVO_NS}groundwater__hydraulic_head",
    "groundwater_drain__volume_flow_rate":    f"{SVO_NS}groundwater_drain__volume_flow_rate",
    "groundwater__volume_flow_rate":          f"{SVO_NS}groundwater__volume_flow_rate",
    # Surface water
    "river_water__volume_flow_rate":          f"{SVO_NS}river_water__volume_flow_rate",
    "spring__volume_flow_rate":               f"{SVO_NS}spring__volume_flow_rate",
    # Land subsidence
    "land_surface__subsidence_rate":          f"{SVO_NS}land_surface__subsidence_rate",
    "land_surface__elevation":                f"{SVO_NS}land_surface__elevation",
    # Climate / forcing
    "atmosphere_water__precipitation_rate":   f"{SVO_NS}atmosphere_water__precipitation_rate",
    "land_surface_air__temperature":          f"{SVO_NS}land_surface_air__temperature",
    # Generic raster
    "land_surface__elevation_contour":        f"{SVO_NS}land_surface__elevation_contour",
    # MODFLOW package standard variables (from models_metadata.json svo_bindings)
    "aquifer_water__volume_flow_rate":                   f"{SVO_NS}aquifer_water__volume_flow_rate",
    "aquifer__hydraulic_conductivity":                   f"{SVO_NS}aquifer__hydraulic_conductivity",
    "land_subsurface_water__recharge_volume_flux":       f"{SVO_NS}land_subsurface_water__recharge_volume_flux",
    "groundwater_well__pumping_volume_flow_rate":        f"{SVO_NS}groundwater_well__pumping_volume_flow_rate",
    "aquifer__storativity":                              f"{SVO_NS}aquifer__storativity",
    "land_surface_water__evapotranspiration_volume_flux":f"{SVO_NS}land_surface_water__evapotranspiration_volume_flux",
    "groundwater__hydraulic_head_drawdown":              f"{SVO_NS}groundwater__hydraulic_head_drawdown",
    # Planning boundaries. These are MINT-style adapter variables used to make
    # CKAN GIS resources discoverable by the same SVO/contract machinery as
    # modeled outputs. If a formal MINT StandardVariable is registered later,
    # keep these as aliases and map them forward.
    "groundwater_management_area__boundary":              f"{SVO_NS}groundwater_management_area__boundary",
    "gma__boundary":                                      f"{SVO_NS}groundwater_management_area__boundary",
    "groundwater_conservation_district__boundary":        f"{SVO_NS}groundwater_conservation_district__boundary",
    "gcd__boundary":                                      f"{SVO_NS}groundwater_conservation_district__boundary",
    "county__boundary":                                   f"{SVO_NS}county__boundary",
    "texas_county__boundary":                             f"{SVO_NS}county__boundary",
    "dfc_planning_area__boundary":                        f"{SVO_NS}dfc_planning_area__boundary",
}

# Map CKAN resource format strings to svo-adapter format identifiers.
# CKAN stores these in the `format` field; values are normalised to uppercase
# before lookup.
CKAN_FORMAT_TO_ADAPTER: dict[str, str] = {
    "CBB":      "cbc-mfusg",
    "CBC":      "cbc-mfusg",
    "HDS":      "hds-mfusg",
    "NETCDF":   "netcdf",
    "NC":       "netcdf",
    "GEOTIFF":  "geotiff",
    "GTIFF":    "geotiff",
    "TIF":      "geotiff",
    "TIFF":     "geotiff",
    "CSV":      "csv",
    "JSON":     "json",
    "GEOJSON":  "geojson",
    "SHP":      "shapefile-zip",
    "SHAPEFILE":"shapefile-zip",
    "ZIP":      "zip",
    "ESRI REST":"arcgis-layer",
}

BOUNDARY_SVOS = {
    f"{SVO_NS}groundwater_management_area__boundary",
    f"{SVO_NS}groundwater_conservation_district__boundary",
    f"{SVO_NS}county__boundary",
    f"{SVO_NS}dfc_planning_area__boundary",
}

BOUNDARY_METADATA_KEYS = (
    "boundary_type",
    "geometry_type",
    "arcgis_layer_id",
    "arcgis_query_field",
    "arcgis_name_field",
    "feature_count",
    "source_authority",
    "source_updated",
    "source_notes",
    "source_page",
    "source_package",
)


@dataclass
class CkanSyncResult:
    upserted: int = 0
    skipped: int = 0
    warnings: list[str] = field(default_factory=list)


def _parse_stdvars(raw: Any) -> list[str]:
    """Return a list of stripped variable names from a CKAN mint_standard_variables value."""
    if not raw:
        return []
    if isinstance(raw, list):
        joined = ",".join(str(v) for v in raw)
    else:
        joined = str(raw)
    return [v.strip() for v in joined.split(",") if v.strip()]


def _adapter_format(resource: dict[str, Any], fmt_raw: str) -> str | None:
    """Map CKAN resource format to the adapter format token.

    CKAN stores both FeatureServer and MapServer layers as "Esri REST". The
    adapter treats both as an addressable ArcGIS layer because the Tapis boundary
    query transform can hit either layer's `/query` endpoint.
    """
    adapter_fmt = CKAN_FORMAT_TO_ADAPTER.get(fmt_raw)
    if adapter_fmt == "zip":
        url = str(resource.get("url") or "").lower()
        name = str(resource.get("name") or "").lower()
        if "shapefile" in name or url.endswith(".zip"):
            return "shapefile-zip"
    return adapter_fmt


def _resource_metadata(resource: dict[str, Any]) -> dict[str, Any]:
    meta = {
        key: resource[key]
        for key in BOUNDARY_METADATA_KEYS
        if resource.get(key) not in (None, "")
    }
    url = str(resource.get("url") or "")
    if "/FeatureServer/" in url or "/MapServer/" in url:
        meta.setdefault("service_type", "arcgis")
    return meta


def _resource_to_data_object(
    resource: dict[str, Any],
    warnings: list[str],
    *,
    pkg_name: str = "",
    pkg_title: str = "",
) -> dict[str, Any] | None:
    """Map a single CKAN resource dict to an adapter_data_object insert dict.

    Returns None if the resource should be skipped (no mint_standard_variables,
    no URL, or all variables are unmapped).

    source_catalog is stored as "ckan:{pkg_name}" so /datasets/find can group
    resources by package and return one dataset entry per CKAN package.
    """
    url = resource.get("url") or resource.get("resource_url") or ""
    if not url:
        return None

    stdvars = _parse_stdvars(resource.get("mint_standard_variables"))
    if not stdvars:
        return None

    resource_id = resource.get("id", "")
    name = resource.get("name") or resource.get("description") or resource_id
    fmt_raw = (resource.get("format") or "").strip().upper()
    adapter_fmt = _adapter_format(resource, fmt_raw)
    resource_meta = _resource_metadata(resource)

    variables = []
    for sv in stdvars:
        svo_uri = STDVAR_TO_SVO.get(sv.lower())
        if svo_uri:
            variable: dict[str, Any] = {"standard_variable_uri": svo_uri, "local_name": sv}
            if resource.get("spatial_type"):
                variable["spatial_type"] = resource["spatial_type"]
            elif svo_uri in BOUNDARY_SVOS:
                variable["spatial_type"] = "polygon"
            if resource.get("crs"):
                variable["crs"] = resource["crs"]
            elif svo_uri in BOUNDARY_SVOS:
                variable["crs"] = "EPSG:4326"
            if resource_meta:
                variable["metadata_json"] = resource_meta
            variables.append(variable)
        else:
            warnings.append(
                f"resource {resource_id}: mint_standard_variables value {sv!r} "
                "has no SVO URI mapping — variable skipped. Add it to STDVAR_TO_SVO."
            )

    # Build the source_catalog value: "ckan:{pkg_name}" when a package name is known,
    # otherwise fall back to plain "ckan".
    catalog = f"ckan:{pkg_name}" if pkg_name else "ckan"

    obj: dict[str, Any] = {
        "id": f"ckan-{resource_id}",
        "label": name,
        "resource_uri": url,
        "source_catalog": catalog,
    }
    if adapter_fmt:
        obj["format"] = adapter_fmt
    if resource.get("mimetype"):
        obj["mime_type"] = resource["mimetype"]
    # description: prefer the resource's own description; fall back to package title.
    desc = resource.get("description") or pkg_title or ""
    if desc:
        obj["description"] = desc
    if variables:
        obj["variables"] = {"data": variables}

    return obj


async def _fetch_all_resources(
    ckan_url: str,
    ckan_token: str | None,
    org: str | None,
    *,
    rows: int = 1000,
) -> list[dict[str, Any]]:
    """Paginate through CKAN package_search and collect all resources.

    Each resource dict is extended with _pkg_name and _pkg_title from its
    parent package so _resource_to_data_object can set source_catalog correctly.
    """
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if ckan_token:
        headers["Authorization"] = ckan_token

    resources: list[dict[str, Any]] = []
    start = 0
    base = ckan_url.rstrip("/")

    async with httpx.AsyncClient(timeout=60) as client:
        while True:
            params: dict[str, Any] = {"rows": rows, "start": start, "include_private": False}
            if org:
                params["fq"] = f"organization:{org}"
            resp = await client.get(f"{base}/api/3/action/package_search", params=params,
                                    headers=headers)
            resp.raise_for_status()
            data = resp.json()
            if not data.get("success"):
                raise RuntimeError(f"CKAN package_search error: {data}")
            results = data["result"]["results"]
            for pkg in results:
                pkg_name = pkg.get("name", "")
                pkg_title = pkg.get("title", "")
                for r in pkg.get("resources") or []:
                    r = dict(r)
                    r["_pkg_name"] = pkg_name
                    r["_pkg_title"] = pkg_title
                    resources.append(r)
            if len(results) < rows:
                break
            start += rows

    return resources


# Reuse the INSERT_DATA_OBJECT mutation from main.py to keep the upsert logic
# consistent. Import lazily to avoid circular imports.
_INSERT_DATA_OBJECT = """
mutation InsertDataObject($obj: adapter_data_object_insert_input!) {
  insert_adapter_data_object_one(
    object: $obj
    on_conflict: {
      constraint: data_object_pkey
      update_columns: [label description resource_uri format extension mime_type source_catalog]
    }
  ) { id label resource_uri }
}
"""


async def sync_ckan_to_adapter(
    hasura_client: Any,
    *,
    ckan_url: str | None = None,
    ckan_token: str | None = None,
    org: str | None = None,
    dry_run: bool = False,
) -> CkanSyncResult:
    """Pull CKAN resources and upsert them as adapter data objects.

    Only resources with a non-empty `mint_standard_variables` field are
    considered. Each resource becomes one data object; its variables list
    is built from the mapped SVO URIs.
    """
    url = (ckan_url or settings.ckan_url).rstrip("/")
    token = ckan_token or settings.ckan_token

    result = CkanSyncResult()
    warnings: list[str] = []

    log.info("ckan_sync: fetching resources from %s (org=%s)", url, org or "*")
    resources = await _fetch_all_resources(url, token, org)
    log.info("ckan_sync: found %d total resources", len(resources))

    for resource in resources:
        obj = _resource_to_data_object(
            resource, warnings,
            pkg_name=resource.get("_pkg_name", ""),
            pkg_title=resource.get("_pkg_title", ""),
        )
        if obj is None:
            result.skipped += 1
            continue

        if dry_run:
            log.info("ckan_sync [DRY_RUN] would upsert: %s (%s)", obj["id"], obj["label"])
            result.upserted += 1
            continue

        try:
            await hasura_client.execute(_INSERT_DATA_OBJECT, {"obj": obj})
            result.upserted += 1
        except Exception as exc:
            warnings.append(f"Failed to upsert {obj['id']}: {exc}")

    result.warnings = warnings
    log.info(
        "ckan_sync: done — upserted=%d skipped=%d warnings=%d",
        result.upserted, result.skipped, len(result.warnings),
    )
    for w in warnings:
        log.warning("ckan_sync: %s", w)
    return result
