import importlib.util
from pathlib import Path
import unittest


SCRIPT = Path(__file__).parents[1] / "scripts" / "reconcile_ckan_svos.py"
SPEC = importlib.util.spec_from_file_location("reconcile_ckan_svos", SCRIPT)
reconcile = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(reconcile)


def package(package_id, name, variables, resources=None, extras=None):
    return {
        "id": package_id,
        "name": name,
        "type": "dataset",
        "mint_standard_variables": variables,
        "spatial": "",
        "extras": extras or [],
        "resources": resources or [],
    }


class ReconciliationPlanTests(unittest.TestCase):
    def setUp(self):
        self.packages = []
        for entry in reconcile.TWDB_GAM_MANIFEST["archives"]:
            self.packages.append(package(
                entry["package_id"], entry["package_name"], [], [{
                    "id": entry["primary_resource_id"],
                    "name": entry["resource_name"],
                    "url": entry["archive_url"],
                    "mint_standard_variables": "",
                    "resource_type": None,
                }],
            ))

        resources = []
        for resource_id, values in reconcile.RESOURCE_CORRECTIONS.items():
            name, old_format, old_svo, _, _ = values
            resources.append({
                "id": resource_id,
                "name": name,
                "format": old_format,
                "mint_standard_variables": old_svo,
            })
        self.packages.append(package(
            reconcile.CAPITAN_PACKAGE_ID,
            reconcile.CAPITAN_PACKAGE_NAME,
            [],
            resources,
        ))

    def test_manifest_is_complete_and_concrete(self):
        self.assertEqual(len(reconcile.TWDB_GAM_MANIFEST["archives"]), 32)
        self.assertEqual(len(reconcile.TWDB_GAM_BY_PACKAGE), 32)
        self.assertEqual(len(reconcile.TWDB_GAM_TEMPORAL_MANIFEST["archives"]), 32)
        self.assertEqual(
            set(reconcile.TWDB_GAM_TEMPORAL_BY_PACKAGE),
            set(reconcile.TWDB_GAM_BY_PACKAGE),
        )
        self.assertTrue(all(item["variables"] for item in reconcile.TWDB_GAM_MANIFEST["archives"]))
        self.assertTrue(all(item["spatial_evidence_url"] for item in reconcile.TWDB_GAM_MANIFEST["archives"]))
        self.assertTrue(all(item["temporal_evidence_url"] for item in reconcile.TWDB_GAM_TEMPORAL_MANIFEST["archives"]))
        self.assertTrue(all(item["temporal_coverage_start"] <= item["temporal_coverage_end"] for item in reconcile.TWDB_GAM_TEMPORAL_MANIFEST["archives"]))

    def test_builds_exact_id_pinned_plan(self):
        plan = reconcile.build_plan(self.packages)
        self.assertEqual(plan["summary"], {
            "package_actions": 32,
            "resource_actions": 54,
            "archive_resources": 32,
            "spatial_packages": 32,
            "spatial_resources": 0,
            "metadata_packages": 32,
            "temporal_packages": 32,
            "needs_apply": 85,
            "already_applied": 1,
            "drift": 0,
        })
        self.assertEqual(len(plan["actions"]), 86)
        for entry in reconcile.TWDB_GAM_MANIFEST["archives"]:
            action = next(item for item in plan["actions"] if item["id"] == entry["primary_resource_id"])
            self.assertEqual(action["after"]["mint_standard_variables"], ", ".join(entry["variables"]))
            self.assertEqual(action["evidence"]["archive_url"], entry["archive_url"])
            temporal = reconcile.TWDB_GAM_TEMPORAL_BY_PACKAGE[entry["package_id"]]
            package_action = next(item for item in plan["actions"] if item["id"] == entry["package_id"])
            self.assertEqual(package_action["after"]["temporal_coverage_start"], temporal["temporal_coverage_start"])
            self.assertEqual(package_action["after"]["temporal_coverage_end"], temporal["temporal_coverage_end"])
            self.assertEqual(package_action["evidence"]["temporal"]["temporal_evidence_url"], temporal["temporal_evidence_url"])

    def test_subside_dataset_uses_existing_spatial_extra(self):
        entry = reconcile.TWDB_GAM_MANIFEST["archives"][0]
        target = self.packages[0]
        target["type"] = "subside_dataset"
        target["extras"] = [{"key": "spatial", "value": ""}]

        plan = reconcile.build_plan(self.packages)
        action = next(item for item in plan["actions"] if item["id"] == entry["package_id"])
        self.assertNotIn("spatial", action["after"])
        spatial_extra = next(item for item in action["after"]["extras"] if item["key"] == "spatial")
        expected = reconcile._canonical_spatial(reconcile._bbox_polygon(tuple(entry["spatial_bounds"])))
        self.assertEqual(spatial_extra["value"], expected)

    def test_plan_is_idempotent_after_values_are_applied(self):
        plan = reconcile.build_plan(self.packages)
        by_id = {item["id"]: item for item in self.packages}
        resources = {
            resource["id"]: resource
            for package_item in self.packages
            for resource in package_item["resources"]
        }
        for item in plan["actions"]:
            target = by_id[item["id"]] if item["action"] == "package_patch" else resources[item["id"]]
            target.update(item["after"])
        second = reconcile.build_plan(self.packages)
        self.assertEqual(second["summary"]["already_applied"], 86)
        self.assertEqual(second["summary"]["needs_apply"], 0)
        self.assertEqual(second["summary"]["drift"], 0)

    def test_unexpected_archive_svo_is_hard_failure(self):
        target = next(item for item in self.packages if item["id"] == reconcile.TWDB_GAM_MANIFEST["archives"][0]["package_id"])
        target["resources"][0]["mint_standard_variables"] = "unexpected_variable"
        with self.assertRaisesRegex(ValueError, "Drifted SVO value"):
            reconcile.build_plan(self.packages)

    def test_missing_target_is_a_hard_failure(self):
        self.packages.pop(0)
        with self.assertRaisesRegex(ValueError, "twdb-bzrv-model-archives"):
            reconcile.build_plan(self.packages)


if __name__ == "__main__":
    unittest.main()
