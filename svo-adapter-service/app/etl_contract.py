"""Shared canonical variable definitions and compatibility helpers.

The adapter accepts historical ETL argument names at its boundaries, but plans,
workflow parameters, and new UI/MINT declarations use the canonical names in
this module.  Keep task environment aliases separate: an old task can continue
to receive ``GMA_ID`` while its workflow argument is ``spatial_scope_id``.
"""
from __future__ import annotations

from copy import deepcopy
from typing import Any, Iterable


COMMON_VARIABLES: tuple[dict[str, Any], ...] = (
    {"key": "geometry_source_uri", "type": "string", "description": "URI or path for spatial features, boundaries, rasters, grids, or tables.", "aliases": ("gma_boundary_uri", "dfc_area_boundary_uri", "location_file_uri"), "label_aliases": ("gma boundary uri", "gma_boundary_uri", "dfc area boundary uri", "dfc_area_boundary_uri", "geometry source uri", "geometry_source_uri", "location file uri", "location_file_uri"), "env_var": "GEOMETRY_SOURCE_URI", "category": "spatial", "source": "adapter"},
    {"key": "geometry_source_type", "type": "string", "description": "Spatial source kind.", "aliases": (), "label_aliases": ("geometry source type", "geometry_source_type"), "env_var": "GEOMETRY_SOURCE_TYPE", "category": "spatial", "enum": ("point", "polygon", "line", "raster", "grid", "table")},
    {"key": "geometry_layer", "type": "string", "description": "Optional layer or table within a multi-layer source.", "aliases": (), "label_aliases": ("geometry layer", "geometry_layer"), "env_var": "GEOMETRY_LAYER", "category": "spatial"},
    {"key": "geometry_id_field", "type": "string", "description": "Stable feature or join key field.", "aliases": (), "label_aliases": ("geometry id field", "geometry_id_field"), "env_var": "GEOMETRY_ID_FIELD", "category": "spatial"},
    {"key": "geometry_name_field", "type": "string", "description": "Human-readable feature or name field.", "aliases": (), "label_aliases": ("geometry name field", "geometry_name_field"), "env_var": "GEOMETRY_NAME_FIELD", "category": "spatial"},
    {"key": "geometry_filter_field", "type": "string", "description": "Field used to subset a spatial source.", "aliases": ("boundary_query_field",), "label_aliases": ("boundary query field", "boundary_query_field", "geometry filter field", "geometry_filter_field"), "env_var": "GEOMETRY_FILTER_FIELD", "category": "spatial"},
    {"key": "geometry_filter_value", "type": "string", "description": "Value used to subset a spatial source.", "aliases": ("boundary_query_value",), "label_aliases": ("boundary query value", "boundary_query_value", "geometry filter value", "geometry_filter_value"), "env_var": "GEOMETRY_FILTER_VALUE", "category": "spatial"},
    {"key": "geometry_crs", "type": "string", "description": "Coordinate reference system, for example EPSG:4326.", "aliases": (), "label_aliases": ("geometry crs", "geometry_crs"), "env_var": "GEOMETRY_CRS", "category": "spatial"},
    {"key": "geometry_format", "type": "string", "description": "Spatial source format.", "aliases": (), "label_aliases": ("geometry format", "geometry_format"), "env_var": "GEOMETRY_FORMAT", "category": "spatial"},
    {"key": "spatial_scope_type", "type": "string", "description": "Semantic spatial planning scope.", "aliases": ("area_type",), "label_aliases": ("area type", "area_type", "spatial scope type", "spatial_scope_type"), "env_var": "SPATIAL_SCOPE_TYPE", "category": "spatial_scope", "enum": ("gma", "county", "gcd", "aquifer", "custom")},
    {"key": "spatial_scope_id", "type": "string", "description": "Stable spatial planning scope identifier.", "aliases": ("gma_id",), "label_aliases": ("gma id", "gma_id", "spatial scope id", "spatial_scope_id"), "env_var": "SPATIAL_SCOPE_ID", "category": "spatial_scope"},
    {"key": "spatial_scope_name", "type": "string", "description": "Human-readable spatial planning scope name.", "aliases": ("area", "county_name", "gcd_name", "aquifer"), "label_aliases": ("area", "county name", "county_name", "gcd name", "gcd_name", "aquifer", "spatial scope name", "spatial_scope_name"), "env_var": "SPATIAL_SCOPE_NAME", "category": "spatial_scope"},
    {"key": "spatial_resolution", "type": "string", "description": "Spatial resolution of the value.", "aliases": (), "label_aliases": ("spatial resolution", "spatial_resolution"), "env_var": "SPATIAL_RESOLUTION", "category": "spatial_scope", "enum": ("point", "polygon", "grid_cell", "region")},
    {"key": "grid_uri", "type": "string", "description": "URI or path for a model grid.", "aliases": (), "label_aliases": ("grid uri", "grid_uri"), "env_var": "GRID_URI", "category": "grid"},
    {"key": "model_layer", "type": "integer", "description": "Model layer index.", "aliases": ("layer",), "label_aliases": ("layer", "model layer", "model_layer"), "env_var": "MODEL_LAYER", "category": "grid"},
    {"key": "stress_period", "type": "integer", "description": "Model stress period.", "aliases": (), "label_aliases": ("stress period", "stress_period"), "env_var": "STRESS_PERIOD", "category": "grid"},
    {"key": "timestep", "type": "integer", "description": "Model timestep.", "aliases": ("time_step",), "label_aliases": ("time step", "time_step", "timestep"), "env_var": "TIMESTEP", "category": "grid"},
    {"key": "baseline_year", "type": "integer", "description": "Baseline year.", "aliases": (), "label_aliases": ("baseline year", "baseline_year"), "env_var": "BASELINE_YEAR", "category": "temporal"},
    {"key": "target_year", "type": "integer", "description": "Target year.", "aliases": (), "label_aliases": ("target year", "target_year"), "env_var": "TARGET_YEAR", "category": "temporal"},
    {"key": "start_year", "type": "integer", "description": "Start year.", "aliases": (), "label_aliases": ("start year", "start_year"), "env_var": "START_YEAR", "category": "temporal"},
    {"key": "end_year", "type": "integer", "description": "End year.", "aliases": (), "label_aliases": ("end year", "end_year"), "env_var": "END_YEAR", "category": "temporal"},
    {"key": "source_uri", "type": "string", "description": "URI or path for the runtime/model input.", "aliases": (), "label_aliases": ("source uri", "source_uri"), "env_var": "SOURCE_URI", "category": "runtime"},
    {"key": "output_uri", "type": "string", "description": "URI or path for a runtime/model output.", "aliases": (), "label_aliases": ("output uri", "output_uri"), "env_var": "OUTPUT_URI", "category": "runtime"},
    {"key": "geo_actor_id", "type": "string", "description": "Configured geo actor identifier.", "aliases": (), "label_aliases": ("geo actor id", "geo_actor_id"), "env_var": "GEO_ACTOR_ID", "category": "runtime", "runtime_only": True},
    {"key": "tapis_base_url", "type": "string", "description": "Tapis service base URL.", "aliases": (), "label_aliases": ("tapis base url", "tapis_base_url"), "env_var": "TAPIS_BASE_URL", "category": "runtime", "runtime_only": True},
    {"key": "allocation", "type": "string", "description": "Execution allocation.", "aliases": (), "label_aliases": ("allocation",), "env_var": "ALLOCATION", "category": "runtime", "runtime_only": True},
    {"key": "tapis_token", "type": "string", "description": "Tapis bearer token injected at execution time.", "aliases": (), "label_aliases": ("tapis token", "tapis_token"), "env_var": "TAPIS_TOKEN", "category": "runtime", "runtime_only": True, "secret": True},
    {"key": "standard_variable_uri", "type": "string", "description": "Standard variable identifier.", "aliases": (), "label_aliases": ("standard variable uri", "standard_variable_uri"), "env_var": "STANDARD_VARIABLE_URI", "category": "contract"},
    {"key": "unit", "type": "string", "description": "Variable unit.", "aliases": (), "label_aliases": ("unit",), "env_var": "UNIT", "category": "contract"},
    {"key": "format", "type": "string", "description": "Data or file format.", "aliases": (), "label_aliases": ("format",), "env_var": "FORMAT", "category": "contract"},
    {"key": "dimensionality", "type": "string", "description": "Variable dimensionality.", "aliases": (), "label_aliases": ("dimensionality",), "env_var": "DIMENSIONALITY", "category": "contract"},
    {"key": "temporal_resolution", "type": "string", "description": "Temporal resolution.", "aliases": (), "label_aliases": ("temporal resolution", "temporal_resolution"), "env_var": "TEMPORAL_RESOLUTION", "category": "contract"},
    {"key": "crs_requirement", "type": "string", "description": "Required coordinate reference system; may mirror geometry_crs.", "aliases": (), "label_aliases": ("crs requirement", "crs_requirement"), "env_var": "CRS_REQUIREMENT", "category": "contract"},
)

_BY_KEY = {item["key"]: item for item in COMMON_VARIABLES}
_ALIAS_TO_KEY = {
    alias: item["key"]
    for item in COMMON_VARIABLES
    for alias in (*item.get("aliases", ()), *item.get("label_aliases", ()))
}
_ALIAS_TO_KEY.update({item["key"]: item["key"] for item in COMMON_VARIABLES})


def canonical_key(name: str | None) -> str | None:
    """Return the canonical key for a parameter/label, if one is known."""
    if not isinstance(name, str):
        return name
    return _ALIAS_TO_KEY.get(name.strip().lower(), name.strip())


def variable_definition(key: str) -> dict[str, Any] | None:
    item = _BY_KEY.get(key)
    return deepcopy(item) if item else None


def public_definitions() -> list[dict[str, Any]]:
    """Return JSON-safe catalog definitions without secret values."""
    return [deepcopy(item) for item in COMMON_VARIABLES]


def normalize_env_from_args(mapping: dict[str, Any] | None) -> dict[str, Any] | None:
    """Canonicalize argument values in an env mapping.

    A DFC area boundary is a second geometry input. If a mapping contains both
    the primary GMA boundary and that area boundary, preserve the area alias so
    both task inputs remain distinct. Direct request args still normalize the
    alias when it is used alone.
    """
    if not isinstance(mapping, dict):
        return mapping
    values = {str(value) for value in mapping.values() if isinstance(value, str)}
    normalized: dict[str, Any] = {}
    for env_key, arg_name in mapping.items():
        if not isinstance(arg_name, str):
            normalized[env_key] = arg_name
            continue
        # DFC transforms use aquifer alongside an area/scope name. Keep this
        # ETL-specific distinction until a first-class multi-scope contract is
        # introduced; collapsing both values would change matching semantics.
        if arg_name == "aquifer":
            normalized[env_key] = arg_name
            continue
        if arg_name == "dfc_area_boundary_uri" and (
            "gma_boundary_uri" in values or "geometry_source_uri" in values
        ):
            normalized[env_key] = arg_name
        else:
            normalized[env_key] = canonical_key(arg_name)
    return normalized


def _value(value: Any) -> Any:
    return value.get("value") if isinstance(value, dict) and "value" in value else value


def normalize_args(args: dict[str, Any] | None) -> dict[str, Any]:
    """Normalize request args with canonical values taking precedence.

    The returned mapping contains canonical keys and also keeps legacy keys that
    were explicitly supplied. Keeping those keys lets old persisted plans and
    old task input maps continue to work while new callers consume canonicals.
    """
    source = dict(args or {})
    result = dict(source)
    for item in COMMON_VARIABLES:
        key = item["key"]
        candidates = (key, *item.get("aliases", ()))
        chosen = next((source[name] for name in candidates if name in source and _value(source[name]) not in (None, "")), None)
        if chosen is not None:
            result[key] = chosen
    # Context-sensitive legacy names can carry both scope and filter meaning.
    for legacy in ("area", "county_name", "gcd_name", "aquifer"):
        if legacy in source and _value(source[legacy]) not in (None, ""):
            result.setdefault("spatial_scope_name", source[legacy])
    if "gma_id" in source and _value(source["gma_id"]) not in (None, ""):
        result.setdefault("spatial_scope_id", source["gma_id"])
    if "area_type" in source and _value(source["area_type"]) not in (None, ""):
        value = _value(source["area_type"])
        result.setdefault("spatial_scope_type", {"area": "custom", "dfc-area": "custom"}.get(str(value), value))
    return result


def accepted_aliases(names: Iterable[str]) -> set[str]:
    """Expand a plan's canonical names with legacy names accepted at ingress."""
    result = set(names)
    for name in list(result):
        item = _BY_KEY.get(canonical_key(name) or name)
        if item:
            result.update(item.get("aliases", ()))
    return result


def mint_label_mapping(label: str) -> tuple[str, str] | None:
    # DFC pieces use aquifer as an independent selector alongside area/scope;
    # preserve that meaning for MINT-synchronized transforms.
    if label.strip().lower() == "aquifer":
        return "AQUIFER", "aquifer"
    key = canonical_key(label)
    item = _BY_KEY.get(key or "")
    if not item:
        return None
    return str(item["env_var"]), str(item["key"])
