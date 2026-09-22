from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = (
    ROOT
    / "graphql_engine"
    / "migrations"
    / "1771300000020_complete_modflow6_input_contract"
)

CONFIGURATION_ID = "ce445698-1d76-4833-95e8-a12eb3da2488"
CANONICAL_INPUTS = (
    "wmobley-modflow-6-simulation-archive",
    "modflow6_input_wel",
    "modflow6_input_rch",
)
REMOVED_INPUTS = (
    "modflow6_input_simulation-archive",
    "03621b4b-0888-4b64-b963-17fa310130d8",
    "bf0761eb-2187-42df-a457-174a4af418a5",
    "modflow6_input_rcha",
    "modflow6_input_rcha-02",
    "modflow6_input_rcha-03",
)


def test_migration_is_scoped_to_the_canonical_modflow6_configuration():
    up = (MIGRATION / "up.sql").read_text()

    assert CONFIGURATION_ID in up
    assert "DELETE FROM public.modelcatalog_configuration_input" in up
    assert "AND input_id IN" in up
    assert "WHERE label" not in up
    assert "configuration_id =" in up
    assert "JOIN public.modelcatalog_configuration" in up
    assert "JOIN public.modelcatalog_dataset_specification" in up


def test_migration_keeps_the_three_input_contract_with_expected_optionality():
    up = (MIGRATION / "up.sql").read_text()

    for input_id in CANONICAL_INPUTS:
        assert input_id in up

    assert "wmobley-modflow-6-simulation-archive',\n    FALSE" in up
    assert "modflow6_input_wel',\n    TRUE" in up
    assert "modflow6_input_rch',\n    TRUE" in up

    for input_id in REMOVED_INPUTS:
        assert input_id in up


def test_down_migration_restores_only_the_removed_relationships():
    down = (MIGRATION / "down.sql").read_text()

    for input_id in REMOVED_INPUTS:
        assert input_id in down

    assert "ON CONFLICT (configuration_id, input_id) DO UPDATE" in down
    assert "wmobley-modflow-6-simulation-archive" not in down
