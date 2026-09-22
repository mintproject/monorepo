from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = (
    ROOT
    / "graphql_engine"
    / "migrations"
    / "1771300000018_modflow_2005_base_tapis_component"
)
FIXTURE = ROOT / "graphql_engine" / "fixtures" / "modelcatalog.sql"


def test_base_modflow_2005_configuration_uses_tapis_component_descriptor():
    up = (MIGRATION / "up.sql").read_text()
    fixture = FIXTURE.read_text()

    assert "modflow_2005_cfg" in up
    assert "https://tapis.tapis.io/v3/apps/modflow-2005/0.0.6" in up
    assert (
        "https://tapis.tapis.io/v3/apps/modflow-2005/0.0.6"
        in fixture
    )
    assert "SET has_component_location = 'https://github.com/" not in up
