from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "graphql_engine" / "migrations" / "1771300000027_remove_modflow6_default_dir"

CONFIGURATION_ID = "https://w3id.org/okn/i/mint/ce445698-1d76-4833-95e8-a12eb3da2488"
PARAMETER_ID = "https://w3id.org/okn/i/mint/0d8f8ea2-e7d7-4360-ba53-aa54f2c62b0c"


def test_up_removes_only_the_canonical_modflow6_default_directory_parameter():
    up = (MIGRATION / "up.sql").read_text()

    assert CONFIGURATION_ID in up
    assert PARAMETER_ID in up
    assert "DELETE FROM public.modelcatalog_configuration_parameter" in up
    assert "DELETE FROM public.modelcatalog_parameter" not in up
    assert "historical execution bindings" in up


def test_down_restores_the_legacy_parameter_and_relationship_idempotently():
    down = (MIGRATION / "down.sql").read_text()

    assert CONFIGURATION_ID in down
    assert PARAMETER_ID in down
    assert "INSERT INTO public.modelcatalog_configuration_parameter" in down
    assert "ON CONFLICT DO NOTHING" in down
