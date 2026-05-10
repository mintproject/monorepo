# Modeler Notebook: Register MODFLOW-2000 in One Nested POST

**Date:** 2026-05-09
**Status:** Draft
**Audience:** MINT modelers
**Output:** `dynamo-experiment-may/01_minimal_modeler_register_modflow2000.ipynb`

## Goal

Give a modeler a minimal, runnable notebook that:

1. Logs into Tapis (portals tenant) with username + password.
2. Registers a complete MODFLOW-2000 model entry in the MINT v2.0.0 Model Catalog API in **one nested POST request** — Software, SoftwareVersion, ModelConfiguration, DataSetSpecifications, VariablePresentations.
3. Reads the bundle back to confirm everything persisted.
4. Demonstrates the correct ID convention: bare slugs in the URL path (no full IRIs, no nested `/` segments).

## Non-Goals

- Debug probes, retry/fallback logic, error-shape exploration. The existing `00_minimal_mint_model_debug_modflow2000_old.ipynb` covers that.
- Cleanup / DELETE.
- Model Setup tier (`ModelConfigurationSetup`) — not needed for initial registration.
- `hasModelCategory` lookup-or-create. Assumes `Hydrology` category exists.

## Background

### What the old notebook showed

The `_old` notebook is a debug repro: PUT `/models/{id}` with a flat rich payload returned 500 (`parsing Text failed, expected String, but encountered Array`) and dropped `hasInputVariable` / `hasOutputVariable` even on a successful minimal PUT. The diagnosis is upstream of this notebook (parser + relation persistence in legacy `/models` path).

### What changed

- **bug-089 nested POST/PUT** (just shipped, see `8389c63` and `5592285`): `model-catalog-api` now supports recursive nested writes via `Software > Version > Configuration > DataSetSpecification > VariablePresentation`. One request creates the whole tree.
- Server mints IDs when none are provided.
- Bare-slug GET (`/variablepresentations/cycles_threshold_temperature_for_cold_damage`) is the correct path; URL-encoded full IRIs are not.

## Design

### Notebook structure

7 cells, top → bottom:

| # | Type | Purpose |
|---|------|---------|
| 1 | Markdown | Title, intent, prerequisites |
| 2 | Code | Imports + config constants |
| 3 | Code | Tapis login (username/password → bearer) |
| 4 | Markdown | Bundle description |
| 5 | Code | Build nested bundle + POST `/software` |
| 6 | Code | GET `/software/{id}` read-back, walk tree |
| 7 | Code | Bare-id GET `/variablepresentations/{slug}` |

### Configuration (cell 2)

```python
import json
import os
from getpass import getpass
import requests

requests.packages.urllib3.disable_warnings()

BASE_URL = "http://api.models.mint.local"
API_PREFIX = "/v2.0.0"
API_ROOT = BASE_URL.rstrip("/") + API_PREFIX

TAPIS_BASE = "https://portals.tapis.io"
TAPIS_TENANT = "portals"

VERIFY_SSL = False  # local dev; MINT uses self-signed / no TLS
TIMEOUT = 60
```

### Login (cell 3)

```python
def get_tapis_token(username: str, password: str) -> str:
    r = requests.post(
        f"{TAPIS_BASE}/v3/oauth2/tokens",
        json={"username": username, "password": password, "grant_type": "password"},
        timeout=TIMEOUT,
        verify=True,
    )
    r.raise_for_status()
    return r.json()["result"]["access_token"]["access_token"]

username = os.environ.get("TAPIS_USERNAME", "").strip() or input("Tapis username: ").strip()
password = os.environ.get("TAPIS_PASSWORD", "") or getpass("Tapis password: ")
token = get_tapis_token(username, password)

headers = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Authorization": f"Bearer {token}",
}
print(f"Authenticated as {username}")
```

Auth flow matches `test_registered_apps.ipynb`. Bearer is forwarded by MINT API to Hasura for JWT validation.

### Nested bundle (cell 5)

```python
bundle = {
    "type": ["Software"],
    "label": ["MODFLOW-2000"],
    "description": ["MODFLOW-2000 groundwater flow model for Tapis batch simulation."],
    "hasModelCategory": [{"id": "https://w3id.org/okn/i/mint/Hydrology"}],
    "hasVersion": [{
        "type": ["SoftwareVersion"],
        "label": ["MODFLOW-2000 MF2000"],
        "description": ["Runtime config version for Tapis app deployment."],
        "hasConfiguration": [{
            "type": ["ModelConfiguration"],
            "label": ["MODFLOW-2000 default configuration"],
            "description": ["Default MF2000 configuration for Yegua-Jackson."],
            "hasInput": [
                {
                    "type": ["DataSetSpecification"],
                    "label": ["MODFLOW name file"],
                    "hasPresentation": [{
                        "type": ["VariablePresentation"],
                        "label": ["MODFLOW namefile presentation"],
                        "hasLongName": ["MODFLOW name file"],
                        "hasShortName": ["namefile"],
                    }],
                },
                {
                    "type": ["DataSetSpecification"],
                    "label": ["MODFLOW package inputs"],
                    "hasPresentation": [{
                        "type": ["VariablePresentation"],
                        "label": ["MODFLOW package inputs presentation"],
                        "hasLongName": ["MODFLOW package inputs"],
                        "hasShortName": ["package-inputs"],
                    }],
                },
            ],
            "hasOutput": [
                {
                    "type": ["DataSetSpecification"],
                    "label": ["Hydraulic head output"],
                    "hasPresentation": [{
                        "type": ["VariablePresentation"],
                        "label": ["Hydraulic head presentation"],
                        "hasLongName": ["Groundwater hydraulic head"],
                        "hasShortName": ["hydraulic-head"],
                    }],
                },
                {
                    "type": ["DataSetSpecification"],
                    "label": ["Cell budget output"],
                    "hasPresentation": [{
                        "type": ["VariablePresentation"],
                        "label": ["Cell budget presentation"],
                        "hasLongName": ["Groundwater cell budget"],
                        "hasShortName": ["cell-budget"],
                    }],
                },
                {
                    "type": ["DataSetSpecification"],
                    "label": ["Drawdown output"],
                    "hasPresentation": [{
                        "type": ["VariablePresentation"],
                        "label": ["Drawdown presentation"],
                        "hasLongName": ["Groundwater drawdown"],
                        "hasShortName": ["drawdown"],
                    }],
                },
            ],
        }],
    }],
}

r = requests.post(
    f"{API_ROOT}/software",
    headers=headers,
    json=bundle,
    timeout=TIMEOUT,
    verify=VERIFY_SSL,
)
print("POST", f"{API_ROOT}/software", "->", r.status_code)
r.raise_for_status()
created = r.json()
software_id = created["id"]
print("software_id:", software_id)
print(json.dumps(created, indent=2))
```

Conventions enforced:
- **No `id` fields** — server mints. Avoids the slug/IRI question entirely.
- **No nested URI paths** — `hasShortName` uses `-` as separator (e.g. `hydraulic-head`, not `hydraulic/head`).
- **Array-text shape** — `label: ["..."]` consistent with v2.0.0 ontology form.

### Read-back (cell 6)

```python
r = requests.get(
    f"{API_ROOT}/software/{software_id}",
    headers=headers,
    timeout=TIMEOUT,
    verify=VERIFY_SSL,
)
r.raise_for_status()
software = r.json()
print(json.dumps(software, indent=2))

version = software["hasVersion"][0]
config = version["hasConfiguration"][0]
print(f"version_id: {version['id']}")
print(f"config_id:  {config['id']}")
print(f"inputs:     {len(config.get('hasInput', []))}")
print(f"outputs:    {len(config.get('hasOutput', []))}")
```

Asserts the whole tree round-trips.

### Bare-id VP GET (cell 7)

```python
vp = config["hasOutput"][0]["hasPresentation"][0]
vp_id_bare = vp["id"].rsplit("/", 1)[-1]   # bare slug only
vp_url = f"{API_ROOT}/variablepresentations/{vp_id_bare}"
r = requests.get(vp_url, headers=headers, timeout=TIMEOUT, verify=VERIFY_SSL)
print("GET", vp_url, "->", r.status_code)
print(r.text)
```

Demonstrates the correct ID convention: pull bare slug from the returned IRI, GET without urlencoding the full IRI.

## ID Convention Summary

| Old (broken) | New |
|--------------|-----|
| `https://w3id.org/okn/i/mint/wmobley/model/modflow-2000/variable-presentation/hydraulic-head` (nested `/`) | `hydraulic-head` (flat slug) |
| `GET /variablepresentations/<urlencoded-full-IRI>` | `GET /variablepresentations/{bare-slug}` |
| Modeler builds & passes `id` | Server mints `id`; modeler captures from response |

## Risks

- **Array-text payload shape may still 500** on the new nested endpoint if bug-089 didn't fully address it. Mitigation: read-back cell will reveal which fields dropped; falls back to scalar-string variant on report.
- **`hasModelCategory` reference fails** if `Hydrology` category not seeded. Documented as prereq in cell 1.
- **Local stack must be running** (`api.models.mint.local` resolves to local Hasura + API). Modeler responsibility.
- **Tapis bearer must validate** against MINT Hasura JWT config in local dev. May need matching public key / shared secret.

## Open Items

- Re-run produces duplicates (server-generated ids → no upsert). Accept for v1.
- No category lookup-or-create. Accept for v1.

## Success Criteria

- `POST /software` returns 200 + JSON with server-minted `id`.
- `GET /software/{id}` returns 200 with `hasVersion[0].hasConfiguration[0].hasInput` (length 2) and `hasOutput` (length 3) populated.
- `GET /variablepresentations/{bare-slug}` returns 200 with the VP body.
- All cells run top-to-bottom on a fresh kernel without manual edits, given env vars `TAPIS_USERNAME` and `TAPIS_PASSWORD`.
