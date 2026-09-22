import importlib.util
import json
from pathlib import Path
import unittest


SCRIPT = Path(__file__).parents[1] / "scripts" / "reconcile_twdb_gams.py"
SPEC = importlib.util.spec_from_file_location("reconcile_twdb_gams", SCRIPT)
reconcile = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(reconcile)


def row(title, page, archive, *, cells=6):
    values = [
        f'<td><a href="{page}">{title}</a></td>',
        f'<td><a href="{archive}">Model</a></td>',
        '<td><a href="https://example.test/grid.zip">Model grid</a></td>',
        '<td><a href="https://example.test/properties.7z">GAM Properties</a></td>',
        '<td><a href="https://example.test/report.pdf">Report</a></td>',
        '<td></td>',
    ]
    return "<tr>" + "".join(values[:cells]) + "</tr>"


class InventoryTests(unittest.TestCase):
    def test_parses_five_and_six_cell_rows(self):
        html = "<table>" + row(
            "Regular GAM", "/groundwater/models/gam/test/test.asp",
            "https://gw-models.s3.amazonaws.com/Download_GAMs/test/test.zip",
        ) + row(
            "Northern Trinity GAM", "/groundwater/models/gam/trnt_n/trnt_n.asp",
            "https://gw-models.s3.amazonaws.com/Download_GAMs/trnt_n/model.7z", cells=5,
        ) + "</table>"
        models = reconcile.parse_inventory(html)
        self.assertEqual([model["code"] for model in models], ["test", "trnt_n"])
        self.assertEqual(len(models[1]["resources"]), 4)

    def test_hueco_and_mesilla_have_distinct_ids(self):
        html = "<table>" + row(
            "Hueco Bolsons", "/groundwater/models/gam/hmbl/hmbl.asp",
            "https://gw-models.s3.amazonaws.com/Download_GAMs/hmbl/Hueco_Bolson_Model_Only.zip",
        ) + row(
            "Mesilla Bolsons", "/groundwater/models/gam/hmbl/hmbl.asp",
            "https://gw-models.s3.amazonaws.com/Download_GAMs/hmbl/Mesilla_Bolson_Model_Only.zip",
        ) + "</table>"
        self.assertEqual(
            [model["code"] for model in reconcile.parse_inventory(html)],
            ["hmbl-hueco", "hmbl-mesilla"],
        )

    def test_source_spaces_are_percent_encoded(self):
        self.assertEqual(
            reconcile.safe_url("https://example.test/a report.pdf"),
            "https://example.test/a%20report.pdf",
        )


class PayloadTests(unittest.TestCase):
    def setUp(self):
        self.model = {
            "code": "symr",
            "title": "Seymour and Blaine GAM",
            "category": "GAM",
            "source_page": "https://example.test/symr.asp",
            "archive_url": "https://example.test/model.zip",
            "resources": [],
        }
        self.evidence = {
            "relevant_text": [
                "Current GAM: Seymour and Blaine (v2.01)",
                "The model was coded using MODFLOW 6 software.",
            ]
        }

    def test_package_payload_removes_unsupported_generated_claims(self):
        existing = {
            "id": "package-id",
            "extras": [
                {"key": "esipfed_known_bias", "value": "false"},
                {"key": "aquifer", "value": "Seymour; Blaine"},
            ],
            "resources": [],
        }
        payload = reconcile.package_payload(self.model, existing, self.evidence, "2026-09-19T00:00:00+00:00")
        extras = {item["key"]: item["value"] for item in payload["extras"]}
        self.assertNotIn("esipfed_known_bias", extras)
        self.assertEqual(extras["aquifer"], "Seymour; Blaine")
        self.assertEqual(extras["model_engine"], "MODFLOW 6")
        self.assertEqual(payload["version"], "2.01")
        self.assertEqual(payload["license_id"], "notspecified")

    def test_archive_resource_has_no_variable_binding(self):
        link = {
            "kind": "model_archive",
            "label": "Model",
            "url": "https://example.test/model.zip",
            "source_cell": "Model",
        }
        payload = reconcile.resource_payload(self.model, link, {"status": 200, "size": 10})
        self.assertNotIn("mint_standard_variables", payload)
        self.assertEqual(payload["data_role"], "model-input-bundle")
        self.assertEqual(payload["requires_extraction"], "true")

    def test_existing_archive_keeps_reviewed_variables_and_drops_resource_spatial(self):
        link = {
            "kind": "model_archive",
            "label": "Model",
            "url": "https://example.test/model.zip",
            "source_cell": "Model",
        }
        existing = {
            "id": "resource-id",
            "mint_standard_variables": "groundwater__hydraulic_head",
            "spatial": {"type": "Polygon", "coordinates": []},
        }
        payload = reconcile.resource_payload(
            self.model, link, {"status": 200, "size": 10}, existing,
        )
        self.assertEqual(payload["mint_standard_variables"], "groundwater__hydraulic_head")
        self.assertEqual(payload["resource_type"], "model_archive")
        self.assertEqual(payload["spatial"], "")

    def test_package_promotes_one_shared_resource_geometry(self):
        spatial = {"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 0]]]}
        existing = {
            "id": "package-id",
            "name": "existing-package",
            "type": "dataset",
            "resources": [{"id": "one", "spatial": spatial}, {"id": "two", "spatial": spatial}],
            "extras": [],
        }
        payload = reconcile.package_payload(
            self.model, existing, self.evidence, "2026-09-19T00:00:00+00:00",
        )
        self.assertEqual(json.loads(payload["spatial"]), spatial)

    def test_exact_url_match_preserves_resource_id(self):
        link = {
            "kind": "model_archive",
            "label": "Model",
            "url": "https://example.test/model.zip",
            "source_cell": "Model",
        }
        self.model["resources"] = [link]
        existing = {
            "id": "package-id",
            "name": "existing-package",
            "type": "dataset",
            "resources": [{"id": "resource-id", "url": "http://example.test/model.zip"}],
            "extras": [],
        }
        proposal = reconcile.build_proposal(
            self.model, existing, {link["url"]: {"status": 200}}, self.evidence,
            "2026-09-19T00:00:00+00:00",
        )
        action = proposal["resource_actions"][0]
        self.assertEqual(action["operation"], "resource_patch")
        self.assertEqual(action["payload"]["id"], "resource-id")
        self.assertEqual(proposal["preserved_existing_resource_ids"], ["resource-id"])


if __name__ == "__main__":
    unittest.main()
