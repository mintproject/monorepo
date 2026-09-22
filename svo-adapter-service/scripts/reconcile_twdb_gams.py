#!/usr/bin/env python3
"""Audit and safely reconcile TWDB GAM downloads with CKAN.

Dry-run is the default. ``--apply --yes`` uses patch-only CKAN actions after a
fresh source/CKAN snapshot. Archive metadata is never treated as evidence that
a scientific output, unit, temporal extent, or executable model is present.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote, unquote, urlencode, urljoin, urlsplit, urlunsplit
from urllib.request import Request, urlopen

SOURCE = "https://www.twdb.texas.gov/groundwater/models/download.asp"
CKAN = "https://ckan.tacc.utexas.edu"
ORG = "twdb-gams"
TAPIS_TOKEN_URL = "https://portals.tapis.io/v3/oauth2/tokens"
KINDS = ["model_archive", "geodatabase", "grid", "report", "auxiliary"]
EXISTING = {
    "blsm": "blossom-aquifer-model-files",
    "crcx": "https-txwaterdatahub-org-dataset-capitan-reef-complex-aquifer-gam-files",
    "czwx_c": "carrizo-wilcox-gam-central-portion",
    "czwx_n": "carrizo-wilcox-aquifer-northern-portion",
    "czwx_s": "carrizo-wilcox-aquifer-southern-portion",
    "ebfz_b": "edwards-bfz-barton-springs-segment-gam",
    "ebfz_n": "edwards-bfz-northern-segment-gam",
    "ebfz_s": "edwards-bfz-san-antonio-segment-gam",
    "eddt_r": "edwards-trinity-plateau-pecos-valley-gam",
    "glfc_c_s": "gulf-coast-central-southern-gam",
    "glfc_n": "gulf-coast-northern-gam",
    "hpas": "high-plains-aquifer-system-gam",
    "lipn": "lipan-aquifer-gam",
    "nctc": "nacatoch-aquifer-gam",
    "symr": "seymour-and-blaine-gam",
    "trnt_n": "ntgam-v301-inputs",
    "trnt_h": "trinity-aquifer-hill-country-southern-portion",
    "ygjk": "yegua-jackson-aquifer-groundwater-availability-model-files",
}
USE_LIMIT = (
    "TWDB models support regional groundwater planning. They are not intended "
    "for local-scale or individual-site decisions. Consult the model report for "
    "calibration, assumptions and uncertainty. Download availability does not "
    "establish successful execution in MINT."
)
RIGHTS = (
    "No standardized license was identified on the TWDB model download or model pages. "
    "Use is subject to TWDB terms and the model documentation; verify rights before redistribution."
)
SEMANTIC_POLICY = (
    "Complete model archives may carry reviewed mint_standard_variables for variables contained "
    "in the bundle. Reports, landing pages, grids, and geodatabases require their own direct evidence."
)


def clean(value):
    return " ".join(value.split())


def canonical_url(value):
    parts = urlsplit(value or "")
    # Preserve path case and query: both can identify different artifacts.
    return parts._replace(scheme="https", netloc=parts.netloc.lower(), fragment="").geturl()


def safe_url(value):
    """Percent-encode spaces and other unsafe path characters in source links."""
    parts = urlsplit(value)
    return urlunsplit((parts.scheme, parts.netloc, quote(unquote(parts.path), safe="/%:@"), parts.query, ""))


class DownloadTable(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows, self.row, self.cell, self.link = [], None, None, None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "tr":
            self.row = []
        elif tag == "td" and self.row is not None:
            self.cell = {"text": "", "links": []}
        elif tag == "a" and self.cell is not None:
            self.link = {"url": safe_url(urljoin(SOURCE, attrs.get("href", ""))), "label": ""}

    def handle_data(self, data):
        if self.cell is not None:
            self.cell["text"] += " " + data
        if self.link is not None:
            self.link["label"] += data

    def handle_endtag(self, tag):
        if tag == "a" and self.link is not None:
            self.link["label"] = clean(self.link["label"])
            if self.cell is not None:
                self.cell["links"].append(self.link)
            self.link = None
        elif tag == "td" and self.cell is not None:
            self.cell["text"] = clean(self.cell["text"])
            self.row.append(self.cell)
            self.cell = None
        elif tag == "tr" and self.row is not None:
            # Northern Trinity omits its final empty Other Data cell.
            if len(self.row) in (5, 6) and self.row[0]["links"]:
                self.rows.append(self.row)
            self.row = None


def parse_inventory(html):
    parser = DownloadTable()
    parser.feed(html)
    models = []
    for row in parser.rows:
        if not row[1]["links"]:
            continue
        archive = row[1]["links"][0]["url"]
        if not re.search(r"\.(zip|zipx|7z)$", urlsplit(archive).path, re.I):
            continue
        code = urlsplit(archive).path.split("/")[2]
        if code == "hmbl":
            code += "-hueco" if "Hueco" in archive else "-mesilla"
        page = row[0]["links"][0]["url"]
        resources = []
        for column, kind in zip(row[1:], KINDS):
            for link in column["links"]:
                resource_kind = "properties" if link["label"].lower() == "gam properties" else kind
                if "predictive" in link["label"].lower() and re.search(r"\.(zip|zipx|7z)$", link["url"], re.I):
                    resource_kind = "predictive_archive"
                resources.append({**link, "kind": resource_kind, "source_cell": column["text"]})
        models.append({
            "code": code, "title": row[0]["text"], "source_page": page,
            "archive_url": archive, "resources": resources,
            "category": "alternative" if "/alt/" in page else "research" if "/research/" in page else "GAM",
        })
    if len({m["code"] for m in models}) != len(models):
        raise ValueError("Non-unique source model identities")
    return models


def fetch(url, *, method="GET", limit=16 * 1024 * 1024, body=None, headers=None):
    request_headers = {"User-Agent": "MINT-TWDB-catalog-reconciler/1.0", **(headers or {})}
    request = Request(url, data=body, method=method, headers=request_headers)
    with urlopen(request, timeout=35) as response:
        data = response.read(limit + 1) if method != "HEAD" else b""
        if len(data) > limit:
            raise ValueError("Response exceeds metadata download limit")
        return data, dict(response.headers), response.geturl(), response.status


def action(action_name, **params):
    data, _, _, _ = fetch(f"{CKAN}/api/3/action/{action_name}?{urlencode(params)}")
    envelope = json.loads(data)
    if not envelope.get("success"):
        raise ValueError(f"CKAN {action_name}: {envelope.get('error')}")
    return envelope["result"]


def post_action(action_name, payload, token):
    body = json.dumps(payload).encode("utf-8")
    data, _, _, _ = fetch(
        f"{CKAN}/api/3/action/{action_name}", method="POST", body=body,
        headers={"Content-Type": "application/json", "X-Tapis-Token": token},
    )
    envelope = json.loads(data)
    if not envelope.get("success"):
        raise ValueError(f"CKAN {action_name}: {envelope.get('error')}")
    return envelope["result"]


def probe(url):
    try:
        _, headers, final_url, status = fetch(url, method="HEAD")
        headers = {key.lower(): value for key, value in headers.items()}
        return {"status": status, "final_url": final_url,
                "size": int(headers["content-length"]) if headers.get("content-length", "").isdigit() else None,
                "content_type": headers.get("content-type"), "last_modified": headers.get("last-modified"),
                "etag": headers.get("etag"), "accept_ranges": headers.get("accept-ranges")}
    except HTTPError as exc:
        return {"status": exc.code, "error": str(exc)}
    except (URLError, TimeoutError, OSError, ValueError) as exc:
        return {"status": None, "error": str(exc)}


class PageText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts, self.skip = [], 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.skip += 1
        if tag in ("p", "li", "h1", "h2", "h3", "br", "tr"):
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.skip = max(0, self.skip - 1)

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)


def page_evidence(url):
    try:
        body, _, final_url, status = fetch(url)
        html = body.decode("utf-8", errors="replace")
        # Remove global navigation from Dreamweaver-based TWDB pages.
        match = re.search(r'<!--\s*InstanceBeginEditable name="(?:MainContent|content|Content|mainContent)"\s*-->(.*?)<!--\s*InstanceEndEditable\s*-->', html, re.S)
        parser = PageText()
        parser.feed(match.group(1) if match else html)
        lines = [clean(line) for line in "".join(parser.parts).splitlines() if clean(line)]
        relevant = [line for line in lines if re.search(r"MODFLOW|GWSIM|SEAWAT|calibrat|simulat|steady|transient|version|aquifer|adopt|draft|develop|groundwater model", line, re.I)]
        return {"status": status, "url": final_url, "relevant_text": relevant}
    except (HTTPError, URLError, TimeoutError, OSError, ValueError) as exc:
        return {"status": None, "error": str(exc)}


def match_package(model, packages):
    explicit = EXISTING.get(model["code"])
    if explicit:
        matches = [p for p in packages if p["name"] == explicit]
        if len(matches) == 1:
            return matches[0]
    matches = [p for p in packages if any(canonical_url(r.get("url")) == canonical_url(model["archive_url"]) for r in p.get("resources", []))]
    if len(matches) > 1:
        raise ValueError(f"Ambiguous existing package for {model['code']}")
    return matches[0] if matches else None


def source_format(url):
    return Path(unquote(urlsplit(url).path)).suffix.lstrip(".").upper() or "HTML"


def explicit_version(model, evidence):
    text = "\n".join([model["title"], *evidence.get("relevant_text", [])])
    patterns = [
        r"Current GAM:[^\n]*?\(v\s*([0-9]+(?:\.[0-9]+)+)\)",
        r"\((?:version|v)\s*([0-9]+(?:\.[0-9]+)+)\)",
        r"version\s+([0-9]+(?:\.[0-9]+)+)[^\n]*?released",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.I)
        if match:
            return match.group(1)
    return None


def model_engine(model, evidence):
    text = "\n".join(evidence.get("relevant_text", []))
    if re.search(r"coded using MODFLOW\s*6", text, re.I):
        return "MODFLOW 6"
    if re.search(r"MODFLOW[- ]2000", text, re.I):
        return "MODFLOW-2000"
    if model["code"] == "ebfz_s" and re.search(r"maintain GWSIM", text, re.I):
        return "GWSIM (TWDB-maintained alternative)"
    return None


def tag_names(model, engine):
    names = {"groundwater", "twdb", "model-archive"}
    names.add("groundwater-availability-model" if model["category"] == "GAM" else f"{model['category']}-model")
    if engine == "MODFLOW 6":
        names.add("modflow-6")
    elif engine == "MODFLOW-2000":
        names.add("modflow-2000")
    elif engine and "GWSIM" in engine:
        names.add("gwsim")
    return sorted(names)


def package_notes(model, checked_at, engine=None):
    kind = {
        "GAM": "Groundwater Availability Model (GAM)",
        "alternative": "alternative groundwater model",
        "research": "research groundwater model",
    }[model["category"]]
    engine_text = f" The TWDB page identifies the model engine as {engine}." if engine else ""
    return (
        f"Official TWDB {kind} artifacts for **{model['title']}**.{engine_text} "
        f"This catalog record follows the current [TWDB model page]({model['source_page']}) and "
        f"[download table]({SOURCE}); {len(model['resources'])} listed links were checked on "
        f"{checked_at[:10]}. The primary model bundle is `{model['archive_url']}`.\n\n"
        f"**Use and interpretation.** {USE_LIMIT} Model outputs are not assumed to exist merely "
        f"because an archive is downloadable. Simulation period, length/time units, vertical datum, "
        f"and exact model footprint remain unverified unless a separately cataloged resource states "
        f"them. {SEMANTIC_POLICY} {RIGHTS}"
    )


def preserved_extras(existing):
    """Retain non-generated extras while removing unsupported blanket ESIP claims."""
    kept = {}
    for item in (existing or {}).get("extras") or []:
        key = item.get("key", "")
        if key.startswith("esipfed_") or key in {"data_source_url", "spatial"}:
            continue
        kept[key] = item.get("value", "")
    return kept


def package_payload(model, existing, evidence, checked_at):
    engine = model_engine(model, evidence)
    version = explicit_version(model, evidence)
    extras = preserved_extras(existing)
    existing_spatial = (existing or {}).get("spatial") or extras.get("spatial")
    resource_spatial = [r.get("spatial") for r in (existing or {}).get("resources", []) if r.get("spatial")]
    canonical_resource_spatial = {
        json.dumps(json.loads(value) if isinstance(value, str) else value, sort_keys=True, separators=(",", ":"))
        for value in resource_spatial
    }
    reviewed_archive_variables = [
        r.get("mint_standard_variables")
        for r in (existing or {}).get("resources", [])
        if r.get("resource_type") in ("model_archive", "predictive_archive")
        and r.get("mint_standard_variables")
    ]
    extras.update({
        "twdb_model_code": model["code"],
        "twdb_model_category": model["category"],
        "twdb_source_catalog_url": SOURCE,
        "twdb_source_model_page": model["source_page"],
        "twdb_primary_archive_url": model["archive_url"],
        "twdb_source_resource_count": str(len(model["resources"])),
        "metadata_profile": "TWDB GAM archive profile v1",
        "metadata_verified_at": checked_at,
        "archive_contents_status": "not inspected",
        "execution_readiness": "not tested",
        "model_outputs_status": "not asserted by archive availability",
        "simulation_period_status": "not verified",
        "units_status": "not verified",
        "vertical_datum_status": "not verified",
        "spatial_coverage_status": (
            "existing dataset geometry retained; not reverified"
            if existing_spatial else
            "identical resource geometry promoted to dataset; not reverified"
            if len(canonical_resource_spatial) == 1 else "exact model footprint not verified"
        ),
        "semantic_annotation_status": (
            "reviewed model-archive variable bindings retained"
            if reviewed_archive_variables else "model-archive variable bindings require review"
        ),
        "mint_standard_variables_policy": SEMANTIC_POLICY,
        "svo_vocabulary_url": "https://www.geoscienceontology.org/svo/svl/variable/",
        "rights_statement": RIGHTS,
    })
    if engine:
        extras["model_engine"] = engine
        extras["model_engine_evidence_url"] = model["source_page"]
    payload = {
        "title": model["title"],
        "notes": package_notes(model, checked_at, engine),
        "url": model["source_page"],
        "author": "Texas Water Development Board",
        "author_email": "gam@twdb.texas.gov",
        "maintainer": "Texas Water Development Board",
        "maintainer_email": "gam@twdb.texas.gov",
        "license_id": "notspecified",
        "tags": [{"name": name} for name in tag_names(model, engine)],
        "extras": [{"key": key, "value": str(value)} for key, value in sorted(extras.items())],
    }
    if version:
        payload["version"] = version
    if existing_spatial:
        payload["spatial"] = existing_spatial
    elif len(canonical_resource_spatial) == 1:
        payload["spatial"] = next(iter(canonical_resource_spatial))
    if existing:
        payload["id"] = existing["id"]
    else:
        payload.update({
            "name": "twdb-" + model["code"].replace("_", "-") + "-model-archives",
            "owner_org": ORG,
            "type": "dataset",
        })
    return payload


def resource_payload(model, link, check, existing_resource=None, dataset_type="dataset"):
    fmt = source_format(link["url"])
    description = (
        f"Official TWDB {link['kind'].replace('_', ' ')} for {model['title']}. "
        f"Listed on {SOURCE}; model context: {model['source_page']}. {link['source_cell']}. "
        f"Availability was checked without downloading the full artifact. {USE_LIMIT}"
    )
    if link["kind"] in ("model_archive", "predictive_archive", "geodatabase", "grid", "properties"):
        description += " Archive contents, units, datum, and execution readiness were not independently verified. " + SEMANTIC_POLICY
    payload = {
        "name": f"{model['title']} — {link['label']}",
        "url": link["url"],
        "format": fmt,
        "description": description,
        "resource_type": link["kind"],
        "source_page": model["source_page"],
        "source_authority": "Texas Water Development Board",
        "source_catalog_url": SOURCE,
        "file_extension": Path(unquote(urlsplit(link["url"]).path)).suffix.lower(),
        "availability_status": "reachable" if check.get("status") == 200 else "unverified",
        "metadata_verification": "source-link-verified; file-contents-not-inspected",
    }
    if dataset_type == "subside_dataset":
        payload.update({
            "abstract": description,
            "program_area": "Groundwater",
            "data_contact_email": "gam@twdb.texas.gov",
            "caveats_usage": USE_LIMIT,
            "categories": "Groundwater",
            "collection_method": "Official TWDB downloadable artifact; contents not inspected",
            "quality_control_level": "TWDB-published artifact; execution not validated",
            "temporal_coverage_start": "",
            "temporal_coverage_end": "",
        })
    if check.get("size"):
        payload["size"] = check["size"]
    if check.get("content_type"):
        payload["mimetype"] = check["content_type"].split(";")[0]
    if link["kind"] in ("model_archive", "predictive_archive"):
        payload["data_role"] = "model-input-bundle"
        payload["requires_extraction"] = "true"
        if existing_resource and existing_resource.get("mint_standard_variables"):
            payload["mint_standard_variables"] = existing_resource["mint_standard_variables"]
    if existing_resource:
        payload["id"] = existing_resource["id"]
        if existing_resource.get("spatial"):
            payload["spatial"] = ""
    return payload


def build_proposal(model, existing, checks, evidence, checked_at):
    name = existing["name"] if existing else "twdb-" + model["code"].replace("_", "-") + "-model-archives"
    resources, issues = [], []
    existing_by_url = {}
    for resource in (existing or {}).get("resources", []):
        existing_by_url.setdefault(canonical_url(resource.get("url")), []).append(resource)
    for link in model["resources"]:
        check = checks[link["url"]]
        matches = existing_by_url.get(canonical_url(link["url"]), [])
        if len(matches) > 1:
            issues.append(f"Duplicate existing URL needs review: {link['url']}")
        payload = resource_payload(
            model, link, check, matches[0] if matches else None,
            (existing or {}).get("type", "dataset"),
        )
        if check.get("status") != 200:
            issues.append(f"Source URL not verified (HTTP {check.get('status')}): {link['url']}")
        resources.append({"operation": "resource_patch" if matches else "resource_create", "payload": payload})
    if existing and not existing.get("resources"):
        issues.append("Existing package has no resources")
    extras = {item["key"]: item["value"] for item in (existing or {}).get("extras", [])}
    spatial = (existing or {}).get("spatial") or extras.get("spatial")
    if not spatial:
        issues.append("Dataset spatial coverage absent; source model footprint required")
    has_archive_variables = any(
        action["payload"].get("mint_standard_variables")
        for action in resources
        if action["payload"].get("resource_type") in ("model_archive", "predictive_archive")
    )
    issues.append("Simulation period, length/time units and vertical datum require evidence")
    if not has_archive_variables:
        issues.append("Model-archive variable bindings require evidence")
    issues.append("License/usage terms need verification before publication")
    return {
        "model_code": model["code"], "package_name": name,
        "package_id": (existing or {}).get("id"), "operation": "package_patch" if existing else "package_create",
        "source": model, "resource_actions": resources,
        "preserved_existing_resource_ids": [r["id"] for r in (existing or {}).get("resources", [])],
        "package_payload": package_payload(model, existing, evidence, checked_at),
        "issues": issues,
    }


def dump(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def audit(output):
    output.mkdir(parents=True, exist_ok=True)
    html, _, _, _ = fetch(SOURCE)
    (output / "twdb-downloads.html").write_bytes(html)
    models = parse_inventory(html.decode("utf-8", errors="replace"))
    packages, start = [], 0
    while True:
        page = action("package_search", fq=f"organization:{ORG}", rows=1000, start=start)
        packages.extend(page["results"])
        if len(packages) >= page["count"]:
            break
        if not page["results"]:
            raise ValueError("Incomplete CKAN pagination")
        start = len(packages)
    dump(output / "ckan-packages-before.json", packages)
    schemas = {kind: action("scheming_dataset_schema_show", type=kind) for kind in ("dataset", "subside_dataset", "mint_dataset")}
    dump(output / "ckan-schemas.json", schemas)
    urls = sorted({r["url"] for m in models for r in m["resources"]})
    with ThreadPoolExecutor(max_workers=8) as pool:
        checks = dict(zip(urls, pool.map(probe, urls)))
    dump(output / "source-url-checks.json", checks)
    pages = sorted({m["source_page"] for m in models})
    with ThreadPoolExecutor(max_workers=6) as pool:
        evidence = dict(zip(pages, pool.map(page_evidence, pages)))
    dump(output / "model-page-evidence.json", evidence)
    checked_at = datetime.now(timezone.utc).isoformat()
    plans = [build_proposal(m, match_package(m, packages), checks, evidence[m["source_page"]], checked_at) for m in models]
    matched = {p["package_id"] for p in plans}
    audit_result = {
        "checked_at": checked_at, "source": SOURCE, "ckan": CKAN, "organization": ORG,
        "summary": {"source_models": len(models), "existing_organization_packages": len(packages),
                    "matched_packages": sum(p["package_id"] is not None for p in plans),
                    "new_packages": sum(p["package_id"] is None for p in plans),
                    "source_resources": sum(len(p["resource_actions"]) for p in plans),
                    "unreachable_source_urls": sum(v.get("status") != 200 for v in checks.values())},
        "plans": plans,
        "unmatched_existing_packages": [{"name": p["name"], "id": p["id"], "resources": len(p.get("resources", []))} for p in packages if p["id"] not in matched],
        "write_status": "No CKAN mutations performed",
    }
    dump(output / "reconciliation-plan.json", audit_result)
    print(json.dumps(audit_result["summary"], indent=2))
    print("Evidence and proposals:", output)
    return audit_result


def read_dotenv(path):
    values = {}
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


def get_token(credentials_file=None):
    configured = os.environ.get("CKAN_API_TOKEN")
    if configured:
        return configured
    values = read_dotenv(credentials_file) if credentials_file else os.environ
    username = values.get("TAPIS_USERNAME")
    password = values.get("TAPIS_PASSWORD")
    if not username or not password:
        raise ValueError("Set CKAN_API_TOKEN or provide TAPIS_USERNAME/TAPIS_PASSWORD")
    body = json.dumps({"username": username, "password": password, "grant_type": "password"}).encode("utf-8")
    data, _, _, _ = fetch(TAPIS_TOKEN_URL, method="POST", body=body, headers={"Content-Type": "application/json"})
    envelope = json.loads(data)
    try:
        return envelope["result"]["access_token"]["access_token"]
    except (KeyError, TypeError) as exc:
        raise ValueError("Tapis token response did not contain an access token") from exc


def save_log(path, value):
    temporary = path.with_suffix(path.suffix + ".tmp")
    dump(temporary, value)
    temporary.replace(path)


def apply_plan(plan, output, token):
    """Apply one deterministic package at a time and persist every returned ID."""
    log = {
        "started_at": datetime.now(timezone.utc).isoformat(),
        "source_checked_at": plan["checked_at"],
        "actions": [],
        "status": "running",
    }
    log_path = output / "ckan-write-log.json"
    save_log(log_path, log)
    for package_plan in plan["plans"]:
        package_action = package_plan["operation"]
        payload = dict(package_plan["package_payload"])
        if package_action == "package_patch":
            current = action("package_show", id=package_plan["package_id"])
            if current.get("id") != package_plan["package_id"]:
                raise ValueError(f"Package identity drift for {package_plan['package_name']}")
        result = post_action(package_action, payload, token)
        package_id = result["id"]
        log["actions"].append({"action": package_action, "id": package_id, "name": result["name"], "status": "success"})
        save_log(log_path, log)

        # Re-resolve by URL after the package mutation so interrupted reruns are additive.
        current = action("package_show", id=package_id)
        by_url = {canonical_url(r.get("url")): r for r in current.get("resources", [])}
        for resource_plan in package_plan["resource_actions"]:
            resource_payload_value = dict(resource_plan["payload"])
            matched = by_url.get(canonical_url(resource_payload_value["url"]))
            if matched:
                resource_action = "resource_patch"
                resource_payload_value["id"] = matched["id"]
            else:
                resource_action = "resource_create"
                resource_payload_value.pop("id", None)
                resource_payload_value["package_id"] = package_id
            resource_result = post_action(resource_action, resource_payload_value, token)
            by_url[canonical_url(resource_result["url"])] = resource_result
            log["actions"].append({
                "action": resource_action, "id": resource_result["id"],
                "package_id": package_id, "url": resource_result["url"], "status": "success",
            })
            save_log(log_path, log)
            time.sleep(0.05)
    log["completed_at"] = datetime.now(timezone.utc).isoformat()
    log["status"] = "complete"
    save_log(log_path, log)
    return log


def verify(output, expected_plan):
    packages = []
    result = action("package_search", fq=f"organization:{ORG}", rows=1000, start=0)
    packages.extend(result["results"])
    by_name = {p["name"]: p for p in packages}
    checks = []
    for item in expected_plan["plans"]:
        name = item["package_payload"].get("name") or item["package_name"]
        package = by_name.get(name)
        expected_urls = {canonical_url(x["payload"]["url"]) for x in item["resource_actions"]}
        actual_urls = {canonical_url(x.get("url")) for x in (package or {}).get("resources", [])}
        checks.append({
            "name": name,
            "found": package is not None,
            "expected_source_resources": len(expected_urls),
            "missing_source_urls": sorted(expected_urls - actual_urls),
            "resource_count": len((package or {}).get("resources", [])),
        })
    report = {
        "verified_at": datetime.now(timezone.utc).isoformat(),
        "organization_package_count": len(packages),
        "expected_model_count": len(expected_plan["plans"]),
        "all_packages_found": all(c["found"] for c in checks),
        "all_source_urls_registered": all(not c["missing_source_urls"] for c in checks),
        "packages": checks,
    }
    dump(output / "ckan-readback-verification.json", report)
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--apply", action="store_true", help="Perform the approved CKAN writes")
    parser.add_argument("--yes", action="store_true", help="Required non-interactive confirmation for --apply")
    parser.add_argument("--credentials-file", type=Path, help="Dotenv containing TAPIS_USERNAME and TAPIS_PASSWORD")
    args = parser.parse_args()
    if args.apply and not args.yes:
        parser.error("--apply requires --yes after explicit user approval")
    result = audit(args.output)
    if args.apply:
        if result["summary"]["unreachable_source_urls"]:
            raise SystemExit("Refusing writes because one or more TWDB source URLs are unreachable")
        token = get_token(args.credentials_file)
        try:
            write_log = apply_plan(result, args.output, token)
            report = verify(args.output, result)
        finally:
            token = None
        print(json.dumps({
            "write_actions": len(write_log["actions"]),
            "write_status": write_log["status"],
            "all_packages_found": report["all_packages_found"],
            "all_source_urls_registered": report["all_source_urls_registered"],
        }, indent=2))
        if not report["all_packages_found"] or not report["all_source_urls_registered"]:
            sys.exit(2)
