from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = (
    ROOT
    / "graphql_engine"
    / "migrations"
    / "1771300000022_normalize_modflow6_tapis_component"
)

CONFIGURATION_ID = "https://w3id.org/okn/i/mint/ce445698-1d76-4833-95e8-a12eb3da2488"
OLD_COMPONENT = "https://portals.tapis.io/v3/apps/modflow6-simulation/0.0.fb606ee"
NEW_COMPONENT = "https://portals.tapis.io/v3/apps/modflow6-simulation/0.0.febed09"


def test_up_updates_only_the_known_stale_modflow6_component():
    up = (MIGRATION / "up.sql").read_text()

    assert CONFIGURATION_ID in up
    assert OLD_COMPONENT in up
    assert NEW_COMPONENT in up
    assert "UPDATE public.modelcatalog_configuration" in up
    assert "WHERE id =" in up


def test_down_restores_the_previous_component_version():
    down = (MIGRATION / "down.sql").read_text()

    assert CONFIGURATION_ID in down
    assert OLD_COMPONENT in down
    assert NEW_COMPONENT in down
