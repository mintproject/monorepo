from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "graphql_engine" / "migrations" / "1771300000014_versioned_modflow_archive_svos"
FIXTURE = ROOT / "graphql_engine" / "fixtures" / "modelcatalog.sql"


class VersionedModflowArchiveContractTests(unittest.TestCase):
    labels = {
        "6": "groundwater_model_modflow6_simulation_archive",
        "2000": "groundwater_model_modflow2000_simulation_archive",
        "2005": "groundwater_model_modflow2005_simulation_archive",
        "96": "groundwater_model_modflow96_simulation_archive",
    }

    def test_migration_registers_all_versioned_labels(self):
        up = (MIGRATION / "up.sql").read_text()
        for version, label in self.labels.items():
            self.assertIn(f"'{label}'", up)
            self.assertIn(f"groundwater-model-modflow{version}-simulation-archive", up)

    def test_migration_updates_each_archive_presentation_without_removing_generic_svo(self):
        up = (MIGRATION / "up.sql").read_text()
        down = (MIGRATION / "down.sql").read_text()
        self.assertIn("wmobley-standard-variable-groundwater-model-simulation-archive", down)
        for version in self.labels:
            self.assertIn(f"wmobley-modflow-{version}-simulation-archive", up)

    def test_fixture_contains_the_same_versioned_contract(self):
        fixture = FIXTURE.read_text()
        for label in self.labels.values():
            self.assertIn(f"'{label}'", fixture)


if __name__ == "__main__":
    unittest.main()
