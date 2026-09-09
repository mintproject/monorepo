"""SVO-to-SVO Semantic Adapter Service (FastAPI sidecar).

Responsibilities: planning + execution orchestration + provenance. Basic CRUD on
metadata is delegated to Hasura GraphQL; this service does not reimplement it.

Endpoints:
  GET  /transform-specs           list the transform registry (pieces + contracts)
  POST /transform-specs           register one ETL piece (transform_spec + contracts)
  POST /data-objects              register a data object + its variable contract(s)
  POST /readiness/check           assess a data object vs a model-input requirement
  POST /plans                     generate (and persist) an ETL plan to close gaps
  GET  /plans/{id}                fetch a stored plan
  POST /workflows/generate        emit a Tapis Workflows pipeline for a plan
  POST /workflows/submit          register + run the pipeline (emulates SUBSIDE)
  GET  /runs/{id}                 fetch execution state of a run
  POST /runs/{id}/register-output register a transformed output as a new data object

A bundled standalone UI (static/index.html) is served at / and drives this flow.
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

from fastapi.responses import FileResponse, RedirectResponse
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
    - tapis_token is configured (service-level token for unattended polling)
    - poll_interval_seconds > 0 (explicit disable path)
    """
    task: asyncio.Task | None = None
    if (settings.tapis_token
            and settings.poll_interval_seconds > 0):
        from . import poller
        task = asyncio.create_task(poller.run_poller(), name="svo-adapter-poller")
    else:
        log.info(
            "poller disabled (token=%s, interval=%d)",
            "set" if settings.tapis_token else "unset",
            settings.poll_interval_seconds,
        )

    if settings.hasura_admin_secret:
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

    if settings.mint_sync_on_startup:
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

    if settings.ckan_sync_on_startup:
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


OPENAPI_TAGS = [
    {
        "name": "Core: Registry",
        "description": "Reusable data-object, transform-spec, and standard-variable registry operations.",
    },
    {
        "name": "Core: Planning",
        "description": "Reusable compatibility, readiness, reachability, and ETL-plan operations.",
    },
    {
        "name": "Core: Workflows",
        "description": "Reusable generation and submission of Tapis Workflows from saved plans.",
    },
    {
        "name": "Core: Runs",
        "description": "Reusable workflow-run status, polling, output registration, and provenance operations.",
    },
    {
        "name": "Core: Catalog/objectives",
        "description": "Reusable objective, runtime-default, and catalog dataset helper operations.",
    },
    {
        "name": "Integrations",
        "description": "Optional MINT, CKAN, Hasura edge-cache, and Tapis operational integration.",
    },
    {
        "name": "DFC/GAM",
        "description": "Texas GMA/GAM DFC target planning and MODFLOW 6 QA/QC use case.",
    },
    {
        "name": "NTGAM forecast",
        "description": "NTGAM location, scenario, and subsidence forecast use case.",
    },
]

app = FastAPI(
    title="SVO Adapter Service",
    version="0.1.0",
    description=(
        "Plans and executes SVO-to-SVO data transformations. "
        "Core groups are reusable across deployments; DFC/GAM and NTGAM forecast "
        "groups identify bespoke application profiles."
    ),
    openapi_tags=OPENAPI_TAGS,
    lifespan=lifespan,
)

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
    id status plan_json source_data_object_id target_dataset_specification_id target_model_configuration_id
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

LIST_RUNS = """
query ListRuns($limit: Int!) {
  adapter_workflow_run(order_by: {started_at: desc}, limit: $limit) {
    id status tapis_workflow_id tapis_run_id started_at completed_at
    output_data_object_id logs_uri error_message workflow_plan_id execution_id
  }
  adapter_workflow_run_aggregate { aggregate { count } }
}
"""

GET_PROVENANCE = """
query GetProvenance($run_id: String!, $limit: Int!) {
  adapter_provenance_event(
    where: {workflow_run_id: {_eq: $run_id}}
    order_by: {created_at: desc}
    limit: $limit
  ) {
    id event_type payload_json created_at workflow_run_id data_object_id
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


def _uri_scheme(uri: str | None) -> str:
    text = str(uri or "")
    return text.split(":", 1)[0].lower() if ":" in text else ""


def _is_tapis_accessible_uri(uri: str | None) -> bool:
    return _uri_scheme(uri) in {"http", "https", "tapis"}


def _is_live_runnable_source_uri(uri: str | None) -> bool:
    """Return true only for sources likely reachable from Tapis/OWE.

    Some legacy registry rows have valid-looking schemes but point at
    non-existent test data (for example a test Tapis path or example.com).
    Those should not be selected for live workflows.
    """
    text = str(uri or "")
    if not _is_tapis_accessible_uri(text):
        return False
    if "example.com" in text:
        return False
    if text.startswith("tapis://ls6/modflow/demo/"):
        return False
    return True


def _source_uri_score(uri: str | None) -> int:
    """Rank candidate data-object URIs for live/Tapis workflows.

    Prefer real CKAN HTTPS resources, then other non-example HTTPS, then Tapis.
    """
    text = str(uri or "")
    scheme = _uri_scheme(text)
    if text.startswith("https://ckan.tacc.utexas.edu/"):
        return 100
    if scheme in {"http", "https"} and "example.com" not in text:
        return 90
    if text.startswith("tapis://ls6/modflow/demo/"):
        return -10
    if scheme == "tapis":
        return 80
    if scheme in {"http", "https"}:
        return 30
    if scheme == "file":
        return 0
    return 10


async def _replacement_source_uri(h, source_data_object_id: str | None) -> str | None:
    """Find a live-runnable replacement URI for a stale source object.

    Match on the source object's first SVO variable and choose the highest-ranked
    registered data object with an actually runnable URI.
    """
    if not source_data_object_id:
        return None
    src_rows = (await h.execute(DATA_OBJECT_CONTRACT_QUERY, {"id": source_data_object_id}))["adapter_data_object"]
    if not src_rows:
        return None
    src_var = ((src_rows[0].get("variables") or [{}])[0]).get("standard_variable_uri")
    if not src_var:
        return None
    objs = (await h.execute(LIST_DATA_OBJECTS_QUERY)).get("adapter_data_object", [])
    candidates = []
    for obj in objs:
        uri = obj.get("resource_uri")
        if not _is_live_runnable_source_uri(uri):
            continue
        if not any(v.get("standard_variable_uri") == src_var for v in obj.get("variables", [])):
            continue
        candidates.append((_source_uri_score(uri), obj.get("label") or "", uri))
    if not candidates:
        return None
    return max(candidates, key=lambda item: (item[0], item[1]))[2]


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
    return {"status": "ok"}


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
    asyncio.create_task(_recompute_edges_bg(), name="recompute-edges")
    return created


async def _load_edge_map(
    registry: list[dict[str, Any]],
) -> "dict[str, list[dict[str, Any]]] | None":
    """Fetch precomputed edges from Hasura and build the BFS index."""
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
    from . import edges as edges_mod
    result = await edges_mod.recompute(get_client(None))
    return {"status": "ok", **result}


@app.post("/admin/poll")
async def trigger_poll(authorization: str | None = Header(None)):
    """Manually trigger one status-poll pass (useful for debugging without waiting
    for the next scheduled tick). Uses the caller's bearer token if provided,
    falling back to the service-level SVO_ADAPTER_TAPIS_TOKEN."""
    from . import poller
    token = _bearer(authorization) or settings.tapis_token
    if not token:
        raise HTTPException(401, "provide a Tapis bearer token or set SVO_ADAPTER_TAPIS_TOKEN")
    updates = await poller.poll_once(token)
    return {"polled": len(updates), "updates": updates}


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

    h = get_client(_bearer(authorization))
    data = await h.execute(GET_SYNC_STATUS_QUERY)
    last_sync_rows = data.get("last_sync") or []
    return {
        "spec_count": data.get("all", {}).get("aggregate", {}).get("count", 0),
        "mint_synced_count": data.get("synced", {}).get("aggregate", {}).get("count", 0),
        "function_task_count": data.get("function_tasks", {}).get("aggregate", {}).get("count", 0),
        "last_sync": last_sync_rows[0]["mint_synced_at"] if last_sync_rows else None,
    }


# ---------------------------------------------------------------------------
# DFC UI support endpoints — read-only lookups that back the standalone UI
# dropdowns (GMA/aquifer/year/metric selectors).  Data comes from the
# PDF-extracted fixture; no Hasura/CKAN mutation.
# ---------------------------------------------------------------------------

_DFC_FIXTURE = Path(__file__).resolve().parents[1] / "examples" / "twdb_adopted_dfc_2021.json"
_OBJECTIVES_FIXTURE = Path(__file__).resolve().parents[1] / "examples" / "dfc_objectives.json"


@app.get("/dfc-targets")
async def dfc_targets(
    gma_id: str | None = Query(None, description="Filter by GMA, e.g. 'GMA 12' or '12'"),
    aquifer: str | None = Query(None, description="Filter by aquifer name (case-insensitive)"),
    metric: str | None = Query(None, description="Filter by metric key"),
    limit: int = Query(1000, ge=1, le=10000),
):
    """Return adopted DFC target records from the PDF-extracted fixture.

    Optional query params filter by GMA, aquifer, and metric.  The UI calls
    this on every GMA/aquifer/year change to repopulate the metric dropdown
    and show adopted-target evidence on the planner answer cards.
    """
    import json as _json

    if not _DFC_FIXTURE.is_file():
        raise HTTPException(500, "DFC fixture not found")
    with open(_DFC_FIXTURE) as f:
        fixture = _json.load(f)
    records = fixture.get("records", [])

    # Normalise the GMA filter: accept "GMA 12", "gma 12", or bare "12".
    gma_num: int | None = None
    if gma_id:
        m = __import__("re").search(r"\d+", gma_id)
        gma_num = int(m.group()) if m else None

    out = []
    for r in records:
        if gma_num is not None and r.get("gma") != gma_num:
            continue
        if aquifer:
            r_aq = (r.get("aquifer_system") or r.get("aquifer") or "").lower()
            if aquifer.lower() not in r_aq and r_aq not in aquifer.lower():
                continue
        if metric and r.get("metric") != metric:
            continue
        out.append(r)
        if len(out) >= limit:
            break

    return {"count": len(out), "records": out}


@app.get("/objectives")
async def list_objectives():
    """Return DFC objective specifications from the fixture."""
    import json as _json

    if not _OBJECTIVES_FIXTURE.is_file():
        return {"objectives": []}
    with open(_OBJECTIVES_FIXTURE) as f:
        fixture = _json.load(f)
    return {"objectives": fixture.get("objectives", [])}


@app.get("/objectives/{objective_id}")
async def get_objective(objective_id: str):
    """Return a single DFC objective specification by ID."""
    import json as _json

    if not _OBJECTIVES_FIXTURE.is_file():
        raise HTTPException(404, "objectives fixture not found")
    with open(_OBJECTIVES_FIXTURE) as f:
        fixture = _json.load(f)
    for obj in fixture.get("objectives", []):
        if obj.get("id") == objective_id:
            return obj
    raise HTTPException(404, f"objective {objective_id!r} not found")


@app.get("/runtime-defaults")
async def runtime_defaults():
    """Return non-secret runtime configuration for the standalone UI.

    Exposes geo_actor_id and other non-sensitive settings so the UI can
    prefill workflow args.  Tokens and secrets are never returned.
    """
    return {
        "geo_actor_id": settings.geo_actor_id or "",
        "tapis_exec_system": settings.tapis_exec_system,
        "tapis_workflow_group": settings.tapis_workflow_group,
    }


@app.post("/objectives/{objective_id}/evaluate-plan")
async def evaluate_objective_plan(
    objective_id: str,
    body: dict | None = None,
    authorization: str | None = Header(None),
):
    """Evaluate an objective specification into an ETL plan.

    Loads the objective from the fixture, finds a matching data object
    for the objective's source requirement, and generates a transform
    chain using the same planner as POST /plans.
    """
    import json as _json

    if not _OBJECTIVES_FIXTURE.is_file():
        raise HTTPException(404, "objectives fixture not found")
    with open(_OBJECTIVES_FIXTURE) as f:
        fixture = _json.load(f)
    objective = None
    for obj in fixture.get("objectives", []):
        if obj.get("id") == objective_id:
            objective = obj
            break
    if not objective:
        raise HTTPException(404, f"objective {objective_id!r} not found")

    h = get_client(_bearer(authorization))
    # The UI sends the metric contract (e.g. head drawdown) in the body.
    body = body or {}
    target_contract = body.get("target_contract") or objective.get("source_requirement", {}).get("contract") or objective.get("targets", {}).get("contract", {})
    if not target_contract:
        raise HTTPException(422, "objective has no target_contract; pass target_contract in request body")

    # List data objects and pick the best reachable match. Prefer remotely
    # accessible CKAN/Tapis sources over local file paths so live Tapis workflows
    # do not receive laptop-only paths.
    objs_data = await h.execute(LIST_DATA_OBJECTS_QUERY)
    objects = objs_data.get("adapter_data_object", [])
    if not objects:
        raise HTTPException(422, "no data objects registered — sync CKAN resources first")

    target_svo = target_contract.get("standard_variable_uri", "")
    tgt = DataObjectContract(**{k: v for k, v in target_contract.items() if k in DataObjectContract.model_fields})
    registry = (await h.execute(TRANSFORM_REGISTRY_QUERY))["adapter_transform_spec"]
    edge_map = await _load_edge_map(registry)

    candidates = []
    for o in objects:
        if target_svo and not any(v.get("standard_variable_uri") == target_svo for v in o.get("variables", [])):
            continue
        rows = (await h.execute(DATA_OBJECT_CONTRACT_QUERY, {"id": o["id"]}))["adapter_data_object"]
        if not rows:
            continue
        src = _data_object_to_contract(rows[0])
        path = find_path(src, tgt, registry, edge_map=edge_map)
        if path is None:
            continue
        candidates.append((_source_uri_score(o.get("resource_uri")), -len(path), o, path))

    if not candidates:
        raise HTTPException(422, "no transform path found from any matching data object to target contract")
    _, _, best, path = max(candidates, key=lambda item: (item[0], item[1], item[2].get("label") or ""))

    plan_json = build_plan_json(path) if path else {"steps": [], "lossy": False}
    plan_json["source"] = best.get("resource_uri", "")
    plan_json["source_data_object_id"] = best.get("id")

    # Persist the plan (best-effort; ignore if adapter tables aren't tracked).
    plan_id = f"obj-{objective_id}"
    try:
        created = (await h.execute(INSERT_PLAN, {"obj": {
            "source_data_object_id": best["id"],
            "status": "draft",
            "plan_json": plan_json,
        }}))["insert_adapter_workflow_plan_one"]
        plan_id = created["id"]
    except Exception:
        pass

    return {
        "plan_id": plan_id,
        "source": {"id": best["id"], "label": best.get("label", "")},
        "objective_id": objective_id,
        "plan_json": plan_json,
    }


@app.post("/plans/dfc-fanout")
async def create_dfc_fanout_plan(body: dict[str, Any], authorization: str | None = Header(None)):
    """Create one DFC area-aggregation branch per adopted target row.

    The DFC UI uses this for district/county-specific drawdown targets. It
    resolves the same source→target transform chain as ``/plans`` and duplicates
    that chain per selected adopted DFC target record, attaching per-area context
    for workflow generation and rendering.
    """
    data_object_id = body.get("data_object_id")
    target_contract_raw = body.get("target_contract")
    target_records = body.get("target_records") or []
    if not data_object_id:
        raise HTTPException(422, "data_object_id is required")
    if not target_contract_raw:
        raise HTTPException(422, "target_contract is required")
    if not isinstance(target_records, list) or not target_records:
        raise HTTPException(422, "target_records must be a non-empty list")

    h = get_client(_bearer(authorization))
    src_rows = (await h.execute(DATA_OBJECT_CONTRACT_QUERY, {"id": data_object_id}))["adapter_data_object"]
    if not src_rows:
        raise HTTPException(404, "data object not found")
    src = _data_object_to_contract(src_rows[0])
    tgt = DataObjectContract(**{k: v for k, v in target_contract_raw.items() if k in DataObjectContract.model_fields})

    registry = (await h.execute(TRANSFORM_REGISTRY_QUERY))["adapter_transform_spec"]
    edge_map = await _load_edge_map(registry)
    path = find_path(src, tgt, registry, edge_map=edge_map)
    if path is None:
        raise HTTPException(422, "no transform path found from source contract to target contract")

    base = build_plan_json(path)
    steps: list[dict[str, Any]] = []
    step_idx = 0
    for rec in target_records:
        depends_on: list[int] = []
        for base_step in base.get("steps", []):
            step = dict(base_step)
            step["step"] = step_idx
            step["depends_on"] = depends_on.copy()
            area = rec.get("area") or "GMA-wide"
            rec_gma = rec.get("gma")
            step["dfc_record_id"] = rec.get("id")
            step["dfc_area"] = area
            step["env_values"] = {
                "AREA": area,
                "AREA_TYPE": rec.get("area_type") or "gma",
                "GMA_ID": body.get("gma_id") or (f"GMA {rec_gma}" if rec_gma else None),
                "AQUIFER": rec.get("aquifer") or rec.get("aquifer_system"),
                "TARGET_YEAR": (rec.get("period") or {}).get("target_year"),
                "DFC_RECORD_ID": rec.get("id"),
            }
            steps.append(step)
            depends_on = [step_idx]
            step_idx += 1

    plan_json = {
        "steps": steps,
        "lossy": base.get("lossy", False),
        "dfc_fanout": True,
        "target_records": target_records,
    }
    created = (await h.execute(INSERT_PLAN, {"obj": {
        "source_data_object_id": data_object_id,
        "status": "draft",
        "plan_json": plan_json,
    }}))["insert_adapter_workflow_plan_one"]
    await h.execute(INSERT_PROVENANCE, {"obj": {
        "event_type": "dfc_fanout_plan_generated",
        "payload_json": {"plan_id": created["id"], "areas": len(target_records), "steps": len(steps)},
    }})
    return {"status": "transform_required", "plan_id": created["id"], "plan_json": plan_json}


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
    if token and "tapis_token" in (pipeline.get("params") or {}) and not args.get("tapis_token", {}).get("value"):
        args["tapis_token"] = {"value": token}
    if not body.dry_run and "source_uri" in (pipeline.get("params") or {}):
        source_uri = args.get("source_uri", {}).get("value")
        if not _is_live_runnable_source_uri(source_uri) and plan.get("source_data_object_id"):
            src_rows = (await h.execute(DATA_OBJECT_CONTRACT_QUERY, {"id": plan["source_data_object_id"]}))["adapter_data_object"]
            plan_source_uri = (src_rows[0] or {}).get("resource_uri") if src_rows else None
            if _is_live_runnable_source_uri(plan_source_uri):
                args["source_uri"] = {"value": plan_source_uri}
                source_uri = plan_source_uri
        if not _is_live_runnable_source_uri(source_uri):
            replacement_uri = await _replacement_source_uri(h, plan.get("source_data_object_id"))
            if replacement_uri:
                args["source_uri"] = {"value": replacement_uri}
                source_uri = replacement_uri
        if not _is_live_runnable_source_uri(source_uri):
            raise HTTPException(
                422,
                "Live workflow source_uri must point to a reachable http, https, or tapis resource; "
                f"got {source_uri or 'missing'!r}. Sync/select a CKAN or real Tapis data object instead of a local file path.",
            )

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


@app.get("/runs")
async def list_runs(limit: int = Query(50, ge=1, le=200), authorization: str | None = Header(None)):
    """List recent workflow runs, most recent first."""
    h = get_client(_bearer(authorization))
    data = await h.execute(LIST_RUNS, {"limit": limit})
    runs = data.get("adapter_workflow_run", [])
    total = data.get("adapter_workflow_run_aggregate", {}).get("aggregate", {}).get("count", 0)
    return {"runs": runs, "total": total}


@app.get("/runs/{run_id}")
async def get_run(run_id: str, authorization: str | None = Header(None)):
    h = get_client(_bearer(authorization))
    run = (await h.execute(GET_RUN, {"id": run_id}))["adapter_workflow_run_by_pk"]
    if not run:
        raise HTTPException(404, "run not found")
    return run


@app.post("/runs/{run_id}/poll")
async def poll_run(run_id: str, authorization: str | None = Header(None)):
    """Poll one Tapis workflow run and persist any status transition.

    This is the user-triggered counterpart to the background poller. It returns
    the persisted adapter run fields plus the Tapis detail payload so the UI can
    render task stdout/stderr and DFC modeled values.
    """
    token = _bearer(authorization) or settings.tapis_token
    h = get_client(token)
    run = (await h.execute(GET_RUN, {"id": run_id}))["adapter_workflow_run_by_pk"]
    if not run:
        raise HTTPException(404, "run not found")

    pipeline_id = run.get("tapis_workflow_id")
    run_uuid = run.get("tapis_run_id")
    if not pipeline_id or not run_uuid:
        return run
    if not token:
        raise HTTPException(401, "log in with a Tapis token to poll this run")

    detail = await run_in_threadpool(tapis.get_run_detail, pipeline_id, run_uuid, token=token)
    tapis_status = str(detail.get("status") or "").upper()
    terminal = {
        "COMPLETED": "completed",
        "FINISHED": "completed",
        "FAILED": "failed",
        "CANCELLED": "failed",
        "TERMINATED": "failed",
    }
    update: dict[str, Any] = {}
    adapter_status = terminal.get(tapis_status)
    if adapter_status:
        update["status"] = adapter_status
        if adapter_status == "completed":
            update["completed_at"] = datetime.utcnow().isoformat()
        else:
            failed = []
            for task in detail.get("tasks") or []:
                if str(task.get("status") or "").upper() in {"FAILED", "ERROR"}:
                    failed.append(task.get("last_message") or task.get("stderr") or task.get("stdout") or task.get("task_id") or "task failed")
            if failed:
                update["error_message"] = "; ".join(map(str, failed))[:2000]
    elif tapis_status and str(run.get("status") or "").lower() in {"submitting", "generated"}:
        update["status"] = "running"

    if update:
        run = (await h.execute(UPDATE_RUN, {"id": run_id, "set": update}))["update_adapter_workflow_run_by_pk"] or run
        await h.execute(INSERT_PROVENANCE, {"obj": {
            "workflow_run_id": run_id,
            "event_type": "run_status_polled",
            "payload_json": {"tapis_status": tapis_status, "adapter_status": update.get("status")},
        }})

    return {**run, **detail}


@app.get("/runs/{run_id}/provenance")
async def get_run_provenance(
    run_id: str,
    limit: int = Query(100, ge=1, le=500),
    authorization: str | None = Header(None),
):
    """Return provenance events associated with a workflow run."""
    h = get_client(_bearer(authorization))
    run = (await h.execute(GET_RUN, {"id": run_id}))["adapter_workflow_run_by_pk"]
    if not run:
        raise HTTPException(404, "run not found")
    data = await h.execute(GET_PROVENANCE, {"run_id": run_id, "limit": limit})
    return {"run_id": run_id, "events": data.get("adapter_provenance_event", [])}


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
# Serve the single-page UI (static/index.html) and redirect / to it.
_STATIC_DIR = Path(__file__).resolve().parents[1] / "static"
if _STATIC_DIR.is_dir():
    @app.get("/ui/", include_in_schema=False)
    async def _ui_index() -> FileResponse:
        """Serve the UI shell without allowing stale deployment metadata to persist."""
        return FileResponse(
            _STATIC_DIR / "index.html",
            headers={"Cache-Control": "no-store, max-age=0"},
        )

    app.mount("/ui", StaticFiles(directory=str(_STATIC_DIR), html=True), name="ui")

    @app.get("/")
    async def _root() -> RedirectResponse:
        return RedirectResponse("/ui/")

    @app.get("/api/oauth2/tapis/callback")
    async def tapis_oauth_callback() -> FileResponse:
        """Serve the UI so it can consume Tapis' query-string access token."""
        return FileResponse(
            _STATIC_DIR / "index.html",
            headers={"Cache-Control": "no-store, max-age=0"},
        )


# Keep the generated Swagger UI organized by API scope. The route implementations
# intentionally remain close to the service code above; tags are applied centrally
# so adding a route does not require repeating OpenAPI boilerplate in every handler.
def _openapi_scope(path: str) -> str:
    if path.startswith("/forecast/"):
        return "NTGAM forecast"
    if path in {"/dfc-targets", "/plans/dfc-fanout"} or path.startswith("/qaqc/"):
        return "DFC/GAM"
    if path.startswith("/admin/"):
        return "Integrations"
    if path in {"/data-objects", "/transform-specs", "/standard-variables", "/health"}:
        return "Core: Registry"
    if path in {"/readiness/check", "/plans", "/plans/discover", "/plans/discover-sources",
                "/plans/model-run"} or path.startswith("/reachable/"):
        return "Core: Planning"
    if path in {"/workflows/generate", "/workflows/submit"}:
        return "Core: Workflows"
    if path == "/runs" or path.startswith("/runs/") or path.startswith("/plans/"):
        return "Core: Runs"
    if path.startswith("/objectives") or path in {"/runtime-defaults", "/datasets/find",
                                                   "/datasets/dataset_resources"}:
        return "Core: Catalog/objectives"
    return "Core: Registry"


for _route in app.routes:
    if hasattr(_route, "path") and hasattr(_route, "tags"):
        _route.tags = [_openapi_scope(_route.path)]
