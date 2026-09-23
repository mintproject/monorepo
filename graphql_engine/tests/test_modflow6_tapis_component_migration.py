from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = (
    ROOT
    / "graphql_engine"
    / "migrations"
    / "1771300000022_normalize_modflow6_tapis_component"
)
CURRENT_MIGRATION = (
    ROOT
    / "graphql_engine"
    / "migrations"
    / "1771300000028_update_modflow6_tapis_component_version"
)

CONFIGURATION_ID = "https://w3id.org/okn/i/mint/ce445698-1d76-4833-95e8-a12eb3da2488"
OLD_COMPONENT = "https://portals.tapis.io/v3/apps/modflow6-simulation/0.0.fb606ee"
NEW_COMPONENT = "https://portals.tapis.io/v3/apps/modflow6-simulation/0.0.febed09"
CURRENT_COMPONENT = "https://portals.tapis.io/v3/apps/modflow6-simulation/0.0.ad59a69"


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


def test_current_migration_points_at_the_registered_corrected_app_version():
    up = (CURRENT_MIGRATION / "up.sql").read_text()

    assert CONFIGURATION_ID in up
    assert NEW_COMPONENT in up
    assert CURRENT_COMPONENT in up
    assert "UPDATE public.modelcatalog_configuration" in up
    assert "WHERE id =" in up


def test_current_migration_down_restores_the_previous_registered_version():
    down = (CURRENT_MIGRATION / "down.sql").read_text()

    assert CONFIGURATION_ID in down
    assert NEW_COMPONENT in down
    assert CURRENT_COMPONENT in down
