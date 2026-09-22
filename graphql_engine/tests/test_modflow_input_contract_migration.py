from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = (
    ROOT
    / "graphql_engine"
    / "migrations"
    / "1771300000009_normalize_modflow_input_contracts"
    / "up.sql"
)


def test_input_contract_migration_repairs_missing_legacy_parents():
    up = MIGRATION.read_text()

    for configuration_id in (
        "90a6c0c2-a43b-4717-adb0-3a5a02737dc9",
        "54a07d2a-c407-4f41-9c51-3245eabd2e61",
    ):
        assert configuration_id in up

    assert "INSERT INTO public.modelcatalog_configuration" in up
    assert "ON CONFLICT (id) DO NOTHING" in up
    assert "INSERT INTO public.modelcatalog_dataset_specification" in up
    assert "INSERT INTO public.modelcatalog_variable_presentation" in up
    assert "INSERT INTO public.modelcatalog_dataset_specification_presentation" in up
    assert "INSERT INTO public.modelcatalog_configuration_output" in up


def test_input_contract_migration_keeps_the_three_input_contracts():
    up = MIGRATION.read_text()

    for input_id in (
        "wmobley-modflow-2000-simulation-archive",
        "wmobley-modflow-2000-rch-override",
        "wmobley-modflow-2000-wel-override",
        "4cd57da2-9be9-440d-b6b4-5a4ca6edd370",
        "wmobley-modflow-96-rch-override",
        "wmobley-modflow-96-wel-override",
        "wmobley-modflow-2005-simulation-archive",
    ):
        assert input_id in up
