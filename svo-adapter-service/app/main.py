"""SVO-to-SVO Semantic Adapter Service (FastAPI sidecar).

Responsibilities: planning + execution orchestration + provenance. Basic CRUD on
metadata is delegated to Hasura GraphQL; this service does not reimplement it.

Endpoints:
  GET  /transform-specs           list the transform registry (pieces + contracts)
  POST /transform-specs           register one ETL piece (transform_spec + contracts)
  POST /admin/seed-subside-werc   one-click demo seed of the SUBSIDE WERC pieces
  POST /data-objects              register a data object + its variable contract(s)
  POST /readiness/check           assess a data object vs a model-input requirement
  POST /plans                     generate (and persist) an ETL plan to close gaps
  GET  /plans/{id}                fetch a stored plan
  POST /workflows/generate        emit a Tapis Workflows pipeline for a plan
  POST /workflows/submit          register + run the pipeline (emulates SUBSIDE)
  GET  /runs/{id}                 fetch execution state of a run
  POST /runs/{id}/register-output register a transformed output as a new data object

A bundled standalone UI (static/index.html) is served at / and drives this flow;
demo mode (SVO_ADAPTER_DEMO_MODE=1) backs it with an in-memory store (see store.py).
"""
from __future__ import annotations

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any

from fastapi import FastAPI, Header, HTTPException, Query
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from pathlib import Path

from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

log = logging.getLogger(__name__)

from . import ntgam, qaqc, stac, tapis
from .config import settings
from .hasura import (
    DATA_OBJECT_CONTRACT_QUERY,
    LIST_DATA_OBJECTS_QUERY,
    MODEL_INPUT_REQUIREMENT_QUERY,
    TRANSFORM_REGISTRY_QUERY,
    get_client,
)
from .models import (
    DataObjectContract,
    DataObjectIn,
    GenerateWorkflowIn,
    ModelRunIn,
    PlanIn,
    ReadinessCheckIn,
    ReadinessResult,
    ReadinessStatus,
    RegisterOutputIn,
    SubmitWorkflowIn,
    TransformSpecIn,
)
from .planner import (
    build_model_run_plan_json,
    build_plan_json,
    compatibility,
    find_path,
    plan_model_run,
    reachable_variables,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start the background Tapis status poller on startup; cancel it on shutdown.

    The poller only runs when:
    - demo_mode is off (no real Tapis in demo)
    - tapis_token is configured (service-level token for unattended polling)
    - poll_interval_seconds > 0 (explicit disable path)
    """
    task: asyncio.Task | None = None
    if (not settings.demo_mode
            and settings.tapis_token
            and settings.poll_interval_seconds > 0):
        from . import poller
        task = asyncio.create_task(poller.run_poller(), name="svo-adapter-poller")
    else:
        log.info(
            "poller disabled (demo_mode=%s, token=%s, interval=%d)",
            settings.demo_mode,
            "set" if settings.tapis_token else "unset",
            settings.poll_interval_seconds,
        )

    if not settings.demo_mode and settings.hasura_admin_secret:
        async def _reload_hasura_schema() -> None:
            """Force Hasura to re-introspect Postgres so newly migrated columns
            (e.g. tapis_app_id on modelcatalog_configuration) are visible in the
            GraphQL schema. Hasura's cached introspection survives restarts from
            its metadata DB but does not auto-pick up ALTER TABLE ADD COLUMN."""
            import httpx
            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    base = settings.hasura_graphql_url.removesuffix("/v1/graphql")
                    r = await client.post(
                        f"{base}/v1/metadata",
                        headers={
                            "x-hasura-admin-secret": settings.hasura_admin_secret,
                            "Content-Type": "application/json",
                        },
                        json={"type": "reload_metadata",
                              "args": {"reload_remote_schemas": True, "reload_sources": True}},
                    )
                    log.info("hasura schema reload: %s", r.json().get("message", r.status_code))
            except Exception:
                log.warning("hasura schema reload failed (non-fatal)", exc_info=True)
        await _reload_hasura_schema()

    if settings.mint_sync_on_startup and not settings.demo_mode:
        async def _startup_sync() -> None:
            try:
                from .mint_sync import MintCatalogClient, sync_mint_to_adapter
                from .hasura import get_client as _get_client
                _h = _get_client()
                result = await sync_mint_to_adapter(
                    _h, MintCatalogClient(_h)
                )
                log.info(
                    "startup mint sync: created=%d updated=%d deleted=%d "
                    "skipped=%d warnings=%d",
                    result.created, result.updated, result.deleted,
                    result.skipped, len(result.warnings),
                )
                for w in result.warnings:
                    log.warning("mint_sync: %s", w)
            except Exception:
                log.exception("startup mint sync failed (non-fatal)")
        asyncio.create_task(_startup_sync(), name="svo-adapter-mint-sync")

    if settings.ckan_sync_on_startup and not settings.demo_mode:
        async def _startup_ckan_sync() -> None:
            try:
                from .ckan_sync import sync_ckan_to_adapter
                from .hasura import get_client as _get_client
                result = await sync_ckan_to_adapter(
                    _get_client(),
                    org=settings.ckan_sync_org or None,
                )
                log.info(
                    "startup ckan sync: upserted=%d skipped=%d warnings=%d",
                    result.upserted, result.skipped, len(result.warnings),
                )
            except Exception:
                log.exception("startup ckan sync failed (non-fatal)")
        asyncio.create_task(_startup_ckan_sync(), name="svo-adapter-ckan-sync")

    yield
    if task:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="SVO Adapter Service", version="0.1.0", lifespan=lifespan)

from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _bearer(authorization: str | None) -> str | None:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:]
    return None


def humanize_svo(uri: str | None) -> str:
    """SVO machine name -> readable label using the object__quantity grammar:
    'groundwater__hydraulic_head' -> 'Groundwater — hydraulic head'."""
    name = (uri or "").rsplit("/", 1)[-1]
    obj, sep, qty = name.partition("__")
    obj = obj.replace("_", " ").strip()
    qty = qty.replace("_", " ").strip()
    if sep and obj and qty:
        return f"{obj[:1].upper()}{obj[1:]} — {qty}"
    return (qty or obj or name).replace("_", " ").capitalize()


# --- mutations (kept here; reads live in hasura.py) ------------------------
INSERT_DATA_OBJECT = """
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

INSERT_TRANSFORM_SPEC = """
mutation InsertTransformSpec($obj: adapter_transform_spec_insert_input!) {
  insert_adapter_transform_spec_one(
    object: $obj
    on_conflict: {
      constraint: transform_spec_pkey
      update_columns: [
        name version description transform_type is_lossy method
        tapis_app_id app_version container_image parameters_schema_json
        stage env_from_args file_inputs
      ]
    }
  ) { id name }
}
"""

INSERT_READINESS = """
mutation InsertReadiness($obj: adapter_readiness_assessment_insert_input!) {
  insert_adapter_readiness_assessment_one(object: $obj) { id status }
}
"""

INSERT_PLAN = """
mutation InsertPlan($obj: adapter_workflow_plan_insert_input!) {
  insert_adapter_workflow_plan_one(object: $obj) { id status }
}
"""

UPDATE_PLAN_WORKFLOW_DEF = """
mutation SetWorkflowDef($id: String!, $def: jsonb!) {
  update_adapter_workflow_plan_by_pk(
    pk_columns: {id: $id}, _set: {tapis_workflow_definition_json: $def, status: "ready"}
  ) { id }
}
"""

GET_PLAN = """
query GetPlan($id: String!) {
  adapter_workflow_plan_by_pk(id: $id) {
    id status plan_json target_dataset_specification_id target_model_configuration_id
  }
}
"""

GET_RUN = """
query GetRun($id: String!) {
  adapter_workflow_run_by_pk(id: $id) {
    id status tapis_workflow_id tapis_run_id started_at completed_at
    output_data_object_id logs_uri error_message workflow_plan_id execution_id
  }
}
"""

INSERT_RUN = """
mutation InsertRun($obj: adapter_workflow_run_insert_input!) {
  insert_adapter_workflow_run_one(object: $obj) {
    id status tapis_workflow_id tapis_run_id workflow_plan_id
  }
}
"""

UPDATE_RUN = """
mutation UpdateRun($id: String!, $set: adapter_workflow_run_set_input!) {
  update_adapter_workflow_run_by_pk(pk_columns: {id: $id}, _set: $set) {
    id status tapis_run_id
  }
}
"""

INSERT_PROVENANCE = """
mutation Provenance($obj: adapter_provenance_event_insert_input!) {
  insert_adapter_provenance_event_one(object: $obj) { id }
}
"""

# --- Ensemble Manager binding mutations (public schema, admin-secret only) ---
# Upsert a resource row so execution_data_binding can FK into it.
UPSERT_RESOURCE = """
mutation UpsertResource($obj: resource_insert_input!) {
  insert_resource_one(object: $obj, on_conflict: {
    constraint: resource_pkey, update_columns: [name, url]
  }) { id }
}
"""

# Bind a registered output to an EM execution input. On conflict (same binding
# already exists) do nothing — idempotent.
INSERT_EXECUTION_DATA_BINDING = """
mutation InsertExecutionDataBinding($obj: execution_data_binding_insert_input!) {
  insert_execution_data_binding_one(object: $obj, on_conflict: {
    constraint: execution_data_binding_pkey, update_columns: []
  }) { execution_id model_io_id resource_id }
}
"""


def _model_input_to_contract(rows: list[dict[str, Any]]) -> DataObjectContract:
    """Project a DatasetSpecification + presentation into the target contract."""
    if not rows:
        raise HTTPException(404, "dataset specification not found in model catalog")
    ds = rows[0]
    svo = unit = None
    pres = ds.get("presentations") or []
    if pres:
        vp = (pres[0] or {}).get("presentation") or {}
        # Prefer the standard-variable object's URI PK; fall back to the scalar column.
        svo = (vp.get("standard_variable") or {}).get("id") or vp.get("has_standard_variable")
        # Prefer the unit object's label; fall back to the scalar column.
        unit = (vp.get("unit") or {}).get("label") or vp.get("uses_unit")
    dim = ds.get("has_dimensionality")
    return DataObjectContract(
        standard_variable_uri=svo,
        unit=unit,
        format=ds.get("has_format"),
        dimensionality=str(dim) if dim is not None else None,  # has_dimensionality is Int
    )


def _data_object_to_contract(row: dict[str, Any]) -> DataObjectContract:
    var = (row.get("variables") or [{}])[0]
    return DataObjectContract(
        standard_variable_uri=var.get("standard_variable_uri"),
        local_name=var.get("local_name"),
        unit=var.get("unit"),
        format=row.get("format"),
        extension=row.get("extension"),
        mime_type=row.get("mime_type"),
        dimensionality=var.get("dimensionality"),
        spatial_type=var.get("spatial_type"),
        crs=var.get("crs"),
        grid_id=var.get("grid_id"),
        grid_description=var.get("grid_description"),
        temporal_resolution=var.get("temporal_resolution"),
        schema_json=var.get("schema_json"),
        resource_uri=row.get("resource_uri"),
    )


async def _resolve_target(h, ds_id: str | None, inline: DataObjectContract | None) -> DataObjectContract:
    """The target requirement: supplied inline, else read from the model catalog."""
    if inline is not None:
        return inline
    if not ds_id:
        raise HTTPException(422, "provide either dataset_specification_id or target_contract")
    rows = (await h.execute(MODEL_INPUT_REQUIREMENT_QUERY, {"ds_id": ds_id}))[
        "modelcatalog_dataset_specification"
    ]
    return _model_input_to_contract(rows)


@app.get("/health")
async def health() -> dict[str, Any]:
    return {"status": "ok", "demo_mode": settings.demo_mode}


@app.post("/data-objects")
async def register_data_object(body: DataObjectIn, authorization: str | None = Header(None)):
    h = get_client(_bearer(authorization))
    obj = body.model_dump(exclude_none=True)
    variables = obj.pop("variables", [])
    if variables:
        obj["variables"] = {"data": variables}
    data = await h.execute(INSERT_DATA_OBJECT, {"obj": obj})
    created = data["insert_adapter_data_object_one"]
    await h.execute(INSERT_PROVENANCE, {"obj": {
        "data_object_id": created["id"], "event_type": "data_object_registered",
        "payload_json": {"label": created["label"]},
    }})
    return created


# Real adapter.transform_spec columns. Job-shaping hints with no column
# (app_version/stage/env_from_args/file_inputs) are packed into
# parameters_schema_json.tapis and read back by planner.build_plan_json.
_SPEC_COLUMNS = frozenset({
    "id", "name", "version", "description", "transform_type", "is_lossy",
    "method", "tapis_app_id", "container_image", "source_code_url",
    "parameters_schema_json",
})
_SPEC_TAPIS_HINTS = (
    "app_version", "tapis_app_version", "tapis_function_id", "stage",
    "env_from_args", "file_inputs",
)


def _spec_insert_obj(spec: dict[str, Any]) -> dict[str, Any]:
    """Build a Hasura nested-insert object for a transform spec from registry-shaped
    input, packing the no-column job hints into parameters_schema_json.tapis."""
    spec = {k: v for k, v in spec.items() if not k.startswith("_")}
    contracts = spec.pop("contracts", []) or []
    hints = {k: spec.pop(k) for k in _SPEC_TAPIS_HINTS if spec.get(k) is not None}
    if "tapis_app_version" in hints and "app_version" not in hints:
        hints["app_version"] = hints["tapis_app_version"]
    if hints:
        params = dict(spec.get("parameters_schema_json") or {})
        params["tapis"] = hints
        spec["parameters_schema_json"] = params
    metadata = spec.pop("metadata", None)
    if metadata:
        params = dict(spec.get("parameters_schema_json") or {})
        params["metadata"] = metadata
        spec["parameters_schema_json"] = params
    obj = {k: v for k, v in spec.items() if k in _SPEC_COLUMNS}
    if contracts:
        obj["contracts"] = {"data": [_contract_insert_obj(c) for c in contracts]}
    return obj


# Real adapter.transform_contract columns. `catalog` has no column, so it is
# packed into metadata_json (read back by planner._contract_from_registry).
_CONTRACT_COLUMNS = frozenset({
    "id", "role", "standard_variable_uri", "format", "unit", "dimensionality",
    "spatial_type", "crs_requirement", "temporal_resolution",
    "schema_requirement_json", "metadata_json",
})


def _normalize_svo_uri(value: str | None) -> str | None:
    if not value:
        return value
    value = str(value).strip()
    if "://" in value or "__" not in value:
        return value
    return f"https://w3id.org/okn/i/mint/{value}"


def _contract_insert_obj(c: dict[str, Any]) -> dict[str, Any]:
    c = {k: v for k, v in c.items() if not k.startswith("_")}
    meta = dict(c.get("metadata_json") or {})
    if c.get("standard_variable_uri"):
        c["standard_variable_uri"] = _normalize_svo_uri(c["standard_variable_uri"])
    for key in ("catalog", "data_type"):
        value = c.pop(key, None)
        if value is not None:
            meta[key] = value
    standard_variables = c.pop("standard_variables", None)
    if standard_variables:
        normalized = [
            _normalize_svo_uri(str(v).strip())
            for v in standard_variables
            if str(v).strip()
        ]
        if len(normalized) == 1 and not c.get("standard_variable_uri"):
            c["standard_variable_uri"] = normalized[0]
        meta["standard_variables"] = normalized
    if meta:
        c["metadata_json"] = meta
    return {k: v for k, v in c.items() if k in _CONTRACT_COLUMNS}


@app.get("/transform-specs")
async def list_transform_specs(authorization: str | None = Header(None)):
    """The transform registry (specs + their input/output contracts)."""
    h = get_client(_bearer(authorization))
    return (await h.execute(TRANSFORM_REGISTRY_QUERY))["adapter_transform_spec"]


@app.post("/transform-specs")
async def register_transform_spec(body: TransformSpecIn, authorization: str | None = Header(None)):
    """Register one ETL piece (a transform_spec + its input/output contracts)."""
    h = get_client(_bearer(authorization))
    obj = _spec_insert_obj(body.model_dump(exclude_none=True))
    created = (await h.execute(INSERT_TRANSFORM_SPEC, {"obj": obj}))["insert_adapter_transform_spec_one"]
    await h.execute(INSERT_PROVENANCE, {"obj": {
        "event_type": "transform_spec_registered",
        "payload_json": {"transform_spec_id": created["id"], "name": created["name"]},
    }})
    # Recompute the edge cache in the background so the next /plans call gets
    # accelerated BFS without blocking this response.
    if not settings.demo_mode:
        asyncio.create_task(_recompute_edges_bg(), name="recompute-edges")
    return created


_EXAMPLES = Path(__file__).resolve().parents[1] / "examples"


def _clean(d: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in d.items() if not k.startswith("_")}


DELETE_TRANSFORM_SPECS_BY_IDS = """
mutation DeleteTransformSpecsByIds($ids: [String!]!) {
  delete_adapter_transform_spec(where: { id: { _in: $ids } }) { affected_rows }
}
"""

DELETE_DATA_OBJECTS_BY_IDS = """
mutation DeleteDataObjectsByIds($ids: [String!]!) {
  delete_adapter_data_object(where: { id: { _in: $ids } }) { affected_rows }
}
"""


async def _seed(h, fixture: str) -> dict[str, Any]:
    """Register a pipeline fixture's transform pieces + its sample source data
    object; return the ids + targets. Delete-then-insert so re-seeding is safe."""
    data = json.loads((_EXAMPLES / fixture).read_text())
    # Skip comment-only objects (entries whose only keys start with "_")
    raw_specs = [s for s in data["transform_specs"] if any(not k.startswith("_") for k in s)]
    # Delete pre-existing rows so re-seeding doesn't hit duplicate key violations.
    spec_ids = [s["id"] for s in raw_specs if s.get("id")]
    if spec_ids and not settings.demo_mode:
        await h.execute(DELETE_TRANSFORM_SPECS_BY_IDS, {"ids": spec_ids})
    specs = []
    for s in raw_specs:
        obj = _spec_insert_obj(s)
        specs.append((await h.execute(INSERT_TRANSFORM_SPEC, {"obj": obj}))["insert_adapter_transform_spec_one"])
    async def _register_do(raw: dict[str, Any]) -> dict[str, Any]:
        do = _clean(raw)
        variables = do.pop("variables", [])
        if variables:
            do["variables"] = {"data": variables}
        return (await h.execute(INSERT_DATA_OBJECT, {"obj": do}))["insert_adapter_data_object_one"]

    created_do = await _register_do(data["source_data_object"])
    # Register all additional `sources` (e.g. the forecast's head/storativity/DEM),
    # so a multi-input model run can resolve every input. Skip any that duplicate
    # the primary source_data_object by resource_uri.
    primary_uri = data["source_data_object"].get("resource_uri")
    extra_sources = [await _register_do(s) for s in (data.get("sources") or [])
                     if s.get("resource_uri") != primary_uri]
    # All target_model_input[...] variants, keyed by suffix ("base", "cataloged", "netcdf", ...).
    targets = {
        (key[len("target_model_input"):].lstrip("_") or "base"): _clean(val)
        for key, val in data.items()
        if key.startswith("target_model_input") and isinstance(val, dict)
    }
    return {
        "transform_specs": specs,
        "data_object": created_do,
        "sources": [created_do, *extra_sources],
        "target_contract": targets.get("base"),
        # Cataloged variant: reaching it pulls the stac-publish backend piece into the plan.
        "target_contract_cataloged": targets.get("cataloged"),
        "targets": targets,
    }


@app.post("/admin/reset")
async def reset_demo():
    """Clear the in-memory demo registry (demo mode only). Lets the UI start clean
    without restarting the server."""
    if not settings.demo_mode:
        raise HTTPException(400, "reset is available only in demo mode")
    from .store import reset_store
    reset_store()
    return {"status": "reset"}


async def _load_edge_map(
    registry: list[dict[str, Any]],
) -> "dict[str, list[dict[str, Any]]] | None":
    """Fetch precomputed edges from Hasura and build the BFS index. Returns None
    in demo mode or when the edge table is empty (first run before recompute)."""
    if settings.demo_mode:
        return None
    from . import edges as edges_mod
    edge_rows = (await get_client(None).execute(edges_mod.GET_EDGES))["adapter_transform_edge"]
    return edges_mod.build_edge_map(registry, edge_rows) if edge_rows else None


async def _recompute_edges_bg() -> None:
    """Recompute transform edges after a spec is registered (fire-and-forget)."""
    from . import edges as edges_mod
    try:
        result = await edges_mod.recompute(get_client(None))
        log.info("edges: recomputed %s", result)
    except Exception as exc:  # noqa: BLE001
        log.warning("edges: background recompute failed: %s", exc)


@app.post("/admin/validate-tapis")
async def validate_tapis(authorization: str | None = Header(None)):
    """Walk each Tapis layer (auth → Workflows service → group → pipeline registration)
    and report what works. Safe: the probe pipeline is created and immediately deleted.
    Use this to confirm the grant is active and the service is reachable before a real run."""
    token = _bearer(authorization) or settings.tapis_token
    if not token:
        raise HTTPException(401, "provide a Tapis bearer token or set SVO_ADAPTER_TAPIS_TOKEN")
    result = await run_in_threadpool(tapis.validate_tapis, token)
    all_ok = all(v.get("ok") for v in result.values())
    return {"all_ok": all_ok, "checks": result}


@app.post("/admin/recompute-edges")
async def trigger_recompute_edges(authorization: str | None = Header(None)):
    """Precompute all output→input transform compatibility edges into adapter.transform_edge.
    Fast O(n²) pass over the registry; call after bulk spec registration or schema changes."""
    if settings.demo_mode:
        raise HTTPException(400, "recompute-edges is not available in demo mode")
    from . import edges as edges_mod
    result = await edges_mod.recompute(get_client(None))
    return {"status": "ok", **result}


@app.post("/admin/poll")
async def trigger_poll(authorization: str | None = Header(None)):
    """Manually trigger one status-poll pass (useful for debugging without waiting
    for the next scheduled tick). Uses the caller's bearer token if provided,
    falling back to the service-level SVO_ADAPTER_TAPIS_TOKEN."""
    if settings.demo_mode:
        raise HTTPException(400, "poll is not available in demo mode")
    from . import poller
    token = _bearer(authorization) or settings.tapis_token
    if not token:
        raise HTTPException(401, "provide a Tapis bearer token or set SVO_ADAPTER_TAPIS_TOKEN")
    updates = await poller.poll_once(token)
    return {"polled": len(updates), "updates": updates}


@app.post("/admin/seed-subside-werc")
async def seed_subside_werc(authorization: str | None = Header(None)):
    """[DEPRECATED] Seed from fixture file. Use POST /admin/sync-from-mint instead
    once common transforms are registered in the MINT catalog."""
    return await _seed(get_client(_bearer(authorization)), "subside_werc_transforms.json")


@app.post("/admin/seed-subside-h2i")
async def seed_subside_h2i(authorization: str | None = Header(None)):
    """[DEPRECATED] Seed from fixture file. Use POST /admin/sync-from-mint instead."""
    return await _seed(get_client(_bearer(authorization)), "subside_h2i_transforms.json")


@app.post("/admin/seed-subside-forecast")
async def seed_subside_forecast(authorization: str | None = Header(None)):
    """[DEPRECATED] Seed from fixture file. Use POST /admin/sync-from-mint instead
    once the MINT catalog migration 1771300000004_svo_adapter_common_transforms has
    been applied and the BFS-relevant configs are registered in MINT."""
    return await _seed(get_client(_bearer(authorization)), "subside_forecast_transforms.json")


@app.post("/admin/seed-gma-dfc")
async def seed_gma_dfc(authorization: str | None = Header(None)):
    """Seed GMA DFC ETL transforms: unit conversions for drawdown/saturated-thickness/
    spring-flow, HDS→GeoTIFF format convert, GMA spatial aggregation, budget extract
    specs for all MODFLOW versions, and the multi-input DFC compliance check.
    Also recomputes transform edges so /plans works immediately after seeding."""
    result = await _seed(get_client(_bearer(authorization)), "gma_dfc_transforms.json")
    # Await edge recompute synchronously so /plans works right after this endpoint returns.
    await _recompute_edges_bg()
    return result


@app.post("/admin/sync-from-mint")
async def sync_from_mint(
    dry_run: bool = Query(False),
    authorization: str | None = Header(None),
):
    """Pull all ModelConfigurations from the MINT catalog and reconcile
    adapter.transform_spec. MINT is the sole source of truth: rows for configs
    no longer in MINT are deleted; hand-created rows (null mint_model_config_id)
    are untouched.

    Pass dry_run=true to preview counts without writing to the database.
    """
    from .mint_sync import MintCatalogClient, sync_mint_to_adapter

    h = get_client(_bearer(authorization))
    mint = MintCatalogClient(h)
    result = await sync_mint_to_adapter(h, mint, dry_run=dry_run)

    edges_recomputed = False
    if not dry_run and (result.created or result.updated or result.deleted):
        asyncio.create_task(_recompute_edges_bg(), name="recompute-edges-post-sync")
        edges_recomputed = True

    return {
        "dry_run": dry_run,
        "created": result.created,
        "updated": result.updated,
        "deleted": result.deleted,
        "skipped": result.skipped,
        "unresolved_tapis_apps": result.unresolved_tapis_apps,
        "warnings": result.warnings,
        "edges_recomputed": edges_recomputed,
    }


@app.post("/admin/sync-from-ckan")
async def sync_from_ckan(
    dry_run: bool = Query(False),
    org: str | None = Query(None, description="Limit to a CKAN organization slug"),
    authorization: str | None = Header(None),
):
    """Pull CKAN resources tagged with mint_standard_variables and upsert them
    as adapter data objects.  Each resource becomes one data object whose SVO
    URI and format are resolved via the mapping tables in ckan_sync.py.

    Pass dry_run=true to preview counts without writing to the database.
    Pass org=<slug> to limit the sync to a single CKAN organization.
    """
    from .ckan_sync import sync_ckan_to_adapter

    h = get_client(_bearer(authorization))
    result = await sync_ckan_to_adapter(
        h,
        org=org or settings.ckan_sync_org or None,
        dry_run=dry_run,
    )

    if not dry_run and result.upserted:
        asyncio.create_task(_recompute_edges_bg(), name="recompute-edges-post-ckan-sync")

    return {
        "dry_run": dry_run,
        "upserted": result.upserted,
        "skipped": result.skipped,
        "warnings": result.warnings,
    }


@app.get("/admin/sync-status")
async def sync_status(authorization: str | None = Header(None)):
    """Return a summary of the current MINT sync state: total specs, how many
    were synced from MINT, how many have unresolved Tapis app IDs, and the
    timestamp of the last sync."""
    from .hasura import GET_SYNC_STATUS_QUERY

    if settings.demo_mode:
        return {"demo_mode": True, "spec_count": 0, "mint_synced_count": 0,
                "function_task_count": 0, "last_sync": None}
    h = get_client(_bearer(authorization))
    data = await h.execute(GET_SYNC_STATUS_QUERY)
    last_sync_rows = data.get("last_sync") or []
    return {
        "spec_count": data.get("all", {}).get("aggregate", {}).get("count", 0),
        "mint_synced_count": data.get("synced", {}).get("aggregate", {}).get("count", 0),
        "function_task_count": data.get("function_tasks", {}).get("aggregate", {}).get("count", 0),
        "last_sync": last_sync_rows[0]["mint_synced_at"] if last_sync_rows else None,
    }


@app.post("/readiness/check", response_model=ReadinessResult)
async def readiness_check(body: ReadinessCheckIn, authorization: str | None = Header(None)):
    h = get_client(_bearer(authorization))
    src_rows = (await h.execute(DATA_OBJECT_CONTRACT_QUERY, {"id": body.data_object_id}))[
        "adapter_data_object"
    ]
    if not src_rows:
        raise HTTPException(404, "data object not found")
    src = _data_object_to_contract(src_rows[0])
    tgt = await _resolve_target(h, body.dataset_specification_id, body.target_contract)

    result = compatibility(src, tgt)
    await h.execute(INSERT_READINESS, {"obj": {
        "data_object_id": body.data_object_id,
        "model_configuration_id": body.model_configuration_id,
        "dataset_specification_id": body.dataset_specification_id,
        "status": result.status.value,
        "missing_requirements_json": {"missing": result.missing_requirements},
    }})
    return result


@app.post("/plans")
async def create_plan(body: PlanIn, authorization: str | None = Header(None)):
    h = get_client(_bearer(authorization))
    src_rows = (await h.execute(DATA_OBJECT_CONTRACT_QUERY, {"id": body.data_object_id}))[
        "adapter_data_object"
    ]
    if not src_rows:
        raise HTTPException(404, "data object not found")
    src = _data_object_to_contract(src_rows[0])
    tgt = await _resolve_target(h, body.target_dataset_specification_id, body.target_contract)

    if compatibility(src, tgt).status == ReadinessStatus.ready:
        return {"status": "ready", "plan": None, "message": "data object is already model-ready"}

    registry = (await h.execute(TRANSFORM_REGISTRY_QUERY))["adapter_transform_spec"]

    edge_map = await _load_edge_map(registry)
    path = find_path(src, tgt, registry, edge_map=edge_map)
    if path is None:
        raise HTTPException(422, "no transform path found from source contract to target contract")

    plan_json = build_plan_json(path)
    created = (await h.execute(INSERT_PLAN, {"obj": {
        "source_data_object_id": body.data_object_id,
        "target_model_configuration_id": body.target_model_configuration_id,
        "target_dataset_specification_id": body.target_dataset_specification_id,
        "status": "draft",
        "plan_json": plan_json,
    }}))["insert_adapter_workflow_plan_one"]
    await h.execute(INSERT_PROVENANCE, {"obj": {
        "event_type": "plan_generated",
        "payload_json": {"plan_id": created["id"], "steps": len(path)},
    }})
    return {"status": "transform_required", "plan_id": created["id"], "plan_json": plan_json}


@app.post("/plans/discover")
async def discover_reachable_targets(body: dict[str, Any]):
    """Given a source contract (standard_variable_uri, unit, format), return all
    target contracts reachable via BFS through the transform registry.  Used by
    the UI to populate the target dropdown with only valid conversion options."""
    src = DataObjectContract(
        standard_variable_uri=body.get("standard_variable_uri") or None,
        unit=body.get("unit") or None,
        format=body.get("format") or None,
        # _check_accessibility requires a resource_uri; supply a probe URI so the
        # accessibility dimension doesn't block the BFS for hypothetical sources.
        resource_uri="https://example.com/discover-probe",
    )
    h = get_client(None)
    registry = (await h.execute(TRANSFORM_REGISTRY_QUERY))["adapter_transform_spec"]
    edge_map = await _load_edge_map(registry)

    # Build candidate targets: all unique output contracts across all specs
    seen: set[tuple[str | None, str | None, str | None]] = set()
    candidates: list[tuple[DataObjectContract, dict[str, Any]]] = []
    for spec in registry:
        for c in (spec.get("contracts") or []):
            if c.get("role") != "output":
                continue
            key = (c.get("standard_variable_uri"), c.get("unit"), c.get("format"))
            if key in seen:
                continue
            seen.add(key)
            candidates.append((
                DataObjectContract(
                    standard_variable_uri=c.get("standard_variable_uri") or None,
                    unit=c.get("unit") or None,
                    format=c.get("format") or None,
                ),
                {"standard_variable_uri": c.get("standard_variable_uri"),
                 "unit": c.get("unit"),
                 "format": c.get("format")},
            ))

    reachable = []
    for tgt_contract, tgt_raw in candidates:
        path = find_path(src, tgt_contract, registry, edge_map=edge_map)
        if path:  # non-empty path means a transform is needed and one was found
            reachable.append(tgt_raw)

    return {"reachable": reachable}


@app.post("/plans/discover-sources")
async def discover_reachable_sources(body: dict[str, Any]):
    """Given a target contract (standard_variable_uri, unit, format), return all
    source contracts that can reach it via reverse BFS through the transform registry.
    Used by the UI's Target→Source mode to show what input data is needed to
    produce a desired output (e.g. a DFC compliance report)."""
    tgt_key = (
        body.get("standard_variable_uri") or "",
        body.get("unit") or "",
        body.get("format") or "",
    )

    h = get_client(None)
    registry = (await h.execute(TRANSFORM_REGISTRY_QUERY))["adapter_transform_spec"]

    def _ck(c: dict) -> tuple[str, str, str]:
        return (c.get("standard_variable_uri") or "", c.get("unit") or "", c.get("format") or "")

    def _key_satisfied_by(frontier_key: tuple[str, str, str], output_keys: set[tuple[str, str, str]]) -> bool:
        """True if any output key satisfies this frontier key.
        Two format-wildcard rules (both symmetric around 'format: null = any format'):
          1. Frontier key has no format → matches any output with same (svo, unit).
             Allows null-format input contracts (e.g. unit-convert) to accept
             explicitly-formatted outputs (e.g. gma-scalar from budget extract).
          2. Output key has no format → matches any frontier key with same (svo, unit).
             Allows null-format outputs (e.g. unit-convert result) to feed into
             downstream specs that expect an explicit format (e.g. geotiff·ft)."""
        svo, unit, fmt = frontier_key
        for ok in output_keys:
            if ok == frontier_key:
                return True
            if not fmt and ok[0] == svo and ok[1] == unit:
                return True
            if not ok[2] and ok[0] == svo and ok[1] == unit:
                return True
        return False

    # Reverse BFS: frontier holds contract keys we still need to find producers for.
    frontier: set[tuple[str, str, str]] = {tgt_key}
    visited: set[tuple[str, str, str]] = set()
    seen_source_keys: set[tuple[str, str, str]] = set()
    reachable: list[dict[str, Any]] = []

    while True:
        new_keys = frontier - visited
        if not new_keys:
            break
        visited |= new_keys
        next_frontier: set[tuple[str, str, str]] = set()

        for spec in registry:
            contracts = spec.get("contracts") or []
            outputs = [c for c in contracts if c.get("role") == "output"]
            inputs  = [c for c in contracts if c.get("role") == "input"]
            output_keys = {_ck(o) for o in outputs}
            if not any(_key_satisfied_by(nk, output_keys) for nk in new_keys):
                continue
            for inp in inputs:
                k = _ck(inp)
                if k not in visited:
                    next_frontier.add(k)
                if k not in seen_source_keys:
                    seen_source_keys.add(k)
                    reachable.append({
                        "standard_variable_uri": inp.get("standard_variable_uri"),
                        "unit": inp.get("unit"),
                        "format": inp.get("format"),
                    })

        frontier = next_frontier

    # Verify each candidate with find_path to match the forward-BFS guarantee:
    # only show sources where an actual plan exists. Candidates without a
    # resource_uri get a probe URI so the accessibility check doesn't block them.
    tgt_contract = DataObjectContract(
        standard_variable_uri=tgt_key[0] or None,
        unit=tgt_key[1] or None,
        format=tgt_key[2] or None,
        resource_uri="https://example.com/discover-probe",
    )
    edge_map = await _load_edge_map(registry)
    verified: list[dict[str, Any]] = []
    seen_verified: set[tuple[str, str, str]] = set()
    for r in reachable:
        k = (r.get("standard_variable_uri") or "", r.get("unit") or "", r.get("format") or "")
        if k in seen_verified:
            continue
        candidate = DataObjectContract(
            standard_variable_uri=r.get("standard_variable_uri") or None,
            unit=r.get("unit") or None,
            format=r.get("format") or None,
            resource_uri="https://example.com/discover-probe",
        )
        path = find_path(candidate, tgt_contract, registry, edge_map=edge_map)
        if path is not None and len(path) > 0:
            seen_verified.add(k)
            verified.append(r)

    return {"reachable": verified}


@app.get("/data-objects")
async def list_data_objects(authorization: str | None = Header(None)):
    """Registered data objects (the 'we have this SVO input' sources) — id, label,
    and each variable's standard_variable_uri + unit/format."""
    h = get_client(_bearer(authorization))
    return (await h.execute(LIST_DATA_OBJECTS_QUERY))["adapter_data_object"]


# ── MINT Data Catalog compatibility layer ─────────────────────────────────────
# The MINT UI calls POST /datasets/find and POST /datasets/dataset_resources.
# Results are grouped by CKAN package (source_catalog = "ckan:{pkg_name}") so
# the UI shows one selectable entry per dataset/package rather than one per file.

_FIND_DATA_OBJECTS_QUERY = """
query FindDataObjects($uris: [String!]!) {
  adapter_data_object(
    where: {
      _and: [
        {variables: {standard_variable_uri: {_in: $uris}}}
        {source_catalog: {_like: "ckan%"}}
      ]
    }
    order_by: {source_catalog: asc, label: asc}
  ) {
    id label resource_uri format source_catalog description
    variables { standard_variable_uri local_name }
  }
}
"""

_GET_PACKAGE_OBJECTS_QUERY = """
query GetPackageObjects($catalog: String!) {
  adapter_data_object(
    where: {source_catalog: {_eq: $catalog}}
    order_by: {label: asc}
  ) {
    id label resource_uri format description
  }
}
"""


class _DatasetsFindBody(BaseModel):
    standard_variable_names__in: list[str] = []
    spatial_coverage__intersects: Any = None
    start_time__gte: str | None = None
    end_time__lte: str | None = None
    limit: int = 1000


class _DatasetResourcesBody(BaseModel):
    dataset_id: str
    filter: dict = {}
    limit: int = 5000


@app.post("/datasets/find")
async def datasets_find(body: _DatasetsFindBody, authorization: str | None = Header(None)):
    """MINT Data Catalog-compatible /datasets/find.

    Converts short SVO variable names to full URIs, queries local
    adapter_data_object rows, and groups results by CKAN package.  Each
    package becomes one "dataset" entry so the UI shows one option per
    dataset rather than one per individual file.
    """
    from .ckan_sync import STDVAR_TO_SVO, SVO_NS

    if not body.standard_variable_names__in:
        return {"result": "success", "datasets": []}

    # Convert short names → full SVO URIs (fall back to direct URI construction).
    uris = []
    for name in body.standard_variable_names__in:
        uri = STDVAR_TO_SVO.get(name.lower()) or f"{SVO_NS}{name}"
        uris.append(uri)

    h = get_client(_bearer(authorization))
    data = await h.execute(_FIND_DATA_OBJECTS_QUERY, {"uris": uris})
    objects = data.get("adapter_data_object") or []

    # Group by source_catalog (= "ckan:{pkg_name}" for synced CKAN resources,
    # or plain "ckan" for older records without a package name).
    packages: dict[str, dict[str, Any]] = {}
    for obj in objects:
        cat = obj.get("source_catalog") or "ckan"
        if cat not in packages:
            # Package display name: description field holds the CKAN package title
            # (set by the updated ckan_sync), or fall back to the catalog slug.
            pkg_title = obj.get("description") or cat.replace("ckan:", "").replace("-", " ").title()
            packages[cat] = {
                "catalog": cat,
                "title": pkg_title,
                "objects": [],
                "var_labels": set(),
            }
        packages[cat]["objects"].append(obj)
        for v in (obj.get("variables") or []):
            lbl = v.get("local_name") or v["standard_variable_uri"].rsplit("/", 1)[-1]
            packages[cat]["var_labels"].add(lbl)

    datasets = []
    for cat, pkg in list(packages.items())[: body.limit]:
        datasets.append({
            "dataset_id": cat,
            "dataset_name": pkg["title"],
            "dataset_metadata": {
                "datatype": "",
                "dataset_description": pkg["title"],
                "source": "ckan",
                "category_tags": sorted(pkg["var_labels"]),
                "resource_count": len(pkg["objects"]),
            },
        })

    return {"result": "success", "datasets": datasets}


@app.post("/datasets/dataset_resources")
async def datasets_resources(
    body: _DatasetResourcesBody, authorization: str | None = Header(None)
):
    """MINT Data Catalog-compatible /datasets/dataset_resources.

    dataset_id is a source_catalog value ("ckan:{pkg_name}").  Returns all
    adapter_data_object rows for that package as individual resources.
    """
    h = get_client(_bearer(authorization))
    data = await h.execute(_GET_PACKAGE_OBJECTS_QUERY, {"catalog": body.dataset_id})
    rows = (data.get("adapter_data_object") or [])[: body.limit]
    if not rows:
        return {"resources": []}

    resources = [
        {
            "resource_id": obj["id"],
            "resource_name": obj["label"],
            "resource_metadata": {
                "resource_data_url": obj.get("resource_uri") or "",
                "datatype": obj.get("format") or "",
                "description": obj.get("description") or "",
            },
        }
        for obj in rows
    ]
    return {"resources": resources}


@app.get("/standard-variables")
async def list_standard_variables(authorization: str | None = Header(None)):
    """Distinct SVO standard variables the adapter knows — gathered from the
    transform registry's contracts + registered data objects. Drives the
    'want this SVO output' picker."""
    h = get_client(_bearer(authorization))
    specs = (await h.execute(TRANSFORM_REGISTRY_QUERY))["adapter_transform_spec"]
    objs = (await h.execute(LIST_DATA_OBJECTS_QUERY))["adapter_data_object"]
    seen: dict[str, dict[str, Any]] = {}
    for s in specs:
        for c in s.get("contracts", []):
            uri = c.get("standard_variable_uri")
            if uri and uri not in seen:
                seen[uri] = {"uri": uri, "name": uri.rsplit("/", 1)[-1],
                             "display": humanize_svo(uri), "produced_by": [], "consumed_by": []}
            if uri:
                (seen[uri]["produced_by"] if c.get("role") == "output" else seen[uri]["consumed_by"]).append(s.get("name"))
    for o in objs:
        for v in o.get("variables", []):
            uri = v.get("standard_variable_uri")
            if uri and uri not in seen:
                seen[uri] = {"uri": uri, "name": uri.rsplit("/", 1)[-1],
                             "display": humanize_svo(uri), "produced_by": [], "consumed_by": []}
    return sorted(seen.values(), key=lambda x: x["display"])


@app.get("/qaqc/modflow6")
async def modflow6_qaqc(authorization: str | None = Header(None)):
    """QA/QC report for the NTGAM MODFLOW 6 SVO adapter path.

    Checks CKAN resource-level SVO coverage, expected transform registration,
    and whether adapter source data objects exist for the model-run inputs.
    """
    h = get_client(_bearer(authorization))
    registry = None
    registry_error = None
    data_objects = None
    data_objects_error = None
    try:
        registry = (await h.execute(TRANSFORM_REGISTRY_QUERY))["adapter_transform_spec"]
    except Exception as exc:  # noqa: BLE001 - report dependency failure
        registry_error = f"{type(exc).__name__}: {exc}"
    try:
        data_objects = (await h.execute(LIST_DATA_OBJECTS_QUERY))["adapter_data_object"]
    except Exception as exc:  # noqa: BLE001 - report dependency failure
        data_objects_error = f"{type(exc).__name__}: {exc}"
    return await qaqc.modflow6_report(
        registry=registry,
        registry_error=registry_error,
        data_objects=data_objects,
        data_objects_error=data_objects_error,
    )


@app.post("/qaqc/modflow6/tapis")
async def modflow6_qaqc_tapis(body: dict[str, Any] | None = None,
                              authorization: str | None = Header(None)):
    """Generate or submit the MODFLOW 6 QA/QC test as a Tapis Workflows run.

    The remote task queries CKAN from Tapis and validates the adapter registry
    snapshot supplied in the run args. Set {"dry_run": true} to inspect the
    pipeline without submitting.
    """
    body = body or {}
    token = _bearer(authorization) or body.get("tapis_token")
    h = get_client(_bearer(authorization))
    registry = (await h.execute(TRANSFORM_REGISTRY_QUERY))["adapter_transform_spec"]
    data_objects = (await h.execute(LIST_DATA_OBJECTS_QUERY))["adapter_data_object"]
    context = qaqc.tapis_context(registry=registry, data_objects=data_objects)
    pipeline_id = body.get("pipeline_id") or f"modflow6-svo-qaqc-{context['config']['name']}"
    pipeline = qaqc.build_tapis_pipeline(pipeline_id)
    args = qaqc.tapis_args(context)

    if body.get("dry_run", True):
        return {
            "status": "generated",
            "pipeline_id": pipeline_id,
            "tapis_workflow_definition": pipeline,
            "args": args,
        }
    if not token:
        raise HTTPException(401, "log in with a Tapis token to submit remote QA/QC")
    try:
        result = await run_in_threadpool(
            tapis.submit_tapis_workflow,
            pipeline,
            args,
            token=token,
            run_name=body.get("run_name") or f"{pipeline_id}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            recreate=bool(body.get("recreate", True)),
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"Tapis Workflows QA/QC submission failed: {exc}")
    return {"status": "submitted", "pipeline_id": pipeline_id, **result}


@app.get("/qaqc/modflow6/tapis/{run_uuid}")
async def modflow6_qaqc_tapis_detail(
    run_uuid: str,
    pipeline_id: str = Query("modflow6-svo-qaqc-ntgam-v301"),
    authorization: str | None = Header(None),
):
    token = _bearer(authorization)
    if not token:
        raise HTTPException(401, "log in with a Tapis token to inspect remote QA/QC")
    try:
        return await run_in_threadpool(tapis.get_run_detail, pipeline_id, run_uuid, token=token)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"could not fetch QA/QC run: {exc}")


@app.get("/reachable/{data_object_id}")
async def reachable(data_object_id: str, authorization: str | None = Header(None)):
    """The SVO standard variables reachable FROM this source via the registry
    (single-input transform chains), each with the shortest chain. Drives a
    source-aware target picker so the UI only offers achievable outputs."""
    h = get_client(_bearer(authorization))
    rows = (await h.execute(DATA_OBJECT_CONTRACT_QUERY, {"id": data_object_id}))["adapter_data_object"]
    if not rows:
        raise HTTPException(404, "data object not found")
    src = _data_object_to_contract(rows[0])
    registry = (await h.execute(TRANSFORM_REGISTRY_QUERY))["adapter_transform_spec"]
    reach = reachable_variables(src, registry)
    out = []
    for r in reach:
        uri = r["standard_variable_uri"]
        quals = " · ".join(x for x in (r.get("unit"), r.get("format")) if x)
        label = humanize_svo(uri) + (f" [{quals}]" if quals else "")
        out.append({
            "uri": uri, "name": uri.rsplit("/", 1)[-1], "display": label,
            "unit": r.get("unit"), "format": r.get("format"),
            "chain": [s.get("name") for s in r["path"]], "steps": len(r["path"]),
            "identity": len(r["path"]) == 0,
        })
    return sorted(out, key=lambda x: (x["display"], x["steps"]))


@app.post("/plans/model-run")
async def plan_model_run_endpoint(body: ModelRunIn, authorization: str | None = Header(None)):
    """Plan a full ETL DAG that resolves EVERY input of a multi-input model from
    the registered data objects and runs it (e.g. the SUBSIDE forecast). Returns
    the per-input resolution + the converging plan_json, and whether it's complete."""
    h = get_client(_bearer(authorization))
    registry = (await h.execute(TRANSFORM_REGISTRY_QUERY))["adapter_transform_spec"]
    run_spec = next((t for t in registry if t.get("id") == body.run_spec_id), None)
    if run_spec is None:
        raise HTTPException(404, f"run spec '{body.run_spec_id}' not found")

    rows = (await h.execute(LIST_DATA_OBJECTS_QUERY))["adapter_data_object"]
    if body.source_ids:
        wanted = set(body.source_ids)
        rows = [r for r in rows if r["id"] in wanted]
    sources = [_data_object_to_contract(r) for r in rows]

    edge_map = await _load_edge_map(registry)
    plan = plan_model_run(run_spec, sources, registry, edge_map=edge_map)
    dag = build_model_run_plan_json(plan)
    branches = [
        {
            "standard_variable": (b.get("standard_variable_uri") or "").rsplit("/", 1)[-1],
            "satisfied": b["source"] is not None,
            "source": getattr(b["source"], "resource_uri", None) if b["source"] else None,
            "chain": [s["name"] for s in (b["path"] or [])],
        }
        for b in plan["branches"]
    ]
    return {"run_spec": run_spec.get("name"), "complete": plan["complete"],
            "branches": branches, "plan_json": dag}


@app.post("/workflows/generate")
async def generate_workflow(body: GenerateWorkflowIn, authorization: str | None = Header(None)):
    h = get_client(_bearer(authorization))
    plan = (await h.execute(GET_PLAN, {"id": body.plan_id}))["adapter_workflow_plan_by_pk"]
    if not plan:
        raise HTTPException(404, "plan not found")
    definition = tapis.generate_tapis_workflow(plan)
    await h.execute(UPDATE_PLAN_WORKFLOW_DEF, {"id": body.plan_id, "def": definition})
    return {"plan_id": body.plan_id, "tapis_workflow_definition": definition}


def _wrap_args(args: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Accept both SUBSIDE-style {"k": {"value": v}} and plain {"k": v}."""
    out: dict[str, dict[str, Any]] = {}
    for key, val in (args or {}).items():
        out[key] = val if isinstance(val, dict) and "value" in val else {"value": val}
    return out


@app.post("/workflows/submit")
async def submit_workflow(body: SubmitWorkflowIn, authorization: str | None = Header(None)):
    """Register the generated pipeline into its Workflows group and run it,
    emulating SUBSIDE (workflows.runPipeline). The caller's bearer token is
    forwarded as the Tapis token used for registration + the run."""
    token = _bearer(authorization)
    h = get_client(token)
    plan = (await h.execute(GET_PLAN, {"id": body.plan_id}))["adapter_workflow_plan_by_pk"]
    if not plan:
        raise HTTPException(404, "plan not found")

    pipeline = tapis.generate_tapis_workflow(plan)
    args = _wrap_args(body.args)

    # Record the run before triggering, so a failed submit still leaves a trail.
    run_obj: dict[str, Any] = {
        "workflow_plan_id": body.plan_id,
        "tapis_workflow_id": pipeline["id"],
        "status": "submitting",
    }
    if body.execution_id:
        run_obj["execution_id"] = body.execution_id
    run = (await h.execute(INSERT_RUN, {"obj": run_obj}))["insert_adapter_workflow_run_one"]
    await h.execute(INSERT_PROVENANCE, {"obj": {
        "workflow_run_id": run["id"], "event_type": "workflow_submit_requested",
        "payload_json": {"plan_id": body.plan_id, "dry_run": body.dry_run},
    }})

    if body.dry_run:
        await h.execute(UPDATE_RUN, {"id": run["id"], "set": {"status": "generated"}})
        return {"run_id": run["id"], "status": "generated",
                "tapis_workflow_definition": pipeline, "args": args}

    try:
        result = await run_in_threadpool(
            tapis.submit_tapis_workflow, pipeline, args,
            token=token, run_name=body.run_name, recreate=body.recreate,
        )
    except Exception as exc:  # surface the Tapis error, mark the run failed
        await h.execute(UPDATE_RUN, {"id": run["id"], "set": {
            "status": "failed", "error_message": f"{type(exc).__name__}: {exc}"[:2000],
        }})
        raise HTTPException(502, f"Tapis Workflows submission failed: {exc}")

    await h.execute(UPDATE_RUN, {"id": run["id"], "set": {
        "status": "running", "tapis_run_id": result.get("uuid"),
    }})
    return {"run_id": run["id"], **result}


@app.get("/plans/{plan_id}")
async def get_plan(plan_id: str, authorization: str | None = Header(None)):
    h = get_client(_bearer(authorization))
    plan = (await h.execute(GET_PLAN, {"id": plan_id}))["adapter_workflow_plan_by_pk"]
    if not plan:
        raise HTTPException(404, "plan not found")
    return plan


@app.get("/runs/{run_id}")
async def get_run(run_id: str, authorization: str | None = Header(None)):
    h = get_client(_bearer(authorization))
    run = (await h.execute(GET_RUN, {"id": run_id}))["adapter_workflow_run_by_pk"]
    if not run:
        raise HTTPException(404, "run not found")
    return run


@app.post("/runs/{run_id}/register-output")
async def register_output(run_id: str, body: RegisterOutputIn, authorization: str | None = Header(None)):
    h = get_client(_bearer(authorization))
    obj = body.output_data_object.model_dump(exclude_none=True)
    variables = obj.pop("variables", [])
    if variables:
        obj["variables"] = {"data": variables}
    created = (await h.execute(INSERT_DATA_OBJECT, {"obj": obj}))["insert_adapter_data_object_one"]
    await h.execute(INSERT_PROVENANCE, {"obj": {
        "workflow_run_id": run_id,
        "data_object_id": created["id"],
        "event_type": "output_registered",
        "payload_json": {"run_id": run_id},
    }})

    bound: dict[str, Any] | None = None
    if body.execution_id:
        bound = await _bind_output_to_execution(
            h, run_id=run_id, created=created, execution_id=body.execution_id,
        )

    return {"run_id": run_id, "output_data_object": created, "bound_to_execution": bound}


async def _bind_output_to_execution(
    h, *, run_id: str, created: dict[str, Any], execution_id: str,
) -> dict[str, Any]:
    """Upsert a resource row and insert an execution_data_binding so the
    registered output is visible as a bound input on the EM execution.

    Uses the admin-secret client (not the user JWT) because resource and
    execution_data_binding are in the public MINT schema and require broader
    write permissions than the adapter's own tables.

    Returns a summary dict; never raises — errors are captured and returned
    as {"error": ...} so the register-output call still succeeds even when
    the EM binding cannot be completed (e.g. execution_id doesn't exist yet).
    """
    # Admin client — the resource / execution_data_binding tables need it.
    admin = get_client(None)
    try:
        # Resolve the target DatasetSpecification from the plan the run was created from.
        run_row = (await h.execute(GET_RUN, {"id": run_id}))["adapter_workflow_run_by_pk"]
        ds_id: str | None = None
        if run_row and run_row.get("workflow_plan_id"):
            plan_row = (await h.execute(GET_PLAN, {"id": run_row["workflow_plan_id"]}))["adapter_workflow_plan_by_pk"]
            ds_id = (plan_row or {}).get("target_dataset_specification_id")

        if not ds_id:
            return {"error": "run has no target_dataset_specification_id — pass it in plan or supply model_io_id directly"}

        resource_uri = created.get("resource_uri")
        if not resource_uri:
            return {"error": "output data object has no resource_uri — cannot create EM resource row"}

        await admin.execute(UPSERT_RESOURCE, {"obj": {
            "id": created["id"],
            "name": created.get("label") or created["id"],
            "url": resource_uri,
        }})
        await admin.execute(INSERT_EXECUTION_DATA_BINDING, {"obj": {
            "execution_id": execution_id,
            "model_io_id": ds_id,
            "resource_id": created["id"],
        }})
        await h.execute(INSERT_PROVENANCE, {"obj": {
            "workflow_run_id": run_id,
            "data_object_id": created["id"],
            "event_type": "output_bound_to_execution",
            "payload_json": {"execution_id": execution_id, "model_io_id": ds_id,
                             "resource_id": created["id"]},
        }})
        return {"execution_id": execution_id, "model_io_id": ds_id, "resource_id": created["id"]}
    except Exception as exc:  # noqa: BLE001 — surface binding failures without blocking output registration
        return {"error": f"{type(exc).__name__}: {exc}"[:500], "execution_id": execution_id}


# --- NTGAM location -> forecast scenario (Phase 2/3) -----------------------
@app.get("/forecast/ntgam/options")
async def ntgam_options():
    """Registry-driven choices for the NTGAM forecast tab: available model layers,
    stress periods, extents (from the CKAN head rasters) + the forecast config's
    parameter defaults + which spatial inputs NTGAM can source. No hardcoded values."""
    try:
        return await run_in_threadpool(ntgam.options)
    except Exception as exc:  # noqa: BLE001 - surface CKAN/MINT connectivity cleanly
        raise HTTPException(502, f"could not load NTGAM options: {exc}")


@app.post("/forecast/scenario")
async def ntgam_scenario(body: dict[str, Any], authorization: str | None = Header(None)):
    """Plan-driven assembly: resolve the forecast inputs from the registry (planner),
    then EXECUTE each resolved branch's ETL on its source to fill the scenario — plus
    registered scalar params + physical derivations + provenance + honest ``missing``.
    No hardcoded source selection."""
    if "lat" not in body or "lon" not in body:
        raise HTTPException(422, "lat and lon are required")
    lat, lon = float(body["lat"]), float(body["lon"])
    h = get_client(_bearer(authorization))
    try:
        plan = await _resolve_forecast_plan(h, lat, lon, body.get("model_layer"))
        result = await run_in_threadpool(
            ntgam.build_scenario_from_plan, lat, lon,
            layer=plan["selection"]["model_layer"], layer_source=plan["selection"]["layer_source"],
            aquifers=plan["aquifer"].get("aquifers") or [], nearest_well=plan["nearest_well"],
            branches=plan["branches"], overrides=body.get("overrides") or {})
        result["plan"] = {"complete": plan["complete"], "branches": plan["branches"],
                          "plan_json": plan["plan_json"]}
        return result
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"scenario assembly failed: {exc}")


@app.post("/forecast/run")
async def ntgam_run(body: dict[str, Any]):
    """Run the SUBSIDE screening model on an assembled scenario (returns risk score,
    risk factors, and the annual subsidence projection)."""
    scenario = body.get("scenario") or body
    if not isinstance(scenario, dict) or not scenario:
        raise HTTPException(422, "a scenario object is required")
    try:
        return await run_in_threadpool(ntgam.run_forecast, scenario)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(500, f"forecast run failed: {exc}")


@app.post("/forecast/run-tapis")
async def ntgam_run_tapis(body: dict[str, Any], authorization: str | None = Header(None)):
    """Run the forecast as a Tapis Workflows pipeline (emulates SUBSIDE): generate a
    one-task pipeline whose function runs ``run_forecast`` on the scenario, then
    register + run it. ``dry_run`` returns the exact pipeline definition + run args
    without submitting. Live submission forwards the caller's Tapis bearer token and
    requires the tenant ``workflows`` service grant (the documented SUBSIDE blocker)."""
    scenario = body.get("scenario")
    if not isinstance(scenario, dict) or not scenario:
        raise HTTPException(422, "a scenario object is required")
    raw_id = str(scenario.get("scenario_id") or "ntgam-forecast")
    pipeline_id = "".join(c if (c.isalnum() or c in "-_") else "-" for c in raw_id).lower()[:60]
    plan_steps = body.get("plan_steps") or []
    pipeline = tapis.build_forecast_pipeline(
        pipeline_id, scenario=scenario, plan_steps=plan_steps or None)
    args: dict[str, Any] = {}  # scenario is embedded in the function code

    if body.get("dry_run"):
        return {"status": "generated", "pipeline_id": pipeline_id,
                "tapis_workflow_definition": pipeline, "args": args}

    token = _bearer(authorization) or body.get("tapis_token")
    try:
        result = await run_in_threadpool(
            tapis.submit_tapis_workflow, pipeline, args,
            token=token, run_name=body.get("run_name") or f"ntgam-{pipeline_id}",
            # default True: Workflows can't PATCH task code, so re-register (delete+create)
            # to guarantee the latest function code runs.
            recreate=bool(body.get("recreate", True)),
        )
    except Exception as exc:  # noqa: BLE001 - surface the Tapis error to the UI
        raise HTTPException(502, f"Tapis Workflows submission failed: {exc}")
    return {"status": "submitted", "pipeline_id": pipeline_id, **result}


_FORECAST_RUN_SPEC = "subside-forecast"
_FORECAST_SERVICE_SVOS = ("land_surface__elevation", "groundwater__temperature",
                          "total_dissolved_solids", "aquitard__clay_thickness")


async def _resolve_forecast_plan(h, lat: float, lon: float,
                                 model_layer: int | None = None) -> dict[str, Any]:
    """Registry-driven resolution: detect the aquifer/layer (CKAN polygons), filter the
    registered data objects to that layer + services, and ask the planner to resolve every
    forecast input -> per-input branches (source + ETL) + the converging DAG."""
    registry = (await h.execute(TRANSFORM_REGISTRY_QUERY))["adapter_transform_spec"]
    run_spec = next((t for t in registry if t.get("name") == _FORECAST_RUN_SPEC), None)
    if run_spec is None:
        raise HTTPException(404, f"run-spec '{_FORECAST_RUN_SPEC}' not registered — "
                                 "run ntgam/register_forecast_planner.py")
    detected = await run_in_threadpool(ntgam.detect_aquifer, lat, lon)
    nearest_well = await run_in_threadpool(stac.nearest_well, lat, lon)
    rows = (await h.execute(LIST_DATA_OBJECTS_QUERY))["adapter_data_object"]

    def _layer(r):
        for v in (r.get("variables") or []):
            if (v.get("local_name") or "").startswith("layer_"):
                return v["local_name"]
        return None

    def _svo(r):
        vs = r.get("variables") or []
        return (vs[0].get("standard_variable_uri") if vs else "") or ""

    present = sorted({int(_layer(r).split("_")[1]) for r in rows if _layer(r)})
    layer = model_layer or detected.get("suggested_layer") or (present[0] if present else 1)
    layer_source = "override" if model_layer else (
        "auto:aquifer-polygon" if detected.get("suggested_layer") else "default")
    want = f"layer_{layer}"
    keep = [r for r in rows if _layer(r) == want
            or (_layer(r) is None and any(k in _svo(r) for k in _FORECAST_SERVICE_SVOS))]
    sources = [_data_object_to_contract(r) for r in keep]

    edge_map = await _load_edge_map(registry)
    plan = plan_model_run(run_spec, sources, registry, edge_map=edge_map)
    branches = [{
        "standard_variable": (b.get("standard_variable_uri") or "").rsplit("/", 1)[-1],
        "temporal": next((c.get("temporal_resolution") for c in run_spec.get("contracts", [])
                          if c.get("id") == b.get("input_id")), None),
        "satisfied": b["source"] is not None,
        "source": getattr(b["source"], "resource_uri", None) if b["source"] else None,
        "etl": [s["name"] for s in (b["path"] or [])],
    } for b in plan["branches"]]
    return {"run_spec": _FORECAST_RUN_SPEC, "complete": plan["complete"],
            "selection": {"model_layer": layer, "layer_source": layer_source,
                          "available_layers": present, "lat": lat, "lon": lon},
            "aquifer": detected, "nearest_well": nearest_well, "branches": branches,
            "plan_json": build_model_run_plan_json(plan)}


@app.post("/forecast/plan")
async def ntgam_forecast_plan(body: dict[str, Any], authorization: str | None = Header(None)):
    """Query by the forecast -> the files + ETLs (DAG) needed to run it, from the registry."""
    if "lat" not in body or "lon" not in body:
        raise HTTPException(422, "lat and lon are required")
    h = get_client(_bearer(authorization))
    return await _resolve_forecast_plan(h, float(body["lat"]), float(body["lon"]),
                                        body.get("model_layer"))


@app.get("/forecast/run-tapis/{run_uuid}")
async def ntgam_run_tapis_detail(run_uuid: str, pipeline_id: str,
                                 authorization: str | None = Header(None)):
    """Fetch a Tapis Workflows run's status + task logs (stdout/stderr/last_message) so
    the UI can show whether it worked and why a task failed. Needs the caller's token."""
    token = _bearer(authorization)
    if not token:
        raise HTTPException(401, "log in (Tapis token) to view a run")
    try:
        return await run_in_threadpool(tapis.get_run_detail, pipeline_id, run_uuid, token=token)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"could not fetch run: {exc}")


# --- bundled standalone UI -------------------------------------------------
# Serve the demo single-page app (static/index.html) and redirect / to it.
_STATIC_DIR = Path(__file__).resolve().parents[1] / "static"
if _STATIC_DIR.is_dir():
    app.mount("/ui", StaticFiles(directory=str(_STATIC_DIR), html=True), name="ui")

    @app.get("/")
    async def _root() -> RedirectResponse:
        return RedirectResponse("/ui/")
