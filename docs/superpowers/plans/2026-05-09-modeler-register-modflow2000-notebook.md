# Modeler MODFLOW-2000 Nested Registration Notebook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a runnable Jupyter notebook (`dynamo-experiment-may/01_minimal_modeler_register_modflow2000.ipynb`) that logs into Tapis with username/password, registers a complete MODFLOW-2000 entry (Software → SoftwareVersion → ModelConfiguration → DataSetSpecifications → VariablePresentations) in one nested POST to MINT v2.0.0 API, and verifies persistence.

**Architecture:** Single-file `.ipynb` written as JSON via `Write` tool (no `nbformat` dependency). 7 cells, top-to-bottom: title, config, login, bundle description, POST + capture id, GET read-back + walk tree, bare-slug VP GET. Auth uses Tapis `portals` tenant password grant; bearer forwarded to MINT API. IDs server-minted; bare slugs only for GET paths.

**Tech Stack:** Python 3, `requests`, `getpass`, Jupyter notebook (nbformat v4 JSON), MINT model-catalog-api v2.0.0, Tapis OAuth2.

**Spec:** `docs/superpowers/specs/2026-05-09-modeler-register-modflow2000-notebook-design.md`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `dynamo-experiment-may/01_minimal_modeler_register_modflow2000.ipynb` | The notebook itself. 7 cells. Self-contained. |
| `dynamo-experiment-may/tests/test_notebook_structure.py` | Smoke test: load notebook JSON, assert cell count + cell content invariants (no leaked tokens, correct base URL, no nested-slash slugs in payload). |

No other files touched. No source-code changes (the notebook exercises an already-shipped API).

---

## Task 1: Create notebook scaffold (cells 1-2: title + config)

**Files:**
- Create: `dynamo-experiment-may/01_minimal_modeler_register_modflow2000.ipynb`

- [ ] **Step 1: Write the failing test**

Create `dynamo-experiment-may/tests/test_notebook_structure.py`:

```python
import json
from pathlib import Path

NOTEBOOK = Path(__file__).resolve().parents[1] / "01_minimal_modeler_register_modflow2000.ipynb"


def load_notebook() -> dict:
    with NOTEBOOK.open() as fh:
        return json.load(fh)


def cell_sources() -> list[str]:
    nb = load_notebook()
    return ["".join(cell["source"]) for cell in nb["cells"]]


def test_notebook_exists():
    assert NOTEBOOK.exists(), f"notebook missing at {NOTEBOOK}"


def test_notebook_is_valid_nbformat_v4():
    nb = load_notebook()
    assert nb["nbformat"] == 4
    assert nb["nbformat_minor"] >= 5
    assert isinstance(nb["cells"], list)


def test_notebook_has_seven_cells():
    nb = load_notebook()
    assert len(nb["cells"]) == 7, f"expected 7 cells, got {len(nb['cells'])}"


def test_first_cell_is_title_markdown():
    nb = load_notebook()
    first = nb["cells"][0]
    assert first["cell_type"] == "markdown"
    src = "".join(first["source"])
    assert "MODFLOW-2000" in src
    assert "Register" in src or "register" in src


def test_config_cell_uses_local_base_url():
    src = cell_sources()[1]
    assert 'BASE_URL = "http://api.models.mint.local"' in src
    assert 'API_PREFIX = "/v2.0.0"' in src
    assert 'TAPIS_BASE = "https://portals.tapis.io"' in src


def test_no_hardcoded_bearer_token():
    for src in cell_sources():
        assert "eyJhbGciOi" not in src, "hardcoded JWT leaked into notebook"
        assert "API_TOKEN =" not in src, "static API_TOKEN constant present"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/mosorio/repos/mint/dynamo-experiment-may
mkdir -p tests
# (test file from step 1 already created)
python3 -m pytest tests/test_notebook_structure.py -v
```

Expected: all tests fail with "notebook missing" (FileNotFoundError) or collection error on first test.

- [ ] **Step 3: Create notebook with cells 1-2**

Write `dynamo-experiment-may/01_minimal_modeler_register_modflow2000.ipynb`:

```json
{
  "cells": [
    {
      "cell_type": "markdown",
      "id": "cell-title",
      "metadata": {},
      "source": [
        "# Register MODFLOW-2000 in One Nested POST\n",
        "\n",
        "Minimal modeler workflow:\n",
        "\n",
        "1. Log in to Tapis (portals tenant) with username + password.\n",
        "2. POST a fully nested Software bundle to the MINT v2.0.0 Model Catalog API: Software → SoftwareVersion → ModelConfiguration → DataSetSpecifications → VariablePresentations.\n",
        "3. Read the bundle back to verify persistence.\n",
        "4. Demonstrate bare-slug GET on `/variablepresentations/{slug}`.\n",
        "\n",
        "**Prerequisites:**\n",
        "- Local MINT stack reachable at `http://api.models.mint.local`.\n",
        "- `Hydrology` model category seeded in the catalog.\n",
        "- Tapis credentials for the `portals` tenant. Set `TAPIS_USERNAME` / `TAPIS_PASSWORD` env vars or enter at prompt."
      ]
    },
    {
      "cell_type": "code",
      "execution_count": null,
      "id": "cell-config",
      "metadata": {},
      "outputs": [],
      "source": [
        "import json\n",
        "import os\n",
        "from getpass import getpass\n",
        "\n",
        "import requests\n",
        "\n",
        "requests.packages.urllib3.disable_warnings()\n",
        "\n",
        "BASE_URL = \"http://api.models.mint.local\"\n",
        "API_PREFIX = \"/v2.0.0\"\n",
        "API_ROOT = BASE_URL.rstrip(\"/\") + API_PREFIX\n",
        "\n",
        "TAPIS_BASE = \"https://portals.tapis.io\"\n",
        "TAPIS_TENANT = \"portals\"\n",
        "\n",
        "VERIFY_SSL = False\n",
        "TIMEOUT = 60\n",
        "\n",
        "print(\"API_ROOT:\", API_ROOT)\n",
        "print(\"TAPIS_BASE:\", TAPIS_BASE)"
      ]
    }
  ],
  "metadata": {
    "kernelspec": {
      "display_name": "Python 3",
      "language": "python",
      "name": "python3"
    },
    "language_info": {
      "name": "python",
      "version": "3.11"
    }
  },
  "nbformat": 4,
  "nbformat_minor": 5
}
```

Note: only 2 cells exist for now. Subsequent tasks append cells. Tests for "7 cells" + later content remain failing — that is expected at this stage.

- [ ] **Step 4: Run partial tests to confirm scaffolding works**

```bash
python3 -m pytest tests/test_notebook_structure.py::test_notebook_exists tests/test_notebook_structure.py::test_notebook_is_valid_nbformat_v4 tests/test_notebook_structure.py::test_first_cell_is_title_markdown tests/test_notebook_structure.py::test_config_cell_uses_local_base_url tests/test_notebook_structure.py::test_no_hardcoded_bearer_token -v
```

Expected: all 5 pass. `test_notebook_has_seven_cells` still fails (only 2 cells).

- [ ] **Step 5: Commit**

```bash
git add dynamo-experiment-may/01_minimal_modeler_register_modflow2000.ipynb dynamo-experiment-may/tests/test_notebook_structure.py
git commit -m "feat(notebook): scaffold modeler MODFLOW-2000 registration notebook with config cell"
```

---

## Task 2: Add login cell (cell 3)

**Files:**
- Modify: `dynamo-experiment-may/01_minimal_modeler_register_modflow2000.ipynb`
- Modify: `dynamo-experiment-may/tests/test_notebook_structure.py`

- [ ] **Step 1: Write failing test**

Append to `tests/test_notebook_structure.py`:

```python
def test_login_cell_uses_password_grant():
    src = cell_sources()[2]
    assert "/v3/oauth2/tokens" in src
    assert '"grant_type": "password"' in src
    assert "TAPIS_USERNAME" in src
    assert "TAPIS_PASSWORD" in src
    assert "getpass" in src
    assert 'Authorization": f"Bearer {token}"' in src
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python3 -m pytest tests/test_notebook_structure.py::test_login_cell_uses_password_grant -v
```

Expected: FAIL — only 2 cells exist, IndexError on `cell_sources()[2]`.

- [ ] **Step 3: Append login cell to notebook**

Edit `01_minimal_modeler_register_modflow2000.ipynb`. Insert this cell as the new third cell (index 2), before the closing `]` of the `cells` array:

```json
    ,
    {
      "cell_type": "code",
      "execution_count": null,
      "id": "cell-login",
      "metadata": {},
      "outputs": [],
      "source": [
        "def get_tapis_token(username: str, password: str) -> str:\n",
        "    r = requests.post(\n",
        "        f\"{TAPIS_BASE}/v3/oauth2/tokens\",\n",
        "        json={\"username\": username, \"password\": password, \"grant_type\": \"password\"},\n",
        "        timeout=TIMEOUT,\n",
        "        verify=True,\n",
        "    )\n",
        "    r.raise_for_status()\n",
        "    return r.json()[\"result\"][\"access_token\"][\"access_token\"]\n",
        "\n",
        "username = os.environ.get(\"TAPIS_USERNAME\", \"\").strip() or input(\"Tapis username: \").strip()\n",
        "password = os.environ.get(\"TAPIS_PASSWORD\", \"\") or getpass(\"Tapis password: \")\n",
        "token = get_tapis_token(username, password)\n",
        "\n",
        "headers = {\n",
        "    \"Accept\": \"application/json\",\n",
        "    \"Content-Type\": \"application/json\",\n",
        "    \"Authorization\": f\"Bearer {token}\",\n",
        "}\n",
        "print(f\"Authenticated as {username}\")"
      ]
    }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
python3 -m pytest tests/test_notebook_structure.py::test_login_cell_uses_password_grant tests/test_notebook_structure.py::test_no_hardcoded_bearer_token -v
```

Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add dynamo-experiment-may/01_minimal_modeler_register_modflow2000.ipynb dynamo-experiment-may/tests/test_notebook_structure.py
git commit -m "feat(notebook): add Tapis password-grant login cell"
```

---

## Task 3: Add bundle-description markdown cell (cell 4)

**Files:**
- Modify: `dynamo-experiment-may/01_minimal_modeler_register_modflow2000.ipynb`
- Modify: `dynamo-experiment-may/tests/test_notebook_structure.py`

- [ ] **Step 1: Write failing test**

Append to `tests/test_notebook_structure.py`:

```python
def test_bundle_description_cell_is_markdown():
    nb = load_notebook()
    cell = nb["cells"][3]
    assert cell["cell_type"] == "markdown"
    src = "".join(cell["source"])
    assert "Software" in src
    assert "SoftwareVersion" in src
    assert "ModelConfiguration" in src
    assert "DataSetSpecification" in src
    assert "VariablePresentation" in src
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python3 -m pytest tests/test_notebook_structure.py::test_bundle_description_cell_is_markdown -v
```

Expected: FAIL — only 3 cells exist.

- [ ] **Step 3: Append markdown cell after login cell**

Insert as cell index 3:

```json
    ,
    {
      "cell_type": "markdown",
      "id": "cell-bundle-doc",
      "metadata": {},
      "source": [
        "## Nested bundle\n",
        "\n",
        "One POST to `/software` creates the entire tree:\n",
        "\n",
        "- **Software** (MODFLOW-2000)\n",
        "  - `hasVersion` → **SoftwareVersion** (MF2000)\n",
        "    - `hasConfiguration` → **ModelConfiguration** (default)\n",
        "      - `hasInput` → **DataSetSpecification** × 2 → each with **VariablePresentation**\n",
        "      - `hasOutput` → **DataSetSpecification** × 3 → each with **VariablePresentation**\n",
        "\n",
        "No `id` fields are passed; the server mints them. Slugs in `hasShortName` use `-` separators (e.g. `hydraulic-head`)."
      ]
    }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
python3 -m pytest tests/test_notebook_structure.py::test_bundle_description_cell_is_markdown -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add dynamo-experiment-may/01_minimal_modeler_register_modflow2000.ipynb dynamo-experiment-may/tests/test_notebook_structure.py
git commit -m "docs(notebook): add nested bundle description cell"
```

---

## Task 4: Add nested POST cell (cell 5)

**Files:**
- Modify: `dynamo-experiment-may/01_minimal_modeler_register_modflow2000.ipynb`
- Modify: `dynamo-experiment-may/tests/test_notebook_structure.py`

- [ ] **Step 1: Write failing tests**

Append:

```python
def test_post_cell_builds_full_nested_bundle():
    src = cell_sources()[4]
    # No ids passed
    assert '"id":' not in src or src.count('"id":') == 1, "ids should not be present in payload (only Hydrology category ref)"
    # Hierarchy keys present
    for key in ("hasVersion", "hasConfiguration", "hasInput", "hasOutput", "hasPresentation"):
        assert key in src, f"missing relation key: {key}"
    # 5 short names: 2 inputs + 3 outputs
    for slug in ("namefile", "package-inputs", "hydraulic-head", "cell-budget", "drawdown"):
        assert f'"{slug}"' in src, f"missing slug: {slug}"
    # No nested-slash slugs
    assert "model/modflow-2000/variable-presentation" not in src
    # POST to /software
    assert 'f"{API_ROOT}/software"' in src
    assert "requests.post(" in src
    # Captures software_id
    assert "software_id = created[\"id\"]" in src


def test_post_cell_uses_hydrology_category_reference():
    src = cell_sources()[4]
    assert 'https://w3id.org/okn/i/mint/Hydrology' in src
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python3 -m pytest tests/test_notebook_structure.py::test_post_cell_builds_full_nested_bundle tests/test_notebook_structure.py::test_post_cell_uses_hydrology_category_reference -v
```

Expected: FAIL — only 4 cells.

- [ ] **Step 3: Append POST cell**

Insert as cell index 4:

```json
    ,
    {
      "cell_type": "code",
      "execution_count": null,
      "id": "cell-post-bundle",
      "metadata": {},
      "outputs": [],
      "source": [
        "bundle = {\n",
        "    \"type\": [\"Software\"],\n",
        "    \"label\": [\"MODFLOW-2000\"],\n",
        "    \"description\": [\"MODFLOW-2000 groundwater flow model for Tapis batch simulation.\"],\n",
        "    \"hasModelCategory\": [{\"id\": \"https://w3id.org/okn/i/mint/Hydrology\"}],\n",
        "    \"hasVersion\": [{\n",
        "        \"type\": [\"SoftwareVersion\"],\n",
        "        \"label\": [\"MODFLOW-2000 MF2000\"],\n",
        "        \"description\": [\"Runtime config version for Tapis app deployment.\"],\n",
        "        \"hasConfiguration\": [{\n",
        "            \"type\": [\"ModelConfiguration\"],\n",
        "            \"label\": [\"MODFLOW-2000 default configuration\"],\n",
        "            \"description\": [\"Default MF2000 configuration for Yegua-Jackson.\"],\n",
        "            \"hasInput\": [\n",
        "                {\n",
        "                    \"type\": [\"DataSetSpecification\"],\n",
        "                    \"label\": [\"MODFLOW name file\"],\n",
        "                    \"hasPresentation\": [{\n",
        "                        \"type\": [\"VariablePresentation\"],\n",
        "                        \"label\": [\"MODFLOW namefile presentation\"],\n",
        "                        \"hasLongName\": [\"MODFLOW name file\"],\n",
        "                        \"hasShortName\": [\"namefile\"],\n",
        "                    }],\n",
        "                },\n",
        "                {\n",
        "                    \"type\": [\"DataSetSpecification\"],\n",
        "                    \"label\": [\"MODFLOW package inputs\"],\n",
        "                    \"hasPresentation\": [{\n",
        "                        \"type\": [\"VariablePresentation\"],\n",
        "                        \"label\": [\"MODFLOW package inputs presentation\"],\n",
        "                        \"hasLongName\": [\"MODFLOW package inputs\"],\n",
        "                        \"hasShortName\": [\"package-inputs\"],\n",
        "                    }],\n",
        "                },\n",
        "            ],\n",
        "            \"hasOutput\": [\n",
        "                {\n",
        "                    \"type\": [\"DataSetSpecification\"],\n",
        "                    \"label\": [\"Hydraulic head output\"],\n",
        "                    \"hasPresentation\": [{\n",
        "                        \"type\": [\"VariablePresentation\"],\n",
        "                        \"label\": [\"Hydraulic head presentation\"],\n",
        "                        \"hasLongName\": [\"Groundwater hydraulic head\"],\n",
        "                        \"hasShortName\": [\"hydraulic-head\"],\n",
        "                    }],\n",
        "                },\n",
        "                {\n",
        "                    \"type\": [\"DataSetSpecification\"],\n",
        "                    \"label\": [\"Cell budget output\"],\n",
        "                    \"hasPresentation\": [{\n",
        "                        \"type\": [\"VariablePresentation\"],\n",
        "                        \"label\": [\"Cell budget presentation\"],\n",
        "                        \"hasLongName\": [\"Groundwater cell budget\"],\n",
        "                        \"hasShortName\": [\"cell-budget\"],\n",
        "                    }],\n",
        "                },\n",
        "                {\n",
        "                    \"type\": [\"DataSetSpecification\"],\n",
        "                    \"label\": [\"Drawdown output\"],\n",
        "                    \"hasPresentation\": [{\n",
        "                        \"type\": [\"VariablePresentation\"],\n",
        "                        \"label\": [\"Drawdown presentation\"],\n",
        "                        \"hasLongName\": [\"Groundwater drawdown\"],\n",
        "                        \"hasShortName\": [\"drawdown\"],\n",
        "                    }],\n",
        "                },\n",
        "            ],\n",
        "        }],\n",
        "    }],\n",
        "}\n",
        "\n",
        "r = requests.post(\n",
        "    f\"{API_ROOT}/software\",\n",
        "    headers=headers,\n",
        "    json=bundle,\n",
        "    timeout=TIMEOUT,\n",
        "    verify=VERIFY_SSL,\n",
        ")\n",
        "print(\"POST\", f\"{API_ROOT}/software\", \"->\", r.status_code)\n",
        "r.raise_for_status()\n",
        "created = r.json()\n",
        "software_id = created[\"id\"]\n",
        "print(\"software_id:\", software_id)\n",
        "print(json.dumps(created, indent=2))"
      ]
    }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python3 -m pytest tests/test_notebook_structure.py -v
```

Expected: all tests except `test_notebook_has_seven_cells`, `test_bundle_description_cell_is_markdown` (cell index check still passes), and the read-back/VP tests (not yet written) pass.

Specifically these must PASS now: `test_post_cell_builds_full_nested_bundle`, `test_post_cell_uses_hydrology_category_reference`.

- [ ] **Step 5: Commit**

```bash
git add dynamo-experiment-may/01_minimal_modeler_register_modflow2000.ipynb dynamo-experiment-may/tests/test_notebook_structure.py
git commit -m "feat(notebook): add nested POST /software bundle cell"
```

---

## Task 5: Add read-back cell (cell 6)

**Files:**
- Modify: `dynamo-experiment-may/01_minimal_modeler_register_modflow2000.ipynb`
- Modify: `dynamo-experiment-may/tests/test_notebook_structure.py`

- [ ] **Step 1: Write failing test**

Append:

```python
def test_readback_cell_walks_tree():
    src = cell_sources()[5]
    assert 'requests.get(' in src
    assert 'f"{API_ROOT}/software/{software_id}"' in src
    assert 'software["hasVersion"][0]' in src
    assert 'version["hasConfiguration"][0]' in src
    assert 'config.get("hasInput"' in src
    assert 'config.get("hasOutput"' in src
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python3 -m pytest tests/test_notebook_structure.py::test_readback_cell_walks_tree -v
```

Expected: FAIL — only 5 cells.

- [ ] **Step 3: Append read-back cell**

Insert as cell index 5:

```json
    ,
    {
      "cell_type": "code",
      "execution_count": null,
      "id": "cell-readback",
      "metadata": {},
      "outputs": [],
      "source": [
        "r = requests.get(\n",
        "    f\"{API_ROOT}/software/{software_id}\",\n",
        "    headers=headers,\n",
        "    timeout=TIMEOUT,\n",
        "    verify=VERIFY_SSL,\n",
        ")\n",
        "r.raise_for_status()\n",
        "software = r.json()\n",
        "print(json.dumps(software, indent=2))\n",
        "\n",
        "version = software[\"hasVersion\"][0]\n",
        "config = version[\"hasConfiguration\"][0]\n",
        "print(f\"version_id: {version['id']}\")\n",
        "print(f\"config_id:  {config['id']}\")\n",
        "print(f\"inputs:     {len(config.get('hasInput', []))}\")\n",
        "print(f\"outputs:    {len(config.get('hasOutput', []))}\")"
      ]
    }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
python3 -m pytest tests/test_notebook_structure.py::test_readback_cell_walks_tree -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add dynamo-experiment-may/01_minimal_modeler_register_modflow2000.ipynb dynamo-experiment-may/tests/test_notebook_structure.py
git commit -m "feat(notebook): add read-back GET /software/{id} cell"
```

---

## Task 6: Add bare-slug VP GET cell (cell 7)

**Files:**
- Modify: `dynamo-experiment-may/01_minimal_modeler_register_modflow2000.ipynb`
- Modify: `dynamo-experiment-may/tests/test_notebook_structure.py`

- [ ] **Step 1: Write failing tests**

Append:

```python
def test_vp_cell_uses_bare_slug():
    src = cell_sources()[6]
    # Strip URI prefix to get bare slug
    assert 'rsplit("/", 1)[-1]' in src
    # GET path uses bare id directly (no urlencode of full IRI)
    assert 'f"{API_ROOT}/variablepresentations/{vp_id_bare}"' in src
    # No quote() or urlencode() of the full IRI
    assert "quote(" not in src
    assert "urlencode(" not in src


def test_all_seven_cells_present():
    nb = load_notebook()
    assert len(nb["cells"]) == 7
```

Also delete the earlier-failing assertion if redundant — but `test_notebook_has_seven_cells` from Task 1 covers it; this new test is extra explicit.

- [ ] **Step 2: Run tests to verify they fail**

```bash
python3 -m pytest tests/test_notebook_structure.py::test_vp_cell_uses_bare_slug tests/test_notebook_structure.py::test_all_seven_cells_present tests/test_notebook_structure.py::test_notebook_has_seven_cells -v
```

Expected: all 3 FAIL.

- [ ] **Step 3: Append VP cell**

Insert as cell index 6:

```json
    ,
    {
      "cell_type": "code",
      "execution_count": null,
      "id": "cell-vp-get",
      "metadata": {},
      "outputs": [],
      "source": [
        "vp = config[\"hasOutput\"][0][\"hasPresentation\"][0]\n",
        "vp_id_bare = vp[\"id\"].rsplit(\"/\", 1)[-1]\n",
        "vp_url = f\"{API_ROOT}/variablepresentations/{vp_id_bare}\"\n",
        "r = requests.get(vp_url, headers=headers, timeout=TIMEOUT, verify=VERIFY_SSL)\n",
        "print(\"GET\", vp_url, \"->\", r.status_code)\n",
        "print(r.text)"
      ]
    }
```

- [ ] **Step 4: Run full test suite to verify everything passes**

```bash
python3 -m pytest tests/test_notebook_structure.py -v
```

Expected: ALL tests PASS (count should be 11+).

- [ ] **Step 5: Validate notebook JSON parses cleanly**

```bash
python3 -c "import json; json.load(open('dynamo-experiment-may/01_minimal_modeler_register_modflow2000.ipynb')); print('valid JSON')"
```

Expected output: `valid JSON`

- [ ] **Step 6: Commit**

```bash
git add dynamo-experiment-may/01_minimal_modeler_register_modflow2000.ipynb dynamo-experiment-may/tests/test_notebook_structure.py
git commit -m "feat(notebook): add bare-slug GET /variablepresentations cell"
```

---

## Task 7: Smoke-execute notebook in headless kernel (optional but recommended)

**Files:**
- No new files. This is a runtime check, not a unit test (depends on local MINT stack).

- [ ] **Step 1: Check whether MINT stack is running locally**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://api.models.mint.local/v2.0.0/software 2>/dev/null || echo "stack not reachable"
```

If response is `200`, `401`, or `403`, stack is up. If `000` or "stack not reachable", skip remaining steps in this task — the notebook ships untested against live API and the modeler verifies on first run.

- [ ] **Step 2: If stack up, execute notebook headlessly**

```bash
cd /Users/mosorio/repos/mint
TAPIS_USERNAME=$TAPIS_USERNAME TAPIS_PASSWORD=$TAPIS_PASSWORD jupyter nbconvert \
  --to notebook --execute --inplace \
  --ExecutePreprocessor.timeout=120 \
  dynamo-experiment-may/01_minimal_modeler_register_modflow2000.ipynb
```

Expected: zero errors, all 7 cells produce output. POST returns 200 with server-minted ids; read-back shows `inputs: 2`, `outputs: 3`; bare-slug VP GET returns 200.

- [ ] **Step 3: If execution succeeded, revert any output-cell pollution**

The executed notebook has populated `outputs` arrays. Decide whether to keep (useful demo) or strip:

```bash
jupyter nbconvert --clear-output --inplace \
  dynamo-experiment-may/01_minimal_modeler_register_modflow2000.ipynb
```

(Stripping is cleaner for diff hygiene.)

- [ ] **Step 4: Re-run structure tests to confirm no regression**

```bash
python3 -m pytest dynamo-experiment-may/tests/test_notebook_structure.py -v
```

Expected: all tests PASS.

- [ ] **Step 5: Commit (if execution happened)**

```bash
git add dynamo-experiment-may/01_minimal_modeler_register_modflow2000.ipynb
git commit -m "test(notebook): verify modeler notebook executes end-to-end against local MINT"
```

(Skip if stack was unreachable in step 1.)

---

## Self-Review

**1. Spec coverage:**

| Spec section | Covered by |
|--------------|-----------|
| Goal: 4-step workflow (login, nested POST, read-back, bare-slug GET) | Tasks 2, 4, 5, 6 |
| Notebook structure table (7 cells) | Tasks 1-6 (one task per cell pair/cell) |
| Configuration constants | Task 1 (cell 2) |
| Login (Tapis password grant) | Task 2 (cell 3) |
| Nested bundle (full Software→VP tree) | Task 4 (cell 5) |
| Read-back walking the tree | Task 5 (cell 6) |
| Bare-id VP GET | Task 6 (cell 7) |
| ID convention (no nested `/`, server-minted) | Tasks 4, 6 (assertions in tests) |
| Success criteria | Task 7 (live execute, optional) |

No spec gaps.

**2. Placeholder scan:** No "TBD", "TODO", "implement later", or vague guidance. Every code cell is fully specified. Every test is fully specified.

**3. Type/name consistency:**
- `software_id` defined in Task 4 step 3, referenced in Task 5 step 3. Match.
- `headers`, `bundle`, `created`, `software`, `version`, `config`, `vp`, `vp_id_bare` all consistent across tasks.
- `API_ROOT`, `TIMEOUT`, `VERIFY_SSL` defined in Task 1, used in Tasks 2, 4, 5, 6. Match.
- Test helper `cell_sources()` defined in Task 1, used in Tasks 2-6. Match.
