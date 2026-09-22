from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = (
    ROOT
    / "graphql_engine"
    / "migrations"
    / "1771300000021_modflow6_cbc_output_position"
)

OUTPUT_ID = "https://w3id.org/okn/i/mint/modflow6_cbc_output"


def test_migration_assigns_the_single_modflow6_output_position():
    up = (MIGRATION / "up.sql").read_text()

    assert OUTPUT_ID in up
    assert 'SET "position" = 1' in up
    assert 'AND "position" IS NULL' in up


def test_down_migration_only_reverts_the_position_repair():
    down = (MIGRATION / "down.sql").read_text()

    assert OUTPUT_ID in down
    assert 'SET "position" = NULL' in down
    assert 'AND "position" = 1' in down
