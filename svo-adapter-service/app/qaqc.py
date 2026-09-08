"""QA/QC checks for MODFLOW 6 SVO-adapter readiness.

The checks intentionally separate CKAN catalog compliance from adapter planning
readiness. A dataset can carry SVO metadata in CKAN and still be unusable by the
adapter if resource-level tags, transform contracts, or adapter data objects are
missing.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any

import httpx

from .config import settings

_REPO = Path(__file__).resolve().parents[3]
_DEFAULT_CONFIG = _REPO / "ntgam" / "ntgam-v301.json"
_MINT_NS = "https://w3id.org/okn/i/mint/"

_FETCH_INPUT_SVOS = [
    "aquifer__transmissivity",
    "aquifer__storativity",
    "aquifer__hydraulic_conductivity",
    "groundwater_well__pumping_volume_flow_rate",
    "land_subsurface_water__recharge_volume_flux",
]
_RUN_INPUT_SVOS = [
    "aquifer__transmissivity",
    "aquifer__storativity",
    "groundwater_well__pumping_volume_flow_rate",
]
_RUN_OUTPUT_SVOS = [
    "groundwater__hydraulic_head",
    "groundwater__flow_rate",
]

REMOTE_QA_FUNCTION_CODE = r'''\
import json
import sys
import urllib.parse
import urllib.request
from collections import Counter

from owe_python_sdk.runtime import execution_context as ctx


def get_input(name, default=""):
    value = ctx.get_input(name)
    return default if value in (None, "") else value


def split_svos(value):
    if value is None:
        return []
    values = value if isinstance(value, list) else [value]
    out = []
    for item in values:
        if item is None:
            continue
        for part in str(item).split(","):
            name = part.strip().rsplit("/", 1)[-1]
            if name:
                out.append(name)
    return out


def package_show(base_url, dataset):
    query = urllib.parse.urlencode({"id": dataset})
    url = base_url.rstrip("/") + "/api/3/action/package_show?" + query
    with urllib.request.urlopen(url, timeout=60) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if not payload.get("success"):
        raise RuntimeError("CKAN package_show failed for " + dataset + ": " + str(payload.get("error")))
    return payload["result"]


def resource_counts(pkg):
    counts = Counter()
    missing_url = 0
    untagged = 0
    for resource in pkg.get("resources") or []:
        svos = split_svos(resource.get("mint_standard_variables")) or split_svos(resource.get("standard_variable_uri"))
        if not svos:
            untagged += 1
        if not resource.get("url"):
            missing_url += 1
        for svo in svos:
            counts[svo] += 1
    return counts, missing_url, untagged


def contract_svos(contract):
    meta = contract.get("metadata_json") or {}
    svos = set(split_svos(contract.get("standard_variable_uri")))
    svos.update(split_svos(meta.get("standard_variables")))
    return svos


def registry_failures(registry, expected_specs):
    by_id = {spec.get("id"): spec for spec in registry if spec.get("id")}
    by_name = {}
    for spec in registry:
        by_name.setdefault(spec.get("name"), []).append(spec)
    failures = []
    for expected in expected_specs:
        spec = by_id.get(expected["id"])
        if spec is None and by_name.get(expected["name"]):
            spec = by_name[expected["name"]][0]
            failures.append(expected["name"] + " registered with generated id " + str(spec.get("id")) + " instead of " + expected["id"])
        if spec is None:
            failures.append("missing transform spec " + expected["name"])
            continue
        for role in sorted({c["role"] for c in expected.get("contracts", [])}):
            want = {split_svos(c.get("standard_variable_uri"))[0] for c in expected["contracts"]
                    if c.get("role") == role and split_svos(c.get("standard_variable_uri"))}
            have = set()
            for contract in spec.get("contracts") or []:
                if contract.get("role") == role:
                    have.update(contract_svos(contract))
            missing = sorted(want - have)
            if missing:
                failures.append(expected["name"] + " " + role + " contract missing SVO(s): " + ", ".join(missing))
    return failures


def source_failures(data_objects, required):
    counts = Counter()
    for obj in data_objects:
        for variable in obj.get("variables") or []:
            for svo in split_svos(variable.get("standard_variable_uri")):
                counts[svo] += 1
    return ["adapter has no registered source data object for " + svo for svo in required if not counts.get(svo)]


config = json.loads(get_input("CONFIG_JSON", "{}"))
requirements = json.loads(get_input("REQUIREMENTS_JSON", "{}"))
expected_specs = json.loads(get_input("EXPECTED_SPECS_JSON", "[]"))
registry = json.loads(get_input("REGISTRY_JSON", "[]"))
data_objects = json.loads(get_input("DATA_OBJECTS_JSON", "[]"))

failures = []
warnings = []
datasets = []
for dataset_id, required in [
    (config["ckan_dataset_inputs"], requirements["fetch_input_svos"]),
    (config["ckan_dataset_outputs"], ["groundwater__hydraulic_head"]),
]:
    pkg = package_show(config["ckan_base_url"], dataset_id)
    counts, missing_url, untagged = resource_counts(pkg)
    missing = [svo for svo in required if not counts.get(svo)]
    for svo in missing:
        dataset_svos = set(split_svos(pkg.get("mint_standard_variables")))
        suffix = " (dataset-level only)" if svo in dataset_svos else ""
        failures.append(dataset_id + " missing resource-level " + svo + suffix)
    if missing_url:
        failures.append(dataset_id + " has resources with no URL: " + str(missing_url))
    if untagged:
        warnings.append(dataset_id + " has untagged resources: " + str(untagged))
    datasets.append({"dataset_id": dataset_id, "resource_count": len(pkg.get("resources") or []),
                     "resource_svo_counts": dict(counts), "missing_required": missing})

failures.extend(registry_failures(registry, expected_specs))
failures.extend(source_failures(data_objects, requirements["run_input_svos"]))

report = {
    "status": "fail" if failures else ("warn" if warnings else "pass"),
    "config": config,
    "datasets": datasets,
    "failures": failures,
    "warnings": warnings,
}
print("SVO_ADAPTER_QAQC_REPORT=" + json.dumps(report, sort_keys=True))
if failures:
    sys.exit(1)
'''


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _status(items: list[str], warn_items: list[str] | None = None) -> str:
    if items:
        return "fail"
    if warn_items:
        return "warn"
    return "pass"


def _load_config(path: Path = _DEFAULT_CONFIG) -> dict[str, Any]:
    return json.loads(path.read_text())


def _model_id(config: dict[str, Any]) -> str:
    return f"{config['name'].lower().replace('-', '_')}_v{str(config['version']).replace('.', '_')}"


def _svo_uri(value: str | None) -> str | None:
    if not value:
        return value
    value = str(value).strip()
    if "://" in value or "__" not in value:
        return value
    return f"{_MINT_NS}{value}"


def _svo_name(value: str | None) -> str:
    value = str(value or "").strip()
    if not value:
        return ""
    return value.rsplit("/", 1)[-1]


def _split_svos(value: Any) -> list[str]:
    if value is None:
        return []
    raw: list[Any]
    if isinstance(value, list):
        raw = value
    else:
        raw = [value]
    svos: list[str] = []
    for item in raw:
        if item is None:
            continue
        for part in str(item).split(","):
            name = _svo_name(part)
            if name:
                svos.append(name)
    return svos


def _extra_value(pkg: dict[str, Any], key: str) -> str | None:
    for extra in pkg.get("extras") or []:
        if extra.get("key") == key:
            return extra.get("value")
    return None


async def _ckan_package(client: httpx.AsyncClient, base_url: str, dataset_id: str) -> dict[str, Any]:
    response = await client.get(
        f"{base_url.rstrip('/')}/api/3/action/package_show",
        params={"id": dataset_id},
    )
    response.raise_for_status()
    payload = response.json()
    if not payload.get("success"):
        raise RuntimeError(payload.get("error") or f"CKAN package_show failed for {dataset_id}")
    return payload["result"]


def _summarize_dataset(
    pkg: dict[str, Any],
    *,
    required_svos: list[str],
    purpose: str,
) -> dict[str, Any]:
    resources = pkg.get("resources") or []
    resource_counts: Counter[str] = Counter()
    units: dict[str, Counter[str]] = defaultdict(Counter)
    formats: dict[str, Counter[str]] = defaultdict(Counter)
    examples: dict[str, list[dict[str, Any]]] = defaultdict(list)
    untagged: list[dict[str, Any]] = []
    missing_url: list[dict[str, Any]] = []
    missing_standard_uri: list[dict[str, Any]] = []

    for resource in resources:
        svos = _split_svos(resource.get("mint_standard_variables"))
        if not svos:
            svos = _split_svos(resource.get("standard_variable_uri"))
        if not svos:
            untagged.append({"id": resource.get("id"), "name": resource.get("name")})
        if not resource.get("url"):
            missing_url.append({"id": resource.get("id"), "name": resource.get("name")})
        if svos and not resource.get("standard_variable_uri"):
            missing_standard_uri.append({"id": resource.get("id"), "name": resource.get("name")})
        for svo in svos:
            resource_counts[svo] += 1
            if resource.get("unit"):
                units[svo][str(resource.get("unit"))] += 1
            if resource.get("format"):
                formats[svo][str(resource.get("format"))] += 1
            if len(examples[svo]) < 3:
                examples[svo].append({
                    "id": resource.get("id"),
                    "name": resource.get("name"),
                    "format": resource.get("format"),
                    "unit": resource.get("unit"),
                    "url": resource.get("url"),
                })

    dataset_svos = sorted(set(_split_svos(pkg.get("mint_standard_variables"))))
    requirements = []
    failures: list[str] = []
    warnings: list[str] = []
    for svo in required_svos:
        count = resource_counts.get(svo, 0)
        dataset_only = count == 0 and svo in dataset_svos
        row_status = "pass" if count else "fail"
        detail = f"{count} resource(s) carry {svo}"
        if dataset_only:
            detail = f"{svo} appears only at dataset level; adapter fetches filter resource metadata"
            failures.append(detail)
        elif not count:
            detail = f"no resource-level {svo} metadata found"
            failures.append(detail)
        requirements.append({
            "svo": svo,
            "status": row_status,
            "resource_count": count,
            "dataset_level_only": dataset_only,
            "detail": detail,
            "units": dict(units.get(svo, {})),
            "formats": dict(formats.get(svo, {})),
            "examples": examples.get(svo, []),
        })

    if missing_url:
        failures.append(f"{len(missing_url)} resource(s) have no URL")
    if missing_standard_uri:
        warnings.append(f"{len(missing_standard_uri)} SVO-tagged resource(s) lack standard_variable_uri")
    if untagged:
        warnings.append(f"{len(untagged)} resource(s) have no resource-level SVO")

    return {
        "dataset_id": pkg.get("name"),
        "title": pkg.get("title") or pkg.get("name"),
        "purpose": purpose,
        "url": f"{pkg.get('ckan_base_url', '').rstrip('/')}/dataset/{pkg.get('name')}",
        "resource_count": len(resources),
        "model_code": _extra_value(pkg, "model_code"),
        "dataset_svos": dataset_svos,
        "resource_svo_counts": dict(sorted(resource_counts.items())),
        "requirements": requirements,
        "issues": {
            "missing_url": missing_url[:10],
            "missing_standard_uri": missing_standard_uri[:10],
            "untagged": untagged[:10],
        },
        "status": _status(failures, warnings),
        "failures": failures,
        "warnings": warnings,
    }


def _contract_id(prefix: str, svo: str) -> str:
    slug = _svo_name(svo).replace("__", "-").replace("_", "-")
    return f"{prefix}-{slug}"


def expected_modflow6_specs(config: dict[str, Any]) -> list[dict[str, Any]]:
    model_id = _model_id(config)
    name = config["name"]

    fetch_output_prefix = f"c-{model_id}-inputs-out"
    run_input_prefix = f"c-{model_id}-run-in"
    run_output_prefix = f"c-{model_id}-run-out"
    capture_input_prefix = f"c-{model_id}-capture-in"

    return [
        {
            "id": f"ts-{model_id}-fetch-inputs",
            "name": f"modflow6-fetch-inputs-{name}",
            "description": f"Fetch {name} MODFLOW 6 inputs from CKAN by SVO",
            "method": "tapis_function",
            "contracts": [
                {
                    "id": _contract_id(fetch_output_prefix, svo),
                    "role": "output",
                    "standard_variable_uri": _svo_uri(svo),
                    "data_type": "modflow6-inputs",
                }
                for svo in _FETCH_INPUT_SVOS
            ],
        },
        {
            "id": f"ts-{model_id}-run",
            "name": f"modflow6-run-{name}",
            "description": f"Execute MODFLOW 6 {name} simulation",
            "method": "tapis_job",
            "tapis_app_id": "modflow6-simulation",
            "contracts": [
                {
                    "id": _contract_id(run_input_prefix, svo),
                    "role": "input",
                    "standard_variable_uri": _svo_uri(svo),
                    "data_type": "modflow6-inputs",
                }
                for svo in _RUN_INPUT_SVOS
            ] + [
                {
                    "id": _contract_id(run_output_prefix, svo),
                    "role": "output",
                    "standard_variable_uri": _svo_uri(svo),
                    "data_type": "modflow6-outputs",
                }
                for svo in _RUN_OUTPUT_SVOS
            ],
        },
        {
            "id": f"ts-{model_id}-capture-outputs",
            "name": f"modflow6-capture-outputs-{name}",
            "description": f"Capture and register {name} MODFLOW 6 outputs to CKAN",
            "method": "tapis_function",
            "contracts": [
                {
                    "id": _contract_id(capture_input_prefix, svo),
                    "role": "input",
                    "standard_variable_uri": _svo_uri(svo),
                    "data_type": "modflow6-outputs",
                }
                for svo in _RUN_OUTPUT_SVOS
            ] + [
                {
                    "id": f"c-{model_id}-ckan-out",
                    "role": "output",
                    "format": "ckan",
                    "data_type": "modflow6-outputs-registered",
                    "catalog": f"ckan+stac:{config['ckan_org']}",
                }
            ],
        },
    ]


def _contract_svos(contract: dict[str, Any]) -> set[str]:
    svos = set(_split_svos(contract.get("standard_variable_uri")))
    metadata = contract.get("metadata_json") or {}
    svos.update(_split_svos(metadata.get("standard_variables")))
    svos.update(_split_svos(contract.get("standard_variables")))
    return svos


def _contract_data_type(contract: dict[str, Any]) -> str | None:
    metadata = contract.get("metadata_json") or {}
    return contract.get("data_type") or metadata.get("data_type")


def _registry_summary(
    registry: list[dict[str, Any]] | None,
    registry_error: str | None,
    expected: list[dict[str, Any]],
) -> dict[str, Any]:
    if registry_error:
        return {
            "status": "fail",
            "error": registry_error,
            "specs": [],
            "failures": [f"could not read adapter transform registry: {registry_error}"],
            "warnings": [],
        }

    registry = registry or []
    by_id = {spec.get("id"): spec for spec in registry if spec.get("id")}
    by_name: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for spec in registry:
        by_name[spec.get("name")].append(spec)

    failures: list[str] = []
    warnings: list[str] = []
    rows: list[dict[str, Any]] = []
    for exp in expected:
        spec = by_id.get(exp["id"])
        matched_by = "id"
        if spec is None and by_name.get(exp["name"]):
            spec = by_name[exp["name"]][0]
            matched_by = "name"
        if spec is None:
            msg = f"missing transform spec {exp['name']} ({exp['id']})"
            failures.append(msg)
            rows.append({"expected_id": exp["id"], "name": exp["name"], "status": "fail", "issues": [msg]})
            continue

        issues: list[str] = []
        spec_warnings: list[str] = []
        if matched_by == "name" and spec.get("id") != exp["id"]:
            issues.append(
                f"registered under generated id {spec.get('id')}; expected stable id {exp['id']}"
            )
        if exp.get("method") and spec.get("method") != exp["method"]:
            issues.append(f"method is {spec.get('method')!r}; expected {exp['method']!r}")
        if exp.get("tapis_app_id") and spec.get("tapis_app_id") != exp["tapis_app_id"]:
            issues.append(f"tapis_app_id is {spec.get('tapis_app_id')!r}; expected {exp['tapis_app_id']!r}")

        contracts = spec.get("contracts") or []
        for role in sorted({c["role"] for c in exp["contracts"]}):
            expected_svos = {
                _svo_name(c.get("standard_variable_uri"))
                for c in exp["contracts"]
                if c.get("role") == role and c.get("standard_variable_uri")
            }
            present_svos = set()
            present_data_types = set()
            for contract in contracts:
                if contract.get("role") != role:
                    continue
                present_svos.update(_contract_svos(contract))
                dt = _contract_data_type(contract)
                if dt:
                    present_data_types.add(dt)
            missing_svos = sorted(expected_svos - present_svos)
            if missing_svos:
                issues.append(f"{role} contract missing SVO(s): {', '.join(missing_svos)}")
            expected_data_types = {
                c.get("data_type")
                for c in exp["contracts"]
                if c.get("role") == role and c.get("data_type")
            }
            missing_data_types = sorted(expected_data_types - present_data_types)
            if missing_data_types:
                spec_warnings.append(f"{role} contract missing data_type metadata: {', '.join(missing_data_types)}")

        if issues:
            failures.extend([f"{exp['name']}: {issue}" for issue in issues])
        if spec_warnings:
            warnings.extend([f"{exp['name']}: {issue}" for issue in spec_warnings])
        rows.append({
            "expected_id": exp["id"],
            "actual_id": spec.get("id"),
            "name": exp["name"],
            "matched_by": matched_by,
            "method": spec.get("method"),
            "tapis_app_id": spec.get("tapis_app_id"),
            "contract_count": len(contracts),
            "status": _status(issues, spec_warnings),
            "issues": issues,
            "warnings": spec_warnings,
        })

    return {
        "status": _status(failures, warnings),
        "spec_count": len(registry),
        "specs": rows,
        "failures": failures,
        "warnings": warnings,
    }


def _adapter_source_summary(
    data_objects: list[dict[str, Any]] | None,
    data_objects_error: str | None,
    required_svos: list[str],
) -> dict[str, Any]:
    if data_objects_error:
        return {
            "status": "fail",
            "error": data_objects_error,
            "requirements": [],
            "failures": [f"could not read adapter data objects: {data_objects_error}"],
            "warnings": [],
        }
    counts: Counter[str] = Counter()
    examples: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for obj in data_objects or []:
        for variable in obj.get("variables") or []:
            svo = _svo_name(variable.get("standard_variable_uri"))
            if not svo:
                continue
            counts[svo] += 1
            if len(examples[svo]) < 3:
                examples[svo].append({
                    "id": obj.get("id"),
                    "label": obj.get("label"),
                    "resource_uri": obj.get("resource_uri"),
                    "unit": variable.get("unit"),
                })
    failures = []
    rows = []
    for svo in required_svos:
        count = counts.get(svo, 0)
        if not count:
            failures.append(f"adapter has no registered source data object for {svo}")
        rows.append({
            "svo": svo,
            "status": "pass" if count else "fail",
            "data_object_count": count,
            "examples": examples.get(svo, []),
        })
    return {
        "status": _status(failures),
        "data_object_count": len(data_objects or []),
        "requirements": rows,
        "failures": failures,
        "warnings": [],
    }


def _model_recommendation(
    config: dict[str, Any],
    inputs_summary: dict[str, Any] | None,
    registry_summary: dict[str, Any],
    source_summary: dict[str, Any],
) -> dict[str, Any]:
    blockers: list[str] = []
    if not inputs_summary:
        blockers.append("CKAN input dataset could not be read")
    elif inputs_summary["status"] == "fail":
        blockers.extend(inputs_summary["failures"])
    if registry_summary["status"] == "fail":
        blockers.extend(registry_summary["failures"])
    if source_summary["status"] == "fail":
        blockers.extend(source_summary["failures"])

    return {
        "model": "MODFLOW 6",
        "name": config["name"],
        "version": config["version"],
        "ckan_dataset": config["ckan_dataset_inputs"],
        "status": "ready" if not blockers else "blocked",
        "ckan_compliant": bool(inputs_summary and inputs_summary["status"] != "fail"),
        "adapter_ready": registry_summary["status"] != "fail" and source_summary["status"] != "fail",
        "blockers": blockers[:20],
    }


def tapis_context(
    *,
    registry: list[dict[str, Any]] | None,
    data_objects: list[dict[str, Any]] | None,
) -> dict[str, Any]:
    config = _load_config()
    ckan_base = (config.get("ckan_base_url") or settings.ckan_url).rstrip("/")
    slim_config = {
        "name": config["name"],
        "version": config["version"],
        "ckan_base_url": ckan_base,
        "ckan_org": config["ckan_org"],
        "ckan_dataset_inputs": config["ckan_dataset_inputs"],
        "ckan_dataset_outputs": config["ckan_dataset_outputs"],
    }
    return {
        "config": slim_config,
        "requirements": {
            "fetch_input_svos": _FETCH_INPUT_SVOS,
            "run_input_svos": _RUN_INPUT_SVOS,
            "run_output_svos": _RUN_OUTPUT_SVOS,
        },
        "expected_specs": expected_modflow6_specs(config),
        "registry": registry or [],
        "data_objects": data_objects or [],
    }


def build_tapis_pipeline(pipeline_id: str = "modflow6-svo-qaqc-ntgam-v301") -> dict[str, Any]:
    return {
        "id": pipeline_id,
        "type": "workflow",
        "description": "Remote QA/QC for the NTGAM MODFLOW 6 SVO adapter path",
        "owner": settings.tapis_workflow_owner,
        "group_id": settings.tapis_workflow_group,
        **({"tenant_id": settings.tapis_tenant} if settings.tapis_tenant else {}),
        "params": {
            "config_json": {"type": "string", "required": True},
            "requirements_json": {"type": "string", "required": True},
            "expected_specs_json": {"type": "string", "required": True},
            "registry_json": {"type": "string", "required": True},
            "data_objects_json": {"type": "string", "required": True},
        },
        "tasks": [{
            "id": "modflow6-svo-qaqc",
            "type": "function",
            "runtime": "python:3.11",
            "installer": "pip",
            "description": "Validate CKAN SVO metadata and SVO-adapter registry readiness",
            "code": REMOTE_QA_FUNCTION_CODE,
            "input": {
                "CONFIG_JSON": {"type": "string", "value_from": {"args": "config_json"}},
                "REQUIREMENTS_JSON": {"type": "string", "value_from": {"args": "requirements_json"}},
                "EXPECTED_SPECS_JSON": {"type": "string", "value_from": {"args": "expected_specs_json"}},
                "REGISTRY_JSON": {"type": "string", "value_from": {"args": "registry_json"}},
                "DATA_OBJECTS_JSON": {"type": "string", "value_from": {"args": "data_objects_json"}},
            },
        }],
    }


def tapis_args(context: dict[str, Any]) -> dict[str, dict[str, str]]:
    return {
        "config_json": {"value": json.dumps(context["config"], separators=(",", ":"))},
        "requirements_json": {"value": json.dumps(context["requirements"], separators=(",", ":"))},
        "expected_specs_json": {"value": json.dumps(context["expected_specs"], separators=(",", ":"))},
        "registry_json": {"value": json.dumps(context["registry"], separators=(",", ":"))},
        "data_objects_json": {"value": json.dumps(context["data_objects"], separators=(",", ":"))},
    }


async def modflow6_report(
    *,
    registry: list[dict[str, Any]] | None = None,
    registry_error: str | None = None,
    data_objects: list[dict[str, Any]] | None = None,
    data_objects_error: str | None = None,
) -> dict[str, Any]:
    config = _load_config()
    ckan_base = (config.get("ckan_base_url") or settings.ckan_url).rstrip("/")
    expected = expected_modflow6_specs(config)
    dataset_errors: list[str] = []
    dataset_summaries: list[dict[str, Any]] = []

    headers = {"Authorization": settings.ckan_token} if settings.ckan_token else {}
    async with httpx.AsyncClient(timeout=settings.request_timeout_seconds, headers=headers) as client:
        for dataset_id, required, purpose in [
            (config["ckan_dataset_inputs"], _FETCH_INPUT_SVOS, "MODFLOW 6 inputs"),
            (config["ckan_dataset_outputs"], ["groundwater__hydraulic_head"], "MODFLOW 6 outputs"),
        ]:
            try:
                pkg = await _ckan_package(client, ckan_base, dataset_id)
                pkg["ckan_base_url"] = ckan_base
                dataset_summaries.append(_summarize_dataset(pkg, required_svos=required, purpose=purpose))
            except Exception as exc:  # noqa: BLE001 - surface dependency status in report
                dataset_errors.append(f"{dataset_id}: {type(exc).__name__}: {exc}")

    registry_status = _registry_summary(registry, registry_error, expected)
    source_status = _adapter_source_summary(data_objects, data_objects_error, _RUN_INPUT_SVOS)
    inputs = next((d for d in dataset_summaries if d["dataset_id"] == config["ckan_dataset_inputs"]), None)
    recommendation = _model_recommendation(config, inputs, registry_status, source_status)

    failures = []
    warnings = []
    failures.extend(dataset_errors)
    for dataset in dataset_summaries:
        failures.extend([f"{dataset['dataset_id']}: {f}" for f in dataset["failures"]])
        warnings.extend([f"{dataset['dataset_id']}: {w}" for w in dataset["warnings"]])
    failures.extend(registry_status["failures"])
    warnings.extend(registry_status["warnings"])
    failures.extend(source_status["failures"])
    warnings.extend(source_status["warnings"])

    return {
        "generated_at": _now(),
        "status": _status(failures, warnings),
        "config": {
            "name": config["name"],
            "version": config["version"],
            "ckan_base_url": ckan_base,
            "ckan_org": config["ckan_org"],
            "ckan_dataset_inputs": config["ckan_dataset_inputs"],
            "ckan_dataset_outputs": config["ckan_dataset_outputs"],
        },
        "requirements": {
            "fetch_input_svos": _FETCH_INPUT_SVOS,
            "run_input_svos": _RUN_INPUT_SVOS,
            "run_output_svos": _RUN_OUTPUT_SVOS,
        },
        "datasets": dataset_summaries,
        "adapter_registry": registry_status,
        "adapter_sources": source_status,
        "recommended_models": [recommendation],
        "failures": failures[:50],
        "warnings": warnings[:50],
    }
